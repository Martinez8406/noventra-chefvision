import Stripe from 'stripe';
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionChange,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from './subscriptionHandlers.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2024-11-20.acacia' })
  : null;

/**
 * Core Stripe webhook processor.
 *
 * Flow:
 * 1. Verify Stripe-Signature with raw body + STRIPE_WEBHOOK_SECRET
 * 2. Dispatch by event.type
 * 3. Update Supabase profiles (plan, tokens, Stripe IDs) via service role
 *
 * @param {{ rawBody: Buffer|string, signature: string|undefined }} input
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleStripeWebhook({ rawBody, signature }) {
  if (!stripe || !webhookSecret) {
    return {
      status: 503,
      body: { error: 'Stripe webhook is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).' },
    };
  }

  if (!signature) {
    return { status: 400, body: { error: 'Missing Stripe-Signature header.' } };
  }

  const payload =
    typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : '';

  if (!payload) {
    return { status: 400, body: { error: 'Empty request body.' } };
  }

  let event;
  try {
    // Must use raw body — JSON parsing before verify breaks signature check (Stripe best practice).
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return { status: 400, body: { error: `Webhook signature verification failed: ${err.message}` } };
  }

  try {
    switch (event.type) {
      // User completed Stripe Checkout — link customer + activate subscription.
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session, stripe);
        break;
      }

      // New or changed subscription (renewal, plan change, status).
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionChange(subscription);
        break;
      }

      // Subscription fully removed — revert to free plan (menu stays live).
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      // Payment failed — record for support; downgrade happens on subscription.deleted.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        // Unhandled events are acknowledged so Stripe does not retry indefinitely.
        console.log('[stripe-webhook] unhandled event type:', event.type);
    }

    return { status: 200, body: { received: true } };
  } catch (err) {
    console.error('[stripe-webhook] handler error:', event.type, err);
    return {
      status: 500,
      body: { error: err.message || 'Webhook handler failed.' },
    };
  }
}

/**
 * Vercel / serverless entry — disable default body parser and read raw stream.
 * Export config for Vercel (same pattern as Next.js API routes).
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Vercel serverless default export */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody;
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body;
  } else if (typeof req.body === 'string') {
    rawBody = req.body;
  } else {
    rawBody = await readRawBody(req);
  }

  const result = await handleStripeWebhook({
    rawBody,
    signature: req.headers['stripe-signature'],
  });

  return res.status(result.status).json(result.body);
}
