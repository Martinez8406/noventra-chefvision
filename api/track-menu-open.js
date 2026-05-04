import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';

function isValidUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleTrackMenuOpen({ body = {} }) {
  const ownerId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!isValidUuid(ownerId)) {
    return { status: 400, body: { error: 'Nieprawidłowe userId.' } };
  }

  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) {
    return { status: 503, body: { error: 'Brak SUPABASE_URL / SUPABASE_ANON_KEY na serwerze.' } };
  }

  const client = createClient(url, key);
  const { error } = await client
    .from('menu_open_events')
    .insert({ owner_id: ownerId });

  if (error) {
    const missingTable = String(error.message || '').toLowerCase().includes('menu_open_events');
    return {
      status: 500,
      body: {
        error: missingTable
          ? 'Brak tabeli menu_open_events. Uruchom migrację SQL.'
          : (error.message || 'Błąd zapisu statystyki.'),
      },
    };
  }

  return { status: 200, body: { ok: true } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleTrackMenuOpen({
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}

