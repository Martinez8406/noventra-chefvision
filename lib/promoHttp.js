import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import {
  getClientIp,
  isValidUuid,
  rateLimitOk,
  sanitizeOptionalText,
} from './feedbackUtils.js';
import { getVerifySessionHeader, resolveRestaurantUserId, verifyOwnerToken } from './promoAuth.js';
import {
  createDeviceSession,
  getDeviceSession,
  hashPin,
  isValidPin,
  issuePromoCodeAfterConfirmedOptIn,
  lookupPromoCode,
  normalizePromoCode,
  ownerCodeView,
  redeemPromoCodeAtomic,
  verifyPin,
} from './promoCodes.js';
import {
  handleGuestPromoConfirm,
  handleGuestPromoResend,
  handleGuestPromoSignup,
  handleOwnerPromoOffer,
  handlePublicPromoOffer,
} from './promoGuest.js';

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

export async function handleVerifySession({ req, body = {} }) {
  const ip = getClientIp(req);
  const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (!isValidUuid(restaurantId)) {
    return { status: 400, body: { error: 'Nieprawidłowy identyfikator restauracji.' } };
  }
  if (!isValidPin(pin)) {
    return { status: 400, body: { error: 'PIN musi mieć 4–8 cyfr.' } };
  }

  const pinKey = `verify-pin:${ip}:${restaurantId}`;
  if (!rateLimitOk(pinKey, 15 * 60 * 1000, 10)) {
    return {
      status: 429,
      body: { error: 'Zbyt wiele prób PIN-u. Spróbuj za kilka minut.', retryAfter: 60 },
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer Verify nie jest skonfigurowany.' } };
  }

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, restaurant_name, waiter_pin_hash')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !profile) {
    return { status: 404, body: { error: 'Nie znaleziono restauracji.' } };
  }

  const pinOk = await verifyPin(pin, profile.waiter_pin_hash);
  if (!pinOk) {
    return { status: 401, body: { error: 'Nieprawidłowy PIN.' } };
  }

  const deviceLabel = sanitizeOptionalText(body?.deviceLabel, 80);
  const session = await createDeviceSession(admin, {
    userId: restaurantId,
    deviceLabel,
  });

  if (!session.ok) {
    return { status: 500, body: { error: session.error } };
  }

  return {
    status: 200,
    body: {
      token: session.token,
      expiresAt: session.expiresAt,
      restaurantId,
      restaurantName: profile.restaurant_name || 'Restauracja',
    },
  };
}

export async function handleVerifyCode({ req, body = {} }) {
  const ip = getClientIp(req);
  const token = getVerifySessionHeader(req);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer Verify nie jest skonfigurowany.' } };
  }

  const session = await getDeviceSession(admin, token);
  if (!session) {
    return { status: 401, body: { error: 'Sesja Verify wygasła. Wpisz PIN ponownie.' } };
  }

  const lookupKey = `verify-lookup:${ip}:${session.user_id}`;
  if (!rateLimitOk(lookupKey, 10 * 60 * 1000, 100)) {
    return {
      status: 429,
      body: { error: 'Zbyt wiele prób. Poczekaj chwilę i spróbuj ponownie.', retryAfter: 20 },
    };
  }

  const code = body?.code;
  if (!normalizePromoCode(code)) {
    return { status: 400, body: { outcome: 'invalid', error: 'Nieprawidłowy format kodu.' } };
  }

  const result = await lookupPromoCode(admin, {
    userId: session.user_id,
    code,
  });

  return { status: 200, body: result };
}

export async function handleRedeemPromo({ req, body = {} }) {
  const ip = getClientIp(req);
  const token = getVerifySessionHeader(req);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer Verify nie jest skonfigurowany.' } };
  }

  const session = await getDeviceSession(admin, token);
  if (!session) {
    return { status: 401, body: { error: 'Sesja Verify wygasła. Wpisz PIN ponownie.' } };
  }

  const redeemKey = `verify-redeem:${ip}:${session.user_id}`;
  if (!rateLimitOk(redeemKey, 10 * 60 * 1000, 120)) {
    return {
      status: 429,
      body: { error: 'Zbyt wiele realizacji. Poczekaj chwilę.', retryAfter: 15 },
    };
  }

  if (!normalizePromoCode(body?.code)) {
    return { status: 400, body: { outcome: 'invalid', error: 'Nieprawidłowy format kodu.' } };
  }

  const result = await redeemPromoCodeAtomic(admin, {
    userId: session.user_id,
    code: body.code,
    usedByDevice: session.id,
  });

  if (result.error) {
    return { status: 500, body: { error: result.error } };
  }

  const status = result.outcome === 'redeemed' ? 200 : 409;
  return { status, body: result };
}

function firstQueryValue(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  if (typeof value === 'string') return value.trim();
  return '';
}

function flattenQuery(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}

function queryFromUrl(url) {
  const raw = String(url || '');
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return {};
  try {
    return Object.fromEntries(new URLSearchParams(raw.slice(qIndex + 1)));
  } catch {
    return {};
  }
}

export function resolvePromoOp(req) {
  const url = String(req?.url || '');
  const fromQuery = firstQueryValue(req?.query?.op);
  if (fromQuery) return fromQuery;
  const fromUrl = firstQueryValue(queryFromUrl(url).op);
  if (fromUrl) return fromUrl;
  if (url.includes('promo-pin')) return 'pin';
  if (url.includes('verify-session')) return 'verify-session';
  if (url.includes('verify-code')) return 'verify-code';
  if (url.includes('redeem-promo')) return 'redeem';
  if (url.includes('promo-signup')) return 'signup';
  if (url.includes('promo-resend')) return 'resend';
  if (url.includes('promo-confirm')) return 'confirm';
  if (url.includes('promo-offer-config')) return 'offer-config';
  if (url.includes('promo-offer')) return 'offer';
  return 'codes';
}

export async function handlePromoApi({ req, authorization, query, body, method }) {
  const q = flattenQuery({ ...queryFromUrl(req?.url), ...(query || req?.query || {}) });
  const op = resolvePromoOp({ query: q, url: req?.url });
  if (op === 'offer') return handlePublicPromoOffer({ query: q });
  if (op === 'signup') {
    if (String(method || '').toUpperCase() !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed' } };
    }
    return handleGuestPromoSignup({ req, body });
  }
  if (op === 'resend') {
    if (String(method || '').toUpperCase() !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed' } };
    }
    return handleGuestPromoResend({ req, body });
  }
  if (op === 'confirm') return handleGuestPromoConfirm({ query: q });
  if (op === 'offer-config') {
    return handleOwnerPromoOffer({ req, authorization, query: q, body, method });
  }
  if (op === 'pin') {
    return handlePromoPin({ req, authorization, query: q, body, method });
  }
  if (op === 'verify-session') {
    if (String(method || '').toUpperCase() !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed' } };
    }
    return handleVerifySession({ req, body });
  }
  if (op === 'verify-code') {
    if (String(method || '').toUpperCase() !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed' } };
    }
    return handleVerifyCode({ req, body });
  }
  if (op === 'redeem') {
    if (String(method || '').toUpperCase() !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed' } };
    }
    return handleRedeemPromo({ req, body });
  }
  return handlePromoCodes({ req, authorization, query: q, body, method });
}
