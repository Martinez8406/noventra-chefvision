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

export async function handleGetMenuOpenStats({ authorization, query = {} }) {
  const user = await verifyToken(authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };

  const requestedUserId = typeof query?.userId === 'string' ? query.userId.trim() : '';
  if (requestedUserId && requestedUserId !== user.id) {
    return { status: 403, body: { error: 'Brak uprawnień do statystyk innego użytkownika.' } };
  }

  const ownerId = user.id;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const chartDays = 30;
  const startOfRange = new Date(startOfToday);
  startOfRange.setDate(startOfRange.getDate() - (chartDays - 1));

  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) {
    return { status: 503, body: { error: 'Brak SUPABASE_URL / SUPABASE_ANON_KEY na serwerze.' } };
  }
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });

  const todayQ = await client
    .from('menu_open_events')
    .select('id', { head: true, count: 'exact' })
    .eq('owner_id', ownerId)
    .gte('opened_at', startOfToday.toISOString());

  if (todayQ.error) {
    const msg = todayQ.error.message || 'Błąd odczytu statystyk (dzisiaj).';
    return { status: 500, body: { error: msg } };
  }

  const monthQ = await client
    .from('menu_open_events')
    .select('id', { head: true, count: 'exact' })
    .eq('owner_id', ownerId)
    .gte('opened_at', startOfMonth.toISOString());

  if (monthQ.error) {
    const msg = monthQ.error.message || 'Błąd odczytu statystyk (miesiąc).';
    return { status: 500, body: { error: msg } };
  }

  const rangeQ = await client
    .from('menu_open_events')
    .select('opened_at')
    .eq('owner_id', ownerId)
    .gte('opened_at', startOfRange.toISOString())
    .order('opened_at', { ascending: true });

  if (rangeQ.error) {
    const msg = rangeQ.error.message || 'Błąd odczytu statystyk (wykres).';
    return { status: 500, body: { error: msg } };
  }

  const byDay = new Map();
  for (let i = 0; i < chartDays; i += 1) {
    const d = new Date(startOfRange);
    d.setDate(startOfRange.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of rangeQ.data || []) {
    const isoDay = String(row.opened_at || '').slice(0, 10);
    if (byDay.has(isoDay)) {
      byDay.set(isoDay, Number(byDay.get(isoDay) || 0) + 1);
    }
  }

  const dailySeries = Array.from(byDay.entries()).map(([date, opens]) => ({ date, opens }));

  return {
    status: 200,
    body: {
      daily: todayQ.count || 0,
      monthly: monthQ.count || 0,
      today: startOfToday.toISOString().slice(0, 10),
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      dailySeries,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleGetMenuOpenStats({
    authorization: req.headers.authorization,
    query: req.query || {},
  });
  return res.status(result.status).json(result.body);
}

