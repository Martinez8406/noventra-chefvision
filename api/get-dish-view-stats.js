import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from '../lib/supabaseServerEnv.js';

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

function resolvePeriodStart(period, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '7d') {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null; // all
}

/**
 * Ranking otwarć szczegółów dań: period = 7d | month | all
 */
export async function handleGetDishViewStats({ authorization, query = {} }) {
  const user = await verifyToken(authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };

  const requestedUserId = typeof query?.userId === 'string' ? query.userId.trim() : '';
  if (requestedUserId && requestedUserId !== user.id) {
    return { status: 403, body: { error: 'Brak uprawnień do statystyk innego użytkownika.' } };
  }

  const periodRaw = typeof query?.period === 'string' ? query.period.trim() : '7d';
  const period = periodRaw === 'month' || periodRaw === 'all' || periodRaw === '7d' ? periodRaw : '7d';
  const since = resolvePeriodStart(period);

  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) {
    return { status: 503, body: { error: 'Brak SUPABASE_URL / SUPABASE_ANON_KEY na serwerze.' } };
  }

  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });

  let eventsQ = client
    .from('dish_view_events')
    .select('dish_id, viewed_at')
    .eq('owner_id', user.id);

  if (since) {
    eventsQ = eventsQ.gte('viewed_at', since.toISOString());
  }

  const { data: events, error: eventsError } = await eventsQ;
  if (eventsError) {
    const missing = String(eventsError.message || '')
      .toLowerCase()
      .includes('dish_view_events');
    return {
      status: 500,
      body: {
        error: missing
          ? 'Brak tabeli dish_view_events. Uruchom supabase/dish_view_events.sql'
          : eventsError.message || 'Błąd odczytu kliknięć.',
      },
    };
  }

  const counts = new Map();
  for (const row of events || []) {
    const id = row.dish_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const dishIds = Array.from(counts.keys());
  let dishesById = {};
  if (dishIds.length) {
    const { data: dishes, error: dishesError } = await client
      .from('dishes')
      .select('id, name, imageUrl, clicks')
      .eq('userId', user.id)
      .in('id', dishIds);

    if (dishesError) {
      return { status: 500, body: { error: dishesError.message || 'Błąd odczytu dań.' } };
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
    status: 200,
    body: {
      period,
      since: since ? since.toISOString().slice(0, 10) : null,
      ranking,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleGetDishViewStats({
    authorization: req.headers.authorization,
    query: req.query || {},
  });
  return res.status(result.status).json(result.body);
}
