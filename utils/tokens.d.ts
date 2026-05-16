export const TRIAL_TOKENS_DEFAULT: number;
export const SUBSCRIPTION_TOKENS_DEFAULT: number;

export function inferPlan(row: Record<string, unknown> | null | undefined): 'trial' | 'premium' | 'free';
export function isTrialActive(row: Record<string, unknown> | null | undefined): boolean;
export function getTokenBalances(row: Record<string, unknown> | null | undefined): {
  plan: string;
  trial: number;
  subscription: number;
  extra: number;
  total: number;
};
export function getTotalSpendableTokens(row: Record<string, unknown> | null | undefined): number;
export function canSpendToken(row: Record<string, unknown> | null | undefined): boolean;
export function pickTokenDebit(
  row: Record<string, unknown> | null | undefined
): { column: string; value: number } | null;
export function buildDebitPatch(debit: { column: string; value: number } | null): Record<string, number> | null;
export function buildRestorePatch(debit: { column: string; value: number } | null): Record<string, number> | null;
export function formatTokenStatus(
  isSubscribed: boolean,
  credits: number,
  tokens?: { trial: number; subscription: number; extra: number; total: number }
): string;
export function mapProfileTokens(
  row: Record<string, unknown> | null | undefined,
  options?: { localPremiumFlag?: boolean }
): {
  plan: string;
  subscriptionStatus: string;
  credits: number;
  tokens: { trial: number; subscription: number; extra: number; total: number };
  trialEndsAt: string | null;
};
