import OpenAI from 'openai';
import { MENU_TRANSLATION_LOCALES_FULL } from '../../utils/tokens.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per IP per minute
const ipHits = new Map(); // ip -> number[]

const TARGET_LOCALES = MENU_TRANSLATION_LOCALES_FULL;

function getClientIp(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req?.ip || req?.connection?.remoteAddress || 'unknown';
}

function rateLimitOk(ip) {
  const now = Date.now();
  const prev = ipHits.get(ip) || [];
  const fresh = prev.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  fresh.push(now);
  ipHits.set(ip, fresh);
  return fresh.length <= RATE_LIMIT_MAX;
}

function validateInput(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > 60) return null;
  if (/\r|\n/.test(trimmed)) return null;
  return trimmed;
}

function parseRequestedLocales(body) {
  const raw = body?.locales;
  if (!Array.isArray(raw) || raw.length === 0) return TARGET_LOCALES;
  const filtered = raw.filter((code) => TARGET_LOCALES.includes(code));
  return filtered.length > 0 ? filtered : TARGET_LOCALES;
}

/** Model czasem zwraca etykietę arabską pod innym kluczem niż "ar". */
function normalizeCategoryParsed(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (!obj.ar) {
    const v = obj.Arabic ?? obj.arabic ?? obj.arabski ?? obj.Arabski ?? obj.ARA;
    if (typeof v === 'string' && v.trim()) obj.ar = v;
  }
  return obj;
}

function validateTranslations(obj, targetLocales) {
  if (!obj || typeof obj !== 'object') return null;
  const locales = Array.isArray(targetLocales) && targetLocales.length > 0 ? targetLocales : TARGET_LOCALES;
  const out = {};
  for (const code of locales) {
    const v = obj[code];
    if (typeof v !== 'string' || !v.trim()) return null;
    // keep it short-ish
    out[code] = v.trim().slice(0, 80);
  }
  return out;
}

const TOKEN_MAP_EN = {
  dania: 'dishes',
  danie: 'dish',
  azjatyckie: 'asian',
  włoskie: 'italian',
  polskie: 'polish',
  wegańskie: 'vegan',
  wegetariańskie: 'vegetarian',
  makarony: 'pasta',
  ryby: 'fish',
  mięsa: 'meat',
  mięso: 'meat',
  owoce: 'fruits',
  morza: 'seafood',
  owoce_morza: 'seafood',
  streetfood: 'street food',
  kuchnia: 'cuisine',
};

const TOKEN_MAP_UK = {
  dania: 'страви',
  danie: 'страва',
  azjatyckie: 'азійські',
  włoskie: 'італійські',
  polskie: 'польські',
  wegańskie: 'веганські',
  wegetariańskie: 'вегетаріанські',
  makarony: 'макарони',
  ryby: 'риба',
  mięsa: "м'ясо",
  mięso: "м'ясо",
  owoce: 'фрукти',
  morza: 'морепродукти',
  owoce_morza: 'морепродукти',
  streetfood: 'стрітфуд',
  kuchnia: 'кухня',
};

const TOKEN_MAP_DE = {
  dania: 'gerichte',
  danie: 'gericht',
  azjatyckie: 'asiatische',
  włoskie: 'italienische',
  polskie: 'polnische',
  wegańskie: 'vegane',
  wegetariańskie: 'vegetarische',
  makarony: 'nudeln',
  ryby: 'fisch',
  mięsa: 'fleisch',
  mięso: 'fleisch',
  owoce: 'früchte',
  morza: 'meeresfrüchte',
  owoce_morza: 'meeresfrüchte',
  streetfood: 'streetfood',
  kuchnia: 'küche',
};

const TOKEN_MAP_HE = {
  dania: 'מנות',
  danie: 'מנה',
  azjatyckie: 'אסייתי',
  włoskie: 'איטלקי',
  polskie: 'פולני',
  wegańskie: 'טבעוני',
  wegetariańskie: 'צמחוני',
  makarony: 'פסטה',
  ryby: 'דגים',
  mięsa: 'בשר',
  mięso: 'בשר',
  owoce: 'פירות',
  morza: 'פירות ים',
  owoce_morza: 'פירות ים',
  streetfood: 'מזון רחוב',
  kuchnia: 'מטבח',
};

const TOKEN_MAP_AR = {
  dania: 'أطباق',
  danie: 'طبق',
  azjatyckie: 'آسيوي',
  włoskie: 'إيطالي',
  polskie: 'بولندي',
  wegańskie: 'نباتي صرف',
  wegetariańskie: 'نباتي',
  makarony: 'باستا',
  ryby: 'أسماك',
  mięsa: 'لحوم',
  mięso: 'لحم',
  owoce: 'فواكه',
  morza: 'بحر',
  owoce_morza: 'مأكولات بحرية',
  streetfood: 'طعام الشارع',
  kuchnia: 'مطبخ',
};

function normalizeToken(token) {
  return token
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function dictionaryTranslate(text, map) {
  return text
    .split(/(\s+|\/|-|\(|\)|,)/g)
    .map((part) => {
      const plain = normalizeToken(part);
      if (!plain) return part;
      // special-case for "owoce morza" likely split into two words
      if (plain === 'owoce') return map.owoce ?? part;
      if (plain === 'morza') return map.morza ?? part;
      return map[plain] || part;
    })
    .join('')
    .replace(/\bfruits sea(food)?\b/i, 'seafood')
    .replace(/\bowoce morza\b/i, map.owoce_morza || 'owoce morza');
}

function fallbackTranslations(text, targetLocales) {
  const locales = Array.isArray(targetLocales) && targetLocales.length > 0 ? targetLocales : TARGET_LOCALES;
  const full = {
    en: dictionaryTranslate(text, TOKEN_MAP_EN),
    he: dictionaryTranslate(text, TOKEN_MAP_HE),
    ar: dictionaryTranslate(text, TOKEN_MAP_AR),
    uk: dictionaryTranslate(text, TOKEN_MAP_UK),
    de: dictionaryTranslate(text, TOKEN_MAP_DE),
    es: text,
    it: text,
    ko: text,
    ja: text,
    fr: text,
    cs: text,
    nl: text,
    zh: text,
  };
  const out = {};
  for (const code of locales) {
    out[code] = full[code] ?? text;
  }
  return out;
}

/**
 * Publiczny endpoint: tłumaczy krótką nazwę kategorii PL -> EN(UK)/HE/AR/UK/DE/ES/IT/KO/JA/FR/CS/NL/ZH.
 * Nie zapisuje do bazy (cache po stronie klienta w localStorage).
 */
export async function handleTranslateCategory({ req, body = {} }) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return { status: 429, body: { error: 'Rate limit exceeded.' } };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const text = validateInput(body?.text);
  if (!text) {
    return { status: 400, body: { error: 'Wymagane pole text (max 60 znaków).' } };
  }

  const targetLocales = parseRequestedLocales(body);
  const localeList = targetLocales.join(', ');
  const englishOnly = targetLocales.length === 1 && targetLocales[0] === 'en';

  if (!apiKey) {
    return {
      status: 200,
      body: { text, translations: fallbackTranslations(text, targetLocales), source: 'fallback' },
    };
  }

  const openai = new OpenAI({ apiKey });
  const targetLanguageDescription = englishOnly
    ? 'en (British English)'
    : 'en (British English), he (hebrajski), ar (arabski), uk, de, es, it, ko, ja (japoński), fr, cs, nl i zh (chiński uproszczony)';

  const prompt = `Przetłumacz nazwę kategorii menu z języka polskiego na ${targetLanguageDescription}.
Zasady:
- tłumacz naturalnie jak w menu restauracji
- zachowaj format krótkiej etykiety (bez kropek, bez cudzysłowów, bez dodatkowych słów)
- jeśli w tekście są ukośniki (np. "X / Y"), zachowaj je
- zwróć WYŁĄCZNIE JSON z kluczami ${localeList}

Tekst (PL): ${text}`;

  const systemJsonExample = `{${targetLocales.map((code) => `"${code}":"..."`).join(',')}}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Zwracasz wyłącznie poprawny JSON: ${systemJsonExample} bez markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { status: 502, body: { error: 'Pusta odpowiedź modelu.' } };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 502, body: { error: 'Nieprawidłowy JSON z modelu.' } };
    }

    normalizeCategoryParsed(parsed);

    const translations = validateTranslations(parsed, targetLocales);
    if (!translations) {
      return {
        status: 200,
        body: { text, translations: fallbackTranslations(text, targetLocales), source: 'fallback' },
      };
    }

    return { status: 200, body: { text, translations } };
  } catch (err) {
    console.error('[translate-category]', err);
    return {
      status: 200,
      body: { text, translations: fallbackTranslations(text, targetLocales), source: 'fallback' },
    };
  }
}

