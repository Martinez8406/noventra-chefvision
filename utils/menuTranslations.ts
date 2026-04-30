import type { Dish, PublicMenuLocale } from '../types';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
    .map((item) => item.trim())
    .filter(Boolean);
};

const ALLERGENS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Alergeny',
  en: 'Allergens',
  uk: 'Алергени',
  de: 'Allergene',
  es: 'Alérgenos',
  it: 'Allergeni',
  ko: '알레르기 유발 성분',
  fr: 'Allergènes',
  zh: '过敏原',
};

const NO_ALLERGENS_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Brak głównych alergenów',
  en: 'No major allergens',
  uk: 'Немає основних алергенів',
  de: 'Keine Hauptallergene',
  es: 'Sin alérgenos principales',
  it: 'Nessun allergene principale',
  ko: '주요 알레르기 성분 없음',
  fr: 'Aucun allergène majeur',
  zh: '无主要过敏原',
};

const INGREDIENTS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Składniki',
  en: 'Ingredients',
  uk: 'Інгредієнти',
  de: 'Zutaten',
  es: 'Ingredientes',
  it: 'Ingredienti',
  ko: '재료',
  fr: 'Ingrédients',
  zh: '配料',
};

const INGREDIENTS_MORE_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'więcej',
  en: 'more',
  uk: 'більше',
  de: 'mehr',
  es: 'más',
  it: 'altro',
  ko: '더보기',
  fr: 'plus',
  zh: '更多',
};

/** Domyślny opis przy zapisie z ChefsStudio – uznajemy za brak własnego opisu (bez tłumaczenia AI). */
export const DEFAULT_DISH_DESCRIPTION_PLACEHOLDER = 'Krótki opis, który zobaczy gość...';

export function shouldRequestMenuTranslation(dish: Dish): boolean {
  const ingredientsPL = toStringArray(dish.ingredients);
  if (ingredientsPL.length > 0) {
    const locales: PublicMenuLocale[] = ['en', 'uk', 'de', 'es', 'it', 'ko', 'fr', 'zh'];
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
  const baseDescription =
    typeof dish.description === 'string' ? dish.description : String(dish.description ?? '');
  if (locale === 'pl') {
    return { name: dish.name, description: baseDescription };
  }
  const t = dish.translations?.[locale];
  return {
    name: dish.name,
    description: (t?.description?.trim() || baseDescription) as string,
  };
}

/** Nagłówek sekcji alergenów + lista etykiet (PL z bazy lub z tłumaczenia). */
export function getPublicAllergenDisplay(
  dish: Dish,
  locale: PublicMenuLocale
): { sectionTitle: string; labels: string[]; noAllergensMessage: string } {
  const pl = toStringArray(dish.allergens);
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
  const pl = toStringArray(dish.ingredients);
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
  es: {
    'Śniadania': 'Desayunos',
    'Przystawki': 'Entrantes',
    'Zupy': 'Sopas',
    'Sałatki': 'Ensaladas',
    'Dania główne': 'Platos principales',
    'Burgery / Sandwicze': 'Hamburguesas / Sándwiches',
    'Menu dla dzieci': 'Menú infantil',
    'Dania wegetariańskie / wegańskie': 'Vegetariano / Vegano',
    'Desery': 'Postres',
    'Dodatki (frytki, sosy, pieczywo)': 'Guarniciones (patatas, salsas, pan)',
    'Napoje zimne': 'Bebidas frías',
    'Napoje gorące': 'Bebidas calientes',
    'Alkohole': 'Bebidas alcohólicas',
    'Oferta sezonowa': 'Especiales de temporada',
    'Makarony': 'Pasta',
  },
  it: {
    'Śniadania': 'Colazioni',
    'Przystawki': 'Antipasti',
    'Zupy': 'Zuppe',
    'Sałatki': 'Insalate',
    'Dania główne': 'Piatti principali',
    'Burgery / Sandwicze': 'Burger / Panini',
    'Menu dla dzieci': 'Menu bambini',
    'Dania wegetariańskie / wegańskie': 'Vegetariano / Vegano',
    'Desery': 'Dolci',
    'Dodatki (frytki, sosy, pieczywo)': 'Contorni (patatine, salse, pane)',
    'Napoje zimne': 'Bevande fredde',
    'Napoje gorące': 'Bevande calde',
    'Alkohole': 'Alcolici',
    'Oferta sezonowa': 'Specialità stagionali',
    'Makarony': 'Pasta',
  },
  ko: {
    'Śniadania': '아침 메뉴',
    'Przystawki': '애피타이저',
    'Zupy': '수프',
    'Sałatki': '샐러드',
    'Dania główne': '메인 요리',
    'Burgery / Sandwicze': '버거 / 샌드위치',
    'Menu dla dzieci': '어린이 메뉴',
    'Dania wegetariańskie / wegańskie': '채식 / 비건',
    'Desery': '디저트',
    'Dodatki (frytki, sosy, pieczywo)': '사이드 (감자튀김, 소스, 빵)',
    'Napoje zimne': '차가운 음료',
    'Napoje gorące': '따뜻한 음료',
    'Alkohole': '주류',
    'Oferta sezonowa': '시즌 스페셜',
    'Makarony': '파스타',
  },
  fr: {
    'Śniadania': 'Petits-déjeuners',
    'Przystawki': 'Entrées',
    'Zupy': 'Soupes',
    'Sałatki': 'Salades',
    'Dania główne': 'Plats principaux',
    'Burgery / Sandwicze': 'Burgers / Sandwichs',
    'Menu dla dzieci': 'Menu enfant',
    'Dania wegetariańskie / wegańskie': 'Végétarien / Vegan',
    'Desery': 'Desserts',
    'Dodatki (frytki, sosy, pieczywo)': 'Accompagnements (frites, sauces, pain)',
    'Napoje zimne': 'Boissons froides',
    'Napoje gorące': 'Boissons chaudes',
    'Alkohole': 'Boissons alcoolisées',
    'Oferta sezonowa': 'Spécialités de saison',
    'Makarony': 'Pâtes',
  },
  zh: {
    'Śniadania': '早餐',
    'Przystawki': '前菜',
    'Zupy': '汤',
    'Sałatki': '沙拉',
    'Dania główne': '主菜',
    'Burgery / Sandwicze': '汉堡 / 三明治',
    'Menu dla dzieci': '儿童菜单',
    'Dania wegetariańskie / wegańskie': '素食 / 纯素',
    'Desery': '甜点',
    'Dodatki (frytki, sosy, pieczywo)': '配菜（薯条、酱料、面包）',
    'Napoje zimne': '冷饮',
    'Napoje gorące': '热饮',
    'Alkohole': '酒精饮品',
    'Oferta sezonowa': '季节限定',
    'Makarony': '意面',
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
