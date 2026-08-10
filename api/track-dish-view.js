import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';

function isValidUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Zapis otwarcia szczegółu dania:
 * - wiersz w dish_view_events (ranking 7 dni / miesiąc)
 * - +1 do dishes.clicks (suma łączna)
 */
export async function handleTrackDishView({ body = {} }) {
  const dishId = typeof body?.dishId === 'string' ? body.dishId.trim() : '';
  if (!isValidUuid(dishId)) {
    return { status: 400, body: { error: 'Nieprawidłowe dishId.' } };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Brak SUPABASE_SERVICE_ROLE_KEY na serwerze.' } };
  }

  const { data: row, error: readError } = await admin
    .from('dishes')
    .select('id, clicks, userId')
    .eq('id', dishId)
    .maybeSingle();

  if (readError) {
    return { status: 500, body: { error: readError.message || 'Błąd odczytu dania.' } };
  }
  if (!row?.id) {
    return { status: 404, body: { error: 'Nie znaleziono dania.' } };
  }

  const ownerId = row.userId;
  if (!ownerId || !isValidUuid(String(ownerId))) {
    return { status: 500, body: { error: 'Danie nie ma poprawnego właściciela (userId).' } };
  }

  const { error: insertError } = await admin.from('dish_view_events').insert({
    owner_id: ownerId,
    dish_id: dishId,
  });

  if (insertError) {
    const missingTable = String(insertError.message || '')
      .toLowerCase()
      .includes('dish_view_events');
    return {
      status: 500,
      body: {
        error: missingTable
          ? 'Brak tabeli dish_view_events. Uruchom supabase/dish_view_events.sql'
          : insertError.message || 'Błąd zapisu zdarzenia.',
      },
    };
  }

  const current = typeof row.clicks === 'number' && Number.isFinite(row.clicks) ? row.clicks : 0;
  const next = current + 1;
  const { error: updateError } = await admin
    .from('dishes')
    .update({ clicks: next })
    .eq('id', dishId);

  if (updateError) {
    console.warn('[track-dish-view] clicks update failed:', updateError.message);
  }

  return { status: 200, body: { ok: true, clicks: next } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleTrackDishView({
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
