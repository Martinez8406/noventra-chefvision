import Stripe from 'stripe';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { CHECKOUT_PRICE_SPEC } from '../pricingCatalog.js';
import {
  LIFETIME_PLAN_TYPE,
  attachLifetimeCheckoutSession,
  expectedLifetimeUnitAmount,
  expireLifetimeReservation,
  reserveLifetimeCheckout,
} from './lifetimeOffer.js';

const PRICE_ENV_BY_PLAN = {
  premium: 'STRIPE_PRICE_ID',
  start: 'STRIPE_START_PRICE_ID',
  start_annual: 'STRIPE_START_ANNUAL_PRICE_ID',
  annual: 'STRIPE_ANNUAL_PRICE_ID',
  tokens: 'STRIPE_TOKEN_PACK_PRICE_ID',
  menu_service: 'STRIPE_MENU_SERVICE_PRICE_ID',
  flyer_service: 'STRIPE_FLYER_SERVICE_PRICE_ID',
};

/** Kwoty z aktualnego cennika — checkout nie może użyć starego price_id. */

function configuredPriceId(planType) {
  const envKey = PRICE_ENV_BY_PLAN[planType];
  return envKey ? process.env[envKey]?.trim() || '' : '';
}

function priceMatchesSpec(price, spec) {
  if (price?.active === false) return false;
  if (price?.unit_amount !== spec.amount) return false;
  if (String(price?.currency || '').toLowerCase() !== 'pln') return false;
  if (!spec.interval) return !price?.recurring;
  return price?.recurring?.interval === spec.interval;
}

async function resolveCheckoutPriceId(stripe, planType) {
  const configured = configuredPriceId(planType);
  const spec = CHECKOUT_PRICE_SPEC[planType];
  if (!spec) return configured || null;
  if (!configured) return null;

  let current;
  try {
    current = await stripe.prices.retrieve(configured);
  } catch (err) {
    console.warn(`[checkout] nie udało się pobrać ${PRICE_ENV_BY_PLAN[planType]}:`, err?.message || err);
    return configured;
  }
  if (priceMatchesSpec(current, spec)) return current.id;

  const productId = typeof current.product === 'string' ? current.product : current.product?.id;
  if (!productId) return null;

  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = listed.data.find((price) => priceMatchesSpec(price, spec));
  if (match) {
    console.warn(
      `[checkout] ${PRICE_ENV_BY_PLAN[planType]} ma ${current.unit_amount} groszy — używam ${match.id} (${spec.amount} groszy / ${spec.interval || 'jednorazowo'}).`,
    );
    return match.id;
  }

  console.error(
    `[checkout] ${PRICE_ENV_BY_PLAN[planType]}=${configured} ma ${current.unit_amount} groszy, oczekiwane ${spec.amount}. Brak ceny zgodnej z cennikiem.`,
  );
  return null;
}

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
 * Tworzy sesję Stripe Checkout dla premium | start | start_annual | annual | tokens | menu_service | flyer_service.
 * Oferta Founder Lifetime jest wyłączona — nowe zakupy Lifetime są odrzucane.
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

  if (planType === LIFETIME_PLAN_TYPE) {
    return { ok: false, status: 410, error: 'Oferta Founder Lifetime nie jest już dostępna.' };
  }

  const allowed = new Set([
    'premium',
    'start',
    'start_annual',
    'annual',
    'tokens',
    'menu_service',
    'flyer_service',
  ]);
  const normalizedPlan = allowed.has(planType) ? planType : 'premium';
  const baseUrl = getBaseUrl();

  const priceId = await resolveCheckoutPriceId(stripe, normalizedPlan);

  if (!priceId) {
    const envHint = PRICE_ENV_BY_PLAN[normalizedPlan] || 'STRIPE_PRICE_ID';
    return {
      ok: false,
      status: 503,
      error: `Cena ${envHint} nie zgadza się z cennikiem albo brakuje jej w konfiguracji.`,
    };
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
