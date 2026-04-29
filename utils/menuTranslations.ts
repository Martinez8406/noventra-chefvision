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

const INGREDIENTS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Składniki',
  en: 'Ingredients',
  uk: 'Інгредієнти',
  de: 'Zutaten',
};

const INGREDIENTS_MORE_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'więcej',
  en: 'more',
  uk: 'більше',
  de: 'mehr',
};

/** Domyślny opis przy zapisie z ChefsStudio – uznajemy za brak własnego opisu (bez tłumaczenia AI). */
export const DEFAULT_DISH_DESCRIPTION_PLACEHOLDER = 'Krótki opis, który zobaczy gość...';

export function shouldRequestMenuTranslation(dish: Dish): boolean {
  const ingredientsPL = dish.ingredients || [];
  if (ingredientsPL.length > 0) {
    const locales: PublicMenuLocale[] = ['en', 'uk', 'de'];
    const hasIngredientsTranslationsForAllLocales = locales.every((locale) => {
      const tr = dish.translations?.[locale]?.ingredients;
      return (
        Array.isArray(tr) &&
        tr.length === ingredientsPL.length &&
        tr.every((x) => typeof x === 'string' && x.trim().length > 0)
      );
    });
    if (!hasIngredientsTranslationsForAllLocales) return true;

    // Jeśli "tłumaczenie" wygląda jak fallback PL (większość pozycji identyczna),
    // to mimo że tablica istnieje, warto ponowić tłumaczenie.
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const isProbablyFallbackPLForLocale = locales.some((locale) => {
      const tr = dish.translations?.[locale]?.ingredients;
      if (!Array.isArray(tr) || tr.length !== ingredientsPL.length) return false;
      const sameCount = tr.reduce((acc, v, i) => {
        if (normalize(String(v)) === normalize(String(ingredientsPL[i] ?? ''))) return acc + 1;
        return acc;
      }, 0);
      const ratio = sameCount / Math.max(1, ingredientsPL.length);
      return ratio >= 0.8; // heurystyka
    });
    if (isProbablyFallbackPLForLocale) return true;
  }

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

/**
 * Składniki: jeśli w `dish.translations[locale].ingredients` jest poprawna tablica
 * (taka sama długość i niepuste pozycje), używamy jej; w przeciwnym razie
 * fallback do `dish.ingredients` (PL z bazy).
 */
export function getPublicIngredientsDisplay(dish: Dish, locale: PublicMenuLocale): string[] {
  const pl = dish.ingredients || [];
  if (locale === 'pl') return pl;
  const t = dish.translations?.[locale];
  const tr = t?.ingredients;
  const ok =
    Array.isArray(tr) &&
    tr.length === pl.length &&
    tr.every((x) => typeof x === 'string' && x.trim().length > 0);
  return ok ? tr!.map((x) => x.trim()) : pl;
}

export function getPublicIngredientsSectionTitle(locale: PublicMenuLocale): string {
  return INGREDIENTS_SECTION_TITLE[locale];
}

export function getPublicIngredientsMoreLabel(locale: PublicMenuLocale, count: number): string {
  return `+${count} ${INGREDIENTS_MORE_LABEL[locale]}`;
}

const MENU_CATEGORY_TITLE: Record<PublicMenuLocale, Record<string, string>> = {
  pl: {
    'Śniadania': 'Śniadania',
    'Przystawki': 'Przystawki',
    'Zupy': 'Zupy',
    'Sałatki': 'Sałatki',
    'Dania główne': 'Dania główne',
    'Burgery / Sandwicze': 'Burgery / Sandwicze',
    'Menu dla dzieci': 'Menu dla dzieci',
    'Dania wegetariańskie / wegańskie': 'Dania wegetariańskie / wegańskie',
    'Desery': 'Desery',
    'Dodatki (frytki, sosy, pieczywo)': 'Dodatki (frytki, sosy, pieczywo)',
    'Napoje zimne': 'Napoje zimne',
    'Napoje gorące': 'Napoje gorące',
    'Alkohole': 'Alkohole',
    'Oferta sezonowa': 'Oferta sezonowa',
    'Makarony': 'Makarony',
  },
  en: {
    'Śniadania': 'Breakfasts',
    'Przystawki': 'Starters',
    'Zupy': 'Soups',
    'Sałatki': 'Salads',
    'Dania główne': 'Main Courses',
    'Burgery / Sandwicze': 'Burgers / Sandwiches',
    'Menu dla dzieci': "Kids' Menu",
    'Dania wegetariańskie / wegańskie': 'Vegetarian / Vegan',
    'Desery': 'Desserts',
    'Dodatki (frytki, sosy, pieczywo)': 'Sides (fries, sauces, bread)',
    'Napoje zimne': 'Cold Drinks',
    'Napoje gorące': 'Hot Drinks',
    'Alkohole': 'Alcohol',
    'Oferta sezonowa': 'Seasonal Specials',
    'Makarony': 'Pasta',
  },
  uk: {
    'Śniadania': 'Сніданки',
    'Przystawki': 'Закуски',
    'Zupy': 'Супи',
    'Sałatki': 'Салати',
    'Dania główne': 'Головні страви',
    'Burgery / Sandwicze': 'Бургери / Сендвічі',
    'Menu dla dzieci': 'Дитяче меню',
    'Dania wegetariańskie / wegańskie': 'Вегетаріанські / Веганські',
    'Desery': 'Десерти',
    'Dodatki (frytki, sosy, pieczywo)': 'Додатки (фрі, соуси, хліб)',
    'Napoje zimne': 'Холодні напої',
    'Napoje gorące': 'Гарячі напої',
    'Alkohole': 'Алкоголь',
    'Oferta sezonowa': 'Сезонні пропозиції',
    'Makarony': 'Макарони',
  },
  de: {
    'Śniadania': 'Frühstücke',
    'Przystawki': 'Vorspeisen',
    'Zupy': 'Suppen',
    'Sałatki': 'Salate',
    'Dania główne': 'Hauptgerichte',
    'Burgery / Sandwicze': 'Burger / Sandwiches',
    'Menu dla dzieci': 'Kinderkarte',
    'Dania wegetariańskie / wegańskie': 'Vegetarisch / Vegan',
    'Desery': 'Desserts',
    'Dodatki (frytki, sosy, pieczywo)': 'Beilagen (Pommes, Saucen, Brot)',
    'Napoje zimne': 'Kalte Getränke',
    'Napoje gorące': 'Warme Getränke',
    'Alkohole': 'Alkohol',
    'Oferta sezonowa': 'Saisonangebote',
    'Makarony': 'Nudeln',
  },
};

export function getPublicMenuCategoryDisplay(category: string, locale: PublicMenuLocale): string {
  if (locale === 'pl') return category;
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const key = normalize(category);

  const map = MENU_CATEGORY_TITLE[locale] || {};
  const direct = map[category.trim()];
  if (direct) return direct;

  // Dopasowanie tolerancyjne (np. różne wielkości liter / wielokrotne spacje)
  for (const [k, v] of Object.entries(map)) {
    if (normalize(k) === key) return v;
  }

  return category;
}
