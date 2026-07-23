import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { getClientIp, isValidUuid, rateLimitOk, sanitizeText } from '../lib/feedbackUtils.js';
import {
  buildServiceRequestEmbed,
  isValidDiscordWebhookUrl,
  isValidServiceAction,
  sendDiscordWebhook,
} from '../lib/discord.js';

const TABLE_RATE_WINDOW_MS = 2 * 60 * 1000; // 2 minuty na ten sam typ prośby ze stolika
const TABLE_RATE_MAX = 1;
// Goście w lokalu często mają ten sam IP (Wi‑Fi) — limit IP tylko przeciw botom, nie per gość.
const IP_RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_RATE_MAX = 300;

function normalizeTable(value) {
  const cleaned = sanitizeText(value, 40);
  if (!cleaned) return null;
  // np. "5", "12A", "Taras 1"
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s\-_/]{0,39}$/u.test(cleaned)) return null;
  return cleaned;
}

const SUCCESS_MESSAGE = {
  waiter: 'Prośba o kelnera została wysłana. Zaraz ktoś podejdzie.',
  bill: 'Prośba o rachunek została wysłana. Kelner zaraz podejdzie.',
  order: 'Prośba o dodatkowe zamówienie została wysłana. Zaraz ktoś podejdzie.',
};

export async function handleRequestService({ req, body = {} }) {
  const restaurantId =
    typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
  if (!isValidUuid(restaurantId)) {
    return { status: 400, body: { error: 'Nieprawidłowy identyfikator restauracji.' } };
  }

  const table = normalizeTable(body?.table);
  if (!table) {
    return {
      status: 400,
      body: { error: 'Brak numeru stolika. Zeskanuj kod QR ze stolika.' },
    };
  }

  const actionRaw = typeof body?.action === 'string' ? body.action.trim() : '';
  if (!isValidServiceAction(actionRaw)) {
    return { status: 400, body: { error: 'Nieprawidłowy typ prośby.' } };
  }
  const action = actionRaw;

  const ip = getClientIp(req);
  const isPanelTest = /^T-/i.test(table);

  // Główna ochrona: ten sam stolik + ten sam typ prośby max 1× / 2 min
  const tableKey = `svc-table:${restaurantId}:${table}:${action}`;
  if (!isPanelTest && !rateLimitOk(tableKey, TABLE_RATE_WINDOW_MS, TABLE_RATE_MAX)) {
    return {
      status: 429,
      body: { error: 'Prośba została już wysłana. Poczekaj chwilę przed kolejną.' },
    };
  }

  // Zapas przeciw masowemu spamowi z jednego IP (np. cały lokal na Wi‑Fi)
  if (!isPanelTest && !rateLimitOk(`svc-ip:${restaurantId}:${ip}`, IP_RATE_WINDOW_MS, IP_RATE_MAX)) {
    return { status: 429, body: { error: 'Zbyt wiele próśb. Spróbuj ponownie później.' } };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer nie jest skonfigurowany.' } };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('waiter_call_enabled, discord_waiter_webhook_url, restaurant_name')
    .eq('id', restaurantId)
    .single();

  if (profileError || !profile) {
    return { status: 404, body: { error: 'Nie znaleziono restauracji.' } };
  }

  const enabled = profile.waiter_call_enabled === true;
  const webhookUrl =
    typeof profile.discord_waiter_webhook_url === 'string'
      ? profile.discord_waiter_webhook_url.trim()
      : '';

  if (!enabled || !webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
    return {
      status: 403,
      body: { error: 'Wezwanie kelnera nie jest obecnie dostępne dla tej restauracji.' },
    };
  }

  const restaurantName =
    (typeof profile.restaurant_name === 'string' && profile.restaurant_name.trim()) ||
    'Restaurant';

  const embed = buildServiceRequestEmbed({
    restaurantName,
    table,
    action,
  });

  const result = await sendDiscordWebhook({
    embeds: [embed],
    webhookUrl,
  });
  if (!result?.ok) {
    console.error('[request-service] Discord failed', result);
    return {
      status: 502,
      body: { error: 'Nie udało się wysłać powiadomienia. Spróbuj ponownie.' },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: SUCCESS_MESSAGE[action] || SUCCESS_MESSAGE.waiter,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleRequestService({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
