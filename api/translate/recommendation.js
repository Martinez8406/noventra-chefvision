import OpenAI from 'openai';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const ipHits = new Map();

const TARGET_LOCALES = ['en', 'he', 'ar', 'uk', 'de', 'es', 'it', 'ko', 'ja', 'fr', 'cs', 'nl', 'zh'];

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

function cleanText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen);
  if (/\r|\n/.test(trimmed)) return null;
  return trimmed;
}

function localeMapFromParsed(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const code of TARGET_LOCALES) {
    const v = obj[code];
    if (typeof v !== 'string' || !v.trim()) return null;
    out[code] = v.trim();
  }
  return out;
}

function fallbackLocaleMap(text) {
  const out = {};
  for (const code of TARGET_LOCALES) out[code] = text;
  return out;
}

/**
 * Publiczny endpoint: tłumaczy treści rekomendacji (nagłówek + pozycje) PL -> wszystkie języki menu.
 */
export async function handleTranslateRecommendation({ req, body = {} }) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return { status: 429, body: { error: 'Rate limit exceeded.' } };
  }

  const type = body?.type;
  if (type !== 'polecane' && type !== 'popularne' && type !== 'zestaw') {
    return { status: 400, body: { error: 'Wymagane pole type.' } };
  }

  const customHeaderText = cleanText(body?.customHeaderText, 120);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems
    .map((item) => {
      const id = typeof item?.id === 'string' ? item.id.trim() : '';
      const title = cleanText(item?.title, 80);
      const subtitle = cleanText(item?.subtitle, 100);
      if (!id || !title) return null;
      return { id, title, subtitle: subtitle || null };
    })
    .filter(Boolean)
    .slice(0, 6);

  if (!customHeaderText && items.length === 0) {
    return { status: 400, body: { error: 'Brak treści do tłumaczenia.' } };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const fallback = {
      customHeaderText: customHeaderText ? fallbackLocaleMap(customHeaderText) : null,
      items: Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            title: fallbackLocaleMap(item.title),
            ...(item.subtitle ? { subtitle: fallbackLocaleMap(item.subtitle) } : {}),
          },
        ]),
      ),
      source: 'fallback',
    };
    return { status: 200, body: fallback };
  }

  const openai = new OpenAI({ apiKey });
  const payload = {
    type,
    customHeaderText: customHeaderText || null,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      subtitle: i.subtitle,
    })),
  };

  const prompt = `Przetłumacz treści rekomendacji menu restauracji z polskiego na: en (British English), he, ar, uk, de, es, it, ko, ja, fr, cs, nl, zh.
Typ rekomendacji: ${type}.
Zasady:
- naturalny język menu / sprzedaży w restauracji
- bez cudzysłowów, bez markdown
- zachowaj sens marketingowy
- dla każdego pola zwróć obiekt z kluczami: en, he, ar, uk, de, es, it, ko, ja, fr, cs, nl, zh

Wejście JSON:
${JSON.stringify(payload)}

Zwróć WYŁĄCZNIE JSON:
{
  "customHeaderText": { "en":"...", "he":"...", ... } lub null,
  "items": {
    "<id>": {
      "title": { "en":"...", ... },
      "subtitle": { "en":"...", ... } lub null
    }
  }
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Zwracasz wyłącznie poprawny JSON bez markdown. Każde pole tłumaczenia ma dokładnie klucze: en, he, ar, uk, de, es, it, ko, ja, fr, cs, nl, zh.',
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

    const out = {
      customHeaderText: null,
      items: {},
    };

    if (customHeaderText && parsed?.customHeaderText) {
      const map = localeMapFromParsed(parsed.customHeaderText);
      out.customHeaderText = map || fallbackLocaleMap(customHeaderText);
    }

    for (const item of items) {
      const entry = parsed?.items?.[item.id];
      if (!entry?.title) {
        out.items[item.id] = {
          title: fallbackLocaleMap(item.title),
          ...(item.subtitle ? { subtitle: fallbackLocaleMap(item.subtitle) } : {}),
        };
        continue;
      }
      const titleMap = localeMapFromParsed(entry.title) || fallbackLocaleMap(item.title);
      const subtitleMap =
        item.subtitle && entry.subtitle
          ? localeMapFromParsed(entry.subtitle) || fallbackLocaleMap(item.subtitle)
          : undefined;
      out.items[item.id] = {
        title: titleMap,
        ...(subtitleMap ? { subtitle: subtitleMap } : {}),
      };
    }

    return { status: 200, body: out };
  } catch (err) {
    console.error('[translate-recommendation]', err);
    const fallback = {
      customHeaderText: customHeaderText ? fallbackLocaleMap(customHeaderText) : null,
      items: Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            title: fallbackLocaleMap(item.title),
            ...(item.subtitle ? { subtitle: fallbackLocaleMap(item.subtitle) } : {}),
          },
        ]),
      ),
      source: 'fallback',
    };
    return { status: 200, body: fallback };
  }
}
