import { generatePromoCodeValue } from './promoCodes.js';

export const WELCOME_KIND = 'guest_club_welcome';
export const WELCOME_VALID_DAYS = 7;
export const WELCOME_PERCENT_MIN = 1;
export const WELCOME_PERCENT_MAX = 90;

const WELCOME_CODE_COLUMNS =
  'id, user_id, code, reward_name, reward_description, status, expires_at, used_at, email, metadata';

/** Liczba całkowita 1–90. Puste pole to brak wartości, nie domyślne 5%. */
export function parseWelcomePercent(value) {
  if (value == null || value === '') return { ok: true, percent: null };
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < WELCOME_PERCENT_MIN || n > WELCOME_PERCENT_MAX) {
    return { ok: false, percent: null };
  }
  return { ok: true, percent: n };
}

export function snapshotWelcomeOffer(percent, now = new Date()) {
  return {
    percent,
    scope: 'whole_bill',
    validDays: WELCOME_VALID_DAYS,
    stacks: false,
    manualPos: true,
    promisedAt: now.toISOString(),
  };
}

export function readWelcomeSnapshot(metadata) {
  const offer = metadata && typeof metadata === 'object' ? metadata.welcome_offer : null;
  if (!offer || typeof offer !== 'object') return null;
  const parsed = parseWelcomePercent(offer.percent);
  if (!parsed.ok || parsed.percent == null) return null;
  const days = Number(offer.validDays);
  return {
    percent: parsed.percent,
    scope: 'whole_bill',
    validDays: days === WELCOME_VALID_DAYS ? WELCOME_VALID_DAYS : WELCOME_VALID_DAYS,
    stacks: false,
    manualPos: true,
    promisedAt: typeof offer.promisedAt === 'string' ? offer.promisedAt : null,
  };
}

export function welcomeRewardCopy(percent) {
  return {
    rewardName: 'Rabat powitalny Klubu Gości',
    rewardDescription: `${percent}% na cały rachunek. Nie łączy się z innymi rabatami. Nalicz rabat ręcznie na kasie.`,
  };
}

export function welcomeGuestView(row, now = new Date()) {
  if (!row?.code) return null;
  const snapshot = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const parsed = parseWelcomePercent(snapshot.percent);
  const percent = parsed.ok ? parsed.percent : null;
  let status = row.status || 'active';
  if (status === 'active' && row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    status = 'expired';
  }
  return {
    code: row.code,
    percent,
    scope: 'whole_bill',
    expiresAt: row.expires_at || null,
    status,
  };
}

function isWelcomeRow(row) {
  return row?.metadata && row.metadata.kind === WELCOME_KIND;
}

async function findWelcomeCode(admin, userId, email) {
  const { data, error } = await admin
    .from('promo_codes')
    .select(WELCOME_CODE_COLUMNS)
    .eq('user_id', userId)
    .eq('email', email);
  if (error) throw error;
  return (data || []).find(isWelcomeRow) || null;
}

async function findCodeById(admin, id) {
  const { data, error } = await admin
    .from('promo_codes')
    .select(WELCOME_CODE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function linkLeadToCode(admin, leadId, codeId) {
  await admin.from('promo_leads').update({ promo_code_id: codeId }).eq('id', leadId).is('promo_code_id', null);
}

function isUniqueViolation(error) {
  if (!error) return false;
  if (error.code === '23505') return true;
  return /duplicate|unique/i.test(String(error.message || ''));
}

/**
 * Jeden bonus na adres w lokalu. Drugie wywołanie zwraca już wydany kod.
 * allowNewGrant = false blokuje tylko nowe wydanie (utrata Premium).
 */
export async function grantWelcomeBonus(admin, lead, { allowNewGrant, now = new Date() } = {}) {
  if (!lead?.id || !lead.user_id || !lead.email) return { ok: true, code: null, created: false };

  if (lead.promo_code_id) {
    const linked = await findCodeById(admin, lead.promo_code_id);
    if (linked) return { ok: true, code: linked, created: false };
  }

  const existing = await findWelcomeCode(admin, lead.user_id, lead.email);
  if (existing) {
    await linkLeadToCode(admin, lead.id, existing.id);
    return { ok: true, code: existing, created: false };
  }

  const snapshot = readWelcomeSnapshot(lead.metadata);
  if (!snapshot) return { ok: true, code: null, created: false };
  if (!allowNewGrant) return { ok: true, code: null, created: false, blockedByPlan: true };

  const expiresAt = new Date(now.getTime() + WELCOME_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const copy = welcomeRewardCopy(snapshot.percent);
  const inserted = await insertWelcomeCode(admin, {
    userId: lead.user_id,
    email: lead.email,
    leadId: lead.id,
    percent: snapshot.percent,
    rewardName: copy.rewardName,
    rewardDescription: copy.rewardDescription,
    expiresAt,
  });

  if (!inserted.ok) {
    if (inserted.conflict) {
      const raced = await findWelcomeCode(admin, lead.user_id, lead.email);
      if (raced) {
        await linkLeadToCode(admin, lead.id, raced.id);
        return { ok: true, code: raced, created: false };
      }
    }
    return { ok: false, code: null, created: false, error: inserted.error || 'Nie udało się wydać rabatu.' };
  }

  await linkLeadToCode(admin, lead.id, inserted.code.id);
  return { ok: true, code: inserted.code, created: true };
}

async function insertWelcomeCode(admin, fields) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generatePromoCodeValue();
    const { data, error } = await admin
      .from('promo_codes')
      .insert({
        user_id: fields.userId,
        campaign_id: null,
        email: fields.email,
        code,
        reward_name: fields.rewardName,
        reward_description: fields.rewardDescription,
        status: 'active',
        expires_at: fields.expiresAt,
        metadata: {
          kind: WELCOME_KIND,
          percent: fields.percent,
          scope: 'whole_bill',
          leadId: fields.leadId,
        },
      })
      .select(WELCOME_CODE_COLUMNS)
      .maybeSingle();

    if (!error && data) return { ok: true, code: data };
    if (isUniqueViolation(error)) {
      const message = String(error.message || '');
      if (/promo_codes_welcome_email_uidx|welcome/i.test(message) || message.includes(fields.email)) {
        return { ok: false, conflict: true };
      }
      const raced = await findWelcomeCode(admin, fields.userId, fields.email);
      if (raced) return { ok: false, conflict: true };
      continue;
    }
    return { ok: false, error: error?.message || 'Nie udało się zapisać kodu.' };
  }
  return { ok: false, error: 'Nie udało się wygenerować unikalnego kodu.' };
}
