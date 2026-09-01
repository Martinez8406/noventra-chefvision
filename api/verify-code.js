import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { getClientIp, rateLimitOk } from '../lib/feedbackUtils.js';
import { getVerifySessionHeader } from '../lib/promoAuth.js';
import { getDeviceSession, lookupPromoCode, normalizePromoCode } from '../lib/promoCodes.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Verify-Session');
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleVerifyCode({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
