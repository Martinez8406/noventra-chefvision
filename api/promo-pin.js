import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { verifyOwnerToken, resolveRestaurantUserId } from '../lib/promoAuth.js';
import { hashPin, isValidPin } from '../lib/promoCodes.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireAdminAndUser({ req, authorization, targetUserId }) {
  const user = await verifyOwnerToken(authorization || req?.headers?.authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Brak SUPABASE_SERVICE_ROLE_KEY na serwerze.' } };
  }

  const resolved = await resolveRestaurantUserId(admin, { user, targetUserId });
  if (!resolved.ok) return { status: resolved.status, body: { error: resolved.error } };

  return { admin, userId: resolved.userId };
}

export async function handleGetPromoPinStatus({ req, authorization, query = {} }) {
  const targetUserId = query.targetUserId || query.userId || null;
  const authz = await requireAdminAndUser({ req, authorization, targetUserId });
  if (authz.status) return authz;

  const { data, error } = await authz.admin
    .from('profiles')
    .select('waiter_pin_hash, waiter_pin_updated_at, restaurant_name')
    .eq('id', authz.userId)
    .maybeSingle();

  if (error || !data) {
    return { status: 404, body: { error: 'Nie znaleziono restauracji.' } };
  }

  return {
    status: 200,
    body: {
      pinSet: typeof data.waiter_pin_hash === 'string' && data.waiter_pin_hash.length > 0,
      updatedAt: data.waiter_pin_updated_at || null,
      restaurantName: data.restaurant_name || null,
    },
  };
}

export async function handleSetPromoPin({ req, authorization, body = {} }) {
  const targetUserId = body.targetUserId || body.userId || null;
  const authz = await requireAdminAndUser({ req, authorization, targetUserId });
  if (authz.status) return authz;

  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  if (!isValidPin(pin)) {
    return { status: 400, body: { error: 'PIN musi mieć 4–8 cyfr.' } };
  }

  const pinHash = await hashPin(pin);
  const { error } = await authz.admin
    .from('profiles')
    .update({
      waiter_pin_hash: pinHash,
      waiter_pin_updated_at: new Date().toISOString(),
    })
    .eq('id', authz.userId);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się zapisać PIN-u.' } };
  }

  return { status: 200, body: { ok: true, pinSet: true } };
}

export async function handlePromoPin({ req, authorization, query, body, method }) {
  const verb = String(method || req?.method || 'GET').toUpperCase();
  if (verb === 'GET') return handleGetPromoPinStatus({ req, authorization, query });
  if (verb === 'POST') return handleSetPromoPin({ req, authorization, body });
  return { status: 405, body: { error: 'Method not allowed' } };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const result = await handlePromoPin({
    req,
    authorization: req.headers.authorization || req.headers.Authorization,
    query: req.query || {},
    body: req.body || {},
    method: req.method,
  });
  return res.status(result.status).json(result.body);
}
