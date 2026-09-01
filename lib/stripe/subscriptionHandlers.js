import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  LIFETIME_BONUS_TOKENS,
  LIFETIME_PLAN_TYPE,
  LIFETIME_STRIPE_SENTINEL,
  expireLifetimeReservation,
  isLifetimeProfile,
  markLifetimePurchasePaid,
} from './lifetimeOffer.js';

/** Trial defaults for new accounts (also applied in SQL trigger). */
export const TRIAL_DAYS = 14;
export const TRIAL_TOKENS = 50;
export const SUBSCRIPTION_TOKENS = 50;
export const START_SUBSCRIPTION_TOKENS = 10;
export const TOKEN_PACK_AMOUNT = 50;
/** Subscription token bucket resets on each billing period (typically ~30 days). */
export const SUBSCRIPTION_TOKEN_RESET_DAYS = 30;

const PREMIUM_STATUSES = new Set(['active', 'trialing']);

/**
 * Maps plan slug to legacy subscription_status used across the app UI.
 */
function planToSubscriptionStatus(plan) {
  if (plan === 'premium') return 'premium';
  if (plan === 'start') return 'start';
  if (plan === 'free') return 'free_limited';
  return 'trial';
}

function periodEndIso(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

async function getProfileByUserId(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getProfileByStripeCustomer(supabase, stripeCustomerId) {
  if (!stripeCustomerId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getProfileByEmail(supabase, email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function getEmailFromCheckoutSession(session) {
  return (
    session?.customer_details?.email ||
    session?.customer_email ||
    session?.metadata?.email ||
    null
  );
}

async function resolveUserId(supabase, { userId, stripeCustomerId }) {
  if (userId) {
    const profile = await getProfileByUserId(supabase, userId);
    if (profile) return profile.id;
  }
  if (stripeCustomerId) {
    const profile = await getProfileByStripeCustomer(supabase, stripeCustomerId);
    if (profile) return profile.id;
  }
  return null;
}

/**
 * Whether subscription_tokens should reset for this billing period.
 * Resets when Stripe advances current_period_start or 30+ days since last reset.
 */
function shouldResetSubscriptionTokens(profile, subscription) {
  const periodStart = subscription.current_period_start;
  const storedStart = profile.subscription_period_start;
  if (periodStart && storedStart && periodStart > storedStart) {
    return true;
  }

  const resetAt = profile.tokens_reset_at ? new Date(profile.tokens_reset_at).getTime() : 0;
  if (!resetAt) return true;

  const msSinceReset = Date.now() - resetAt;
  return msSinceReset >= SUBSCRIPTION_TOKEN_RESET_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * PREMIUM: active subscription — grant subscription_tokens, store Stripe IDs.
 */
export async function activatePremium(userId, { stripeCustomerId, stripeSubscriptionId, subscription }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] activatePremium: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  const resetTokens = shouldResetSubscriptionTokens(profile, subscription);

  const patch = {
    plan: 'premium',
    subscription_status: planToSubscriptionStatus('premium'),
    stripe_customer_id: stripeCustomerId || profile.stripe_customer_id || null,
    stripe_subscription_id: stripeSubscriptionId || subscription?.id || null,
    current_period_end: periodEndIso(subscription?.current_period_end),
    stripe_subscription_status: subscription?.status || 'active',
    subscription_period_start: subscription?.current_period_start ?? profile.subscription_period_start,
    payment_failed_at: null,
  };

  if (resetTokens) {
    patch.subscription_tokens = SUBSCRIPTION_TOKENS;
    patch.tokens_reset_at = new Date().toISOString();
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;

  console.log('[stripe-webhook] premium activated', { userId, resetTokens });
  return { ok: true };
}

/**
 * START: active subscription — 10 subscription tokens / month, bez Hotel Hub.
 */
export async function activateStart(userId, { stripeCustomerId, stripeSubscriptionId, subscription }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] activateStart: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  const resetTokens = shouldResetSubscriptionTokens(profile, subscription);

  const patch = {
    plan: 'start',
    subscription_status: planToSubscriptionStatus('start'),
    stripe_customer_id: stripeCustomerId || profile.stripe_customer_id || null,
    stripe_subscription_id: stripeSubscriptionId || subscription?.id || null,
    current_period_end: periodEndIso(subscription?.current_period_end),
    stripe_subscription_status: subscription?.status || 'active',
    subscription_period_start: subscription?.current_period_start ?? profile.subscription_period_start,
    payment_failed_at: null,
  };

  if (resetTokens) {
    patch.subscription_tokens = START_SUBSCRIPTION_TOKENS;
    patch.tokens_reset_at = new Date().toISOString();
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;

  console.log('[stripe-webhook] start activated', { userId, resetTokens });
  return { ok: true };
}

/**
 * Founder Lifetime — jednorazowa płatność, stały dostęp Premium bez subskrypcji.
 */
export async function activateLifetime(userId, {
  stripeCustomerId,
  stripeSessionId,
  pricePln,
  stripePriceId,
  slotNumber,
  stripe,
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] activateLifetime: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  await markLifetimePurchasePaid(supabase, {
    userId,
    sessionId: stripeSessionId,
    stripeCustomerId,
    pricePln,
    stripePriceId,
    slotNumber,
  });

  if (isLifetimeProfile(profile) && profile.lifetime_purchased_at) {
    console.log('[stripe-webhook] lifetime already active — skip bonus tokens', { userId, stripeSessionId });
    return { ok: true, duplicate: true };
  }

  if (stripe && previousSubscriptionIdIsReal(profile.stripe_subscription_id)) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (e) {
      console.warn('[stripe-webhook] lifetime: could not cancel previous subscription', e.message);
    }
  }

  const lifetimeFields = {
    plan: 'premium',
    subscription_status: planToSubscriptionStatus('premium'),
    stripe_customer_id: stripeCustomerId || profile.stripe_customer_id || null,
    stripe_subscription_id: LIFETIME_STRIPE_SENTINEL,
    stripe_subscription_status: 'lifetime',
    current_period_end: null,
    payment_failed_at: null,
    lifetime_price_pln: pricePln || profile.lifetime_price_pln || null,
  };

  const currentExtra = typeof profile.extra_tokens === 'number' ? profile.extra_tokens : 0;
  const trialLeft =
    typeof profile.trial_tokens === 'number' && !Number.isNaN(profile.trial_tokens)
      ? Math.max(0, profile.trial_tokens)
      : 0;
  const grantedAt = new Date().toISOString();

  // Bonus 100 extra_tokens tylko przy pierwszym przyznaniu Lifetime (lifetime_purchased_at IS NULL).
  // Ponowiony webhook nie doda tokenów drugi raz. Nie ruszamy subscription_tokens.
  const { data: grantedRow, error: grantError } = await supabase
    .from('profiles')
    .update({
      ...lifetimeFields,
      extra_tokens: currentExtra + LIFETIME_BONUS_TOKENS + trialLeft,
      lifetime_purchased_at: grantedAt,
    })
    .eq('id', userId)
    .is('lifetime_purchased_at', null)
    .select('id, extra_tokens')
    .maybeSingle();

  if (grantError) throw grantError;

  if (!grantedRow) {
    const { error } = await supabase.from('profiles').update(lifetimeFields).eq('id', userId);
    if (error) throw error;
    console.log('[stripe-webhook] lifetime already granted — tokens not added again', { userId });
    return { ok: true, duplicate: true };
  }

  console.log('[stripe-webhook] lifetime activated', {
    userId,
    pricePln,
    extraTokens: grantedRow.extra_tokens,
    bonus: LIFETIME_BONUS_TOKENS,
  });
  return { ok: true };
}

function previousSubscriptionIdIsReal(id) {
  return typeof id === 'string' && id.startsWith('sub_');
}

/**
 * Jednorazowe zlecenie wykonania menu cyfrowego przez zespół ChefVision.
 */
export async function activateMenuService(userId, { stripeSessionId, stripeCustomerId } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] activateMenuService: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  if (stripeSessionId) {
    const { data: existing } = await supabase
      .from('menu_service_orders')
      .select('id')
      .eq('stripe_checkout_session_id', stripeSessionId)
      .maybeSingle();
    if (existing?.id) {
      console.log('[stripe-webhook] menu_service already recorded', { userId, stripeSessionId });
      return { ok: true, duplicate: true };
    }
  }

  const { error } = await supabase.from('menu_service_orders').insert({
    client_user_id: userId,
    status: 'paid',
    stripe_checkout_session_id: stripeSessionId || null,
    stripe_customer_id: stripeCustomerId || profile.stripe_customer_id || null,
    paid_at: new Date().toISOString(),
  });

  if (error) throw error;

  if (stripeCustomerId && !profile.stripe_customer_id) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', userId);
  }

  console.log('[stripe-webhook] menu_service activated', { userId, stripeSessionId });
  return { ok: true };
}

/**
 * Jednorazowe zlecenie ulotki QR (projekt graficzny).
 */
export async function activateFlyerService(userId, { stripeSessionId, stripeCustomerId } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] activateFlyerService: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  if (stripeSessionId) {
    const { data: existing } = await supabase
      .from('flyer_service_orders')
      .select('id')
      .eq('stripe_checkout_session_id', stripeSessionId)
      .maybeSingle();
    if (existing?.id) {
      console.log('[stripe-webhook] flyer_service already recorded', { userId, stripeSessionId });
      return { ok: true, duplicate: true };
    }
  }

  const { error } = await supabase.from('flyer_service_orders').insert({
    client_user_id: userId,
    status: 'paid',
    stripe_checkout_session_id: stripeSessionId || null,
    stripe_customer_id: stripeCustomerId || profile.stripe_customer_id || null,
    paid_at: new Date().toISOString(),
  });

  if (error) throw error;

  if (stripeCustomerId && !profile.stripe_customer_id) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', userId);
  }

  console.log('[stripe-webhook] flyer_service activated', { userId, stripeSessionId });
  return { ok: true };
}

/**
 * Jednorazowa paczka tokenów — aktywny plan Start lub Premium.
 */
export async function addTokenPack(userId, amount = TOKEN_PACK_AMOUNT) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY).');

  const profile = await getProfileByUserId(supabase, userId);
  if (!profile) {
    console.warn('[stripe-webhook] addTokenPack: profile not found', userId);
    return { ok: false, reason: 'profile_not_found' };
  }

  const plan = profile.plan;
  const status = profile.subscription_status;
  const canBuy =
    plan === 'premium' ||
    plan === 'start' ||
    status === 'premium' ||
    status === 'start' ||
    isLifetimeProfile(profile);
  if (!canBuy) {
    console.warn('[stripe-webhook] addTokenPack: not start/premium', userId);
    return { ok: false, reason: 'not_eligible' };
  }

  const current = typeof profile.extra_tokens === 'number' ? profile.extra_tokens : 0;
  const { error } = await supabase
    .from('profiles')
    .update({ extra_tokens: current + amount })
    .eq('id', userId);

  if (error) throw error;
  console.log('[stripe-webhook] token pack added', { userId, amount, total: current + amount });
  return { ok: true };
}

/**
 * FREE: subscription canceled/deleted — menu stays, AI/premium features off.
 */
export async function downgradeToFree(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured.');

  const { error } = await supabase
    .from('profiles')
    .update({
      plan: 'free',
      subscription_status: planToSubscriptionStatus('free'),
      stripe_subscription_id: null,
      stripe_subscription_status: 'canceled',
      current_period_end: null,
      subscription_tokens: 0,
      // extra_tokens preserved for future Premium — nie są używane w planie darmowym
    })
    .eq('id', userId);

  if (error) throw error;
  console.log('[stripe-webhook] downgraded to free', { userId });
  return { ok: true };
}

/**
 * TRIAL defaults (signup / explicit trial). Called from SQL trigger for new users.
 */
export function buildTrialDefaults() {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  return {
    plan: 'trial',
    subscription_status: planToSubscriptionStatus('trial'),
    trial_tokens: TRIAL_TOKENS,
    trial_ends_at: trialEndsAt.toISOString(),
    subscription_tokens: 0,
    extra_tokens: 0,
  };
}

/**
 * checkout.session.completed — link Stripe customer and activate premium after Checkout.
 */
export async function handleCheckoutSessionCompleted(session, stripe) {
  const userId = session.client_reference_id || session.metadata?.userId || null;
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  let subscription = null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (subscriptionId && stripe) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured.');

  let resolvedUserId = await resolveUserId(supabase, { userId, stripeCustomerId });

  // Payment Links often don't set client_reference_id/metadata.userId.
  // Fallback: resolve profile by email from the Checkout Session and link stripe_customer_id.
  if (!resolvedUserId) {
    const email = getEmailFromCheckoutSession(session);
    if (email) {
      const byEmail = await getProfileByEmail(supabase, email);
      if (byEmail?.id) {
        resolvedUserId = byEmail.id;
        if (stripeCustomerId) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', resolvedUserId);
        }
      }
    }
  }

  if (!resolvedUserId) {
    console.warn('[stripe-webhook] checkout.session.completed: no user for session', session.id);
    return { ok: false, reason: 'user_not_found' };
  }

  const planType =
    session.metadata?.planType ||
    subscription?.metadata?.planType ||
    'premium';

  if (session.mode === 'payment' && planType === 'tokens') {
    return addTokenPack(resolvedUserId, TOKEN_PACK_AMOUNT);
  }

  if (session.mode === 'payment' && planType === 'menu_service') {
    return activateMenuService(resolvedUserId, {
      stripeSessionId: session.id,
      stripeCustomerId,
    });
  }

  if (session.mode === 'payment' && planType === 'flyer_service') {
    return activateFlyerService(resolvedUserId, {
      stripeSessionId: session.id,
      stripeCustomerId,
    });
  }

  if (session.mode === 'payment' && planType === LIFETIME_PLAN_TYPE) {
    const pricePln = Number.parseInt(session.metadata?.lifetimePricePln, 10);
    const slotNumber = Number.parseInt(session.metadata?.lifetimeSlot, 10);
    return activateLifetime(resolvedUserId, {
      stripeCustomerId,
      stripeSessionId: session.id,
      pricePln: Number.isFinite(pricePln) ? pricePln : null,
      stripePriceId: null,
      slotNumber: Number.isFinite(slotNumber) ? slotNumber : null,
      stripe,
    });
  }

  if (session.mode === 'subscription' && subscription && PREMIUM_STATUSES.has(subscription.status)) {
    if (planType === 'start') {
      return activateStart(resolvedUserId, {
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        subscription,
      });
    }
    return activatePremium(resolvedUserId, {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscription,
    });
  }

  // One-time payment or unpaid session — no plan change
  if (stripeCustomerId) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', resolvedUserId);
  }

  return { ok: true, skipped: true };
}

/**
 * customer.subscription.created | .updated
 */
export async function handleSubscriptionChange(subscription) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured.');

  const stripeCustomerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const userId =
    subscription.metadata?.userId ||
    (await resolveUserId(supabase, { stripeCustomerId }));

  if (!userId) {
    console.warn('[stripe-webhook] subscription change: no user', subscription.id);
    return { ok: false, reason: 'user_not_found' };
  }

  const status = subscription.status;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, stripe_subscription_status, lifetime_purchased_at')
    .eq('id', userId)
    .maybeSingle();

  if (isLifetimeProfile(existingProfile)) {
    console.log('[stripe-webhook] subscription change skipped — lifetime account', userId);
    return { ok: true, skipped: true, reason: 'lifetime' };
  }

  if (PREMIUM_STATUSES.has(status)) {
    const planType = subscription.metadata?.planType || 'premium';
    if (planType === 'start') {
      return activateStart(userId, {
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        subscription,
      });
    }
    return activatePremium(userId, {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscription,
    });
  }

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return downgradeToFree(userId);
  }

  // past_due / incomplete — keep premium until Stripe ends subscription; record status
  if (status === 'past_due' || status === 'incomplete') {
    const { error } = await supabase
      .from('profiles')
      .update({
        stripe_subscription_status: status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        current_period_end: periodEndIso(subscription.current_period_end),
      })
      .eq('id', userId);
    if (error) throw error;
    return { ok: true, status };
  }

  return { ok: true, status };
}

/**
 * customer.subscription.deleted
 */
export async function handleSubscriptionDeleted(subscription) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured.');

  const stripeCustomerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const userId =
    subscription.metadata?.userId ||
    (await resolveUserId(supabase, { stripeCustomerId }));

  if (!userId) {
    console.warn('[stripe-webhook] subscription.deleted: no user', subscription.id);
    return { ok: false, reason: 'user_not_found' };
  }

  const profile = await getProfileByUserId(supabase, userId);
  if (isLifetimeProfile(profile)) {
    console.log('[stripe-webhook] subscription.deleted skipped — lifetime account', userId);
    return { ok: true, skipped: true, reason: 'lifetime' };
  }

  return downgradeToFree(userId);
}

/**
 * checkout.session.expired — zwolnij zarezerwowany slot Lifetime.
 */
export async function handleCheckoutSessionExpired(session) {
  const planType = session?.metadata?.planType;
  if (planType !== LIFETIME_PLAN_TYPE) return { ok: true, skipped: true };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin' };

  await expireLifetimeReservation(supabase, { sessionId: session.id });
  console.log('[stripe-webhook] lifetime reservation expired', { sessionId: session.id });
  return { ok: true };
}

/**
 * invoice.payment_failed — record failure; Stripe may retry before canceling.
 */
export async function handleInvoicePaymentFailed(invoice) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured.');

  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  const userId = await resolveUserId(supabase, { stripeCustomerId });
  if (!userId) {
    console.warn('[stripe-webhook] invoice.payment_failed: no user', invoice.id);
    return { ok: false, reason: 'user_not_found' };
  }

  const profile = await getProfileByUserId(supabase, userId);
  if (isLifetimeProfile(profile)) {
    return { ok: true, skipped: true, reason: 'lifetime' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      payment_failed_at: new Date().toISOString(),
      stripe_subscription_status: 'past_due',
    })
    .eq('id', userId);

  if (error) throw error;
  console.log('[stripe-webhook] payment failed recorded', { userId, invoiceId: invoice.id });
  return { ok: true };
}
