import type { Dish, PublicMenuLocale } from '../types';

const ALLERGENS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Alergeny',
  en: 'Allergens',
  uk: 'Алергени',
  de: 'Allergene',
};

const NO_ALLERGENS_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Brak głównych alergenów',
  en: 'No major allergens',
  uk: 'Немає основних алергенів',
  de: 'Keine Hauptallergene',
};

/** Domyślny opis przy zapisie z ChefsStudio – uznajemy za brak własnego opisu (bez tłumaczenia AI). */
export const DEFAULT_DISH_DESCRIPTION_PLACEHOLDER = 'Krótki opis, który zobaczy gość...';

export function shouldRequestMenuTranslation(dish: Dish): boolean {
  const d = dish.description?.trim() || '';
  if (d.length < 3) return false;
  if (d === DEFAULT_DISH_DESCRIPTION_PLACEHOLDER) return false;
  return true;
}

export function getPublicDishCopy(
  dish: Dish,
  locale: PublicMenuLocale
): { name: string; description: string } {
  if (locale === 'pl') {
    return { name: dish.name, description: dish.description };
  }
  const t = dish.translations?.[locale];
  return {
    name: dish.name,
    description: (t?.description?.trim() || dish.description) as string,
  };
}

/** Nagłówek sekcji alergenów + lista etykiet (PL z bazy lub z tłumaczenia). */
export function getPublicAllergenDisplay(
  dish: Dish,
  locale: PublicMenuLocale
): { sectionTitle: string; labels: string[]; noAllergensMessage: string } {
  const pl = dish.allergens || [];
  if (locale === 'pl') {
    return {
      sectionTitle: ALLERGENS_SECTION_TITLE.pl,
      labels: [...pl],
      noAllergensMessage: NO_ALLERGENS_LABEL.pl,
    };
  }
  const t = dish.translations?.[locale];
  const tr = t?.allergens;
  const ok =
    Array.isArray(tr) &&
    tr.length === pl.length &&
    tr.every((x) => typeof x === 'string' && x.trim().length > 0);
  return {
    sectionTitle: ALLERGENS_SECTION_TITLE[locale],
    labels: ok ? tr!.map((x) => x.trim()) : [...pl],
    noAllergensMessage: NO_ALLERGENS_LABEL[locale],
  };
}
