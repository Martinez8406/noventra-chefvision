/** Logo w `public/logo.png` */
export const BRAND_LOGO_SRC = '/logo.png';

/** Początkowa liczba kredytów AI dla kont trial / darmowych (nie-Premium). */
export const TRIAL_AI_CREDITS = 20;

/** Maks. liczba zapisanych teł na użytkownika (Supabase + tryb lokalny). */
export const MAX_USER_BACKDROPS = 5;

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

/** Kategorie menu cyfrowego — kolejność = kolejność sekcji u gościa. „Inne” = fallback (brak kategorii / stare wpisy). */
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
  'Inne',
] as const;
