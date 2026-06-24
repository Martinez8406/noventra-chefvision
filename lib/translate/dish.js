import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getDishOwnerId, getSupabaseServerCredentials } from '../supabaseServerEnv.js';
import {
  getMenuTranslationLocales,
  MENU_TRANSLATION_LOCALES_FULL,
  resolveEffectivePlan,
} from '../../utils/tokens.js';

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

function normalizeIngredients(row) {
  const raw = row?.ingredients;
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

/** Obcięcie opcjonalnego bloku ```json … ``` z odpowiedzi modelu. */
function stripMarkdownJsonFence(raw) {
  let s = String(raw ?? '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '');
    s = s.replace(/\s*```\s*$/i, '');
    s = s.trim();
  }
  return s;
}

const ROOT_LOCALE_KEYS = MENU_TRANSLATION_LOCALES_FULL;

/** Model czasem owija lokale w { translations: { en: … } } zamiast płaskiego obiektu. */
function unwrapTranslationsPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const looksLikeLocaleRoot = (o) =>
    typeof o === 'object' &&
    o !== null &&
    ROOT_LOCALE_KEYS.some((k) => Object.prototype.hasOwnProperty.call(o, k));

  if (looksLikeLocaleRoot(parsed)) return parsed;

  for (const wrap of ['translations', 'data', 'result', 'response', 'menu', 'output']) {
    const inner = parsed[wrap];
    if (looksLikeLocaleRoot(inner)) return inner;
  }
  return parsed;
}

function pickEntryDescription(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const keys = ['description', 'desc', 'marketing_description', 'marketing', 'summary', 'text', 'copy'];
  for (const k of keys) {
    const v = entry[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function pickEntryIngredientsRaw(entry) {
  if (!entry || typeof entry !== 'object') return undefined;
  const keys = ['ingredients', 'items', 'ingredient_list', 'składniki', 'skladniki'];
  for (const k of keys) {
    if (entry[k] !== undefined && entry[k] !== null) return entry[k];
  }
  return undefined;
}

function pickEntryAllergensRaw(entry) {
  if (!entry || typeof entry !== 'object') return undefined;
  const keys = ['allergens', 'allergen_labels', 'allergies'];
  for (const k of keys) {
    if (entry[k] !== undefined && entry[k] !== null) return entry[k];
  }
  return undefined;
}

/** Model czasem zwraca stary klucz en-us zamiast he — ujednolicamy przed walidacją. */
function normalizeParsedKeys(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (!parsed.he && parsed['en-us']) {
    parsed.he = parsed['en-us'];
  }
  // Czasem arabski jest pod inną nazwą klucza — scalać do "ar"
  if (!parsed.ar) {
    const arCandidate =
      parsed.Arabic ??
      parsed.arabic ??
      parsed.arabski ??
      parsed.Arabski ??
      parsed.ARA ??
      parsed['ar-SA'] ??
      parsed.ar_SA;
    if (arCandidate && typeof arCandidate === 'object') {
      parsed.ar = arCandidate;
    }
  }
  return parsed;
}

function validateTranslations(data, sourceAllergens, sourceIngredients, targetLocales) {
  if (!data || typeof data !== 'object') return null;
  const n = sourceAllergens.length;
  const m = sourceIngredients.length;
  const out = {};
  const locales = Array.isArray(targetLocales) && targetLocales.length > 0 ? targetLocales : ROOT_LOCALE_KEYS;

  const pickLocaleEntry = (raw, code) => {
    if (!raw || typeof raw !== 'object') return null;
    const aliases = {
      he: ['he', 'he-il', 'he_il', 'iw', 'hebrew', 'en-us', 'en_us', 'enus'],
      ar: ['ar', 'ar-sa', 'ar_ae', 'ar-SA', 'arabic', 'Arabic', 'AR', 'ar-eg'],
      en: ['en', 'en-gb', 'en_gb', 'english_uk', 'uk_english', 'british_english'],
      uk: ['uk', 'ua', 'ukrainian'],
      de: ['de', 'de-de', 'german'],
      es: ['es', 'es-es', 'spanish'],
      it: ['it', 'it-it', 'italian'],
      ko: ['ko', 'ko-kr', 'korean'],
      ja: ['ja', 'ja-jp', 'jp', 'japanese'],
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

  /** Gdy brak pola opisu w danej lokali, bierz pierwszy niepusty z listy (żeby walidacja nie odrzucała całego JSON). */
  const pickAnyFallbackDescription = () => {
    const order = ['en', 'he', 'ar', 'uk', 'de', 'es', 'it', 'ko', 'ja', 'fr', 'cs', 'nl', 'zh'];
    for (const loc of order) {
      const e = pickLocaleEntry(data, loc);
      const d = pickEntryDescription(e);
      if (d) return d;
    }
    return '';
  };

  const sharedFallbackDescription = pickAnyFallbackDescription();

  for (const code of locales) {
    const entry = pickLocaleEntry(data, code);
    const finalDescription = pickEntryDescription(entry) || sharedFallbackDescription || '';
    if (!finalDescription) return null;
    const base = { description: finalDescription };
    if (n === 0) {
      if (entry?.allergens === undefined) {
        base.allergens = [];
      } else if (Array.isArray(entry?.allergens) && (entry?.allergens?.length ?? 0) === 0) {
        base.allergens = [];
      } else {
        base.allergens = [];
      }
    } else {
      const rawAllergensArr = pickEntryAllergensRaw(entry);
      const rawAllergens = Array.isArray(rawAllergensArr) ? rawAllergensArr : [];
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
      if (entry?.ingredients === undefined) {
        base.ingredients = [];
      } else if (Array.isArray(entry?.ingredients) && (entry?.ingredients?.length ?? 0) === 0) {
        base.ingredients = [];
      } else {
        base.ingredients = [];
      }
    } else {
      const fallback = sourceIngredients.map((x) => (typeof x === 'string' ? x.trim() : String(x).trim()));
      const normalized = normalizeTranslatedIngredients(pickEntryIngredientsRaw(entry));
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
 * Tłumaczy opis i alergeny (PL → EN(UK), HE, AR, UK, DE, ES, IT, KO, JA, FR, CS, NL, ZH) do kolumny `translations`. Nazwa dania nie jest tłumaczona.
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

  const { data: profileRow, error: profileError } = await userClient
    .from('profiles')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[translate-dish] profile:', profileError);
    return { status: 500, body: { error: 'Błąd odczytu profilu.' } };
  }

  const targetLocales = getMenuTranslationLocales(profileRow || {});
  const localeList = targetLocales.join(', ');
  const englishOnly = targetLocales.length === 1 && targetLocales[0] === 'en';

  const allergensPL = normalizeAllergens(row);
  const allergensJson = JSON.stringify(allergensPL);
  const ingredientsPL = normalizeIngredients(row);
  const ingredientsJson = JSON.stringify(ingredientsPL);

  const localeEntryExample =
    allergensPL.length > 0
      ? '{"description":"...","allergens":["..."],"ingredients":["..."]}'
      : '{"description":"...","allergens":[],"ingredients":["..."]}';

  const schemaExample = `{${targetLocales.map((code) => `"${code}":${localeEntryExample}`).join(',')}}`;

  const allergenBlock =
    allergensPL.length > 0
      ? `
Lista alergenów (język źródłowy PL – dokładnie w tej kolejności, ${allergensPL.length} pozycji): ${allergensJson}
Dla każdego języka (${localeList}) dodaj pole "allergens": tablica stringów — ta sama liczba elementów i ta sama kolejność co powyżej. Przetłumacz każdą etykietę na naturalny, zwięzły odpowiednik w danym języku.`
      : `
Brak zaznaczonych alergenów po stronie PL – dla każdego języka ustaw "allergens": [] (pusta tablica).`;

  const targetLanguageDescription = englishOnly
    ? 'angielski brytyjski'
    : 'angielski brytyjski, hebrajski (nowy hebrajski), arabski (współczesny standardowy), ukraiński, niemiecki, hiszpański, włoski, koreański, japoński (standardowy współczesny), francuski, czeski, niderlandzki i chiński uproszczony';

  const localeKeyRules = englishOnly
    ? `Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy) — klucz "en" zawiera TYLKO pola "description", "allergens" i "ingredients" (bez pola "name").`
    : `Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy) — każdy z kluczy ${localeList} zawiera TYLKO pola "description", "allergens" i "ingredients" (bez pola "name"). Język hebrajski MUSI być pod kluczem dokładnie "he" (nie używaj "en-us"). Język arabski MUSI być pod kluczem dokładnie "ar" (małe litery, łacina) — przetłumacz opis, składniki i alergeny na **arabski**, nie zostawiaj angielskiego w bloku "ar". Język japoński MUSI być pod kluczem dokładnie "ja".`;

  const prompt = `Jesteś profesjonalnym tłumaczem kulinarnym. NIE tłumacz nazwy dania — nazwa własna pozostaje w oryginale; w menu jest już zapisana osobno. Przetłumacz WYŁĄCZNIE poniższy opis marketingowy oraz listę składników i zwróć też etykiety alergenów na języki: ${targetLanguageDescription}. Zachowaj sens i ton restauracji w naturalny sposób.
${allergenBlock}

Lista składników (język źródłowy PL – dokładnie w tej kolejności, ${ingredientsPL.length} pozycji): ${ingredientsJson}
Dla każdego języka (${localeList}) dodaj pole "ingredients": tablica stringów — ta sama liczba elementów i ta sama kolejność co powyżej. Przetłumacz każdą nazwę składnika na naturalny, zwięzły odpowiednik w danym języku.

${localeKeyRules}
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
      parsed = JSON.parse(stripMarkdownJsonFence(raw));
    } catch {
      return { status: 502, body: { error: 'Nieprawidłowy JSON z modelu.' } };
    }

    parsed = unwrapTranslationsPayload(parsed);
    normalizeParsedKeys(parsed);

    const translations = validateTranslations(parsed, allergensPL, ingredientsPL, targetLocales);
    if (!translations) {
      console.warn(
        '[translate-dish] Niepoprawna struktura tłumaczeń (parsed keys):',
        parsed && typeof parsed === 'object' ? Object.keys(parsed) : parsed
      );
      return { status: 502, body: { error: 'Niepoprawna struktura tłumaczeń.' } };
    }

    const toSave =
      resolveEffectivePlan(profileRow || {}) === 'free' ? { en: translations.en } : translations;

    const { data: updated, error: updateError } = await userClient
      .from('dishes')
      .update({ translations: toSave })
      .eq('id', dishId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[translate-dish] Supabase update:', updateError);
      return { status: 500, body: { error: updateError.message || 'Błąd zapisu tłumaczeń.' } };
    }

    return { status: 200, body: { translations: toSave, dish: updated } };
  } catch (err) {
    console.error('[translate-dish]', err);
    const message = err instanceof Error ? err.message : String(err);
    return { status: 500, body: { error: message || 'Błąd API OpenAI.' } };
  }
}
