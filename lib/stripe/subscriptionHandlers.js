import { getSupabaseAdmin } from './supabaseAdmin.js';

/** Trial defaults for new accounts (also applied in SQL trigger). */
export const TRIAL_DAYS = 14;
export const TRIAL_TOKENS = 50;
export const SUBSCRIPTION_TOKENS = 50;
/** Subscription token bucket resets on each billing period (typically ~30 days). */
export const SUBSCRIPTION_TOKEN_RESET_DAYS = 30;

const PREMIUM_STATUSES = new Set(['active', 'trialing']);

/**
 * Maps plan slug to legacy subscription_status used across the app UI.
 */
function planToSubscriptionStatus(plan) {
  if (plan === 'premium') return 'premium';
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

  if (session.mode === 'subscription' && subscription && PREMIUM_STATUSES.has(subscription.status)) {
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

  if (PREMIUM_STATUSES.has(status)) {
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

  return downgradeToFree(userId);
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
