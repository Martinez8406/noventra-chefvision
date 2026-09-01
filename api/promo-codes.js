import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { isValidUuid } from '../lib/feedbackUtils.js';
import { verifyOwnerToken, resolveRestaurantUserId } from '../lib/promoAuth.js';
import { issuePromoCodeAfterConfirmedOptIn, ownerCodeView } from '../lib/promoCodes.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

export async function handleListPromoCodes({ req, authorization, query = {} }) {
  const targetUserId = query.targetUserId || query.userId || null;
  const authz = await requireAdminAndUser({ req, authorization, targetUserId });
  if (authz.status) return authz;

  const { data, error } = await authz.admin
    .from('promo_codes')
    .select('id, code, reward_name, reward_description, status, email, created_at, expires_at, used_at')
    .eq('user_id', authz.userId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się pobrać kodów.' } };
  }

  return { status: 200, body: { codes: (data || []).map(ownerCodeView) } };
}

export async function handleCreatePromoCode({ req, authorization, body = {} }) {
  const targetUserId = body.targetUserId || body.userId || null;
  const authz = await requireAdminAndUser({ req, authorization, targetUserId });
  if (authz.status) return authz;

  const result = await issuePromoCodeAfterConfirmedOptIn(authz.admin, {
    userId: authz.userId,
    email: body.email,
    rewardName: body.rewardName || body.reward_name,
    rewardDescription: body.rewardDescription || body.reward_description,
    expiresAt: body.expiresAt || body.expires_at || null,
    campaignId: body.campaignId || body.campaign_id || null,
    code: body.code || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : { source: 'owner_panel' },
  });

  if (!result.ok) {
    return { status: result.status, body: { error: result.error } };
  }

  return { status: 201, body: { code: ownerCodeView(result.code) } };
}

export async function handleCancelPromoCode({ req, authorization, body = {} }) {
  const targetUserId = body.targetUserId || body.userId || null;
  const authz = await requireAdminAndUser({ req, authorization, targetUserId });
  if (authz.status) return authz;

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!isValidUuid(id)) {
    return { status: 400, body: { error: 'Nieprawidłowy identyfikator kodu.' } };
  }

  const { data, error } = await authz.admin
    .from('promo_codes')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', authz.userId)
    .eq('status', 'active')
    .select('id, code, reward_name, reward_description, status, email, created_at, expires_at, used_at')
    .maybeSingle();

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się anulować kodu.' } };
  }
  if (!data) {
    return { status: 409, body: { error: 'Kod nie jest aktywny albo nie istnieje.' } };
  }

  return { status: 200, body: { code: ownerCodeView(data) } };
}

export async function handlePromoCodes({ req, authorization, query, body, method }) {
  const verb = String(method || req?.method || 'GET').toUpperCase();
  if (verb === 'GET') return handleListPromoCodes({ req, authorization, query });
  if (verb === 'POST') return handleCreatePromoCode({ req, authorization, body });
  if (verb === 'PATCH') return handleCancelPromoCode({ req, authorization, body });
  return { status: 405, body: { error: 'Method not allowed' } };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const result = await handlePromoCodes({
    req,
    authorization: req.headers.authorization || req.headers.Authorization,
    query: req.query || {},
    body: req.body || {},
    method: req.method,
  });
  return res.status(result.status).json(result.body);
}
