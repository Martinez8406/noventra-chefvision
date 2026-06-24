import Stripe from 'stripe';

const PRICE_BY_PLAN = {
  premium: process.env.STRIPE_PRICE_ID,
  start: process.env.STRIPE_START_PRICE_ID,
  tokens: process.env.STRIPE_TOKEN_PACK_PRICE_ID,
};

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000';
}

/**
 * Tworzy sesję Stripe Checkout dla planu premium | start | tokens.
 */
export async function createCheckoutSession({
  stripe,
  userId,
  successUrl,
  cancelUrl,
  planType = 'premium',
}) {
  if (!stripe) {
    return { ok: false, status: 503, error: 'Stripe nie jest skonfigurowany.' };
  }

  const normalizedPlan = planType === 'start' || planType === 'tokens' ? planType : 'premium';
  const priceId = PRICE_BY_PLAN[normalizedPlan];
  const baseUrl = getBaseUrl();

  if (!priceId) {
    const envHint =
      normalizedPlan === 'premium'
        ? 'STRIPE_PRICE_ID'
        : normalizedPlan === 'start'
          ? 'STRIPE_START_PRICE_ID'
          : 'STRIPE_TOKEN_PACK_PRICE_ID';
    return { ok: false, status: 503, error: `Brak ${envHint} w konfiguracji serwera.` };
  }

  const metadata = userId ? { userId, planType: normalizedPlan } : { planType: normalizedPlan };
  const sessionBase = {
    success_url: successUrl || `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/#/cennik`,
    client_reference_id: userId || undefined,
    metadata,
  };

  if (normalizedPlan === 'tokens') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      ...sessionBase,
    });
    return { ok: true, status: 200, url: session.url };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata },
    ...sessionBase,
  });
  return { ok: true, status: 200, url: session.url };
}

export function getStripeClient() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, { apiVersion: '2024-11-20.acacia' });
}
