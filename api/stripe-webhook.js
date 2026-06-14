/**
 * Vercel serverless entry — flat /api/*.js path (same pattern as create-checkout-session.js).
 *
 * Stripe Dashboard URL: https://<your-domain>/api/stripe/webhook
 * vercel.json rewrites that path → this function (/api/stripe-webhook).
 */
import { handleStripeWebhook, readStripeWebhookBody } from '../lib/stripe/webhookCore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await readStripeWebhookBody(req);
  const result = await handleStripeWebhook({
    rawBody,
    signature: req.headers['stripe-signature'],
  });

  return res.status(result.status).json(result.body);
}
