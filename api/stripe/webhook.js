/**
 * Shared exports for local Express (server/index.js).
 * Production webhook: api/stripe-webhook.js + vercel.json rewrite → /api/stripe/webhook
 */
export { handleStripeWebhook, readStripeWebhookBody } from './webhookCore.js';
