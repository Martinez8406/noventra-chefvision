import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';
import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import { buildImplementationOfferMessage, sendDiscordNotification } from './discord.js';

/**
 * Oferta wdrożeniowa 0 zł. Gdy `free: false`, /api/create-checkout-session
 * wraca do Stripe (299 / 149 zł) — bez zmiany webhooków.
 */
export const IMPLEMENTATION_OFFERS = {
  menu_service: {
    free: true,
    table: 'menu_service_orders',
    serviceType: 'menu_creation',
    kind: 'menu',
    price: 0,
    paidPrice: 299,
    currency: 'PLN',
  },
  flyer_service: {
    free: true,
    table: 'flyer_service_orders',
    serviceType: 'qr_flyer',
    kind: 'flyer',
    price: 0,
    paidPrice: 149,
    currency: 'PLN',
  },
};

const ACTIVE_STATUSES = ['pending', 'paid', 'in_progress'];
const inFlight = new Set();

export function isFreeImplementationPlan(planType) {
  return Boolean(IMPLEMENTATION_OFFERS[planType]?.free);
}

async function defaultVerifyToken(authHeader) {
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
  if (!token) return null;

  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) return null;

  const client = createClient(url, key);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function alreadySentResponse() {
  return {
    status: 409,
    body: { error: 'To zlecenie zostało już wysłane.', code: 'already_sent' },
  };
}

export async function createFreeImplementationOrder({
  authorization,
  planType,
  deps = {},
} = {}) {
  const offer = IMPLEMENTATION_OFFERS[planType];
  if (!offer?.free) {
    return { status: 400, body: { error: 'Ta usługa nie jest ofertą wdrożeniową.' } };
  }

  const verifyToken = deps.verifyToken || defaultVerifyToken;
  const user = await verifyToken(authorization);
  if (!user) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const lockKey = `${user.id}:${planType}`;
  if (inFlight.has(lockKey)) {
    return alreadySentResponse();
  }
  inFlight.add(lockKey);

  try {
    const getAdmin = deps.getAdmin || getSupabaseAdmin;
    const admin = getAdmin();
    if (!admin) {
      return { status: 503, body: { error: 'Serwer nie jest skonfigurowany.' } };
    }

    const { data: existing, error: existingError } = await admin
      .from(offer.table)
      .select('id')
      .eq('client_user_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('[implementation-offer] duplicate check failed', existingError.message);
      return { status: 500, body: { error: 'Nie udało się sprawdzić zlecenia.' } };
    }
    if (existing?.id) {
      return alreadySentResponse();
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('email, restaurant_name')
      .eq('id', user.id)
      .maybeSingle();

    const email = user.email?.trim() || profile?.email?.trim() || 'unknown';
    const restaurantName =
      typeof profile?.restaurant_name === 'string' && profile.restaurant_name.trim()
        ? profile.restaurant_name.trim()
        : null;

    const fullRow = {
      client_user_id: user.id,
      status: 'pending',
      payment_status: 'free',
      price: offer.price,
      currency: offer.currency,
    };

    let inserted = null;
    let insertError = null;
    ({ data: inserted, error: insertError } = await admin
      .from(offer.table)
      .insert(fullRow)
      .select('id, status, payment_status, price, currency, created_at')
      .maybeSingle());

    if (insertError) {
      console.warn('[implementation-offer] insert with offer columns failed, retrying minimal row', insertError.message);
      ({ data: inserted, error: insertError } = await admin
        .from(offer.table)
        .insert({
          client_user_id: user.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .select('id, status, created_at')
        .maybeSingle());
    }

    if (insertError) {
      console.error('[implementation-offer] insert failed', insertError.message);
      return { status: 500, body: { error: 'Nie udało się zapisać zlecenia.' } };
    }

    const sendDiscord = deps.sendDiscord || sendDiscordNotification;
    try {
      const discordResult = await sendDiscord(
        buildImplementationOfferMessage({
          kind: offer.kind,
          email,
          restaurantName,
        }),
      );
      if (!discordResult?.ok) {
        console.error('[implementation-offer] Discord failed after save', {
          userId: user.id,
          planType,
          orderId: inserted?.id,
          reason: discordResult?.reason || discordResult?.status || discordResult?.error,
        });
      }
    } catch (err) {
      console.error('[implementation-offer] Discord error after save', {
        userId: user.id,
        planType,
        orderId: inserted?.id,
        error: err,
      });
    }

    return {
      status: 200,
      body: {
        ok: true,
        free: true,
        orderId: inserted?.id ?? null,
        serviceType: offer.serviceType,
        payment_status: 'free',
        status: inserted?.status || 'pending',
      },
    };
  } finally {
    inFlight.delete(lockKey);
  }
}
