import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import {
  getClientIp,
  isValidEmail,
  isValidUuid,
  rateLimitOk,
  sanitizeText,
  sendResendEmail,
} from './feedbackUtils.js';
import { hashToken, issuePromoCodeAfterConfirmedOptIn } from './promoCodes.js';
import { resolveRestaurantUserId, verifyOwnerToken } from './promoAuth.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRES_DAYS = 14;
const DEFAULT_REWARD_NAME = 'Darmowy deser';
const DEFAULT_REWARD_DESCRIPTION = 'Przy zamówieniu dowolnego dania głównego';

function hasResend() {
  return !!process.env.RESEND_API_KEY?.trim() && !!process.env.RESEND_FROM_EMAIL?.trim();
}

function appBaseUrl(req) {
  const fromEnv = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin) return origin.replace(/\/+$/, '');
  return 'https://app.chefvision.pl';
}

export function maskEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.indexOf('@');
  if (at < 1) return '***';
  return `${value[0]}***@${value.slice(at + 1)}`;
}

export function normalizeGuestEmail(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (!isValidEmail(cleaned)) return null;
  return cleaned.slice(0, 254);
}

function createConfirmToken() {
  return randomBytes(32).toString('base64url');
}

function parseOffer(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const expires = Number(src.expires_in_days ?? src.expiresInDays ?? DEFAULT_EXPIRES_DAYS);
  const expiresInDays = Number.isFinite(expires) ? Math.min(90, Math.max(1, Math.round(expires))) : DEFAULT_EXPIRES_DAYS;
  const rewardName =
    typeof src.reward_name === 'string' && src.reward_name.trim()
      ? src.reward_name.trim().slice(0, 120)
      : typeof src.rewardName === 'string' && src.rewardName.trim()
        ? src.rewardName.trim().slice(0, 120)
        : DEFAULT_REWARD_NAME;
  const rewardDescription =
    typeof src.reward_description === 'string' && src.reward_description.trim()
      ? src.reward_description.trim().slice(0, 400)
      : typeof src.rewardDescription === 'string' && src.rewardDescription.trim()
        ? src.rewardDescription.trim().slice(0, 400)
        : DEFAULT_REWARD_DESCRIPTION;
  const maxPerEmail = Number(src.max_per_email ?? src.maxPerEmail ?? 1);
  return {
    active: src.active === true,
    rewardName,
    rewardDescription,
    expiresInDays,
    maxPerEmail: Number.isFinite(maxPerEmail) && maxPerEmail > 0 ? Math.round(maxPerEmail) : 1,
  };
}

function toDbOffer(offer) {
  return {
    active: offer.active === true,
    reward_name: offer.rewardName,
    reward_description: offer.rewardDescription,
    expires_in_days: offer.expiresInDays,
    max_per_email: offer.maxPerEmail || 1,
  };
}

function genericSignupBody(email) {
  return {
    ok: true,
    checkInbox: true,
    maskedEmail: maskEmail(email),
  };
}

function publicCodeView(codeRow, rewardFallback) {
  if (!codeRow) return null;
  const expiredByDate = codeRow.expires_at && new Date(codeRow.expires_at).getTime() <= Date.now();
  const outcome =
    codeRow.status === 'used'
      ? 'used'
      : codeRow.status === 'expired' || expiredByDate
        ? 'expired'
        : 'ready';
  return {
    outcome,
    code: codeRow.code,
    rewardName: codeRow.reward_name || rewardFallback?.rewardName || DEFAULT_REWARD_NAME,
    rewardDescription: codeRow.reward_description || rewardFallback?.rewardDescription || null,
    expiresAt: codeRow.expires_at || null,
  };
}

async function loadOffer(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, restaurant_name, guest_promo')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    restaurantName: (typeof data.restaurant_name === 'string' && data.restaurant_name.trim()) || 'Restauracja',
    offer: parseOffer(data.guest_promo),
  };
}

async function sendConfirmEmail({ req, to, firstName, restaurantName, rewardName, token }) {
  const confirmUrl = `${appBaseUrl(req)}/promo/confirm?token=${encodeURIComponent(token)}`;
  const name = firstName || 'Gościu';
  const text = [
    `Cześć ${name},`,
    '',
    'potwierdź swój adres email, aby odebrać bonus:',
    '',
    `🎁 ${rewardName}`,
    '',
    confirmUrl,
    '',
    'Po kliknięciu otrzymasz swój kod promocyjny.',
    '',
    'Jeśli to nie Ty wysłałeś formularz, zignoruj tę wiadomość.',
    '',
    `ChefVision / ${restaurantName}`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">
      <p>Cześć ${escapeHtml(name)},</p>
      <p>potwierdź swój adres email, aby odebrać bonus:</p>
      <p style="font-size:18px;font-weight:700">🎁 ${escapeHtml(rewardName)}</p>
      <p style="margin:28px 0">
        <a href="${confirmUrl}" style="display:inline-block;background:#c4a574;color:#0a1a12;text-decoration:none;font-weight:800;letter-spacing:.04em;padding:14px 22px;border-radius:14px">
          POTWIERDZAM EMAIL
        </a>
      </p>
      <p>Po kliknięciu otrzymasz swój kod promocyjny.</p>
      <p style="color:#666;font-size:13px">Jeśli to nie Ty wysłałeś formularz, zignoruj tę wiadomość.</p>
      <p style="color:#666;font-size:13px">ChefVision / ${escapeHtml(restaurantName)}</p>
    </div>
  `;

  await sendResendEmail({
    to,
    subject: 'Potwierdź odbiór swojego bonusu',
    text,
    html,
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function attachToken(admin, leadId, token) {
  const now = new Date();
  const { error } = await admin
    .from('promo_leads')
    .update({
      confirmation_token_hash: hashToken(token),
      confirmation_sent_at: now.toISOString(),
      confirmation_expires_at: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    })
    .eq('id', leadId);
  if (error) throw error;
}

async function attachOldestCodeForEmail(admin, lead, offer) {
  const { data: rows } = await admin
    .from('promo_codes')
    .select('id, code, reward_name, reward_description, status, expires_at, created_at')
    .eq('user_id', lead.user_id)
    .eq('email', lead.email)
    .in('status', ['active', 'used', 'expired'])
    .order('created_at', { ascending: true });

  const list = Array.isArray(rows) ? rows : [];
  const keep = list[0];
  if (!keep) return null;

  if (lead.promo_code_id !== keep.id) {
    await admin.from('promo_leads').update({ promo_code_id: keep.id }).eq('id', lead.id);
  }
  return publicCodeView(keep, offer);
}

async function issueAndAttachCode(admin, lead, offer) {
  const reused = await attachOldestCodeForEmail(admin, lead, offer);
  if (reused) return reused;

  const expiresAt = new Date(Date.now() + offer.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const issued = await issuePromoCodeAfterConfirmedOptIn(admin, {
    userId: lead.user_id,
    email: lead.email,
    rewardName: offer.rewardName,
    rewardDescription: offer.rewardDescription,
    expiresAt,
    metadata: {
      source: 'double_opt_in',
      leadId: lead.id,
      maxPerEmail: offer.maxPerEmail || 1,
    },
  });
  if (!issued.ok) {
    return { error: issued.error || 'Nie udało się wygenerować kodu.' };
  }

  const afterRace = await attachOldestCodeForEmail(admin, lead, offer);
  return afterRace || publicCodeView(issued.code, offer);
}

export async function handlePublicPromoOffer({ query = {} }) {
  const restaurantId = typeof query.restaurantId === 'string' ? query.restaurantId.trim() : '';
  if (!isValidUuid(restaurantId)) {
    return { status: 200, body: { active: false } };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: 200, body: { active: false } };
  const loaded = await loadOffer(admin, restaurantId);
  if (!loaded || !loaded.offer.active) {
    return { status: 200, body: { active: false } };
  }
  return {
    status: 200,
    body: {
      active: true,
      rewardName: loaded.offer.rewardName,
      rewardDescription: loaded.offer.rewardDescription,
      restaurantName: loaded.restaurantName,
    },
  };
}

export async function handleGuestPromoSignup({ req, body = {} }) {
  const ip = getClientIp(req);
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const firstName = sanitizeText(body.firstName || body.name, 80);
  const email = normalizeGuestEmail(body.email);
  const termsAccepted = body.termsAccepted === true;
  const marketingConsent = body.marketingConsent === true;

  if (!isValidUuid(restaurantId) || !firstName || !email || !termsAccepted || !marketingConsent) {
    return { status: 400, body: { error: 'Uzupełnij imię, email i wymagane zgody.' } };
  }

  if (!rateLimitOk(`promo-signup-ip:${ip}`, 60 * 60 * 1000, 8)) {
    return { status: 429, body: { error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.' } };
  }
  if (!rateLimitOk(`promo-signup-email:${restaurantId}:${email}`, 60 * 60 * 1000, 5)) {
    return { status: 200, body: genericSignupBody(email) };
  }

  if (!hasResend()) {
    return { status: 503, body: { error: 'Wysyłka e-mail nie jest teraz dostępna. Spróbuj później.' } };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Promocja jest tymczasowo niedostępna.' } };
  }

  const loaded = await loadOffer(admin, restaurantId);
  if (!loaded || !loaded.offer.active) {
    return { status: 400, body: { error: 'Promocja nie jest obecnie dostępna.' } };
  }

  const now = new Date();
  const token = createConfirmToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

  const { data: existing } = await admin
    .from('promo_leads')
    .select('id, status')
    .eq('user_id', restaurantId)
    .eq('email', email)
    .maybeSingle();

  try {
    if (!existing) {
      const { data: inserted, error } = await admin
        .from('promo_leads')
        .insert({
          user_id: restaurantId,
          first_name: firstName,
          email,
          status: 'pending',
          terms_accepted_at: now.toISOString(),
          marketing_consent_at: now.toISOString(),
          confirmation_token_hash: tokenHash,
          confirmation_sent_at: now.toISOString(),
          confirmation_expires_at: expiresAt,
          metadata: { max_per_email: loaded.offer.maxPerEmail || 1 },
        })
        .select('id')
        .single();
      if (error) throw error;
      void inserted;
    } else if (existing.status === 'blocked') {
      return { status: 200, body: genericSignupBody(email) };
    } else {
      await admin
        .from('promo_leads')
        .update({
          first_name: firstName,
          terms_accepted_at: now.toISOString(),
          marketing_consent_at: now.toISOString(),
          confirmation_token_hash: tokenHash,
          confirmation_sent_at: now.toISOString(),
          confirmation_expires_at: expiresAt,
        })
        .eq('id', existing.id);
    }

    await sendConfirmEmail({
      req,
      to: email,
      firstName,
      restaurantName: loaded.restaurantName,
      rewardName: loaded.offer.rewardName,
      token,
    });
  } catch (err) {
    console.error('[promo-signup]', err);
    return { status: 502, body: { error: 'Nie udało się wysłać wiadomości. Spróbuj ponownie później.' } };
  }

  return { status: 200, body: genericSignupBody(email) };
}

export async function handleGuestPromoResend({ req, body = {} }) {
  const ip = getClientIp(req);
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const email = normalizeGuestEmail(body.email);

  if (!isValidUuid(restaurantId) || !email) {
    return { status: 400, body: { error: 'Podaj prawidłowy adres e-mail.' } };
  }

  if (!rateLimitOk(`promo-resend:${ip}:${restaurantId}:${email}`, 60 * 1000, 1)) {
    return { status: 429, body: { error: 'Poczekaj chwilę, zanim wyślesz wiadomość ponownie.', retryAfter: 60 } };
  }

  if (!hasResend()) {
    return { status: 200, body: genericSignupBody(email) };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: 200, body: genericSignupBody(email) };

  const loaded = await loadOffer(admin, restaurantId);
  if (!loaded || !loaded.offer.active) {
    return { status: 200, body: genericSignupBody(email) };
  }

  const { data: lead } = await admin
    .from('promo_leads')
    .select('id, first_name, status')
    .eq('user_id', restaurantId)
    .eq('email', email)
    .maybeSingle();

  if (!lead || lead.status === 'blocked') {
    return { status: 200, body: genericSignupBody(email) };
  }

  const token = createConfirmToken();
  try {
    await attachToken(admin, lead.id, token);
    await sendConfirmEmail({
      req,
      to: email,
      firstName: lead.first_name,
      restaurantName: loaded.restaurantName,
      rewardName: loaded.offer.rewardName,
      token,
    });
  } catch (err) {
    console.error('[promo-resend]', err);
    return { status: 502, body: { error: 'Nie udało się wysłać wiadomości. Spróbuj ponownie później.' } };
  }

  return { status: 200, body: genericSignupBody(email) };
}

export async function handleGuestPromoConfirm({ query = {} }) {
  const token = typeof query.token === 'string' ? query.token.trim() : '';
  if (!token || token.length < 16) {
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy.' } };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { outcome: 'invalid', error: 'Potwierdzenie jest tymczasowo niedostępne.' } };
  }

  const tokenHash = hashToken(token);
  const { data: lead } = await admin
    .from('promo_leads')
    .select('*')
    .eq('confirmation_token_hash', tokenHash)
    .maybeSingle();

  if (!lead || lead.status === 'blocked' || lead.status === 'unsubscribed') {
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy lub wygasł.' } };
  }

  const loaded = await loadOffer(admin, lead.user_id);
  const offer = loaded?.offer || parseOffer({});

  if (lead.status === 'confirmed') {
    const issued = await issueAndAttachCode(admin, lead, offer);
    if (issued?.error) {
      return { status: 502, body: { outcome: 'invalid', error: 'Nie udało się pobrać kodu.' } };
    }
    return { status: 200, body: issued };
  }

  if (lead.status !== 'pending') {
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy.' } };
  }

  if (!loaded?.offer?.active) {
    return { status: 400, body: { outcome: 'invalid', error: 'Promocja nie jest obecnie dostępna.' } };
  }

  if (lead.confirmation_expires_at && new Date(lead.confirmation_expires_at).getTime() <= Date.now()) {
    return { status: 400, body: { outcome: 'expired', error: 'Link wygasł. Wyślij formularz ponownie.' } };
  }

  const { data: won } = await admin
    .from('promo_leads')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  const confirmedLead = won || (await admin.from('promo_leads').select('*').eq('id', lead.id).maybeSingle()).data;
  if (!confirmedLead) {
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy.' } };
  }

  const issued = await issueAndAttachCode(admin, confirmedLead, offer);
  if (issued?.error) {
    return { status: 502, body: { outcome: 'invalid', error: 'Nie udało się wygenerować kodu.' } };
  }
  return { status: 200, body: issued };
}

export async function handleOwnerPromoOffer({ req, authorization, query = {}, body = {}, method }) {
  const verb = String(method || 'GET').toUpperCase();
  const user = await verifyOwnerToken(authorization || req?.headers?.authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: 503, body: { error: 'Brak SUPABASE_SERVICE_ROLE_KEY na serwerze.' } };

  const targetUserId = query.targetUserId || query.userId || body.targetUserId || body.userId || null;
  const resolved = await resolveRestaurantUserId(admin, { user, targetUserId });
  if (!resolved.ok) return { status: resolved.status, body: { error: resolved.error } };

  if (verb === 'GET') {
    const loaded = await loadOffer(admin, resolved.userId);
    if (!loaded) return { status: 404, body: { error: 'Nie znaleziono restauracji.' } };
    return { status: 200, body: loaded.offer };
  }

  if (verb !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };

  const next = parseOffer({
    active: body.active === true,
    rewardName: body.rewardName,
    rewardDescription: body.rewardDescription,
    expiresInDays: body.expiresInDays,
    maxPerEmail: body.maxPerEmail,
  });

  const { error } = await admin
    .from('profiles')
    .update({ guest_promo: toDbOffer(next) })
    .eq('id', resolved.userId);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się zapisać promocji.' } };
  }

  return { status: 200, body: next };
}
