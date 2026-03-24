import { GeneratorParams, BlurLevel } from "../types";
import { supabase } from './supabaseService';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

/**
 * Legacy dish generator (used by DishGenerator.tsx).
 * Calls the secure server-side API route – no Gemini key in the browser.
 */
export const generateDishImage = async (params: GeneratorParams, plateImage?: string): Promise<string> => {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      type: 'dish',
      aiSettings: {
        dishName:          params.dishName,
        styleLabel:        params.style,
        lightingLabel:     params.lighting,
        plateLabel:        params.plateType,
        angleLabel:        params.cameraAngle,
        hasCustomBackdrop: !!plateImage,
        hasCustomTableware: false,
      },
      images: {
        backdrop: plateImage ?? null,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error || 'Błąd generacji AI.';
    if (msg === 'API_KEY_REQUIRED') throw new Error('API_KEY_REQUIRED');
    throw new Error(msg);
  }
  if (!data.image) throw new Error('Brak danych obrazu w odpowiedzi serwera.');
  return data.image;
};

/**
 * Backdrop processor (used by BackdropLab.tsx).
 * Calls the secure server-side API route – no Gemini key in the browser.
 */
export const processBackdropImage = async (base64Image: string, level: BlurLevel): Promise<string> => {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      type: 'backdrop',
      images: { source: base64Image },
      blurLevel: level,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Błąd przetwarzania tła.');
  if (!data.image) throw new Error('Brak przetworzonego obrazu.');
  if (level === BlurLevel.NATURAL) return data.image;
  return applyCanvasBlur(data.image, level);
};

async function applyCanvasBlur(dataUrl: string, level: BlurLevel): Promise<string> {
  const blurPx = level === BlurLevel.FINE_DINING ? 8 : 3; // wyraźna różnica między trybami

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));

      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Nie można załadować obrazu po przetwarzaniu.'));
    img.src = dataUrl;
  });
}
