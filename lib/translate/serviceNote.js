const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const ipHits = new Map();

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
  return trimmed;
}

/**
 * Publiczny endpoint: tłumaczy notatkę serwisową Hotel Hub (PL) -> EN dla gości.
 */
export async function handleTranslateServiceNote({ req, body = {} }) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return { status: 429, body: { error: 'Rate limit exceeded.' } };
  }

  const text = cleanText(body?.text, 320);
  if (!text) {
    return { status: 400, body: { error: 'Wymagane pole text (max 320 znaków).' } };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { status: 200, body: { text, en: text, source: 'fallback' } };
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const prompt = `Przetłumacz notatkę serwisową dla gości hotelu z języka polskiego na naturalny brytyjski angielski.
Zasady:
- ton uprzejmy, jak w menu hotelowym
- bez cudzysłowów, bez dodatkowych wyjaśnień
- jeśli tekst jest już po angielsku, zwróć go bez zmian
- zwróć WYŁĄCZNIE JSON: {"en":"..."}

Tekst: ${text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Zwracasz wyłącznie poprawny JSON: {"en":"..."} bez markdown.',
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

    const en = typeof parsed?.en === 'string' ? parsed.en.trim() : '';
    if (!en) {
      return { status: 200, body: { text, en: text, source: 'fallback' } };
    }

    return { status: 200, body: { text, en, source: 'openai' } };
  } catch (err) {
    console.error('[translate-service-note]', err);
    return { status: 200, body: { text, en: text, source: 'fallback' } };
  }
}
