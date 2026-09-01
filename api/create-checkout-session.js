import { createCheckoutSession, getStripeClient } from '../lib/stripe/createCheckoutSession.js';
import {
  createFreeImplementationOrder,
  isFreeImplementationPlan,
} from '../lib/implementationOffer.js';
import { getLifetimeOfferState, publicLifetimeOfferView } from '../lib/stripe/lifetimeOffer.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';

export async function handleCreateCheckoutSession(req) {
  const { userId, successUrl, cancelUrl, planType } = req.body || {};
  const authorization = req.headers?.authorization || req.headers?.Authorization;

  if (isFreeImplementationPlan(planType)) {
    return createFreeImplementationOrder({ authorization, planType });
  }

  const result = await createCheckoutSession({
    stripe: getStripeClient(),
    userId,
    successUrl,
    cancelUrl,
    planType,
  });
  if (!result.ok) {
    return { status: result.status, body: { error: result.error } };
  }
  return { status: 200, body: { url: result.url } };
}

export async function handleGetLifetimeOffer() {
  try {
    const state = await getLifetimeOfferState(getSupabaseAdmin());
    return { status: 200, body: publicLifetimeOfferView(state) };
  } catch (e) {
    console.error('[lifetime-offer]', e);
    return { status: 500, body: { error: e.message || 'Nie udało się pobrać oferty Lifetime.' } };
  }
}

export async function handleConfirmPremium(req) {
  const stripe = getStripeClient();
  if (!stripe) {
    return { status: 503, body: { error: 'Stripe nie jest skonfigurowany.' } };
  }

  const sessionId = req.query?.session_id;
  if (!sessionId) {
    return { status: 400, body: { error: 'Brak session_id.' } };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return { status: 400, body: { error: 'Płatność nie została zakończona.' } };
    }
    const userId = session.client_reference_id || session.metadata?.userId || null;
    const planType = session.metadata?.planType || null;
    return { status: 200, body: { ok: true, userId, planType } };
  } catch (e) {
    console.error('Stripe confirm-premium:', e);
    return { status: 500, body: { error: e.message || 'Błąd weryfikacji sesji.' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const sessionId = req.query?.session_id;
      const { status, body } = sessionId
        ? await handleConfirmPremium(req)
        : await handleGetLifetimeOffer();
      return res.status(status).json(body);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { status, body } = await handleCreateCheckoutSession(req);
    return res.status(status).json(body);
  } catch (e) {
    console.error('Stripe create-checkout-session:', e);
    return res.status(500).json({ error: e.message || 'Błąd tworzenia sesji.' });
  }
}
