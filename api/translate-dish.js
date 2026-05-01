import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getDishOwnerId, getSupabaseServerCredentials } from './supabaseServerEnv.js';

async function verifyToken(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) return null;
  const client = createClient(url, key);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error) return null;
  return user;
}

function normalizeAllergens(row) {
  const raw = row?.allergens;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function validateTranslations(data, sourceAllergens, sourceIngredients) {
  if (!data || typeof data !== 'object') return null;
  const n = sourceAllergens.length;
  const m = sourceIngredients.length;
  const out = {};
  const targetLocales = ['en', 'en-us', 'uk', 'de', 'es', 'it', 'ko', 'fr', 'cs', 'nl', 'zh'];

  const pickLocaleEntry = (raw, code) => {
    if (!raw || typeof raw !== 'object') return null;
    const aliases = {
      'en-us': ['en-us', 'en_us', 'enus', 'enUS', 'english_us', 'us', 'american_english'],
      en: ['en', 'en-gb', 'en_gb', 'english_uk', 'uk_english', 'british_english'],
      uk: ['uk', 'ua', 'ukrainian'],
      de: ['de', 'de-de', 'german'],
      es: ['es', 'es-es', 'spanish'],
      it: ['it', 'it-it', 'italian'],
      ko: ['ko', 'ko-kr', 'korean'],
      fr: ['fr', 'fr-fr', 'french'],
      cs: ['cs', 'cs-cz', 'czech'],
      nl: ['nl', 'nl-nl', 'dutch'],
      zh: ['zh', 'zh-cn', 'zh_hans', 'chinese', 'chinese_simplified'],
    };
    for (const key of aliases[code] || [code]) {
      const entry = raw[key];
      if (entry && typeof entry === 'object') return entry;
    }
    return null;
  };

  const normalizeTranslatedIngredients = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((x) => x.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(/[\n,;]+/g)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    }
    return [];
  };

  for (const code of targetLocales) {
    const entry = pickLocaleEntry(data, code);
    const description = entry?.description;
    const fallbackDescription = typeof data?.en?.description === 'string' ? data.en.description.trim() : '';
    const finalDescription =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : fallbackDescription || '';
    if (!finalDescription) return null;
    const base = { description: finalDescription };
    if (n === 0) {
      if (entry?.allergens === undefined) {
        base.allergens = [];
      } else if (Array.isArray(entry.allergens) && entry.allergens.length === 0) {
        base.allergens = [];
      } else {
        base.allergens = [];
      }
    } else {
      const rawAllergens = Array.isArray(entry?.allergens) ? entry.allergens : [];
      if (rawAllergens.length === n) {
        const cleaned = rawAllergens
          .map((a) => (typeof a === 'string' ? a.trim() : ''))
          .filter((a) => a.length > 0);
        base.allergens = cleaned.length === n ? cleaned : [...sourceAllergens];
      } else {
        base.allergens = [...sourceAllergens];
      }
    }

    // Ingredients (PL -> translated list with the same count/order).
    // Tolerancyjnie: normalizujemy do długości `m`, a brakujące pozycje uzupełniamy PL,
    // żeby UI prawie zawsze pokazywało tłumaczenie (nawet jeśli AI format się trochę rozjechał).
    if (m === 0) {
      if (entry.ingredients === undefined) {
        base.ingredients = [];
      } else if (Array.isArray(entry.ingredients) && entry.ingredients.length === 0) {
        base.ingredients = [];
      } else {
        base.ingredients = [];
      }
    } else {
      const fallback = sourceIngredients.map((x) => (typeof x === 'string' ? x.trim() : String(x).trim()));
      const normalized = normalizeTranslatedIngredients(entry?.ingredients);
      if (normalized.length === 0) {
        base.ingredients = fallback;
      } else if (normalized.length >= m) {
        base.ingredients = normalized.slice(0, m);
      } else {
        // Take translated ones first, then fill remainder with PL
        base.ingredients = [...normalized, ...fallback.slice(normalized.length, m)];
      }
    }
    out[code] = base;
  }
  return out;
}

/**
 * Tłumaczy opis i alergeny (PL → EN(UK), EN(US), UK, DE, ES, IT, KO, FR, CS, NL, ZH) do kolumny `translations`. Nazwa dania nie jest tłumaczona.
 * Wymaga JWT + roli właściciela rekordu (`userId`).
 */
export async function handleTranslateDish({ authorization, body = {} }) {
  const user = await verifyToken(authorization);
  if (!user) {
    return { status: 401, body: { error: 'Brak autoryzacji.' } };
  }

  const dishId = typeof body.dishId === 'string' ? body.dishId.trim() : '';
  if (!dishId) {
    return { status: 400, body: { error: 'Wymagane pole dishId.' } };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { status: 503, body: { error: 'OPENAI_API_KEY nie jest skonfigurowany na serwerze.' } };
  }

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return {
      status: 503,
      body: {
        error:
          'Brak SUPABASE_URL / SUPABASE_ANON_KEY na serwerze (dodaj do .env.local lub zduplikuj VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY jako SUPABASE_*).',
      },
    };
  }

  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: row, error: fetchError } = await userClient
    .from('dishes')
    .select('*')
    .eq('id', dishId)
    .maybeSingle();

  if (fetchError) {
    console.error('[translate-dish] select:', fetchError);
    return { status: 500, body: { error: fetchError.message || 'Błąd odczytu dania.' } };
  }
  if (!row) {
    return { status: 404, body: { error: 'Nie znaleziono dania (RLS lub złe id).' } };
  }

  const ownerId = getDishOwnerId(row);
  if (!ownerId || ownerId !== user.id) {
    return { status: 403, body: { error: 'Brak uprawnień do tego dania.' } };
  }

  const name = (row.name || '').trim();
  const description = (row.description || '').trim();
  if (!name || !description) {
    return { status: 400, body: { error: 'Brak nazwy lub opisu do tłumaczenia.' } };
  }

  const allergensPL = normalizeAllergens(row);
  const allergensJson = JSON.stringify(allergensPL);
  const ingredientsPL = Array.isArray(row.ingredients) ? row.ingredients.map((x) => String(x)) : [];
  const ingredientsJson = JSON.stringify(ingredientsPL);

  const allergenBlock =
    allergensPL.length > 0
      ? `
Lista alergenów (język źródłowy PL – dokładnie w tej kolejności, ${allergensPL.length} pozycji): ${allergensJson}
Dla każdego języka (en, en-us, uk, de, es, it, ko, fr, cs, nl, zh) dodaj pole "allergens": tablica stringów — ta sama liczba elementów i ta sama kolejność co powyżej. Przetłumacz każdą etykietę na naturalny, zwięzły odpowiednik w danym języku.`
      : `
Brak zaznaczonych alergenów po stronie PL – dla każdego języka ustaw "allergens": [] (pusta tablica).`;

  const schemaExample =
    allergensPL.length > 0
      ? `{"en":{"description":"...","allergens":["..."],"ingredients":["..."]},"en-us":{"description":"...","allergens":["..."],"ingredients":["..."]},"uk":{"description":"...","allergens":["..."],"ingredients":["..."]},"de":{"description":"...","allergens":["..."],"ingredients":["..."]},"es":{"description":"...","allergens":["..."],"ingredients":["..."]},"it":{"description":"...","allergens":["..."],"ingredients":["..."]},"ko":{"description":"...","allergens":["..."],"ingredients":["..."]},"fr":{"description":"...","allergens":["..."],"ingredients":["..."]},"cs":{"description":"...","allergens":["..."],"ingredients":["..."]},"nl":{"description":"...","allergens":["..."],"ingredients":["..."]},"zh":{"description":"...","allergens":["..."],"ingredients":["..."]}}`
      : `{"en":{"description":"...","allergens":[],"ingredients":["..."]},"en-us":{"description":"...","allergens":[],"ingredients":["..."]},"uk":{"description":"...","allergens":[],"ingredients":["..."]},"de":{"description":"...","allergens":[],"ingredients":["..."]},"es":{"description":"...","allergens":[],"ingredients":["..."]},"it":{"description":"...","allergens":[],"ingredients":["..."]},"ko":{"description":"...","allergens":[],"ingredients":["..."]},"fr":{"description":"...","allergens":[],"ingredients":["..."]},"cs":{"description":"...","allergens":[],"ingredients":["..."]},"nl":{"description":"...","allergens":[],"ingredients":["..."]},"zh":{"description":"...","allergens":[],"ingredients":["..."]}}`;

  const prompt = `Jesteś profesjonalnym tłumaczem kulinarnym. NIE tłumacz nazwy dania — nazwa własna pozostaje w oryginale; w menu jest już zapisana osobno. Przetłumacz WYŁĄCZNIE poniższy opis marketingowy oraz listę składników i zwróć też etykiety alergenów na języki: angielski brytyjski, angielski amerykański, ukraiński, niemiecki, hiszpański, włoski, koreański, francuski, czeski, niderlandzki i chiński uproszczony. Zachowaj sens i ton restauracji w naturalny sposób.
${allergenBlock}

Lista składników (język źródłowy PL – dokładnie w tej kolejności, ${ingredientsPL.length} pozycji): ${ingredientsJson}
Dla każdego języka (en, en-us, uk, de, es, it, ko, fr, cs, nl, zh) dodaj pole "ingredients": tablica stringów — ta sama liczba elementów i ta sama kolejność co powyżej. Przetłumacz każdą nazwę składnika na naturalny, zwięzły odpowiednik w danym języku.

Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy) — każdy z kluczy en, en-us, uk, de, es, it, ko, fr, cs, nl, zh zawiera TYLKO pola "description", "allergens" i "ingredients" (bez pola "name"):
${schemaExample}

Nazwa dania (nie tłumacz, tylko kontekst): ${name}
Opis dania do przetłumaczenia (PL): ${description}`;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Zwracasz wyłącznie poprawny JSON zgodny ze specyfikacją użytkownika. Bez kodu markdown.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { status: 502, body: { error: 'Pusta odpowiedź modelu.' } };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 502, body: { error: 'Nieprawidłowy JSON z modelu.' } };
    }

    const translations = validateTranslations(parsed, allergensPL, ingredientsPL);
    if (!translations) {
      return { status: 502, body: { error: 'Niepoprawna struktura tłumaczeń.' } };
    }

    const { data: updated, error: updateError } = await userClient
      .from('dishes')
      .update({ translations })
      .eq('id', dishId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[translate-dish] Supabase update:', updateError);
      return { status: 500, body: { error: updateError.message || 'Błąd zapisu tłumaczeń.' } };
    }

    return { status: 200, body: { translations, dish: updated } };
  } catch (err) {
    console.error('[translate-dish]', err);
    const message = err instanceof Error ? err.message : String(err);
    return { status: 500, body: { error: message || 'Błąd API OpenAI.' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleTranslateDish({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
