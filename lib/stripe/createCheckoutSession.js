import Stripe from 'stripe';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  LIFETIME_PLAN_TYPE,
  attachLifetimeCheckoutSession,
  expectedLifetimeUnitAmount,
  expireLifetimeReservation,
  reserveLifetimeCheckout,
} from './lifetimeOffer.js';

const PRICE_BY_PLAN = {
  premium: process.env.STRIPE_PRICE_ID,
  start: process.env.STRIPE_START_PRICE_ID,
  tokens: process.env.STRIPE_TOKEN_PACK_PRICE_ID,
  menu_service: process.env.STRIPE_MENU_SERVICE_PRICE_ID,
  flyer_service: process.env.STRIPE_FLYER_SERVICE_PRICE_ID,
};

const ONE_TIME_PLANS = new Set(['tokens', 'menu_service', 'flyer_service', LIFETIME_PLAN_TYPE]);

const INVOICE_DESCRIPTION = {
  tokens: 'Paczka +50 tokenów AI ChefVision',
  menu_service: 'Wykonanie menu cyfrowego ChefVision',
  flyer_service: 'Ulotka QR ChefVision',
  [LIFETIME_PLAN_TYPE]: 'ChefVision Founder Lifetime — dostęp jednorazowy',
};

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000';
}

async function createOneTimeCheckoutSession(stripe, { priceId, metadata, sessionBase, planType }) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_creation: 'always',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: INVOICE_DESCRIPTION[planType] || 'Zakup ChefVision',
        metadata,
        footer: 'Dziękujemy za zakup. ChefVision — profesjonalna wizualizacja dań.',
      },
    },
    ...sessionBase,
  });
  return session;
}

async function createLifetimeCheckoutSession(stripe, { userId, successUrl, cancelUrl, baseUrl }) {
  const supabase = getSupabaseAdmin();
  const reservation = await reserveLifetimeCheckout({ supabase, userId });
  if (!reservation.ok) {
    return { ok: false, status: reservation.status, error: reservation.error };
  }

  const expectedAmount = expectedLifetimeUnitAmount(reservation.tier);
  try {
    const stripePrice = await stripe.prices.retrieve(reservation.priceId);
    if (
      stripePrice.unit_amount !== expectedAmount ||
      String(stripePrice.currency).toLowerCase() !== 'pln'
    ) {
      await expireLifetimeReservation(supabase, { purchaseId: reservation.purchaseId });
      return {
        ok: false,
        status: 503,
        error: `Niewłaściwa cena Stripe dla puli ${reservation.tier} zł. Sprawdź STRIPE_LIFETIME_PRICE_ID_${reservation.tier}.`,
      };
    }
  } catch (e) {
    await expireLifetimeReservation(supabase, { purchaseId: reservation.purchaseId });
    throw e;
  }

  const metadata = {
    userId,
    planType: LIFETIME_PLAN_TYPE,
    lifetimeTier: reservation.tier,
    lifetimePricePln: String(reservation.pricePln),
    lifetimeSlot: String(reservation.slotNumber),
  };
  const sessionBase = {
    success_url: successUrl || `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/#/cennik`,
    client_reference_id: userId,
    metadata,
  };

  try {
    const session = await createOneTimeCheckoutSession(stripe, {
      priceId: reservation.priceId,
      metadata,
      sessionBase,
      planType: LIFETIME_PLAN_TYPE,
    });
    await attachLifetimeCheckoutSession(supabase, reservation.purchaseId, session.id);
    return { ok: true, status: 200, url: session.url };
  } catch (e) {
    await expireLifetimeReservation(supabase, { purchaseId: reservation.purchaseId });
    throw e;
  }
}

/**
 * Tworzy sesję Stripe Checkout dla premium | start | tokens | menu_service | flyer_service | founder_lifetime.
 * Cena Lifetime jest zawsze ustalana po stronie serwera — body nie może jej nadpisać.
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

  const allowed = new Set([
    'premium',
    'start',
    'tokens',
    'menu_service',
    'flyer_service',
    LIFETIME_PLAN_TYPE,
  ]);
  const normalizedPlan = allowed.has(planType) ? planType : 'premium';
  const baseUrl = getBaseUrl();

  if (normalizedPlan === LIFETIME_PLAN_TYPE) {
    return createLifetimeCheckoutSession(stripe, { userId, successUrl, cancelUrl, baseUrl });
  }

  const priceId = PRICE_BY_PLAN[normalizedPlan];

  if (!priceId) {
    const envHint =
      normalizedPlan === 'premium'
        ? 'STRIPE_PRICE_ID'
        : normalizedPlan === 'start'
          ? 'STRIPE_START_PRICE_ID'
          : normalizedPlan === 'tokens'
            ? 'STRIPE_TOKEN_PACK_PRICE_ID'
            : normalizedPlan === 'flyer_service'
              ? 'STRIPE_FLYER_SERVICE_PRICE_ID'
              : 'STRIPE_MENU_SERVICE_PRICE_ID';
    return { ok: false, status: 503, error: `Brak ${envHint} w konfiguracji serwera.` };
  }

  const metadata = userId ? { userId, planType: normalizedPlan } : { planType: normalizedPlan };
  const sessionBase = {
    success_url: successUrl || `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/#/cennik`,
    client_reference_id: userId || undefined,
    metadata,
  };

  if (ONE_TIME_PLANS.has(normalizedPlan)) {
    const session = await createOneTimeCheckoutSession(stripe, {
      priceId,
      metadata,
      sessionBase,
      planType: normalizedPlan,
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
