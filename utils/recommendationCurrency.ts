import type { RecommendationCurrency } from '../types';
import type { DishRecommendation, DishRecommendationItem } from '../types';

export const DEFAULT_RECOMMENDATION_CURRENCY: RecommendationCurrency = 'PLN';

export const RECOMMENDATION_CURRENCY_META_ID = '__chefvision_currency__';

export const RECOMMENDATION_CURRENCY_CODES: RecommendationCurrency[] = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
  'HUF',
  'UAH',
  'ILS',
  'AED',
  'CAD',
  'AUD',
];

const CURRENCY_SET = new Set<string>(RECOMMENDATION_CURRENCY_CODES);

export function isCurrencyMetaItem(item: DishRecommendationItem): boolean {
  return item.id === RECOMMENDATION_CURRENCY_META_ID;
}

export function stripCurrencyMetaItems(items: DishRecommendationItem[]): DishRecommendationItem[] {
  return items.filter((item) => !isCurrencyMetaItem(item));
}

export function extractCurrencyFromItems(items: DishRecommendationItem[]): RecommendationCurrency | undefined {
  const meta = items.find(isCurrencyMetaItem);
  const code = meta?.title?.trim();
  if (code && CURRENCY_SET.has(code)) {
    return code as RecommendationCurrency;
  }
  return undefined;
}

export function withCurrencyMeta(
  items: DishRecommendationItem[],
  currency: RecommendationCurrency,
): DishRecommendationItem[] {
  return [
    { id: RECOMMENDATION_CURRENCY_META_ID, title: currency, subtitle: '' },
    ...stripCurrencyMetaItems(items),
  ];
}

export function normalizeRecommendation(rec: DishRecommendation): DishRecommendation {
  const items = stripCurrencyMetaItems(rec.items);
  const currency = resolveRecommendationCurrency(rec.currency ?? extractCurrencyFromItems(rec.items));
  return { ...rec, items, currency };
}

export function serializeRecommendationItems(
  rec: DishRecommendation,
): DishRecommendationItem[] {
  const normalized = normalizeRecommendation(rec);
  return withCurrencyMeta(normalized.items, normalized.currency ?? DEFAULT_RECOMMENDATION_CURRENCY);
}

export function resolveRecommendationCurrency(
  currency?: RecommendationCurrency | string | null,
): RecommendationCurrency {
  if (currency && CURRENCY_SET.has(currency)) {
    return currency as RecommendationCurrency;
  }
  return DEFAULT_RECOMMENDATION_CURRENCY;
}

export function formatRecommendationPrice(
  amount: string | undefined,
  currency?: RecommendationCurrency | string | null,
): string {
  const trimmed = amount?.trim();
  if (!trimmed) return '';

  switch (resolveRecommendationCurrency(currency)) {
    case 'PLN':
      return `${trimmed} zł`;
    case 'EUR':
      return `€${trimmed}`;
    case 'USD':
      return `$${trimmed}`;
    case 'GBP':
      return `£${trimmed}`;
    case 'CHF':
      return `CHF ${trimmed}`;
    case 'CZK':
      return `${trimmed} Kč`;
    case 'SEK':
      return `${trimmed} kr`;
    case 'NOK':
      return `${trimmed} kr`;
    case 'DKK':
      return `${trimmed} kr`;
    case 'HUF':
      return `${trimmed} Ft`;
    case 'UAH':
      return `${trimmed} ₴`;
    case 'ILS':
      return `₪${trimmed}`;
    case 'AED':
      return `${trimmed} AED`;
    case 'CAD':
      return `CA$${trimmed}`;
    case 'AUD':
      return `A$${trimmed}`;
    default:
      return trimmed;
  }
}
