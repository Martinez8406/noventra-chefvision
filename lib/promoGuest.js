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
import { hashToken } from './promoCodes.js';
import { resolveRestaurantUserId, verifyOwnerToken } from './promoAuth.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRES_DAYS = 14;

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
        : '';
  const rewardDescription =
    typeof src.reward_description === 'string' && src.reward_description.trim()
      ? src.reward_description.trim().slice(0, 400)
      : typeof src.rewardDescription === 'string' && src.rewardDescription.trim()
        ? src.rewardDescription.trim().slice(0, 400)
        : '';
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
    reward_name: offer.rewardName || null,
    reward_description: offer.rewardDescription || null,
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

function joinedBody() {
  return { outcome: 'joined' };
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

async function sendConfirmEmail({ req, to, firstName, restaurantName, token }) {
  const confirmUrl = `${appBaseUrl(req)}/promo/confirm?token=${encodeURIComponent(token)}`;
  const name = firstName || 'Gościu';
  const text = [
    `Cześć ${name},`,
    '',
    'potwierdź swój adres email, aby dołączyć do Klubu Gości.',
    '',
    'Jako członek możesz otrzymywać specjalne oferty, nowości i okazjonalne bonusy od restauracji.',
    '',
    confirmUrl,
    '',
    'Jeśli to nie Ty wysłałeś formularz, zignoruj tę wiadomość.',
    '',
    `ChefVision / ${restaurantName}`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">
      <p>Cześć ${escapeHtml(name)},</p>
      <p>potwierdź swój adres email, aby dołączyć do Klubu Gości.</p>
      <p>Jako członek możesz otrzymywać specjalne oferty, nowości i okazjonalne bonusy od restauracji.</p>
      <p style="margin:28px 0">
        <a href="${confirmUrl}" style="display:inline-block;background:#c4a574;color:#0a1a12;text-decoration:none;font-weight:800;letter-spacing:.04em;padding:14px 22px;border-radius:14px">
          POTWIERDZAM EMAIL
        </a>
      </p>
      <p style="color:#666;font-size:13px">Jeśli to nie Ty wysłałeś formularz, zignoruj tę wiadomość.</p>
      <p style="color:#666;font-size:13px">ChefVision / ${escapeHtml(restaurantName)}</p>
    </div>
  `;

  await sendResendEmail({
    to,
    subject: 'Potwierdź dołączenie do Klubu Gości',
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
    return { status: 503, body: { error: 'Klub Gości jest tymczasowo niedostępny.' } };
  }

  const loaded = await loadOffer(admin, restaurantId);
  if (!loaded || !loaded.offer.active) {
    return { status: 400, body: { error: 'Zapis do Klubu Gości nie jest obecnie dostępny.' } };
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
      const { error } = await admin
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
          promo_code_id: null,
          metadata: { source: 'guest_club' },
        });
      if (error) throw error;
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

  if (lead.status === 'confirmed') {
    return { status: 200, body: joinedBody() };
  }

  if (lead.status !== 'pending') {
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy.' } };
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
    .select('id')
    .maybeSingle();

  if (!won) {
    const { data: again } = await admin.from('promo_leads').select('status').eq('id', lead.id).maybeSingle();
    if (again?.status === 'confirmed') {
      return { status: 200, body: joinedBody() };
    }
    return { status: 400, body: { outcome: 'invalid', error: 'Link jest nieprawidłowy.' } };
  }

  return { status: 200, body: joinedBody() };
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
    return { status: 200, body: { active: loaded.offer.active === true } };
  }

  if (verb !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };

  const loaded = await loadOffer(admin, resolved.userId);
  const next = parseOffer({
    ...(loaded?.offer || {}),
    active: body.active === true,
  });

  const { error } = await admin
    .from('profiles')
    .update({ guest_promo: toDbOffer(next) })
    .eq('id', resolved.userId);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się zapisać ustawień Klubu Gości.' } };
  }

  return { status: 200, body: { active: next.active === true } };
}
