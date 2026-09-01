import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { getClientIp, rateLimitOk } from '../lib/feedbackUtils.js';
import { getVerifySessionHeader } from '../lib/promoAuth.js';
import { getDeviceSession, normalizePromoCode, redeemPromoCodeAtomic } from '../lib/promoCodes.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Verify-Session');
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleRedeemPromo({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
