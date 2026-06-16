import type { DietaryTag, SpiceLevel } from './types';

/** Logo w `public/Zrzut_ekranu_2026-05-02_115035-removebg-preview.png` */
export const BRAND_LOGO_SRC =
  '/Zrzut_ekranu_2026-05-02_115035-removebg-preview.png';

/** Baner CTA „Video Link” na publicznym menu (social media). */
export const VIDEO_LINK_BANNER_SRC = '/video-link-banner.png';

/** Tokeny trial przy rejestracji (14 dni — patrz Supabase trial_ends_at). */
export const TRIAL_TOKENS = 50;

/** Tokeny subskrypcji Premium na okres rozliczeniowy (~30 dni). */
export const SUBSCRIPTION_TOKENS = 50;

/** @deprecated Użyj TRIAL_TOKENS — alias dla starszego kodu. */
export const TRIAL_AI_CREDITS = TRIAL_TOKENS;

/** Maks. liczba zapisanych teł na użytkownika (Supabase + tryb lokalny). */
export const MAX_USER_BACKDROPS = 5;

/** Maks. liczba podglądów (wariantów) wyświetlanych w Studio zdjęć / Motywach. */
export const MAX_ENHANCE_PREVIEWS = 4;

/** Style zdjęcia dla trybu „Ulepsz zdjęcie” (Studio zdjęć, krok 2 – wymagany). */
export const ENHANCE_STYLES = [
  {
    id: 'fine_dining',
    label: 'Fine Dining',
    cardImage: '/style-cards/fine_dining.png',
    cardPlaceholder: 'from-zinc-900 via-slate-800 to-black',
  },
  {
    id: 'rustic',
    label: 'Rustic',
    cardImage: '/style-cards/rustic.png',
    cardPlaceholder: 'from-amber-950 via-stone-800 to-stone-950',
  },
  {
    id: 'street_food',
    label: 'Street Food',
    cardImage: '/style-cards/street_food.png',
    cardPlaceholder: 'from-orange-950 via-red-950 to-zinc-950',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    cardImage: '/style-cards/lifestyle.png',
    cardPlaceholder: 'from-rose-900 via-amber-900 to-stone-900',
  },
] as const;
export type EnhanceStyleId = typeof ENHANCE_STYLES[number]['id'];

/**
 * Talerze / podstawki — każdy z pełnym zestawem ID.
 * Widoczność w UI sterowana przez `PLATES_BY_STYLE` (każdy styl ma własny zestaw).
 * „Custom plate upload” NIE jest wpisem słownika — dodawany jest zawsze dodatkowo w UI.
 */
export const PLATE_PRESETS = [
  { id: 'premium_plate',  label: 'Premium' },
  { id: 'white_plate',    label: 'Biały talerz' },
  { id: 'ceramic_plate',  label: 'Rustykalna ceramika' },
  { id: 'wood_board',     label: 'Deska drewniana' },
  { id: 'bowl',           label: 'Miska' },
  { id: 'no_plate',       label: 'Bez talerza' },
  { id: 'tray',           label: 'Taca uliczna' },
  { id: 'basket',         label: 'Koszyk z papierem' },
  { id: 'casual_plate',   label: 'Casual stoneware' },
] as const;
export type PlatePresetId = typeof PLATE_PRESETS[number]['id'];

export const PLATE_LABEL: Record<PlatePresetId, string> = PLATE_PRESETS.reduce((acc, p) => {
  acc[p.id] = p.label;
  return acc;
}, {} as Record<PlatePresetId, string>);

/**
 * Styl → dozwolone talerze. Kolejność = kolejność wyświetlania.
 * Nie pokazujemy pozostałych (żadnych stanów disabled — po prostu nie renderujemy).
 */
export const PLATES_BY_STYLE: Record<EnhanceStyleId, PlatePresetId[]> = {
  'fine_dining': ['premium_plate', 'white_plate'],
  'rustic':      ['ceramic_plate', 'wood_board', 'bowl'],
  'street_food': ['no_plate', 'tray', 'basket'],
  'lifestyle':   ['white_plate', 'bowl', 'casual_plate'],
};

/** Oświetlenie (krok 5, opcjonalne). */
export const LIGHTING_PRESETS = [
  { id: 'soft', label: 'Miękkie' },
  { id: 'dramatic', label: 'Dramatyczne' },
] as const;
export type LightingId = typeof LIGHTING_PRESETS[number]['id'];

/** Motywy sezonowe — osobna zakładka. Theme nadpisuje styl/tło/talerz. */
export const SEASONAL_THEMES = [
  { id: 'christmas', label: 'Boże Narodzenie', cardImage: '/style-cards/christmas.png' },
  { id: 'easter', label: 'Wielkanoc', cardImage: '/style-cards/easter.png' },
  { id: 'halloween', label: 'Halloween', cardImage: '/style-cards/halloween.png' },
  { id: 'summer', label: 'Lato', cardImage: '/style-cards/summer.png' },
  { id: 'valentine', label: 'Walentynki', cardImage: '/style-cards/valentine.png' },
] as const;
export type SeasonalThemeId = typeof SEASONAL_THEMES[number]['id'];

/** Domyślne oświetlenie w promptach AI (brak wyboru w UI). */
export const DEFAULT_LIGHTING = {
  label: 'Złota Godzina',
  value: 'Golden Hour (warm, soft sunlight)',
} as const;

export const PLATE_OPTIONS = [
  { label: 'Kamień/Łupek', value: 'Natural dark stone platter' },
  { label: 'Biała Porcelana', value: 'Classic fine white porcelain plate' },
  { label: 'Drewno', value: 'Rustic wooden serving board' },
  { label: 'Ceramika', value: 'Handmade rustic ceramic bowl' },
];

export const ANGLE_OPTIONS = [
  { label: 'Top-down (Flatlay)', value: 'Top-down flatlay' },
  { label: 'Makro (Zbliżenie)', value: 'Macro extreme close-up' },
  { label: 'Eye-level', value: 'Eye-level front view' },
];

export const STYLE_OPTIONS = [
  { label: 'Fine Dining', value: 'Fine dining style, elegant plating, microgreens, sauces in dots' },
  { label: 'Rustic', value: 'Rustic, hearty portions, casual but beautiful' },
  { label: 'Street Food', value: 'Modern street food style, vibrant, dynamic' },
  { label: 'Bistro Lifestyle', value: 'Classic French bistro style, warm, inviting' },
];

export const ALLERGENS_LIST: string[] = [
  'Gluten', 'Laktoza', 'Orzechy', 'Skorupiaki', 'Jaja', 'Ryby', 'Soja', 'Gorczyca'
];

/** Oznaczenia dietetyczne w panelu edycji i menu live. */
export const DIETARY_TAG_OPTIONS: {
  id: DietaryTag;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}[] = [
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    shortLabel: 'V',
    description: '',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: 'vegan',
    label: 'Vegan',
    shortLabel: 'VG',
    description: '',
    badgeClass: 'bg-green-50 text-green-900 border-green-200',
  },
  {
    id: 'halal',
    label: 'Halal',
    shortLabel: 'Halal',
    description: 'Zgodne z zasadami islamu.',
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-200',
  },
  {
    id: 'kosher',
    label: 'Koszerne',
    shortLabel: 'Koszer',
    description: 'Zgodne z zasadami judaizmu.',
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-200',
  },
  {
    id: 'gluten_free',
    label: 'Bezglutenowe',
    shortLabel: 'GF',
    description: 'Danie nie zawiera glutenu (możliwe śladowe ilości).',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    id: 'lactose_free',
    label: 'Bez laktozy',
    shortLabel: 'LF',
    description: 'Dla osób z nietolerancją mleka.',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
];

/** Poziomy ostrości — jeden na danie. */
export const SPICE_LEVEL_OPTIONS: {
  id: SpiceLevel;
  label: string;
  peppers: string;
  description: string;
}[] = [
  { id: 'mild', label: 'Łagodne', peppers: '🌶️', description: 'Dla dzieci lub osób wrażliwych.' },
  { id: 'medium', label: 'Średnio pikantne', peppers: '🌶️🌶️', description: 'Umiarkowana ostrość.' },
  { id: 'hot', label: 'Bardzo ostre', peppers: '🌶️🌶️🌶️', description: 'Dla miłośników mocnych smaków.' },
];

export const DIETARY_TAG_BY_ID = Object.fromEntries(
  DIETARY_TAG_OPTIONS.map((o) => [o.id, o])
) as Record<DietaryTag, (typeof DIETARY_TAG_OPTIONS)[number]>;

export const SPICE_LEVEL_BY_ID = Object.fromEntries(
  SPICE_LEVEL_OPTIONS.map((o) => [o.id, o])
) as Record<SpiceLevel, (typeof SPICE_LEVEL_OPTIONS)[number]>;

/** Kategorie menu cyfrowego — kolejność = kolejność sekcji u gościa. */
export const MENU_CATEGORIES = [
  'Śniadania',
  'Przystawki',
  'Zupy',
  'Sałatki',
  'Dania główne',
  'Burgery / Sandwicze',
  'Menu dla dzieci',
  'Dania wegetariańskie / wegańskie',
  'Desery',
  'Dodatki (frytki, sosy, pieczywo)',
  'Napoje zimne',
  'Napoje gorące',
  'Alkohole',
  'Oferta sezonowa',
] as const;
