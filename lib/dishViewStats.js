import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';

function isValidUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Zapis otwarcia szczegółu dania (events + dishes.clicks).
 * Wywoływane z track-menu-open gdy body.dishId jest ustawione.
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

export function resolveDishViewsPeriodStart(period, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '7d') {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

/** Ranking dań dla właściciela (RLS przez client z Authorization). */
export async function fetchDishViewRanking(client, ownerId, period = '7d') {
  const since = resolveDishViewsPeriodStart(period);
  let eventsQ = client
    .from('dish_view_events')
    .select('dish_id, viewed_at')
    .eq('owner_id', ownerId);

  if (since) {
    eventsQ = eventsQ.gte('viewed_at', since.toISOString());
  }

  const { data: events, error: eventsError } = await eventsQ;
  if (eventsError) {
    const missing = String(eventsError.message || '')
      .toLowerCase()
      .includes('dish_view_events');
    return {
      error: missing
        ? 'Brak tabeli dish_view_events. Uruchom supabase/dish_view_events.sql'
        : eventsError.message || 'Błąd odczytu kliknięć.',
    };
  }

  const counts = new Map();
  for (const row of events || []) {
    const id = row.dish_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const dishIds = Array.from(counts.keys());
  const dishesById = {};
  if (dishIds.length) {
    const { data: dishes, error: dishesError } = await client
      .from('dishes')
      .select('id, name, imageUrl, clicks')
      .eq('userId', ownerId)
      .in('id', dishIds);

    if (dishesError) {
      return { error: dishesError.message || 'Błąd odczytu dań.' };
    }
    for (const d of dishes || []) {
      dishesById[d.id] = d;
    }
  }

  const ranking = Array.from(counts.entries())
    .map(([dishId, views]) => {
      const d = dishesById[dishId];
      return {
        dishId,
        name: d?.name || 'Danie',
        imageUrl: d?.imageUrl || null,
        views,
        clicksTotal: typeof d?.clicks === 'number' ? d.clicks : views,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  return {
    period,
    since: since ? since.toISOString().slice(0, 10) : null,
    ranking,
  };
}
