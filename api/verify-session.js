import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { getClientIp, isValidUuid, rateLimitOk, sanitizeOptionalText } from '../lib/feedbackUtils.js';
import { createDeviceSession, isValidPin, verifyPin } from '../lib/promoCodes.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Verify-Session');
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleVerifySession({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
