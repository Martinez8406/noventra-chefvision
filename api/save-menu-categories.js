import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';

const TARGET_LOCALES = ['en', 'uk', 'de', 'es', 'it', 'ko', 'fr', 'zh'];

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

function normalizeCategories(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((x) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : ''))
    .filter(Boolean)
    .slice(0, 60)
    .map((x) => x.slice(0, 80));
  return Array.from(new Set(cleaned));
}

function validateTranslationMap(raw, categories) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const category of categories) {
    const entry = raw[category];
    if (!entry || typeof entry !== 'object') return null;
    const item = {};
    for (const locale of TARGET_LOCALES) {
      const v = entry[locale];
      if (typeof v !== 'string' || !v.trim()) return null;
      item[locale] = v.trim().slice(0, 120);
    }
    out[category] = item;
  }
  return out;
}

function fallbackTranslations(categories) {
  const out = {};
  for (const c of categories) {
    out[c] = { en: c, uk: c, de: c, es: c, it: c, ko: c, fr: c, zh: c };
  }
  return out;
}

export async function handleSaveMenuCategories({ authorization, body = {} }) {
  const user = await verifyToken(authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };

  const categories = normalizeCategories(body?.categories);
  if (categories.length === 0) {
    return { status: 400, body: { error: 'Przekaż niepustą listę kategorii.' } };
  }

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return { status: 503, body: { error: 'Brak SUPABASE_URL / SUPABASE_ANON_KEY na serwerze.' } };
  }

  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
  });

  let translations = fallbackTranslations(categories);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const prompt = `Przetłumacz poniższe nazwy kategorii menu z języka polskiego na en, uk, de, es, it, ko, fr i zh (chiński uproszczony).
Zasady:
- zachowaj styl etykiet menu (krótkie, naturalne)
- nie dodawaj nowych kategorii
- klucze JSON muszą być IDENTYCZNE jak wejściowe nazwy kategorii

Kategorie:
${JSON.stringify(categories)}

Zwróć WYŁĄCZNIE JSON w formacie:
{
  "Nazwa kategorii PL": { "en": "...", "uk": "...", "de": "...", "es": "...", "it": "...", "ko": "...", "fr": "...", "zh": "..." }
}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Zwracasz wyłącznie poprawny JSON bez markdown.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });
      const raw = completion.choices[0]?.message?.content;
      const parsed = raw ? JSON.parse(raw) : null;
      const validated = validateTranslationMap(parsed, categories);
      if (validated) translations = validated;
    } catch (err) {
      console.warn('[save-menu-categories] translation fallback:', err?.message || err);
    }
  }

  const payload = {
    menu_categories: categories,
    menu_category_translations: translations,
  };

  const { data, error } = await userClient
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('id, menu_categories, menu_category_translations')
    .single();

  if (error) {
    const msg = error.message || 'Błąd zapisu kategorii.';
    const missingColumn =
      msg.includes('menu_categories') || msg.includes('menu_category_translations');
    return {
      status: 500,
      body: {
        error: missingColumn
          ? 'Brak kolumn menu_categories/menu_category_translations w tabeli profiles. Uruchom migrację SQL.'
          : msg,
      },
    };
  }

  return {
    status: 200,
    body: {
      menuCategories: data?.menu_categories || categories,
      menuCategoryTranslations: data?.menu_category_translations || translations,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleSaveMenuCategories({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}

