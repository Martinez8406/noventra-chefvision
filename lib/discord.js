export async function sendDiscordNotification(message, webhookUrlOverride) {
  return sendDiscordWebhook({
    content: message,
    webhookUrl: webhookUrlOverride,
  });
}

function withWaitParam(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('wait')) parsed.searchParams.set('wait', 'true');
    return parsed.toString();
  } catch {
    return url;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response, body, attempt) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.retry_after === 'number') {
      return Math.min(Math.ceil(parsed.retry_after * 1000) + 250, 8000);
    }
  } catch {
    /* ignore */
  }
  const header = response.headers.get('retry-after');
  const n = header ? Number(header) : NaN;
  if (Number.isFinite(n) && n > 0) {
    return Math.min(n < 30 ? n * 1000 : n, 8000) + 250;
  }
  return Math.min(500 * attempt, 4000);
}

export async function sendDiscordWebhook({ content, embeds, webhookUrl: webhookUrlOverride } = {}) {
  const webhookUrl =
    (typeof webhookUrlOverride === 'string' && webhookUrlOverride.trim()) ||
    process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'no_webhook' };

  const payload = {};
  if (typeof content === 'string' && content.trim()) payload.content = content;
  if (Array.isArray(embeds) && embeds.length > 0) payload.embeds = embeds;

  if (!payload.content && !payload.embeds) {
    return { ok: false, skipped: true, reason: 'empty_payload' };
  }

  const endpoint = withWaitParam(webhookUrl);
  let lastFail = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[discord] Webhook OK');
        return { ok: true };
      }

      const body = await response.text().catch(() => '');
      lastFail = { ok: false, status: response.status, body };

      if (response.status === 429 && attempt < 4) {
        const waitMs = retryAfterMs(response, body, attempt);
        console.warn('[discord] Webhook 429, retrying', { attempt, waitMs });
        await sleep(waitMs);
        continue;
      }
      if (response.status >= 500 && attempt < 4) {
        await sleep(400 * attempt);
        continue;
      }

      console.error('[discord] Webhook failed:', response.status, body);
      return lastFail;
    } catch (error) {
      lastFail = { ok: false, error };
      if (attempt < 4) {
        await sleep(400 * attempt);
        continue;
      }
      console.error('[discord] Webhook error:', error);
      return lastFail;
    }
  }

  return lastFail || { ok: false, reason: 'retries_exhausted' };
}

export function buildNewUserRegisteredMessage(email, at = new Date()) {
  return [
    '🆕 New user registered',
    '',
    `Email: ${email}`,
    'Plan: Free',
    `Time: ${at.toISOString()}`,
  ].join('\n');
}

export function buildImplementationOfferMessage({ kind, email, restaurantName } = {}) {
  const restaurant =
    typeof restaurantName === 'string' && restaurantName.trim() ? restaurantName.trim() : null;
  const lines =
    kind === 'flyer'
      ? [
          '🎨 NOWE ZLECENIE — ULOTKA QR',
          '',
          `Klient: ${email || 'unknown'}`,
          ...(restaurant ? [`Restauracja: ${restaurant}`] : []),
          'Usługa: Ulotka QR',
          'Cena: 0 zł',
          'Oferta: Wdrożeniowa',
          'Status: Oczekuje na realizację',
        ]
      : [
          '🛠️ NOWE ZLECENIE — MENU',
          '',
          `Klient: ${email || 'unknown'}`,
          ...(restaurant ? [`Restauracja: ${restaurant}`] : []),
          'Usługa: Wykonanie menu',
          'Cena: 0 zł',
          'Oferta: Wdrożeniowa',
          'Status: Oczekuje na realizację',
        ];
  return lines.join('\n');
}

/** @typedef {'waiter' | 'bill' | 'order'} ServiceRequestAction */

const SERVICE_EMBED = {
  waiter: {
    title: '🔔 Wezwij kelnera',
    color: 0x22c55e,
  },
  order: {
    title: '🥤 Dodatkowe zamówienie',
    color: 0xf59e0b,
  },
  bill: {
    title: '🧾 Prośba o rachunek',
    color: 0xef4444,
  },
};

/**
 * Discord embed for table service requests (waiter / order / bill).
 * @param {{ restaurantName?: string | null, table: string, action: ServiceRequestAction, at?: Date }} params
 */
export function buildServiceRequestEmbed({
  restaurantName,
  table,
  action,
  at = new Date(),
}) {
  const meta = SERVICE_EMBED[action] || SERVICE_EMBED.waiter;
  const timeLabel = at.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return {
    title: meta.title,
    color: meta.color,
    fields: [
      { name: 'Stolik', value: String(table), inline: true },
      { name: 'Restauracja', value: restaurantName?.trim() || '—', inline: true },
      { name: 'Godzina zgłoszenia', value: timeLabel, inline: false },
    ],
    footer: { text: 'Powered by ChefVision' },
    timestamp: at.toISOString(),
  };
}

/** @deprecated use buildServiceRequestEmbed */
export function buildServiceRequestMessage(params) {
  const embed = buildServiceRequestEmbed(params);
  return [
    embed.title,
    '',
    `Restauracja: ${embed.fields[1].value}`,
    `Stolik: ${embed.fields[0].value}`,
    `Czas: ${embed.fields[2].value}`,
  ].join('\n');
}

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/i;

export function isValidDiscordWebhookUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return false;
  return DISCORD_WEBHOOK_RE.test(trimmed);
}

export function isValidServiceAction(value) {
  return value === 'waiter' || value === 'bill' || value === 'order';
}
