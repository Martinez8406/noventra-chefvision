import { randomBytes, randomInt, pbkdf2, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { isValidUuid } from './feedbackUtils.js';

const pbkdf2Async = promisify(pbkdf2);

export const PROMO_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const PROMO_CODE_FORMAT_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{2}-[0-9]{4}$/;

const PIN_RE = /^\d{4,8}$/;
const PBKDF2_ITERATIONS = 120000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GENERATE_ATTEMPTS = 24;

export function formatPromoCodeInput(raw) {
  const upper = String(raw || '').toUpperCase();
  let letters = '';
  let digits = '';
  for (const ch of upper) {
    if (letters.length < 2 && PROMO_CODE_LETTERS.includes(ch)) {
      letters += ch;
      continue;
    }
    if (letters.length >= 2 && digits.length < 4 && ch >= '0' && ch <= '9') {
      digits += ch;
    }
  }
  if (digits.length > 0) return `${letters}-${digits}`;
  return letters;
}

export function isValidPromoCodeFormat(code) {
  return PROMO_CODE_FORMAT_RE.test(String(code || '').trim().toUpperCase());
}

export function normalizePromoCode(raw) {
  const formatted = formatPromoCodeInput(raw);
  return isValidPromoCodeFormat(formatted) ? formatted : null;
}

export function isValidPin(pin) {
  return PIN_RE.test(String(pin || ''));
}

export function generatePromoCodeValue() {
  const a = PROMO_CODE_LETTERS[randomInt(PROMO_CODE_LETTERS.length)];
  const b = PROMO_CODE_LETTERS[randomInt(PROMO_CODE_LETTERS.length)];
  const digits = String(randomInt(0, 10000)).padStart(4, '0');
  return `${a}${b}-${digits}`;
}

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(String(pin), salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPin(pin, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'pbkdf2' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await pbkdf2Async(String(pin), salt, PBKDF2_ITERATIONS, 32, 'sha256');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function waiterPublicResult(row, outcome) {
  return {
    outcome,
    code: row?.code || null,
    rewardName: row?.reward_name || null,
    rewardDescription: row?.reward_description || null,
    usedAt: row?.used_at || null,
  };
}

/**
 * Generator serwerowy. Wywołać po potwierdzonym zapisie (np. Double Opt-In).
 * Na MVP woła to panel właściciela / seed testowy — bez osobnego mailera.
 */
export async function issuePromoCodeAfterConfirmedOptIn(admin, {
  userId,
  email = null,
  rewardName,
  rewardDescription = null,
  expiresAt = null,
  campaignId = null,
  code = null,
  metadata = {},
}) {
  if (!admin) {
    return { ok: false, status: 503, error: 'Brak klienta administracyjnego Supabase.' };
  }
  if (!isValidUuid(userId)) {
    return { ok: false, status: 400, error: 'Nieprawidłowy identyfikator restauracji.' };
  }

  const name = typeof rewardName === 'string' ? rewardName.trim().slice(0, 120) : '';
  if (!name) {
    return { ok: false, status: 400, error: 'Podaj nazwę nagrody.' };
  }

  const description =
    typeof rewardDescription === 'string' && rewardDescription.trim()
      ? rewardDescription.trim().slice(0, 400)
      : null;

  const guestEmail =
    typeof email === 'string' && email.trim() ? email.trim().toLowerCase().slice(0, 254) : null;

  const campaign =
    typeof campaignId === 'string' && isValidUuid(campaignId.trim()) ? campaignId.trim() : null;

  let expires = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, status: 400, error: 'Nieprawidłowa data wygaśnięcia.' };
    }
    expires = d.toISOString();
  }

  const requested = code ? normalizePromoCode(code) : null;
  if (code && !requested) {
    return { ok: false, status: 400, error: 'Nieprawidłowy format kodu. Oczekiwany: AB-1234.' };
  }

  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt += 1) {
    const nextCode = requested || generatePromoCodeValue();

    const { data: existingActive, error: existingError } = await admin
      .from('promo_codes')
      .select('id')
      .eq('user_id', userId)
      .eq('code', nextCode)
      .eq('status', 'active')
      .maybeSingle();

    if (existingError) {
      return { ok: false, status: 500, error: existingError.message || 'Nie udało się sprawdzić unikalności kodu.' };
    }
    if (existingActive) {
      if (requested) {
        return { ok: false, status: 409, error: 'Ten kod jest już aktywny w tej restauracji.' };
      }
      continue;
    }

    const { data, error } = await admin
      .from('promo_codes')
      .insert({
        user_id: userId,
        campaign_id: campaign,
        email: guestEmail,
        code: nextCode,
        reward_name: name,
        reward_description: description,
        status: 'active',
        expires_at: expires,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      })
      .select('id, user_id, code, reward_name, reward_description, status, created_at, expires_at, used_at, email, campaign_id')
      .single();

    if (error) {
      if (error.code === '23505') {
        if (requested) {
          return { ok: false, status: 409, error: 'Ten kod jest już aktywny w tej restauracji.' };
        }
        continue;
      }
      return { ok: false, status: 500, error: error.message || 'Nie udało się zapisać kodu.' };
    }

    return { ok: true, status: 201, code: data };
  }

  return { ok: false, status: 503, error: 'Nie udało się wygenerować unikalnego kodu. Spróbuj ponownie.' };
}

export async function lookupPromoCode(admin, { userId, code }) {
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    return { outcome: 'invalid', code: null, rewardName: null, rewardDescription: null, usedAt: null };
  }

  const selectCols = 'id, code, reward_name, reward_description, status, expires_at, used_at';
  const { data: activeRow } = await admin
    .from('promo_codes')
    .select(selectCols)
    .eq('user_id', userId)
    .eq('code', normalized)
    .eq('status', 'active')
    .maybeSingle();

  let data = activeRow;
  if (!data) {
    const { data: latestRows } = await admin
      .from('promo_codes')
      .select(selectCols)
      .eq('user_id', userId)
      .eq('code', normalized)
      .order('created_at', { ascending: false })
      .limit(1);
    data = Array.isArray(latestRows) ? latestRows[0] : latestRows;
  }

  if (!data) {
    return { outcome: 'invalid', code: normalized, rewardName: null, rewardDescription: null, usedAt: null };
  }

  const now = Date.now();
  const expired = data.expires_at && new Date(data.expires_at).getTime() < now;

  if (data.status === 'used') {
    return waiterPublicResult(data, 'used');
  }
  if (data.status === 'cancelled') {
    return waiterPublicResult({ ...data, code: normalized }, 'invalid');
  }
  if (data.status === 'expired' || expired) {
    if (data.status === 'active' && expired) {
      await admin
        .from('promo_codes')
        .update({ status: 'expired' })
        .eq('id', data.id)
        .eq('status', 'active');
    }
    return waiterPublicResult(data, 'expired');
  }
  if (data.status === 'active') {
    return waiterPublicResult(data, 'active');
  }
  return waiterPublicResult(data, 'invalid');
}

export async function redeemPromoCodeAtomic(admin, { userId, code, usedByDevice = null }) {
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    return { outcome: 'invalid', code: null, rewardName: null, rewardDescription: null, usedAt: null };
  }

  const { data, error } = await admin.rpc('redeem_promo_code_atomic', {
    p_user_id: userId,
    p_code: normalized,
    p_used_by_device: usedByDevice,
  });

  if (!error && data && data.code) {
    return {
      outcome: 'redeemed',
      code: data.code,
      rewardName: data.reward_name,
      rewardDescription: data.reward_description,
      usedAt: data.used_at,
    };
  }

  if (error && !/could not find|does not exist|schema cache/i.test(String(error.message || ''))) {
    return { error: error.message || 'Nie udało się zrealizować kodu.', outcome: null };
  }

  const fallback = await redeemWithUpdateFallback(admin, {
    userId,
    code: normalized,
    usedByDevice,
  });
  if (fallback) {
    return {
      outcome: 'redeemed',
      code: fallback.code,
      rewardName: fallback.reward_name,
      rewardDescription: fallback.reward_description,
      usedAt: fallback.used_at,
    };
  }

  const lookup = await lookupPromoCode(admin, { userId, code: normalized });
  if (lookup.outcome === 'active') {
    return { ...lookup, outcome: 'invalid' };
  }
  return lookup;
}

async function redeemWithUpdateFallback(admin, { userId, code, usedByDevice }) {
  const nowIso = new Date().toISOString();
  const payload = {
    status: 'used',
    used_at: nowIso,
    used_by_device: usedByDevice,
  };
  const selectCols = 'id, code, reward_name, reward_description, used_at';

  const { data: noExpiry } = await admin
    .from('promo_codes')
    .update(payload)
    .eq('user_id', userId)
    .eq('code', code)
    .eq('status', 'active')
    .is('expires_at', null)
    .select(selectCols)
    .maybeSingle();
  if (noExpiry) return noExpiry;

  const { data: withExpiry } = await admin
    .from('promo_codes')
    .update(payload)
    .eq('user_id', userId)
    .eq('code', code)
    .eq('status', 'active')
    .gt('expires_at', nowIso)
    .select(selectCols)
    .maybeSingle();
  return withExpiry || null;
}

export async function createDeviceSession(admin, { userId, deviceLabel = null }) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await admin.from('verify_device_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    device_label: deviceLabel,
  });

  if (error) {
    return { ok: false, error: error.message || 'Nie udało się utworzyć sesji Verify.' };
  }

  return { ok: true, token, expiresAt };
}

export async function getDeviceSession(admin, token) {
  if (!token || typeof token !== 'string') return null;
  const tokenHash = hashToken(token.trim());
  const { data, error } = await admin
    .from('verify_device_sessions')
    .select('id, user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  await admin
    .from('verify_device_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

export function ownerCodeView(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    rewardName: row.reward_name,
    rewardDescription: row.reward_description,
    status: row.status,
    email: row.email || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}
