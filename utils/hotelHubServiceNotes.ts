import type { PublicMenuLocale } from '../types';
import { HOTEL_HUB_SERVICE_NOTE_TEMPLATES } from './hotelHub';

const CACHE_PREFIX = 'chefvision_hotel_hub_service_note_en:';

/** Znane szablony PL → EN (bez wywołania API). */
const STATIC_PL_TO_EN: Record<string, string> = {
  [HOTEL_HUB_SERVICE_NOTE_TEMPLATES[0]]: HOTEL_HUB_SERVICE_NOTE_TEMPLATES[0],
  [HOTEL_HUB_SERVICE_NOTE_TEMPLATES[1]]: HOTEL_HUB_SERVICE_NOTE_TEMPLATES[1],
  'Advance booking recommended.': 'Advance booking recommended.',
  'Zwykle zgodnie z godzinami otwarcia restauracji.': HOTEL_HUB_SERVICE_NOTE_TEMPLATES[0],
  'Pełne menu restauracji w ciągu dnia. Ograniczone menu w godzinach nocnych.':
    HOTEL_HUB_SERVICE_NOTE_TEMPLATES[1],
  'Pełne menu restauracyjne dostępne 13-22. Ograniczone menu nocne dostępne 22-01':
    'Full restaurant menu available 13:00–22:00. Limited night menu available 22:00–01:00.',
  'Rezerwacja zalecana.': 'Advance booking recommended.',
};

function cacheKey(text: string): string {
  return `${CACHE_PREFIX}${text.trim().toLowerCase()}`;
}

function hasPolishChars(text: string): boolean {
  return /[ąćęłńóśźż]/i.test(text);
}

/** Reguły PL → EN gdy API niedostępne (dev bez restartu / brak OpenAI). */
function fallbackTranslateServiceNotePlToEn(text: string): string {
  let en = text.trim();

  const phraseRules: Array<[RegExp, string]> = [
    [
      /^Pełne menu restauracyjne dostępne\s+(\d{1,2})-(\d{1,2})\.\s*Ograniczone menu nocne dostępne\s+(\d{1,2})-(\d{1,2})\.?$/i,
      'Full restaurant menu available $1:00–$2:00. Limited night menu available $3:00–$4:00.',
    ],
    [
      /^Pełne menu restauracji w ciągu dnia\.\s*Ograniczone menu w godzinach nocnych\.?$/i,
      HOTEL_HUB_SERVICE_NOTE_TEMPLATES[1],
    ],
    [/Pełne menu restauracyjne dostępne/gi, 'Full restaurant menu available'],
    [/Pełne menu restauracji w ciągu dnia/gi, 'Full restaurant menu during the day'],
    [/Ograniczone menu nocne dostępne/gi, 'Limited night menu available'],
    [/Ograniczone menu w godzinach nocnych/gi, 'Limited menu during late-night hours'],
    [/Zwykle zgodnie z godzinami otwarcia restauracji\.?/gi, HOTEL_HUB_SERVICE_NOTE_TEMPLATES[0]],
    [/Rezerwacja zalecana\.?/gi, 'Advance booking recommended.'],
    [/dostępne/gi, 'available'],
    [/godzinach nocnych/gi, 'late-night hours'],
  ];

  for (const [pattern, replacement] of phraseRules) {
    en = en.replace(pattern, replacement);
  }

  // 13-22 → 13:00–22:00 (same line, after phrase rules)
  en = en.replace(/(\d{1,2})-(\d{1,2})/g, (_, a, b) => `${a}:00–${b}:00`);

  return en.trim();
}

export function getServiceNoteSectionLabel(locale: PublicMenuLocale): string {
  return locale === 'pl' ? 'Notatka serwisowa' : 'Service note';
}

export function getPublicServiceNotesSync(notes: string, locale: PublicMenuLocale): string {
  const trimmed = (notes || '').trim();
  if (!trimmed || locale === 'pl') return trimmed;
  if (STATIC_PL_TO_EN[trimmed]) return STATIC_PL_TO_EN[trimmed];
  return fallbackTranslateServiceNotePlToEn(trimmed);
}

export async function fetchServiceNotesEn(text: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  if (STATIC_PL_TO_EN[trimmed]) return STATIC_PL_TO_EN[trimmed];

  try {
    const cached = localStorage.getItem(cacheKey(trimmed));
    if (cached && !hasPolishChars(cached)) return cached;
  } catch {
    /* ignore */
  }

  let fromApi: string | null = null;

  try {
    const resp = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'service_note', text: trimmed }),
    });
    const data = await resp.json().catch(() => null);
    if (resp.ok && typeof data?.en === 'string' && data.en.trim()) {
      const en = data.en.trim();
      if (en !== trimmed && !hasPolishChars(en)) {
        fromApi = en;
      }
    }
  } catch {
    /* use fallback */
  }

  const result = fromApi ?? fallbackTranslateServiceNotePlToEn(trimmed);

  try {
    localStorage.setItem(cacheKey(trimmed), result);
  } catch {
    /* ignore */
  }

  return result;
}

export async function resolvePublicServiceNotes(notes: string, locale: PublicMenuLocale): Promise<string> {
  const trimmed = (notes || '').trim();
  if (!trimmed || locale === 'pl') return trimmed;
  if (STATIC_PL_TO_EN[trimmed]) return STATIC_PL_TO_EN[trimmed];
  return fetchServiceNotesEn(trimmed);
}
