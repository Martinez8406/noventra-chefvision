const API_BASE = '';

export interface CreateCheckoutOptions {
  userId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Tworzy sesję Stripe Checkout i przekierowuje użytkownika do płatności.
 * successUrl domyślnie: http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}
 */
export async function createCheckoutSession(options: CreateCheckoutOptions = {}): Promise<void> {
  const successUrl = options.successUrl ?? `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = options.cancelUrl ?? window.location.origin;

  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: options.userId ?? null,
      successUrl,
      cancelUrl,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Błąd API (${res.status})`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('Brak URL sesji Stripe.');
  window.location.href = data.url;
}

/**
 * Weryfikuje sesję Stripe po powrocie z płatności. Zwraca userId do ustawienia Premium (po stronie klienta).
 */
export async function confirmPremiumSession(sessionId: string): Promise<{ ok: boolean; userId: string | null }> {
  const res = await fetch(`${API_BASE}/api/confirm-premium?session_id=${encodeURIComponent(sessionId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Błąd weryfikacji płatności.');
  return { ok: data.ok === true, userId: data.userId ?? null };
}
