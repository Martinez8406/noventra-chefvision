/**
 * ChefVision token buckets (shared by API + client).
 *
 * Spend order:
 *   trial (aktywny do trial_ends_at) → trial_tokens only
 *   premium   → subscription_tokens, then extra_tokens
 *   free      → brak AI (extra_tokens nie są używane)
 *
 * Trial trwa 14 dni od trial_ends_at — także przy 0 tokenów.
 * Po trial_ends_at → plan darmowy (free_limited).
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

/** Plan uwzględniający wygaśnięcie trialu (po 14 dniach → free). */
export function resolveEffectivePlan(row) {
  const raw = inferPlan(row);
  if (raw === 'trial' && !isTrialActive(row)) return 'free';
  return raw;
}

/** Trial i Premium: pełna jakość, bez znaku wodny, promocje itd. */
export function hasProFeatures(subscriptionStatus) {
  return subscriptionStatus === 'premium' || subscriptionStatus === 'trial';
}

/** Hotel Hub — tylko trial (aktywny) i Premium. */
export function canUseHotelHub(row) {
  const plan = resolveEffectivePlan(row);
  return plan === 'premium' || plan === 'trial';
}

/** Paczki tokenów tylko na Premium (nie w trial, nie w free). */
export function canPurchaseTokenPacks(subscriptionStatus) {
  return subscriptionStatus === 'premium';
}

function readTrialTokens(row) {
  if (!isTrialActive(row)) return 0;
  const n = row?.trial_tokens;
  if (typeof n === 'number' && !Number.isNaN(n)) return Math.max(0, n);
  // Legacy: tylko gdy trial_tokens jeszcze nie istnieje w wierszu (stare konta)
  const legacy = row?.ai_credits;
  if (typeof n !== 'number' && typeof legacy === 'number' && !Number.isNaN(legacy)) {
    return Math.max(0, legacy);
  }
  return 0;
}

function readSubscriptionTokens(row) {
  if (resolveEffectivePlan(row) !== 'premium') return 0;
  const n = row?.subscription_tokens;
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n) : 0;
}

function readExtraTokens(row) {
  const n = row?.extra_tokens;
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n) : 0;
}

/** Salda do wyświetlenia i debetu (free: 0 tokenów AI). */
export function getTokenBalances(row) {
  const normalized = normalizeProfileForTokenOps(row);
  const plan = resolveEffectivePlan(normalized);
  const trial = plan === 'trial' ? readTrialTokens(normalized) : 0;
  const subscription = plan === 'premium' ? readSubscriptionTokens(normalized) : 0;
  const extra = plan === 'premium' ? readExtraTokens(normalized) : 0;
  const total = trial + subscription + extra;
  return { plan, trial, subscription, extra, total };
}

export function getTotalSpendableTokens(row) {
  return getTokenBalances(row).total;
}

export function canSpendToken(row) {
  const plan = resolveEffectivePlan(normalizeProfileForTokenOps(row));
  if (plan === 'free') return false;
  return getTotalSpendableTokens(row) > 0;
}

export function canUseAiGeneration(row) {
  return canSpendToken(row);
}

export function normalizeProfileForTokenOps(row) {
  if (!row) return row;

  let next = { ...row };
  const plan = inferPlan(next);
  const hasStripe = !!next.stripe_subscription_id;

  if (plan === 'premium' && !hasStripe && (next.subscription_tokens ?? 0) === 0) {
    next = {
      ...next,
      plan: 'trial',
      subscription_status: 'trial',
    };
  }

  if (inferPlan(next) === 'trial' && isTrialActive(next)) {
    const trialN =
      typeof next.trial_tokens === 'number' && !Number.isNaN(next.trial_tokens)
        ? next.trial_tokens
        : typeof next.ai_credits === 'number' && !Number.isNaN(next.ai_credits)
          ? next.ai_credits
          : null;
    if (trialN != null) {
      next.trial_tokens = trialN;
      next.ai_credits = trialN;
    }
  }

  return next;
}

export function pickTokenDebit(row) {
  const normalized = normalizeProfileForTokenOps(row);
  const plan = resolveEffectivePlan(normalized);
  const { trial, subscription, extra } = getTokenBalances(normalized);

  if (plan === 'free') return null;

  if (plan === 'premium') {
    if (subscription > 0) {
      return { column: 'subscription_tokens', value: subscription };
    }
    if (extra > 0) return { column: 'extra_tokens', value: extra };
    return null;
  }

  if (plan === 'trial') {
    // Używaj surowych wartości z bazy (przed normalize), żeby lock UPDATE trafił w właściwą kolumnę
    const raw = row;
    if (typeof raw?.trial_tokens === 'number' && raw.trial_tokens > 0) {
      return { column: 'trial_tokens', value: raw.trial_tokens };
    }
    if (typeof raw?.ai_credits === 'number' && raw.ai_credits > 0) {
      return { column: 'ai_credits', value: raw.ai_credits };
    }
    return null;
  }

  return null;
}

export function buildDebitPatch(debit) {
  if (!debit) return null;
  const next = debit.value - 1;
  const patch = { [debit.column]: next };
  if (debit.column === 'trial_tokens' || debit.column === 'ai_credits') {
    patch.trial_tokens = next;
    patch.ai_credits = next;
  }
  return patch;
}

export function buildRestorePatch(debit) {
  if (!debit) return null;
  const patch = { [debit.column]: debit.value };
  if (debit.column === 'trial_tokens' || debit.column === 'ai_credits') {
    patch.trial_tokens = debit.value;
    patch.ai_credits = debit.value;
  }
  return patch;
}

export function formatTokenStatus(subscriptionStatus, credits, tokens, trialEndsAt = null) {
  if (subscriptionStatus === 'premium' && tokens) {
    const extraPart = tokens.extra > 0 ? ` + ${tokens.extra} dodatkowych` : '';
    return `Premium · ${tokens.total} tokenów (${tokens.subscription} z subskrypcji${extraPart})`;
  }
  if (subscriptionStatus === 'trial' && tokens) {
    let label = `Trial · ${tokens.trial}/${TRIAL_TOKENS_DEFAULT} tokenów`;
    if (trialEndsAt) {
      const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
      if (days > 0) label += ` · ${days} dni`;
      else label += ' · ostatni dzień';
    }
    if (tokens.trial === 0) label += ' · tylko własne zdjęcia (bez AI)';
    return label;
  }
  if (subscriptionStatus === 'free_limited') {
    return 'Darmowy · własne zdjęcia, bez AI';
  }
  return credits > 0 ? `Tokeny: ${credits}` : 'Darmowy · brak tokenów AI';
}

export function mapProfileTokens(row, { localPremiumFlag = false } = {}) {
  const syntheticRow = localPremiumFlag
    ? { ...row, plan: 'premium', subscription_status: 'premium', stripe_subscription_id: row?.stripe_subscription_id || 'local' }
    : row;

  const normalized = normalizeProfileForTokenOps(syntheticRow);
  const effectivePlan = resolveEffectivePlan(normalized);
  const balances = getTokenBalances(normalized);

  let subscriptionStatus = 'free_limited';
  if (effectivePlan === 'premium') subscriptionStatus = 'premium';
  else if (effectivePlan === 'trial') subscriptionStatus = 'trial';

  return {
    plan: effectivePlan,
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
