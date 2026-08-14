import { createCheckoutSession, getStripeClient } from '../lib/stripe/createCheckoutSession.js';
import {
  createFreeImplementationOrder,
  isFreeImplementationPlan,
} from '../lib/implementationOffer.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { status, body } = await handleCreateCheckoutSession(req);
    return res.status(status).json(body);
  } catch (e) {
    console.error('Stripe create-checkout-session:', e);
    return res.status(500).json({ error: e.message || 'Błąd tworzenia sesji.' });
  }
}
