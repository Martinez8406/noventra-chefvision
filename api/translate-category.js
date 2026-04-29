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

function validateTranslations(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const code of ['en', 'uk', 'de']) {
    const v = obj[code];
    if (typeof v !== 'string' || !v.trim()) return null;
    // keep it short-ish
    out[code] = v.trim().slice(0, 80);
  }
  return out;
}

/**
 * Publiczny endpoint: tłumaczy krótką nazwę kategorii PL -> EN/UK/DE.
 * Nie zapisuje do bazy (cache po stronie klienta w localStorage).
 */
export async function handleTranslateCategory({ req, body = {} }) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return { status: 429, body: { error: 'Rate limit exceeded.' } };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { status: 503, body: { error: 'OPENAI_API_KEY nie jest skonfigurowany na serwerze.' } };
  }

  const text = validateInput(body?.text);
  if (!text) {
    return { status: 400, body: { error: 'Wymagane pole text (max 60 znaków).' } };
  }

  const openai = new OpenAI({ apiKey });
  const prompt = `Przetłumacz nazwę kategorii menu z języka polskiego na en, uk i de.
Zasady:
- tłumacz naturalnie jak w menu restauracji
- zachowaj format krótkiej etykiety (bez kropek, bez cudzysłowów, bez dodatkowych słów)
- jeśli w tekście są ukośniki (np. "X / Y"), zachowaj je
- zwróć WYŁĄCZNIE JSON z kluczami en, uk, de

Tekst (PL): ${text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Zwracasz wyłącznie poprawny JSON: {"en":"...","uk":"...","de":"..."} bez markdown.',
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
      return { status: 502, body: { error: 'Niepoprawna struktura tłumaczeń.' } };
    }

    return { status: 200, body: { text, translations } };
  } catch (err) {
    console.error('[translate-category]', err);
    const message = err instanceof Error ? err.message : String(err);
    return { status: 500, body: { error: message || 'Błąd API OpenAI.' } };
  }
}

