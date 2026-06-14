import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import {
  getClientIp,
  isValidEmail,
  isValidUuid,
  rateLimitOk,
  sanitizeOptionalEmail,
  sanitizeOptionalText,
  sanitizeText,
  sendFeedbackEmail,
} from '../lib/feedbackUtils.js';

export async function handleFeedback({ req, body = {} }) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return { status: 429, body: { error: 'Zbyt wiele wiadomości. Spróbuj ponownie za godzinę.' } };
  }

  const restaurantId =
    typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
  if (!isValidUuid(restaurantId)) {
    return { status: 400, body: { error: 'Nieprawidłowy identyfikator restauracji.' } };
  }

  const message = sanitizeText(body?.message, 1000);
  if (!message || message.length < 10) {
    return {
      status: 400,
      body: { error: 'Wiadomość jest wymagana (min. 10 znaków, max. 1000).' },
    };
  }

  const name = sanitizeOptionalText(body?.name, 120);
  const guestEmailRaw = typeof body?.email === 'string' ? body.email.trim() : '';
  let guestEmail = null;
  if (guestEmailRaw) {
    if (!isValidEmail(guestEmailRaw)) {
      return { status: 400, body: { error: 'Podaj prawidłowy adres e-mail lub zostaw pole puste.' } };
    }
    guestEmail = sanitizeOptionalEmail(guestEmailRaw);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer nie jest skonfigurowany do wysyłki opinii.' } };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('feedback_enabled, feedback_email, restaurant_name')
    .eq('id', restaurantId)
    .single();

  if (profileError || !profile) {
    return { status: 404, body: { error: 'Nie znaleziono restauracji.' } };
  }

  const managerEmail =
    typeof profile.feedback_email === 'string' ? profile.feedback_email.trim() : '';
  const feedbackEnabled = profile.feedback_enabled !== false;

  if (!feedbackEnabled || !managerEmail || !isValidEmail(managerEmail)) {
    return { status: 403, body: { error: 'Opinie gości nie są obecnie dostępne dla tej restauracji.' } };
  }

  const restaurantName =
    (typeof profile.restaurant_name === 'string' && profile.restaurant_name.trim()) || 'Restaurant';

  const timestamp = new Date().toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    const missing = [
      !process.env.RESEND_API_KEY?.trim() ? 'RESEND_API_KEY' : null,
      !process.env.RESEND_FROM_EMAIL?.trim() ? 'RESEND_FROM_EMAIL' : null,
    ].filter(Boolean);
    console.error('[feedback] Brak zmiennych środowiskowych:', missing.join(', '));
    return {
      status: 503,
      body: {
        error:
          'Wysyłka e-mail nie jest skonfigurowana na serwerze API. Zrestartuj npm run dev (musi działać proces SERVER). Na Vercel dodaj zmienne i zrób redeploy.',
      },
    };
  }

  try {
    await sendFeedbackEmail({
      to: managerEmail,
      restaurantName,
      name,
      email: guestEmail,
      message,
      timestamp,
    });
  } catch (err) {
    console.error('[feedback]', err);
    const detail = err instanceof Error ? err.message : String(err);
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      status: 502,
      body: {
        error: isDev
          ? `Nie udało się wysłać wiadomości: ${detail}`
          : 'Nie udało się wysłać wiadomości. Spróbuj ponownie później.',
      },
    };
  }

  return {
    status: 200,
    body: { ok: true, message: 'Dziękujemy za wiadomość. Została przesłana do managera restauracji.' },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleFeedback({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}

