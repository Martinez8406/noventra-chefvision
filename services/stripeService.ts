import { supabase } from './supabaseService';

const API_BASE = '';

export type CheckoutPlanType =
  | 'premium'
  | 'start'
  | 'tokens'
  | 'menu_service'
  | 'flyer_service'
  | 'implementation_bundle'
  | 'founder_lifetime';

export interface LifetimeOfferState {
  soldOut: boolean;
  pricePln: number | null;
  tier: '599' | '799' | 'sold_out' | string;
  badge: string;
  nextTierNote: string | null;
  buttonLabel: string;
}

export async function fetchLifetimeOffer(): Promise<LifetimeOfferState> {
  const res = await fetch(`${API_BASE}/api/lifetime-offer`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Nie udało się pobrać oferty Lifetime.');
  }
  return {
    soldOut: data.soldOut === true,
    pricePln: typeof data.pricePln === 'number' ? data.pricePln : data.soldOut ? null : 599,
    tier: typeof data.tier === 'string' ? data.tier : '599',
    badge: typeof data.badge === 'string' ? data.badge : 'Tylko 10 kont w tej cenie',
    nextTierNote: typeof data.nextTierNote === 'string' ? data.nextTierNote : null,
    buttonLabel: typeof data.buttonLabel === 'string' ? data.buttonLabel : 'Kupuję',
  };
}

export interface CreateCheckoutOptions {
  userId?: string;
  successUrl?: string;
  cancelUrl?: string;
  planType?: CheckoutPlanType;
}

/**
 * Tworzy sesję Stripe Checkout i przekierowuje użytkownika do płatności.
 * successUrl domyślnie: http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}
 */
export async function createCheckoutSession(options: CreateCheckoutOptions = {}): Promise<void> {
  const successUrl = options.successUrl ?? `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = options.cancelUrl ?? window.location.origin;

  let accessToken: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: options.userId ?? null,
      successUrl,
      cancelUrl,
      planType: options.planType ?? 'premium',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    throw new Error(typeof data.error === 'string' ? data.error : 'To zlecenie zostało już wysłane.');
  }
  if (res.status === 401) {
    throw new Error('Musisz być zalogowany, aby złożyć zlecenie.');
  }
  if (!res.ok) {
    throw new Error(data.error || `Błąd API (${res.status})`);
  }

  if (data.free === true) {
    return;
  }

  if (!data.url) throw new Error('Brak URL sesji Stripe.');
  window.location.href = data.url;
}

/**
 * Weryfikuje sesję Stripe po powrocie z płatności. Zwraca userId do ustawienia Premium (po stronie klienta).
 */
export async function confirmPremiumSession(
  sessionId: string,
): Promise<{ ok: boolean; userId: string | null; planType: string | null }> {
  const res = await fetch(`${API_BASE}/api/confirm-premium?session_id=${encodeURIComponent(sessionId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Błąd weryfikacji płatności.');
  return {
    ok: data.ok === true,
    userId: data.userId ?? null,
    planType: typeof data.planType === 'string' ? data.planType : null,
  };
}

/** Stripe Customer Portal — faktury, karta, anulowanie subskrypcji. */
export async function createBillingPortalSession(options: {
  userId: string;
  returnUrl?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/create-billing-portal-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: options.userId,
      returnUrl: options.returnUrl ?? window.location.origin,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Błąd API (${res.status})`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('Brak URL portalu Stripe.');
  window.location.href = data.url;
}
