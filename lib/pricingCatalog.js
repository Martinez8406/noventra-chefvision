/**
 * Aktualny cennik ChefVision (PLN).
 * Kwoty w groszach są źródłem prawdy dla checkoutu Stripe.
 */

export const PRICES_PLN = {
  startMonth: 49,
  startYear: 490,
  premiumMonth: 89,
  premiumYear: 790,
  menuService: 349,
  flyerService: 149,
};

/** 89 zł × 12. Roczny Premium (790 zł) jest o 26% tańszy. */
export const PREMIUM_YEAR_LIST_PLN = PRICES_PLN.premiumMonth * 12;
export const PREMIUM_YEAR_SAVINGS_PLN = PREMIUM_YEAR_LIST_PLN - PRICES_PLN.premiumYear;
export const PREMIUM_YEAR_DISCOUNT_PERCENT = 26;

/** Start roczny = 10 × 49 zł. Dwa miesiące gratis. */
export const START_YEAR_LIST_PLN = PRICES_PLN.startMonth * 12;
export const START_YEAR_SAVINGS_PLN = START_YEAR_LIST_PLN - PRICES_PLN.startYear;

/**
 * @type {Record<string, { amount: number, interval: 'month' | 'year' | null }>}
 * interval null = płatność jednorazowa.
 */
export const CHECKOUT_PRICE_SPEC = {
  start: { amount: PRICES_PLN.startMonth * 100, interval: 'month' },
  start_annual: { amount: PRICES_PLN.startYear * 100, interval: 'year' },
  premium: { amount: PRICES_PLN.premiumMonth * 100, interval: 'month' },
  annual: { amount: PRICES_PLN.premiumYear * 100, interval: 'year' },
  menu_service: { amount: PRICES_PLN.menuService * 100, interval: null },
  flyer_service: { amount: PRICES_PLN.flyerService * 100, interval: null },
};

/** Usługi w cenie zakupu planu rocznego. */
export function complimentaryServicesForPlan(planType) {
  if (planType === 'annual') return ['menu_service', 'flyer_service'];
  if (planType === 'start_annual') return ['flyer_service'];
  return [];
}
