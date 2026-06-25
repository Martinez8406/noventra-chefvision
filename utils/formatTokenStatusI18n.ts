import i18n from '../i18n';
import { TRIAL_TOKENS_DEFAULT } from './tokens.js';

type TokenBalances = {
  trial: number;
  subscription: number;
  extra: number;
  total: number;
};

export function formatTokenStatusI18n(
  subscriptionStatus: string | undefined,
  credits: number,
  tokens?: TokenBalances,
  trialEndsAt?: string | null
): string {
  const t = i18n.getFixedT(i18n.language, 'sidebar');

  if (subscriptionStatus === 'start' && tokens) {
    const extraPart =
      tokens.extra > 0 ? t('tokenStatus.startExtra', { extra: tokens.extra }) : '';
    return t('tokenStatus.start', {
      total: tokens.total,
      subscription: tokens.subscription,
      extraPart,
    });
  }

  if (subscriptionStatus === 'premium' && tokens) {
    const extraPart =
      tokens.extra > 0 ? t('tokenStatus.premiumExtra', { extra: tokens.extra }) : '';
    return t('tokenStatus.premium', {
      total: tokens.total,
      subscription: tokens.subscription,
      extraPart,
    });
  }

  if (subscriptionStatus === 'trial' && tokens) {
    let label = t('tokenStatus.trial', {
      trial: tokens.trial,
      max: TRIAL_TOKENS_DEFAULT,
    });
    if (trialEndsAt) {
      const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
      if (days > 0) {
        label += t('tokenStatus.trialDays', { count: days });
      } else {
        label += t('tokenStatus.trialLastDay');
      }
    }
    if (tokens.trial === 0) {
      label += t('tokenStatus.trialNoAi');
    }
    return label;
  }

  if (subscriptionStatus === 'free_limited') {
    return t('tokenStatus.freeLimited');
  }

  return credits > 0
    ? t('tokenStatus.credits', { credits })
    : t('tokenStatus.freeNoTokens');
}

export function formatPremiumTokenShort(total: number): string {
  return i18n.getFixedT(i18n.language, 'sidebar')('tokenStatus.premiumShort', { total });
}
