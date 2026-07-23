export type ServiceRequestAction = 'waiter' | 'bill' | 'order';

export type DiscordWebhookResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  body?: string;
  error?: unknown;
};

export async function sendDiscordNotification(
  message: string,
  webhookUrlOverride?: string,
): Promise<DiscordWebhookResult> {
  return sendDiscordWebhook({
    content: message,
    webhookUrl: webhookUrlOverride,
  });
}

export async function sendDiscordWebhook(params: {
  content?: string;
  embeds?: Record<string, unknown>[];
  webhookUrl?: string;
}): Promise<DiscordWebhookResult> {
  const { content, embeds, webhookUrl: webhookUrlOverride } = params;
  const webhookUrl =
    (typeof webhookUrlOverride === 'string' && webhookUrlOverride.trim()) ||
    process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'no_webhook' };

  const payload: { content?: string; embeds?: Record<string, unknown>[] } = {};
  if (typeof content === 'string' && content.trim()) payload.content = content;
  if (Array.isArray(embeds) && embeds.length > 0) payload.embeds = embeds;

  if (!payload.content && !payload.embeds) {
    return { ok: false, skipped: true, reason: 'empty_payload' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[discord] Webhook failed:', response.status, body);
      return { ok: false, status: response.status, body };
    }

    console.log('[discord] Webhook OK');
    return { ok: true };
  } catch (error) {
    console.error('[discord] Webhook error:', error);
    return { ok: false, error };
  }
}

export function buildNewUserRegisteredMessage(email: string, at: Date = new Date()): string {
  return [
    '🆕 New user registered',
    '',
    `Email: ${email}`,
    'Plan: Free',
    `Time: ${at.toISOString()}`,
  ].join('\n');
}

const SERVICE_EMBED: Record<
  ServiceRequestAction,
  { title: string; color: number }
> = {
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

export function buildServiceRequestEmbed(params: {
  restaurantName?: string | null;
  table: string;
  action: ServiceRequestAction;
  at?: Date;
}): {
  title: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string };
  timestamp: string;
} {
  const { restaurantName, table, action, at = new Date() } = params;
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
export function buildServiceRequestMessage(params: {
  restaurantName?: string | null;
  table: string;
  action: ServiceRequestAction;
  at?: Date;
}): string {
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

export function isValidDiscordWebhookUrl(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return false;
  return DISCORD_WEBHOOK_RE.test(trimmed);
}

export function isValidServiceAction(value: string): value is ServiceRequestAction {
  return value === 'waiter' || value === 'bill' || value === 'order';
}
