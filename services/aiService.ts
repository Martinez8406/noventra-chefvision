import { GeneratorParams } from '../types';
import { supabase } from './supabaseService';

export interface GenerationResult {
  image: string;
  creditsRemaining?: number;
  generationsUsed?: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!supabase) {
    console.debug('[getAuthHeaders] Supabase not configured – no token attached.');
    return headers;
  }

  // Step 1: validate token with Supabase server — this auto-refreshes expired tokens
  const { error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.debug('[getAuthHeaders] getUser() error:', userError.message);
  }

  // Step 2: read the (now-fresh) session from local storage
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    console.debug('[getAuthHeaders] Token attached for:', session.user?.email);
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    console.debug('[getAuthHeaders] No valid session – request will be sent without token.');
  }

  return headers;
}

export interface AiDishSettings {
  dishName: string;
  styleLabel: string;
  lightingLabel: string;
  plateLabel: string;
  angleLabel: string;
  hasCustomBackdrop: boolean;
  hasCustomTableware: boolean;
}

/**
 * Generates a dish image by calling the secure server-side API route.
 * The Gemini API key never leaves the server.
 */
export async function generateDishImageWithAI(
  _params: GeneratorParams,
  settings: AiDishSettings,
  options?: {
    backdropImage?: string;
    tablewareImage?: string;
    dishReferenceImage?: string;
    ingredientsHint?: string;
  }
): Promise<GenerationResult> {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      type: 'dish',
      aiSettings: settings,
      images: {
        backdrop:      options?.backdropImage      ?? null,
        tableware:     options?.tablewareImage     ?? null,
        dishReference: options?.dishReferenceImage ?? null,
      },
      ingredientsHint: options?.ingredientsHint ?? null,
    }),
  });

  const raw = await response.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const hint =
      response.status === 502 || response.status === 503 || response.status === 504
        ? ' Serwer API Chef Vision (domyślnie port 3002, STRIPE_API_PORT) prawdopodobnie nie działa — uruchom `npm run dev` (Vite + backend), nie samo `vite`.'
        : response.status === 404
          ? ' Endpoint /api nie istnieje — w trybie dev potrzebny jest backend Chef Vision (proxy na STRIPE_API_PORT / 3002); `vite preview` sam z siebie nie obsługuje /api.'
          : '';
    throw new Error(
      `Nieprawidłowa odpowiedź serwera (HTTP ${response.status}).${hint}`
    );
  }

  if (!response.ok) {
    const msg = data?.error || 'Błąd generacji AI.';
    if (msg === 'API_KEY_REQUIRED') throw new Error('API_KEY_REQUIRED');
    throw new Error(msg);
  }

  if (!data.image) throw new Error('Brak danych obrazu w odpowiedzi serwera.');
  return {
    image:            data.image,
    creditsRemaining: data.creditsRemaining,
    generationsUsed:  data.generationsUsed,
  };
}
