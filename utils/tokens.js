/**
 * ChefVision token buckets (shared by API + client).
 *
 * Spend order:
 *   trial     → trial_tokens, then extra_tokens
 *   premium   → subscription_tokens, then extra_tokens
 *   free      → extra_tokens only
 *
 * trial_tokens are ignored after trial_ends_at.
 * extra_tokens never expire.
 */

export const TRIAL_TOKENS_DEFAULT = 50;
export const SUBSCRIPTION_TOKENS_DEFAULT = 50;

export function inferPlan(row) {
  if (row?.plan === 'premium' || row?.plan === 'free' || row?.plan === 'trial') {
    return row.plan;
  }
  if (row?.subscription_status === 'premium') return 'premium';
  if (row?.subscription_status === 'free_limited') return 'free';
  return 'trial';
}

export function isTrialActive(row) {
  const plan = inferPlan(row);
  if (plan !== 'trial') return false;
  if (!row?.trial_ends_at) return true;
  return new Date(row.trial_ends_at).getTime() > Date.now();
}

function readTrialTokens(row) {
  if (!isTrialActive(row)) return 0;
  const n = row?.trial_tokens;
  if (typeof n === 'number' && !Number.isNaN(n)) return Math.max(0, n);
  // Legacy column before migration
  const legacy = row?.ai_credits;
  if (typeof legacy === 'number' && !Number.isNaN(legacy)) return Math.max(0, legacy);
  return TRIAL_TOKENS_DEFAULT;
}

function readSubscriptionTokens(row) {
  if (inferPlan(row) !== 'premium') return 0;
  const n = row?.subscription_tokens;
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n) : 0;
}

function readExtraTokens(row) {
  const n = row?.extra_tokens;
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n) : 0;
}

/** Per-bucket balances + total spendable. */
export function getTokenBalances(row) {
  const plan = inferPlan(row);
  const trial = readTrialTokens(row);
  const subscription = readSubscriptionTokens(row);
  const extra = readExtraTokens(row);
  const total = trial + subscription + extra;
  return { plan, trial, subscription, extra, total };
}

export function getTotalSpendableTokens(row) {
  return getTokenBalances(row).total;
}

export function canSpendToken(row) {
  return getTotalSpendableTokens(row) > 0;
}

/**
 * Which column to decrement (optimistic-lock friendly).
 * @returns {{ column: string, value: number } | null}
 */
export function pickTokenDebit(row) {
  const { plan, trial, subscription, extra } = getTokenBalances(row);

  if (plan === 'premium') {
    if (subscription > 0) return { column: 'subscription_tokens', value: subscription };
    if (extra > 0) return { column: 'extra_tokens', value: extra };
    return null;
  }

  if (plan === 'trial' && isTrialActive(row)) {
    if (trial > 0) return { column: 'trial_tokens', value: trial };
    if (extra > 0) return { column: 'extra_tokens', value: extra };
    return null;
  }

  if (extra > 0) return { column: 'extra_tokens', value: extra };
  return null;
}

/** Patch to apply after a successful debit (value - 1). */
export function buildDebitPatch(debit) {
  if (!debit) return null;
  return { [debit.column]: debit.value - 1 };
}

/** Patch to restore a failed generation (rollback). */
export function buildRestorePatch(debit) {
  if (!debit) return null;
  return { [debit.column]: debit.value };
}

/**
 * Map DB profile row → UI user fields (subscription + credits).
 */
/** Short label for Studio / Motywy UI. */
export function formatTokenStatus(isSubscribed, credits, tokens) {
  if (isSubscribed && tokens) {
    const extraPart = tokens.extra > 0 ? ` + ${tokens.extra} dodatkowych` : '';
    return `Tokeny Premium: ${tokens.total} (${tokens.subscription} z subskrypcji${extraPart})`;
  }
  if (tokens?.extra > 0 && (tokens.trial ?? 0) === 0) {
    return `Tokeny dodatkowe: ${tokens.extra}`;
  }
  if (tokens) {
    return `Tokeny trial: ${tokens.trial}/${TRIAL_TOKENS_DEFAULT}`;
  }
  return `Tokeny: ${credits}`;
}

export function mapProfileTokens(row, { localPremiumFlag = false } = {}) {
  const plan = localPremiumFlag ? 'premium' : inferPlan(row);
  const syntheticRow = localPremiumFlag
    ? { ...row, plan: 'premium', subscription_status: 'premium' }
    : row;

  const balances = getTokenBalances(syntheticRow);
  let subscriptionStatus = 'trial';
  if (plan === 'premium') subscriptionStatus = 'premium';
  else if (plan === 'free' || (!isTrialActive(syntheticRow) && balances.total <= 0)) {
    subscriptionStatus = 'free_limited';
  } else if (balances.total <= 0 && plan === 'trial' && !isTrialActive(syntheticRow)) {
    subscriptionStatus = 'free_limited';
  } else if (balances.total <= 0) {
    subscriptionStatus = 'free_limited';
  }

  return {
    plan,
    subscriptionStatus,
    credits: balances.total,
    tokens: {
      trial: balances.trial,
      subscription: balances.subscription,
      extra: balances.extra,
      total: balances.total,
    },
    trialEndsAt: row?.trial_ends_at ?? null,
  };
}
