import { createCheckoutSession, getStripeClient } from '../lib/stripe/createCheckoutSession.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, successUrl, cancelUrl, planType } = req.body || {};
    const result = await createCheckoutSession({
      stripe: getStripeClient(),
      userId,
      successUrl,
      cancelUrl,
      planType,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ url: result.url });
  } catch (e) {
    console.error('Stripe create-checkout-session:', e);
    return res.status(500).json({ error: e.message || 'Błąd tworzenia sesji.' });
  }
}
