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
 * Core Stripe webhook processor (shared by Express + Vercel).
 *
 * Flow:
 * 1. Verify Stripe-Signature with raw body + STRIPE_WEBHOOK_SECRET
 * 2. Dispatch by event.type
 * 3. Update Supabase profiles via service role
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
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return { status: 400, body: { error: `Webhook signature verification failed: ${err.message}` } };
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session, stripe);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionChange(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      default:
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

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Resolve raw body for Stripe signature verification (never use parsed JSON). */
export async function readStripeWebhookBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body;
  return readRawBody(req);
}
