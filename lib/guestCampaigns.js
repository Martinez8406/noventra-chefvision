import {
  getClientIp,
  isValidUuid,
  rateLimitOk,
  sanitizeOptionalText,
  sanitizeText,
  sendResendEmail,
} from './feedbackUtils.js';
import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import { resolveRestaurantUserId, verifyOwnerToken } from './promoAuth.js';
import { GUEST_CLUB_PLAN_ERROR, guestClubAllowedForRestaurant } from './promoGuest.js';
import {
  guestAppBaseUrl,
  unsubscribeApiUrl,
  unsubscribePageUrl,
} from './promoGuest.js';
import {
  GUEST_CAMPAIGN_CTA_PRESETS,
  GUEST_CAMPAIGN_TEMPLATES,
  getGuestCampaignTemplate,
} from './guestCampaignTemplates.js';

const MAX_RECIPIENTS = 150;
const SEND_CONCURRENCY = 4;
const SEND_RATE_WINDOW_MS = 60 * 60 * 1000;
const SEND_RATE_MAX = 3;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personalize(template, firstName) {
  const name = firstName && firstName.trim() ? firstName.trim() : '';
  const fallback = name || 'Gościu';
  return String(template || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, fallback)
    .replace(/\{\s*first_name\s*\}/gi, fallback);
}

function greeting(firstName) {
  const name = firstName && firstName.trim() ? firstName.trim() : '';
  return name ? `Cześć ${name},` : 'Cześć,';
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function liveMenuUrl(req, userId, dishId) {
  const base = guestAppBaseUrl(req);
  if (dishId && isValidUuid(dishId)) return `${base}/menu/${userId}/dish/${dishId}`;
  return `${base}/menu/${userId}`;
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

export function renderCampaignEmail({
  restaurantName,
  logoUrl,
  firstName,
  headline,
  message,
  offerText,
  validLabel,
  dish,
  ctaLabel,
  ctaUrl,
  unsubUrl,
}) {
  const hi = greeting(firstName);
  const dishName = dish?.name ? escapeHtml(dish.name) : '';
  const dishDesc = dish?.description ? nl2br(String(dish.description).slice(0, 280)) : '';
  const dishImg = isHttpUrl(dish?.imageUrl) ? dish.imageUrl.trim() : '';
  const logo = isHttpUrl(logoUrl) ? logoUrl.trim() : '';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.55;background:#ffffff">
      <div style="padding:28px 24px 8px;text-align:center">
        ${
          logo
            ? `<img src="${escapeHtml(logo)}" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:16px;object-fit:cover"/>`
            : ''
        }
        <p style="margin:12px 0 0;font-size:12px;letter-spacing:.16em;font-weight:800;text-transform:uppercase;color:#c4a574">${escapeHtml(
          restaurantName || 'Restauracja'
        )}</p>
      </div>
      <div style="padding:8px 24px 24px">
        <p style="margin:0 0 12px;color:#444">${escapeHtml(hi)}</p>
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">${escapeHtml(personalize(headline, firstName))}</h1>
        ${
          dishImg
            ? `<img src="${escapeHtml(dishImg)}" alt="${dishName}" style="width:100%;max-height:280px;object-fit:cover;border-radius:18px;margin:0 0 16px"/>`
            : ''
        }
        ${dishName ? `<p style="margin:0 0 8px;font-size:18px;font-weight:800">${dishName}</p>` : ''}
        ${dishDesc ? `<p style="margin:0 0 16px;color:#555;font-size:14px">${dishDesc}</p>` : ''}
        <p style="margin:0 0 16px;color:#333">${nl2br(personalize(message, firstName))}</p>
        ${
          offerText
            ? `<div style="margin:0 0 16px;padding:14px 16px;border-radius:16px;background:#f7f1e6;color:#3b2f1a;font-weight:700">${escapeHtml(
                personalize(offerText, firstName)
              )}${validLabel ? `<div style="margin-top:6px;font-size:13px;font-weight:500;color:#6b5a3d">${escapeHtml(validLabel)}</div>` : ''}</div>`
            : validLabel
              ? `<p style="margin:0 0 16px;color:#6b5a3d;font-size:13px">${escapeHtml(validLabel)}</p>`
              : ''
        }
        <p style="margin:28px 0 8px;text-align:center">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#c4a574;color:#0a1a12;text-decoration:none;font-weight:800;letter-spacing:.04em;padding:14px 22px;border-radius:14px">
            ${escapeHtml(ctaLabel || 'Zobacz w menu')}
          </a>
        </p>
      </div>
      <div style="padding:8px 24px 28px;color:#888;font-size:12px;line-height:1.5">
        ${
          unsubUrl
            ? `<p style="margin:0 0 8px">Nie chcesz dostawać takich wiadomości? <a href="${escapeHtml(
                unsubUrl
              )}" style="color:#888">Wypisz się z Klubu gości Premium</a>.</p>`
            : ''
        }
        <p style="margin:0">ChefVision · ${escapeHtml(restaurantName || '')}</p>
      </div>
    </div>
  `;

  const text = [
    hi,
    '',
    personalize(headline, firstName),
    '',
    dish?.name || '',
    dish?.description ? String(dish.description).slice(0, 280) : '',
    '',
    personalize(message, firstName),
    offerText ? personalize(offerText, firstName) : '',
    validLabel || '',
    '',
    `${ctaLabel || 'Zobacz w menu'}: ${ctaUrl}`,
    '',
    unsubUrl ? `Wypis: ${unsubUrl}` : '',
    `ChefVision / ${restaurantName || ''}`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { html, text, subjectPersonalize: (subject) => personalize(subject, firstName) };
}

function validLabelFrom(from, until) {
  const a = (from || '').trim();
  const b = (until || '').trim();
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return '';
}

async function requireCampaignOwner({ req, authorization, query, body }) {
  const user = await verifyOwnerToken(authorization || req?.headers?.authorization);
  if (!user) return { status: 401, body: { error: 'Brak autoryzacji.' } };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: 503, body: { error: 'Brak SUPABASE_SERVICE_ROLE_KEY na serwerze.' } };
  const targetUserId = query?.targetUserId || query?.userId || body?.targetUserId || body?.userId || null;
  const resolved = await resolveRestaurantUserId(admin, { user, targetUserId });
  if (!resolved.ok) return { status: resolved.status, body: { error: resolved.error } };
  if (!(await guestClubAllowedForRestaurant(admin, resolved.userId))) {
    return { status: 403, body: { error: GUEST_CLUB_PLAN_ERROR } };
  }
  return { admin, userId: resolved.userId };
}

function campaignView(row) {
  return {
    id: row.id,
    name: row.name,
    templateType: row.template_type,
    subject: row.subject,
    headline: row.headline,
    status: row.status,
    recipientCount: row.recipient_count || 0,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    failedCount: Number(row.metadata?.failedCount || 0),
    skippedCount: Number(row.metadata?.skippedCount || 0),
  };
}

export async function handleCampaignDishes({ req, authorization, query = {} }) {
  const authz = await requireCampaignOwner({ req, authorization, query, body: {} });
  if (authz.status) return authz;

  const { data, error } = await authz.admin
    .from('dishes')
    .select('id, name, imageUrl, description, isOnline')
    .eq('userId', authz.userId)
    .eq('isOnline', true)
    .order('createdAt', { ascending: false })
    .limit(80);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się pobrać dań.' } };
  }

  const dishes = (data || []).map((row) => ({
    id: row.id,
    name: row.name || 'Danie',
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '',
    description: typeof row.description === 'string' ? row.description : '',
  }));
  return { status: 200, body: { dishes } };
}

export async function handleCampaignRecipientCount({ req, authorization, query = {} }) {
  const authz = await requireCampaignOwner({ req, authorization, query, body: {} });
  if (authz.status) return authz;

  const { count, error } = await authz.admin
    .from('promo_leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', authz.userId)
    .eq('status', 'confirmed')
    .not('marketing_consent_at', 'is', null);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się policzyć odbiorców.' } };
  }
  return { status: 200, body: { confirmedCount: count || 0 } };
}

export async function handleListGuestCampaigns({ req, authorization, query = {} }) {
  const authz = await requireCampaignOwner({ req, authorization, query, body: {} });
  if (authz.status) return authz;

  const { data, error } = await authz.admin
    .from('guest_campaigns')
    .select('id, name, template_type, subject, headline, status, recipient_count, created_at, sent_at, metadata')
    .eq('user_id', authz.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { status: 500, body: { error: error.message || 'Nie udało się pobrać historii kampanii.' } };
  }
  return { status: 200, body: { campaigns: (data || []).map(campaignView) } };
}

async function loadDish(admin, userId, dishId) {
  if (!dishId || !isValidUuid(dishId)) return null;
  const { data } = await admin
    .from('dishes')
    .select('id, name, imageUrl, description, isOnline')
    .eq('id', dishId)
    .eq('userId', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    description: typeof data.description === 'string' ? data.description : '',
  };
}

async function loadBrand(admin, userId) {
  const { data } = await admin
    .from('profiles')
    .select('restaurant_name, logo_url')
    .eq('id', userId)
    .maybeSingle();
  return {
    restaurantName: (typeof data?.restaurant_name === 'string' && data.restaurant_name.trim()) || 'Restauracja',
    logoUrl: typeof data?.logo_url === 'string' ? data.logo_url : '',
  };
}

async function loadSendableLeads(admin, userId) {
  const { data, error } = await admin
    .from('promo_leads')
    .select('id, first_name, email, status, marketing_consent_at')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .not('marketing_consent_at', 'is', null)
    .order('confirmed_at', { ascending: false })
    .limit(MAX_RECIPIENTS + 1);

  if (error) throw error;
  return data || [];
}

async function leadStillSendable(admin, leadId) {
  const { data } = await admin
    .from('promo_leads')
    .select('id, status, marketing_consent_at, first_name, email')
    .eq('id', leadId)
    .maybeSingle();
  if (!data) return null;
  if (data.status !== 'confirmed' || !data.marketing_consent_at) return null;
  return data;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function parseCampaignBody(body, { userId, req, dish }) {
  const template = getGuestCampaignTemplate(body.templateType || body.template_type);
  if (!template) return { error: 'Nieznany szablon kampanii.' };

  const name = sanitizeText(body.name, 80);
  const subject = sanitizeText(body.subject, 140);
  const headline = sanitizeText(body.headline, 160);
  const message = sanitizeOptionalText(body.message, 1200) || '';
  const offerText = sanitizeOptionalText(body.offerText || body.offer_text, 180);
  const validFrom = sanitizeOptionalText(body.validFrom || body.valid_from, 40);
  const validUntil = sanitizeOptionalText(body.validUntil || body.valid_until, 40);
  let ctaLabel = sanitizeText(body.ctaLabel || body.cta_label, 40) || template.defaultCta;
  if (!GUEST_CAMPAIGN_CTA_PRESETS.includes(ctaLabel) && ctaLabel.length < 2) {
    ctaLabel = template.defaultCta;
  }

  const dishId = typeof (body.dishId || body.dish_id) === 'string' ? (body.dishId || body.dish_id).trim() : '';
  const ctaUrl = liveMenuUrl(req, userId, dish?.id || (isValidUuid(dishId) ? dishId : null));

  if (!name || !subject || !headline) {
    return { error: 'Uzupełnij nazwę kampanii, temat i nagłówek.' };
  }

  return {
    template,
    name,
    subject,
    headline,
    message,
    offerText,
    validFrom,
    validUntil,
    ctaLabel,
    ctaUrl,
    dishId: dish?.id || null,
  };
}

export async function handleSendGuestCampaign({ req, authorization, query = {}, body = {} }) {
  const verb = String(req?.method || 'POST').toUpperCase();
  if (verb !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };

  const ip = getClientIp(req);
  const authz = await requireCampaignOwner({ req, authorization, query, body });
  if (authz.status) return authz;

  if (!rateLimitOk(`campaign-send-ip:${ip}`, SEND_RATE_WINDOW_MS, 8)) {
    return { status: 429, body: { error: 'Zbyt wiele wysyłek. Spróbuj za godzinę.' } };
  }
  if (!rateLimitOk(`campaign-send-user:${authz.userId}`, SEND_RATE_WINDOW_MS, SEND_RATE_MAX)) {
    return { status: 429, body: { error: 'Limit 3 kampanii na godzinę. Spróbuj później.' } };
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    return { status: 503, body: { error: 'Wysyłka e-mail nie jest teraz dostępna.' } };
  }

  const requestedDishId = typeof (body.dishId || body.dish_id) === 'string' ? (body.dishId || body.dish_id).trim() : '';
  const dish = requestedDishId ? await loadDish(authz.admin, authz.userId, requestedDishId) : null;
  if (requestedDishId && isValidUuid(requestedDishId) && !dish) {
    return { status: 400, body: { error: 'Wybrane danie nie należy do tej restauracji.' } };
  }

  const parsed = parseCampaignBody(body, { userId: authz.userId, req, dish });
  if (parsed.error) return { status: 400, body: { error: parsed.error } };

  let leads;
  try {
    leads = await loadSendableLeads(authz.admin, authz.userId);
  } catch (err) {
    return { status: 500, body: { error: err.message || 'Nie udało się pobrać odbiorców.' } };
  }

  if (leads.length === 0) {
    return { status: 400, body: { error: 'Brak potwierdzonych kontaktów ze zgodą marketingową.' } };
  }
  if (leads.length > MAX_RECIPIENTS) {
    return {
      status: 400,
      body: {
        error: `Kampania MVP obsługuje maksymalnie ${MAX_RECIPIENTS} odbiorców naraz. Zmniejsz listę albo wyślij w transzach.`,
      },
    };
  }

  const brand = await loadBrand(authz.admin, authz.userId);
  const validLabel = validLabelFrom(parsed.validFrom, parsed.validUntil);

  const { data: campaign, error: insertError } = await authz.admin
    .from('guest_campaigns')
    .insert({
      user_id: authz.userId,
      name: parsed.name,
      template_type: parsed.template.id,
      subject: parsed.subject,
      headline: parsed.headline,
      message: parsed.message,
      offer_text: parsed.offerText,
      valid_from: parsed.validFrom,
      valid_until: parsed.validUntil,
      dish_id: parsed.dishId,
      cta_label: parsed.ctaLabel,
      cta_url: parsed.ctaUrl,
      status: 'sending',
      recipient_count: 0,
      metadata: { source: 'guest_club_campaigns' },
    })
    .select('id')
    .maybeSingle();

  if (insertError || !campaign) {
    return { status: 500, body: { error: insertError?.message || 'Nie udało się utworzyć kampanii.' } };
  }

  const stats = { sent: 0, failed: 0, skipped: 0 };

  try {
    await mapPool(leads, SEND_CONCURRENCY, async (lead) => {
      const fresh = await leadStillSendable(authz.admin, lead.id);
      if (!fresh) {
        stats.skipped += 1;
        await authz.admin.from('guest_campaign_deliveries').insert({
          campaign_id: campaign.id,
          lead_id: lead.id,
          email: lead.email,
          status: 'skipped',
        });
        return;
      }

      const unsubPage = unsubscribePageUrl(req, fresh.id);
      const unsubApi = unsubscribeApiUrl(req, fresh.id);
      const rendered = renderCampaignEmail({
        restaurantName: brand.restaurantName,
        logoUrl: brand.logoUrl,
        firstName: fresh.first_name,
        headline: parsed.headline,
        message: parsed.message,
        offerText: parsed.offerText,
        validLabel,
        dish,
        ctaLabel: parsed.ctaLabel,
        ctaUrl: parsed.ctaUrl,
        unsubUrl: unsubPage,
      });

      try {
        await sendResendEmail({
          to: fresh.email,
          subject: rendered.subjectPersonalize(parsed.subject),
          text: rendered.text,
          html: rendered.html,
          headers: unsubApi
            ? {
                'List-Unsubscribe': `<${unsubApi}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              }
            : undefined,
        });
        stats.sent += 1;
        await authz.admin.from('guest_campaign_deliveries').insert({
          campaign_id: campaign.id,
          lead_id: fresh.id,
          email: fresh.email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (err) {
        stats.failed += 1;
        await authz.admin.from('guest_campaign_deliveries').insert({
          campaign_id: campaign.id,
          lead_id: fresh.id,
          email: fresh.email,
          status: 'failed',
          error: String(err?.message || 'send_failed').slice(0, 240),
        });
      }
    });
  } catch (err) {
    await authz.admin
      .from('guest_campaigns')
      .update({
        status: 'failed',
        metadata: { failedCount: stats.failed, skippedCount: stats.skipped, error: String(err?.message || '').slice(0, 200) },
      })
      .eq('id', campaign.id);
    return { status: 502, body: { error: 'Wysyłka kampanii została przerwana.' } };
  }

  const status = stats.sent > 0 ? 'sent' : 'failed';
  await authz.admin
    .from('guest_campaigns')
    .update({
      status,
      recipient_count: stats.sent,
      sent_at: stats.sent > 0 ? new Date().toISOString() : null,
      metadata: { failedCount: stats.failed, skippedCount: stats.skipped },
    })
    .eq('id', campaign.id);

  if (status === 'failed') {
    return { status: 502, body: { error: 'Nie udało się wysłać wiadomości. Sprawdź konfigurację Resend.' } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      campaignId: campaign.id,
      sent: stats.sent,
      failed: stats.failed,
      skipped: stats.skipped,
    },
  };
}

export { GUEST_CAMPAIGN_TEMPLATES };
