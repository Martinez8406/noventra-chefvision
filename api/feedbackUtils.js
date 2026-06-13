const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;
const ipHits = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getClientIp(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req?.ip || req?.connection?.remoteAddress || 'unknown';
}

export function rateLimitOk(ip, windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX) {
  const now = Date.now();
  const prev = ipHits.get(ip) || [];
  const fresh = prev.filter((t) => now - t < windowMs);
  fresh.push(now);
  ipHits.set(ip, fresh);
  return fresh.length <= max;
}

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

/** Usuwa tagi HTML, kontrolne znaki i normalizuje białe znaki. */
export function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return null;
  if (cleaned.length > maxLen) return cleaned.slice(0, maxLen);
  return cleaned;
}

export function sanitizeOptionalText(value, maxLen) {
  if (value == null || value === '') return null;
  return sanitizeText(String(value), maxLen);
}

export function sanitizeOptionalEmail(value) {
  if (value == null || value === '') return null;
  const cleaned = sanitizeText(String(value), 254);
  if (!cleaned) return null;
  return isValidEmail(cleaned) ? cleaned.toLowerCase() : null;
}

export async function sendResendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Brak RESEND_API_KEY na serwerze.');
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error('Brak RESEND_FROM_EMAIL na serwerze.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Resend HTTP ${response.status}: ${errBody.slice(0, 200)}`);
  }

  return response.json().catch(() => ({}));
}

export async function sendFeedbackEmail({ to, restaurantName, name, email, message, timestamp }) {
  const displayName = name || 'Nie podano';
  const displayEmail = email || 'Nie podano';

  const text = [
    `Restauracja: ${restaurantName || '—'}`,
    '',
    'Imię:',
    displayName,
    '',
    'Email:',
    displayEmail,
    '',
    'Wiadomość:',
    '',
    message,
    '',
    `Timestamp: ${timestamp}`,
  ].join('\n');

  await sendResendEmail({
    to,
    subject: 'Nowa wiadomość od gościa restauracji',
    text,
  });
}
