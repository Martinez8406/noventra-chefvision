import { getSupabaseAdmin } from './supabaseAdmin.js';
import { isLifetimeProfile, LIFETIME_STRIPE_SENTINEL } from '../../utils/tokens.js';

export const LIFETIME_PLAN_TYPE = 'founder_lifetime';
export const LIFETIME_PRICE_PLN_FIRST = 599;
export const LIFETIME_PRICE_PLN_SECOND = 799;
/** Jednorazowy bonus Lifetime — kubełek extra_tokens (bez resetu, bez wygaśnięcia). */
export const LIFETIME_BONUS_TOKENS = 100;
export { LIFETIME_STRIPE_SENTINEL, isLifetimeProfile };

/** Pending checkout holds a slot until Stripe expiry (default 24h). */
export const LIFETIME_PENDING_HOLD_MS = 24 * 60 * 60 * 1000;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getLifetimeLimits() {
  const firstTierLimit = parsePositiveInt(process.env.LIFETIME_FIRST_TIER_LIMIT, 10);
  const totalLimit = parsePositiveInt(process.env.LIFETIME_TOTAL_LIMIT, 20);
  return {
    firstTierLimit,
    totalLimit: Math.max(totalLimit, firstTierLimit),
  };
}

/**
 * Pure tier resolver — soldCount comes from the server (DB), never from the client.
 */
export function resolveLifetimeTier(soldCount, limits = getLifetimeLimits()) {
  const n = Number.isFinite(soldCount) ? Math.max(0, soldCount) : 0;
  const { firstTierLimit, totalLimit } = limits;

  if (n >= totalLimit) {
    return {
      soldOut: true,
      pricePln: null,
      tier: 'sold_out',
      badge: 'Oferta Founder Lifetime wyprzedana',
      nextTierNote: null,
      buttonLabel: 'Oferta wyprzedana',
    };
  }

  if (n >= firstTierLimit) {
    return {
      soldOut: false,
      pricePln: LIFETIME_PRICE_PLN_SECOND,
      tier: '799',
      badge: 'Ostatnie 10 kont',
      nextTierNote: null,
      buttonLabel: 'Kupuję',
    };
  }

  return {
    soldOut: false,
    pricePln: LIFETIME_PRICE_PLN_FIRST,
    tier: '599',
    badge: 'Tylko 10 kont w tej cenie',
    nextTierNote: 'Kolejne 10 kont: 799 zł',
    buttonLabel: 'Kupuję',
  };
}

export function getLifetimePriceIdForTier(tier) {
  if (tier === '599') return process.env.STRIPE_LIFETIME_PRICE_ID_599?.trim() || null;
  if (tier === '799') return process.env.STRIPE_LIFETIME_PRICE_ID_799?.trim() || null;
  return null;
}

export function expectedLifetimeUnitAmount(tier) {
  if (tier === '599') return LIFETIME_PRICE_PLN_FIRST * 100;
  if (tier === '799') return LIFETIME_PRICE_PLN_SECOND * 100;
  return null;
}

export function publicLifetimeOfferView(state) {
  return {
    soldOut: state.soldOut === true,
    pricePln: state.pricePln,
    tier: state.tier,
    badge: state.badge,
    nextTierNote: state.nextTierNote,
    buttonLabel: state.buttonLabel,
    firstTierLimit: state.firstTierLimit,
    totalLimit: state.totalLimit,
  };
}

function isMissingRelation(error) {
  const msg = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /lifetime_purchases/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

async function countPaidPurchases(supabase) {
  const { count, error } = await supabase
    .from('lifetime_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid');

  if (!error && typeof count === 'number') return count;
  if (error && !isMissingRelation(error)) throw error;

  const { count: fromProfiles, error: profileError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(`lifetime_purchased_at.not.is.null,stripe_subscription_id.eq.${LIFETIME_STRIPE_SENTINEL}`);

  if (profileError) throw profileError;
  return typeof fromProfiles === 'number' ? fromProfiles : 0;
}

async function countPendingHolds(supabase) {
  const cutoff = new Date(Date.now() - LIFETIME_PENDING_HOLD_MS).toISOString();
  const { count, error } = await supabase
    .from('lifetime_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('created_at', cutoff);

  if (error) {
    if (isMissingRelation(error)) return 0;
    throw error;
  }
  return typeof count === 'number' ? count : 0;
}

export async function countLifetimeCommitted(supabase) {
  const paid = await countPaidPurchases(supabase);
  const pending = await countPendingHolds(supabase);
  return paid + pending;
}

export async function getLifetimeOfferState(supabase = getSupabaseAdmin()) {
  const limits = getLifetimeLimits();
  if (!supabase) {
    const tier = resolveLifetimeTier(0, limits);
    return {
      ...tier,
      soldCount: 0,
      ...limits,
      available: false,
      reason: 'no_admin',
    };
  }

  const soldCount = await countLifetimeCommitted(supabase);
  const tier = resolveLifetimeTier(soldCount, limits);
  return {
    ...tier,
    soldCount,
    ...limits,
    available: true,
  };
}

async function expireStalePending(supabase) {
  const cutoff = new Date(Date.now() - LIFETIME_PENDING_HOLD_MS).toISOString();
  const { error } = await supabase
    .from('lifetime_purchases')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff);
  if (error && !isMissingRelation(error)) {
    console.warn('[lifetime] expire stale pending:', error.message);
  }
}

async function expireUserPending(supabase, userId) {
  const { error } = await supabase
    .from('lifetime_purchases')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error && !isMissingRelation(error)) {
    console.warn('[lifetime] expire user pending:', error.message);
  }
}

/**
 * Server-side price lock for Checkout. Ignores any client-supplied amount.
 */
export async function reserveLifetimeCheckout({ supabase = getSupabaseAdmin(), userId } = {}) {
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: 'Brak konfiguracji serwera (SUPABASE_SERVICE_ROLE_KEY) — nie można zweryfikować puli Lifetime.',
    };
  }
  if (!userId) {
    return {
      ok: false,
      status: 401,
      error: 'Musisz być zalogowany, aby kupić Founder Lifetime.',
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, plan, subscription_status, stripe_subscription_id, stripe_subscription_status, lifetime_purchased_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return { ok: false, status: 404, error: 'Nie znaleziono profilu.' };
  }
  if (isLifetimeProfile(profile)) {
    return { ok: false, status: 409, error: 'Masz już plan Founder Lifetime.' };
  }

  await expireStalePending(supabase);
  await expireUserPending(supabase, userId);

  const limits = getLifetimeLimits();

  for (let attempt = 0; attempt < 6; attempt++) {
    const soldCount = await countLifetimeCommitted(supabase);
    const tierState = resolveLifetimeTier(soldCount, limits);

    if (tierState.soldOut) {
      return {
        ok: false,
        status: 409,
        error: 'Oferta Founder Lifetime wyprzedana.',
        offer: publicLifetimeOfferView({ ...tierState, ...limits, soldCount }),
      };
    }

    const priceId = getLifetimePriceIdForTier(tierState.tier);
    const envHint =
      tierState.tier === '599' ? 'STRIPE_LIFETIME_PRICE_ID_599' : 'STRIPE_LIFETIME_PRICE_ID_799';
    if (!priceId) {
      return { ok: false, status: 503, error: `Brak ${envHint} w konfiguracji serwera.` };
    }

    const slotNumber = soldCount + 1;
    const { data: inserted, error: insertError } = await supabase
      .from('lifetime_purchases')
      .insert({
        user_id: userId,
        slot_number: slotNumber,
        price_pln: tierState.pricePln,
        stripe_price_id: priceId,
        status: 'pending',
      })
      .select('id, slot_number, price_pln')
      .maybeSingle();

    if (!insertError && inserted?.id) {
      return {
        ok: true,
        purchaseId: inserted.id,
        slotNumber: inserted.slot_number,
        pricePln: tierState.pricePln,
        priceId,
        tier: tierState.tier,
        soldCount,
      };
    }

    if (insertError && isMissingRelation(insertError)) {
      console.warn(
        '[lifetime] brak tabeli lifetime_purchases — uruchom supabase/lifetime_offer.sql. Checkout bez rezerwacji slotu.',
      );
      return {
        ok: true,
        purchaseId: null,
        slotNumber: soldCount + 1,
        pricePln: tierState.pricePln,
        priceId,
        tier: tierState.tier,
        soldCount,
        unreserved: true,
      };
    }

    // Unique slot race — retry with a fresh count.
    const isUnique = insertError?.code === '23505' || /duplicate|unique/i.test(insertError?.message || '');
    if (isUnique) continue;

    throw insertError || new Error('Nie udało się zarezerwować slotu Lifetime.');
  }

  return {
    ok: false,
    status: 409,
    error: 'Oferta Founder Lifetime wyprzedana.',
  };
}

export async function attachLifetimeCheckoutSession(supabase, purchaseId, sessionId) {
  if (!supabase || !purchaseId || !sessionId) return;
  const { error } = await supabase
    .from('lifetime_purchases')
    .update({ stripe_checkout_session_id: sessionId })
    .eq('id', purchaseId)
    .eq('status', 'pending');
  if (error && !isMissingRelation(error)) {
    console.warn('[lifetime] attach session:', error.message);
  }
}

export async function expireLifetimeReservation(supabase, { purchaseId, sessionId } = {}) {
  if (!supabase) return;
  if (purchaseId) {
    await supabase.from('lifetime_purchases').update({ status: 'expired' }).eq('id', purchaseId).eq('status', 'pending');
    return;
  }
  if (sessionId) {
    await supabase
      .from('lifetime_purchases')
      .update({ status: 'expired' })
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending');
  }
}

export async function markLifetimePurchasePaid(supabase, {
  userId,
  sessionId,
  stripeCustomerId,
  pricePln,
  stripePriceId,
  slotNumber,
} = {}) {
  if (!supabase) return { ok: false, reason: 'no_admin' };

  if (sessionId) {
    const { data: existing } = await supabase
      .from('lifetime_purchases')
      .select('id, status, price_pln, slot_number')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (existing?.id) {
      if (existing.status === 'paid') return { ok: true, duplicate: true, purchase: existing };
      const { error } = await supabase
        .from('lifetime_purchases')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_customer_id: stripeCustomerId || null,
          price_pln: pricePln || existing.price_pln,
        })
        .eq('id', existing.id);
      if (error) throw error;
      return { ok: true, purchase: { ...existing, status: 'paid' } };
    }
  }

  const committed = await countPaidPurchases(supabase);
  const nextSlot = slotNumber || committed + 1;
  const { data: inserted, error } = await supabase
    .from('lifetime_purchases')
    .insert({
      user_id: userId,
      slot_number: nextSlot,
      price_pln: pricePln || LIFETIME_PRICE_PLN_FIRST,
      stripe_price_id: stripePriceId || null,
      stripe_checkout_session_id: sessionId || null,
      stripe_customer_id: stripeCustomerId || null,
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .select('id, slot_number, price_pln, status')
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return { ok: true, skippedTable: true };
    if (error.code === '23505') return { ok: true, duplicate: true };
    throw error;
  }
  return { ok: true, purchase: inserted };
}
