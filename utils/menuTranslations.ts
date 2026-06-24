import type { Dish, PublicMenuLocale } from '../types';
import { getMenuTranslationLocales } from './tokens';

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) {
        return j
          .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      /* nie JSON */
    }
    return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

const ALLERGENS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Alergeny',
  en: 'Allergens',
  he: 'אלרגנים',
  ar: 'مسببات الحساسية',
  uk: 'Алергени',
  de: 'Allergene',
  es: 'Alérgenos',
  it: 'Allergeni',
  ko: '알레르기 유발 성분',
  ja: 'アレルゲン',
  fr: 'Allergènes',
  cs: 'Alergeny',
  nl: 'Allergenen',
  zh: '过敏原',
};

const NO_ALLERGENS_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'Brak głównych alergenów',
  en: 'No major allergens',
  he: 'ללא אלרגנים עיקריים',
  ar: 'لا توجد مسببات حساسية رئيسية',
  uk: 'Немає основних алергенів',
  de: 'Keine Hauptallergene',
  es: 'Sin alérgenos principales',
  it: 'Nessun allergene principale',
  ko: '주요 알레르기 성분 없음',
  ja: '主要アレルゲンは含まれません',
  fr: 'Aucun allergène majeur',
  cs: 'Bez hlavních alergenů',
  nl: 'Geen belangrijke allergenen',
  zh: '无主要过敏原',
};

const INGREDIENTS_SECTION_TITLE: Record<PublicMenuLocale, string> = {
  pl: 'Składniki',
  en: 'Ingredients',
  he: 'מרכיבים',
  ar: 'المكونات',
  uk: 'Інгредієнти',
  de: 'Zutaten',
  es: 'Ingredientes',
  it: 'Ingredienti',
  ko: '재료',
  ja: '材料',
  fr: 'Ingrédients',
  cs: 'Suroviny',
  nl: 'Ingrediënten',
  zh: '配料',
};

const INGREDIENTS_MORE_LABEL: Record<PublicMenuLocale, string> = {
  pl: 'więcej',
  en: 'more',
  he: 'עוד',
  ar: 'المزيد',
  uk: 'більше',
  de: 'mehr',
  es: 'más',
  it: 'altro',
  ko: '더보기',
  ja: '件',
  fr: 'plus',
  cs: 'více',
  nl: 'meer',
  zh: '更多',
};

/** Menu cyfrowe: języki z zapisem od prawej do lewej (RTL). */
export function isRtlMenuLocale(locale: PublicMenuLocale): boolean {
  return locale === 'he' || locale === 'ar';
}

/**
 * Wpis tłumaczenia dla danego języka.
 * Legacy: w bazie mogą zostać rekordy z kluczem `en-us` (stary slot) — traktujemy je jako brakujące `he` przy wyświetlaniu,
 * dopóki zapis nie zostanie nadpisany pełnym obiektem z API (klucz `he`).
 */
export function resolveMenuTranslationEntry(
  dish: Dish,
  locale: PublicMenuLocale
): MenuTranslationEntry | undefined {
  const tr = dish.translations;
  if (!tr) return undefined;
  const direct = tr[locale];
  if (direct !== undefined && direct !== null) return direct;
  if (locale === 'he') {
    const legacy = (tr as Record<string, MenuTranslationEntry | undefined>)['en-us'];
    if (legacy !== undefined && legacy !== null) return legacy;
  }
  return undefined;
}

/** Domyślny opis przy zapisie z ChefsStudio – uznajemy za brak własnego opisu (bez tłumaczenia AI). */
export const DEFAULT_DISH_DESCRIPTION_PLACEHOLDER = 'Krótki opis, który zobaczy gość...';

export function shouldRequestMenuTranslation(
  dish: Dish,
  planRow?: Record<string, unknown> | null
): boolean {
  const locales = getMenuTranslationLocales(planRow ?? null) as PublicMenuLocale[];
  const ingredientsPL = toStringArray(dish.ingredients);
  if (ingredientsPL.length > 0) {
    const hasIngredientsTranslationsForAllLocales = locales.every((locale) => {
      /* Dla `he` tylko klucz `he` — nie legacy `en-us`, żeby po zmianie locale wymusić nowe tłumaczenie AI. */
      const tr =
        locale === 'he'
          ? dish.translations?.he?.ingredients
          : dish.translations?.[locale]?.ingredients;
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
      const tr =
        locale === 'he'
          ? dish.translations?.he?.ingredients
          : dish.translations?.[locale]?.ingredients;
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
  const t = resolveMenuTranslationEntry(dish, locale);
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
  const t = resolveMenuTranslationEntry(dish, locale);
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
  const t = resolveMenuTranslationEntry(dish, locale);
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
  he: {
    'Śniadania': 'ארוחות בוקר',
    'Przystawki': 'מנות ראשונות',
    'Zupy': 'מרקים',
    'Sałatki': 'סלטים',
    'Dania główne': 'מנות עיקריות',
    'Burgery / Sandwicze': 'המבורגרים / כריכים',
    'Menu dla dzieci': 'תפריט ילדים',
    'Dania wegetariańskie / wegańskie': 'צמחוני / טבעוני',
    'Desery': 'קינוחים',
    'Dodatki (frytki, sosy, pieczywo)': 'תוספות (צ׳יפס, רטבים, לחם)',
    'Napoje zimne': 'משקאות קרים',
    'Napoje gorące': 'משקאות חמים',
    'Alkohole': 'אלכוהול',
    'Oferta sezonowa': 'מבצעי עונה',
    'Makarony': 'פסטה',
  },
  ar: {
    'Śniadania': 'وجبات الإفطار',
    'Przystawki': 'المقبلات',
    'Zupy': 'الشوربات',
    'Sałatki': 'السلطات',
    'Dania główne': 'الأطباق الرئيسية',
    'Burgery / Sandwicze': 'برغر / سندويشات',
    'Menu dla dzieci': 'قائمة الأطفال',
    'Dania wegetariańskie / wegańskie': 'نباتي / نباتي صرف',
    'Desery': 'الحلويات',
    'Dodatki (frytki, sosy, pieczywo)': 'الإضافات (بطاطس، صلصات، خبز)',
    'Napoje zimne': 'المشروبات الباردة',
    'Napoje gorące': 'المشروبات الساخنة',
    'Alkohole': 'المشروبات الكحولية',
    'Oferta sezonowa': 'العروض الموسمية',
    'Makarony': 'باستا',
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
  ja: {
    'Śniadania': '朝食',
    'Przystawki': '前菜',
    'Zupy': 'スープ',
    'Sałatki': 'サラダ',
    'Dania główne': 'メイン料理',
    'Burgery / Sandwicze': 'バーガー / サンドイッチ',
    'Menu dla dzieci': 'お子様メニュー',
    'Dania wegetariańskie / wegańskie': 'ベジタリアン / ヴィーガン',
    'Desery': 'デザート',
    'Dodatki (frytki, sosy, pieczywo)': 'サイド（フライ、ソース、パン）',
    'Napoje zimne': '冷たいドリンク',
    'Napoje gorące': '温かいドリンク',
    'Alkohole': 'アルコール',
    'Oferta sezonowa': '季節のおすすめ',
    'Makarony': 'パスタ',
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
  cs: {
    'Śniadania': 'Snídaně',
    'Przystawki': 'Předkrmy',
    'Zupy': 'Polévky',
    'Sałatki': 'Saláty',
    'Dania główne': 'Hlavní jídla',
    'Burgery / Sandwicze': 'Burgery / Sendviče',
    'Menu dla dzieci': 'Dětské menu',
    'Dania wegetariańskie / wegańskie': 'Vegetariánské / Veganské',
    'Desery': 'Dezerty',
    'Dodatki (frytki, sosy, pieczywo)': 'Přílohy (hranolky, omáčky, pečivo)',
    'Napoje zimne': 'Studené nápoje',
    'Napoje gorące': 'Horké nápoje',
    'Alkohole': 'Alkohol',
    'Oferta sezonowa': 'Sezónní speciality',
    'Makarony': 'Těstoviny',
  },
  nl: {
    'Śniadania': 'Ontbijt',
    'Przystawki': 'Voorgerechten',
    'Zupy': 'Soepen',
    'Sałatki': 'Salades',
    'Dania główne': 'Hoofdgerechten',
    'Burgery / Sandwicze': 'Burgers / Broodjes',
    'Menu dla dzieci': 'Kindermenu',
    'Dania wegetariańskie / wegańskie': 'Vegetarisch / Vegan',
    'Desery': 'Desserts',
    'Dodatki (frytki, sosy, pieczywo)': 'Bijgerechten (friet, sauzen, brood)',
    'Napoje zimne': 'Koude dranken',
    'Napoje gorące': 'Warme dranken',
    'Alkohole': 'Alcohol',
    'Oferta sezonowa': 'Seizoensspecials',
    'Makarony': 'Pasta',
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
