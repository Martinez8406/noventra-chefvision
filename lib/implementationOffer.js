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

export const IMPLEMENTATION_BUNDLE_PLAN = 'implementation_bundle';

const ACTIVE_STATUSES = ['pending', 'paid', 'in_progress'];
const inFlight = new Set();

export function isFreeImplementationPlan(planType) {
  if (planType === IMPLEMENTATION_BUNDLE_PLAN) {
    return IMPLEMENTATION_OFFERS.menu_service.free && IMPLEMENTATION_OFFERS.flyer_service.free;
  }
  return Boolean(IMPLEMENTATION_OFFERS[planType]?.free);
}

function planKeysFor(planType) {
  if (planType === IMPLEMENTATION_BUNDLE_PLAN) return ['menu_service', 'flyer_service'];
  if (IMPLEMENTATION_OFFERS[planType]) return [planType];
  return [];
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

async function findActiveOrder(admin, table, userId) {
  const { data, error } = await admin
    .from(table)
    .select('id')
    .eq('client_user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .limit(1)
    .maybeSingle();
  return { data, error };
}

async function insertOfferRow(admin, offer, userId) {
  const fullRow = {
    client_user_id: userId,
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
        client_user_id: userId,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .select('id, status, created_at')
      .maybeSingle());
  }

  return { inserted, insertError };
}

export async function createFreeImplementationOrdersForUser({
  userId,
  email,
  planType = IMPLEMENTATION_BUNDLE_PLAN,
  deps = {},
} = {}) {
  if (!userId) {
    return { status: 400, body: { error: 'Brak użytkownika.' } };
  }
  return createFreeImplementationOrder({
    authorization: 'Bearer internal',
    planType,
    deps: {
      ...deps,
      verifyToken: async () => ({ id: userId, email: email || '' }),
    },
  });
}

export async function createFreeImplementationOrder({
  authorization,
  planType,
  deps = {},
} = {}) {
  const keys = planKeysFor(planType);
  if (!keys.length || keys.some((key) => !IMPLEMENTATION_OFFERS[key]?.free)) {
    return { status: 400, body: { error: 'Ta usługa nie jest ofertą wdrożeniową.' } };
  }

  const verifyToken = deps.verifyToken || defaultVerifyToken;
  const user = await verifyToken(authorization);
  if (!user) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const lockKey = `${user.id}:${planType === IMPLEMENTATION_BUNDLE_PLAN ? 'bundle' : planType}`;
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

    const created = [];
    const createdIds = {};

    for (const key of keys) {
      const offer = IMPLEMENTATION_OFFERS[key];
      const { data: existing, error: existingError } = await findActiveOrder(admin, offer.table, user.id);
      if (existingError) {
        console.error('[implementation-offer] duplicate check failed', existingError.message);
        return { status: 500, body: { error: 'Nie udało się sprawdzić zlecenia.' } };
      }
      if (existing?.id) continue;

      const { inserted, insertError } = await insertOfferRow(admin, offer, user.id);
      if (insertError) {
        console.error('[implementation-offer] insert failed', insertError.message);
        if (created.length === 0) {
          return { status: 500, body: { error: 'Nie udało się zapisać zlecenia.' } };
        }
        break;
      }
      created.push(key);
      createdIds[key] = inserted?.id ?? null;
    }

    if (created.length === 0) {
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

    const kind =
      created.length > 1 ? 'bundle' : IMPLEMENTATION_OFFERS[created[0]].kind;
    const sendDiscord = deps.sendDiscord || sendDiscordNotification;
    try {
      const discordResult = await sendDiscord(
        buildImplementationOfferMessage({
          kind,
          email,
          restaurantName,
        }),
      );
      if (!discordResult?.ok) {
        console.error('[implementation-offer] Discord failed after save', {
          userId: user.id,
          planType,
          created,
          reason: discordResult?.reason || discordResult?.status || discordResult?.error,
        });
      }
    } catch (err) {
      console.error('[implementation-offer] Discord error after save', {
        userId: user.id,
        planType,
        created,
        error: err,
      });
    }

    const primary = IMPLEMENTATION_OFFERS[created[0]];
    return {
      status: 200,
      body: {
        ok: true,
        free: true,
        orderId: createdIds[created[0]] ?? null,
        created,
        serviceType: planType === IMPLEMENTATION_BUNDLE_PLAN ? 'implementation_bundle' : primary.serviceType,
        payment_status: 'free',
        status: 'pending',
      },
    };
  } finally {
    inFlight.delete(lockKey);
  }
}
