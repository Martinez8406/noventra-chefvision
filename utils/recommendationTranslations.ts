import type { DishRecommendation, DishRecommendationItem, DishRecommendationType, PublicMenuLocale } from '../types';
import { getRecommendationHeader } from './dishRecommendations';

export const REC_TRANSLATIONS_STORAGE_KEY = (userId: string) =>
  `chefvision_public_rec_translations:${userId}`;

export type RecommendationItemTranslation = {
  title: Partial<Record<PublicMenuLocale, string>>;
  subtitle?: Partial<Record<PublicMenuLocale, string>>;
};

export type RecommendationTranslationCache = {
  customHeaderText?: Partial<Record<PublicMenuLocale, string>>;
  items: Record<string, RecommendationItemTranslation>;
};

const NON_PL_LOCALES: PublicMenuLocale[] = [
  'en',
  'he',
  'ar',
  'uk',
  'de',
  'es',
  'it',
  'ko',
  'ja',
  'fr',
  'cs',
  'nl',
  'zh',
];

export const RECOMMENDATION_BADGE_I18N: Record<DishRecommendationType, Record<PublicMenuLocale, string>> = {
  polecane: {
    pl: 'Szef kuchni poleca',
    en: "Chef's choice",
    he: 'בחירת השף',
    ar: 'اختيار الشيف',
    uk: 'Вибір шефа',
    de: 'Empfehlung des Küchenchefs',
    es: 'Elección del chef',
    it: 'Scelta dello chef',
    ko: '셰프 추천',
    ja: 'シェフおすすめ',
    fr: 'Choix du chef',
    cs: 'Šéfkuchař doporučuje',
    nl: 'Keuze van de chef',
    zh: '主厨推荐',
  },
  popularne: {
    pl: 'Najlepiej sprzedawane',
    en: 'Bestseller',
    he: 'רב מכר',
    ar: 'الأكثر مبيعاً',
    uk: 'Бестселер',
    de: 'Bestseller',
    es: 'Más vendido',
    it: 'Più venduto',
    ko: '베스트셀러',
    ja: 'ベストセラー',
    fr: 'Meilleure vente',
    cs: 'Nejprodávanější',
    nl: 'Bestseller',
    zh: '畅销',
  },
  zestaw: {
    pl: 'W zestawie taniej',
    en: 'Cheaper in bundle',
    he: 'זול יותר בחבילה',
    ar: 'أرخص في الباقة',
    uk: 'Дешевше в наборі',
    de: 'Im Bundle günstiger',
    es: 'Más barato en pack',
    it: 'Più conveniente in bundle',
    ko: '세트 할인',
    ja: 'セット割引',
    fr: 'Moins cher en formule',
    cs: 'Levněji v balíčku',
    nl: 'Goedkoper in bundel',
    zh: '套餐更省',
  },
};

export const RECOMMENDATION_HEADER_I18N: Record<DishRecommendationType, Record<PublicMenuLocale, string>> = {
  polecane: {
    pl: 'Polecamy do tego dania',
    en: 'Pairs well with this dish',
    he: 'מומלץ לצד המנה',
    ar: 'يناسب هذا الطبق',
    uk: 'Рекомендуємо до цієї страви',
    de: 'Passt zu diesem Gericht',
    es: 'Ideal con este plato',
    it: 'Abbinamento consigliato',
    ko: '이 메뉴와 잘 어울려요',
    ja: 'この料理におすすめ',
    fr: 'À associer à ce plat',
    cs: 'Doporučujeme k tomuto jídlu',
    nl: 'Past bij dit gerecht',
    zh: '推荐搭配',
  },
  popularne: {
    pl: 'Inni często zamawiają z',
    en: 'Others often order with',
    he: 'לקוחות אחרים לרוב מזמינים עם',
    ar: 'غالباً يطلبه الآخرون مع',
    uk: 'Інші часто замовляють разом із',
    de: 'Andere bestellen oft dazu',
    es: 'Otros suelen pedir con',
    it: 'Altri spesso ordinano con',
    ko: '다른 고객이 자주 함께 주문',
    ja: '他のお客様も一緒に注文',
    fr: 'Souvent commandé avec',
    cs: 'Ostatní často objednávají s',
    nl: 'Anderen bestellen vaak met',
    zh: '其他人常搭配',
  },
  zestaw: {
    pl: 'Najpopularniejszy zestaw',
    en: 'Most popular set',
    he: 'המארז הפופולרי',
    ar: 'أشهر باقة',
    uk: 'Найпопулярніший набір',
    de: 'Beliebtestes Menü',
    es: 'Pack más popular',
    it: 'Bundle più popolare',
    ko: '인기 세트',
    ja: '人気セット',
    fr: 'Formule la plus populaire',
    cs: 'Nejoblíbenější balíček',
    nl: 'Populairste bundel',
    zh: '最受欢迎套餐',
  },
};

const SAVINGS_I18N: Record<PublicMenuLocale, (pct: number) => string> = {
  pl: (pct) => `Oszczędzasz ${pct}%`,
  en: (pct) => `You save ${pct}%`,
  he: (pct) => `חוסכים ${pct}%`,
  ar: (pct) => `وفّر ${pct}%`,
  uk: (pct) => `Економія ${pct}%`,
  de: (pct) => `Sie sparen ${pct}%`,
  es: (pct) => `Ahorras ${pct}%`,
  it: (pct) => `Risparmi ${pct}%`,
  ko: (pct) => `${pct}% 절약`,
  ja: (pct) => `${pct}%お得`,
  fr: (pct) => `Économisez ${pct}%`,
  cs: (pct) => `Ušetříte ${pct}%`,
  nl: (pct) => `Bespaar ${pct}%`,
  zh: (pct) => `节省 ${pct}%`,
};

export function loadRecommendationTranslations(userId: string): Record<string, RecommendationTranslationCache> {
  if (typeof window === 'undefined' || !userId) return {};
  try {
    const raw = localStorage.getItem(REC_TRANSLATIONS_STORAGE_KEY(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRecommendationTranslations(
  userId: string,
  cache: Record<string, RecommendationTranslationCache>,
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(REC_TRANSLATIONS_STORAGE_KEY(userId), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function pickLocale(
  map: Partial<Record<PublicMenuLocale, string>> | undefined,
  locale: PublicMenuLocale,
  fallback: string,
): string {
  const v = map?.[locale]?.trim();
  return v || fallback;
}

export function getPublicRecommendationBadge(
  type: DishRecommendationType,
  locale: PublicMenuLocale,
): string {
  return RECOMMENDATION_BADGE_I18N[type][locale] || RECOMMENDATION_BADGE_I18N[type].pl;
}

export function getPublicRecommendationHeader(
  rec: DishRecommendation,
  locale: PublicMenuLocale,
  cache?: RecommendationTranslationCache | null,
): string {
  const plHeader = getRecommendationHeader(rec);
  if (locale === 'pl') return plHeader;

  const customPl = rec.customHeaderText?.trim();
  if (customPl) {
    return pickLocale(cache?.customHeaderText, locale, customPl);
  }

  return RECOMMENDATION_HEADER_I18N[rec.type][locale] || RECOMMENDATION_HEADER_I18N[rec.type].pl;
}

export function getPublicRecommendationItemCopy(
  item: DishRecommendationItem,
  locale: PublicMenuLocale,
  cache?: RecommendationTranslationCache | null,
): { title: string; subtitle?: string } {
  const itemCache = cache?.items?.[item.id];
  const title = locale === 'pl' ? item.title : pickLocale(itemCache?.title, locale, item.title);
  const subtitleRaw = item.subtitle?.trim();
  const subtitle =
    subtitleRaw && locale !== 'pl'
      ? pickLocale(itemCache?.subtitle, locale, subtitleRaw)
      : subtitleRaw || undefined;
  return { title, subtitle };
}

export function formatZestawDisplayTitlesLocalized(
  items: DishRecommendationItem[],
  dishName: string,
  locale: PublicMenuLocale,
  cache?: RecommendationTranslationCache | null,
): string {
  const parts = items
    .map((i) => getPublicRecommendationItemCopy(i, locale, cache).title.trim())
    .filter(Boolean);
  const main =
    locale === 'pl' ? dishName.trim() : dishName.trim();
  if (!main) return parts.join(' + ');
  const alreadyIncluded = parts.some((p) => p.toLowerCase() === main.toLowerCase());
  if (!alreadyIncluded) parts.push(main);
  return parts.join(' + ');
}

export function getPublicSavingsLabel(percent: number, locale: PublicMenuLocale): string {
  return SAVINGS_I18N[locale]?.(percent) ?? SAVINGS_I18N.pl(percent);
}

export function recommendationNeedsTranslation(rec: DishRecommendation): boolean {
  const hasCustom = !!rec.customHeaderText?.trim();
  const hasItems = rec.items.some((i) => i.title?.trim() || i.subtitle?.trim());
  return hasCustom || hasItems;
}

const checkMapAllLocales = (map?: Partial<Record<PublicMenuLocale, string>>) =>
  !!map && NON_PL_LOCALES.every((l) => typeof map[l] === 'string' && map[l]!.trim().length > 0);

export function recommendationCacheReady(
  rec: DishRecommendation,
  cache: RecommendationTranslationCache | undefined,
): boolean {
  if (!recommendationNeedsTranslation(rec)) return true;
  if (!cache) return false;
  if (rec.customHeaderText?.trim() && !checkMapAllLocales(cache.customHeaderText)) return false;
  for (const item of rec.items) {
    if (!item.title?.trim()) continue;
    if (!checkMapAllLocales(cache.items?.[item.id]?.title)) return false;
    if (item.subtitle?.trim() && !checkMapAllLocales(cache.items[item.id]?.subtitle)) return false;
  }
  return true;
}

export async function fetchRecommendationTranslation(
  rec: DishRecommendation,
): Promise<RecommendationTranslationCache> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: 'recommendation',
      type: rec.type,
      customHeaderText: rec.customHeaderText?.trim() || null,
      items: rec.items.map((i) => ({
        id: i.id,
        title: i.title,
        subtitle: i.subtitle,
      })),
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

  const cache: RecommendationTranslationCache = { items: {} };
  if (data?.customHeaderText && typeof data.customHeaderText === 'object') {
    cache.customHeaderText = data.customHeaderText;
  }
  if (data?.items && typeof data.items === 'object') {
    cache.items = data.items;
  }
  return cache;
}
