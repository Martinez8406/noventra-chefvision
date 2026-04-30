import OpenAI from 'openai';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per IP per minute
const ipHits = new Map(); // ip -> number[]

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

const TARGET_LOCALES = ['en', 'uk', 'de', 'es', 'it', 'ko', 'fr', 'zh'];

function validateTranslations(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const code of TARGET_LOCALES) {
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

function fallbackTranslations(text) {
  return {
    en: dictionaryTranslate(text, TOKEN_MAP_EN),
    uk: dictionaryTranslate(text, TOKEN_MAP_UK),
    de: dictionaryTranslate(text, TOKEN_MAP_DE),
    es: text,
    it: text,
    ko: text,
    fr: text,
    zh: text,
  };
}

/**
 * Publiczny endpoint: tłumaczy krótką nazwę kategorii PL -> EN/UK/DE/ES/IT/KO/FR/ZH.
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

  if (!apiKey) {
    return { status: 200, body: { text, translations: fallbackTranslations(text), source: 'fallback' } };
  }

  const openai = new OpenAI({ apiKey });
  const prompt = `Przetłumacz nazwę kategorii menu z języka polskiego na en, uk, de, es, it, ko, fr i zh (chiński uproszczony).
Zasady:
- tłumacz naturalnie jak w menu restauracji
- zachowaj format krótkiej etykiety (bez kropek, bez cudzysłowów, bez dodatkowych słów)
- jeśli w tekście są ukośniki (np. "X / Y"), zachowaj je
- zwróć WYŁĄCZNIE JSON z kluczami en, uk, de, es, it, ko, fr, zh

Tekst (PL): ${text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Zwracasz wyłącznie poprawny JSON: {"en":"...","uk":"...","de":"...","es":"...","it":"...","ko":"...","fr":"...","zh":"..."} bez markdown.',
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

    const translations = validateTranslations(parsed);
    if (!translations) {
      return { status: 200, body: { text, translations: fallbackTranslations(text), source: 'fallback' } };
    }

    return { status: 200, body: { text, translations } };
  } catch (err) {
    console.error('[translate-category]', err);
    return { status: 200, body: { text, translations: fallbackTranslations(text), source: 'fallback' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleTranslateCategory({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}

