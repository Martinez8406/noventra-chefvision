/**
 * Rabat powitalny Klubu — atrapa bazy i atrapa poczty.
 * Nie łączy się z produkcyjnym Supabase i nie wysyła e-maili.
 */
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { drainMemoryOutbox } from '../lib/feedbackUtils.js';
import { setOwnerUserForTests } from '../lib/promoAuth.js';
import { hashToken, lookupPromoCode, redeemPromoCodeAtomic } from '../lib/promoCodes.js';
import {
  handleGuestPromoConfirm,
  handleGuestPromoSignup,
  handleGuestPromoUnsubscribe,
  handleOwnerPromoLeads,
  handleOwnerPromoOffer,
  handlePublicPromoOffer,
} from '../lib/promoGuest.js';
import { getSupabaseAdmin, setSupabaseAdminForTests } from '../lib/stripe/supabaseAdmin.js';
import { canUseGuestClub } from '../utils/tokens.js';

process.env.CHEFVISION_EMAIL_SINK = 'memory';
process.env.PROMO_UNSUB_SECRET = 'test-unsub-secret-16chars';
process.env.BASE_URL = 'http://127.0.0.1:3000';

const VENUE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const START = '33333333-3333-4333-8333-333333333333';

const store = {
  profiles: [],
  promo_leads: [],
  promo_codes: [],
};

function clone(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function match(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col];
    if (filter.op === 'eq') return value === filter.val;
    if (filter.op === 'is') return filter.val == null ? value == null : value === filter.val;
    if (filter.op === 'in') return filter.val.includes(value);
    if (filter.op === 'gt') return value != null && String(value) > String(filter.val);
    return false;
  });
}

function welcomeRows(userId, email) {
  return store.promo_codes.filter(
    (row) => row.user_id === userId && row.email === email && row.metadata?.kind === 'guest_club_welcome',
  );
}

function query(table) {
  const state = { op: 'select', filters: [], payload: null, order: null, limit: null };
  const exec = () => {
    const rows = store[table];
    if (!rows) return Promise.resolve({ data: null, error: { message: `Brak tabeli ${table}` } });

    if (state.op === 'insert') {
      const row = {
        id: state.payload.id || randomUUID(),
        created_at: state.payload.created_at || new Date().toISOString(),
        ...state.payload,
      };
      if (table === 'promo_codes' && row.metadata?.kind === 'guest_club_welcome') {
        const dup = welcomeRows(row.user_id, row.email)[0];
        if (dup) {
          return Promise.resolve({
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "promo_codes_welcome_email_uidx"',
            },
          });
        }
      }
      if (table === 'promo_codes' && row.status === 'active') {
        const dup = store.promo_codes.find(
          (item) => item.user_id === row.user_id && item.code === row.code && item.status === 'active',
        );
        if (dup) {
          return Promise.resolve({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint "promo_codes_code_active"' },
          });
        }
      }
      rows.push(row);
      return Promise.resolve({ data: clone(row), error: null });
    }

    let found = rows.filter((row) => match(row, state.filters));
    if (state.order) {
      const { col, ascending } = state.order;
      found = [...found].sort((a, b) => {
        const av = a[col] || '';
        const bv = b[col] || '';
        return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    if (state.limit != null) found = found.slice(0, state.limit);

    if (state.op === 'update') {
      const updated = [];
      for (const row of found) {
        Object.assign(row, state.payload);
        updated.push(row);
      }
      if (state.single) return Promise.resolve({ data: clone(updated[0] || null), error: null });
      return Promise.resolve({ data: updated.map(clone), error: null });
    }

    if (state.single) return Promise.resolve({ data: clone(found[0] || null), error: null });
    return Promise.resolve({ data: found.map(clone), error: null });
  };

  const api = {
    select() {
      state.single = false;
      return api;
    },
    insert(payload) {
      state.op = 'insert';
      state.payload = payload;
      return api;
    },
    update(payload) {
      state.op = 'update';
      state.payload = payload;
      return api;
    },
    eq(col, val) {
      state.filters.push({ op: 'eq', col, val });
      return api;
    },
    is(col, val) {
      state.filters.push({ op: 'is', col, val });
      return api;
    },
    in(col, val) {
      state.filters.push({ op: 'in', col, val });
      return api;
    },
    gt(col, val) {
      state.filters.push({ op: 'gt', col, val });
      return api;
    },
    order(col, opts) {
      state.order = { col, ascending: opts?.ascending !== false };
      return api;
    },
    limit(n) {
      state.limit = n;
      return api;
    },
    maybeSingle() {
      state.single = true;
      return exec();
    },
    single() {
      state.single = true;
      return exec();
    },
    then(resolve, reject) {
      return exec().then(resolve, reject);
    },
  };
  return api;
}

const memoryAdmin = {
  from: query,
  rpc(name, args) {
    if (name !== 'redeem_promo_code_atomic') {
      return Promise.resolve({ data: null, error: { message: 'function does not exist' } });
    }
    const now = Date.now();
    const row = store.promo_codes.find(
      (item) =>
        item.user_id === args.p_user_id &&
        item.code === args.p_code &&
        item.status === 'active' &&
        (!item.expires_at || new Date(item.expires_at).getTime() > now),
    );
    if (!row) return Promise.resolve({ data: null, error: null });
    row.status = 'used';
    row.used_at = new Date().toISOString();
    row.used_by_device = args.p_used_by_device || null;
    return Promise.resolve({ data: clone(row), error: null });
  },
};

setSupabaseAdminForTests(memoryAdmin);
if (getSupabaseAdmin() !== memoryAdmin) {
  throw new Error('Atrapa bazy nie została podłączona. Test przerwany, żeby nie ruszyć prawdziwego Supabase.');
}

function profile(id, plan, extra = {}) {
  return {
    id,
    restaurant_name: extra.restaurant_name || 'Bistro Test',
    plan,
    subscription_status: plan,
    trial_ends_at: null,
    lifetime_purchased_at: extra.lifetime_purchased_at || null,
    stripe_subscription_id: extra.stripe_subscription_id || null,
    stripe_subscription_status: null,
    guest_promo: extra.guest_promo || { active: true, welcome_enabled: false, welcome_percent: null },
    platform_role: 'owner',
  };
}

store.profiles.push(
  profile(VENUE, 'premium', {
    restaurant_name: 'Bistro Nad Wisłą',
    guest_promo: { active: true, welcome_enabled: true, welcome_percent: 5 },
  }),
  profile(OTHER, 'premium', { restaurant_name: 'Inny lokal' }),
  profile(START, 'start', {
    restaurant_name: 'Startowa',
    guest_promo: { active: true, welcome_enabled: true, welcome_percent: 5 },
  }),
);

let failed = 0;
let ipSeq = 0;

function req() {
  ipSeq += 1;
  return {
    headers: { origin: 'http://127.0.0.1:3000', 'x-forwarded-for': `10.0.0.${ipSeq}` },
    ip: `10.0.0.${ipSeq}`,
  };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err?.message || err);
  }
}

function tokenFrom(mail) {
  const match = String(mail?.text || '').match(/[?&]token=([^\s&]+)/);
  if (!match) throw new Error('Brak tokenu w atrapie wiadomości');
  return decodeURIComponent(match[1]);
}

async function signup(email, restaurantId = VENUE, firstName = 'Anna') {
  drainMemoryOutbox();
  const result = await handleGuestPromoSignup({
    req: req(),
    body: {
      restaurantId,
      firstName,
      email,
      termsAccepted: true,
      marketingConsent: true,
    },
  });
  const mail = drainMemoryOutbox()[0] || null;
  return { result, mail };
}

async function confirm(token) {
  return handleGuestPromoConfirm({ req: req(), query: { token } });
}

function leadByEmail(email, userId = VENUE) {
  return store.promo_leads.find((row) => row.user_id === userId && row.email === email) || null;
}

await check('uprawnienia: Premium i lifetime tak, trial i Start nie', async () => {
  assert.strictEqual(canUseGuestClub({ plan: 'premium' }), true);
  assert.strictEqual(canUseGuestClub({ plan: 'start' }), false);
  assert.strictEqual(canUseGuestClub({ plan: 'trial', trial_ends_at: new Date(Date.now() + 86400000).toISOString() }), false);
  assert.strictEqual(canUseGuestClub({ plan: 'free' }), false);
  assert.strictEqual(canUseGuestClub({ plan: 'start', stripe_subscription_id: 'lifetime' }), true);
});

await check('walidacja procentu i brak domyślnych 5%', async () => {
  const { parseWelcomePercent } = await import('../lib/welcomeBonus.js');
  assert.deepStrictEqual(parseWelcomePercent(''), { ok: true, percent: null });
  assert.deepStrictEqual(parseWelcomePercent(5), { ok: true, percent: 5 });
  assert.strictEqual(parseWelcomePercent(0).ok, false);
  assert.strictEqual(parseWelcomePercent(91).ok, false);
  assert.strictEqual(parseWelcomePercent(5.5).ok, false);
});

await check('1. zapis bez potwierdzenia nie daje kodu', async () => {
  const email = 'pending@example.com';
  const { result, mail } = await signup(email);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.checkInbox, true);
  assert.ok(!('welcome' in result.body));
  assert.strictEqual(leadByEmail(email).status, 'pending');
  assert.strictEqual(leadByEmail(email).metadata.welcome_offer.percent, 5);
  assert.strictEqual(welcomeRows(VENUE, email).length, 0);
  assert.match(mail.text, /jednorazowy rabat 5%/);
  const early = await confirm('zbyt-krotki');
  assert.notStrictEqual(early.body.outcome, 'joined');
  assert.strictEqual(welcomeRows(VENUE, email).length, 0);
});

await check('2. potwierdzenie daje dokładnie jeden bonus', async () => {
  const email = 'pending@example.com';
  const { mail } = await signup(email);
  const before = drainMemoryOutbox().length;
  const joined = await confirm(tokenFrom(mail));
  assert.strictEqual(before, 0);
  assert.strictEqual(joined.status, 200);
  assert.strictEqual(joined.body.outcome, 'joined');
  assert.strictEqual(joined.body.restaurantName, 'Bistro Nad Wisłą');
  assert.strictEqual(joined.body.welcome.percent, 5);
  assert.strictEqual(joined.body.welcome.scope, 'whole_bill');
  assert.strictEqual(joined.body.welcome.status, 'active');
  assert.match(joined.body.welcome.code, /^[A-HJ-NP-Z]{2}-[0-9]{4}$/);
  const days = (new Date(joined.body.welcome.expiresAt).getTime() - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days < 7.05, `ważność ${days} dni`);
  assert.strictEqual(welcomeRows(VENUE, email).length, 1);
  assert.strictEqual(drainMemoryOutbox().length, 0);
});

await check('3. ponowne kliknięcia i równoległe żądania nie tworzą drugiego bonusu', async () => {
  const email = 'race@example.com';
  const { mail } = await signup(email);
  const token = tokenFrom(mail);
  const [a, b] = await Promise.all([confirm(token), confirm(token)]);
  assert.strictEqual(a.body.welcome.code, b.body.welcome.code);
  assert.strictEqual(welcomeRows(VENUE, email).length, 1);
  const again = await confirm(token);
  assert.strictEqual(again.body.welcome.code, a.body.welcome.code);
  assert.strictEqual(again.body.welcome.status, 'active');
});

await check('4. ten sam link pokazuje kod, obcy token i sam e-mail nie', async () => {
  const email = 'race@example.com';
  const code = welcomeRows(VENUE, email)[0].code;
  const { mail } = await signup(email);
  const shown = await confirm(tokenFrom(mail));
  assert.strictEqual(shown.body.welcome.code, code);
  const stranger = await confirm(tokenFrom((await signup('other@example.com')).mail));
  assert.notStrictEqual(stranger.body.welcome?.code, code);
  assert.ok(!store.promo_codes.some((row) => row.email === email && row.code !== code && row.metadata?.kind === 'guest_club_welcome'));
});

await check('5. kod działa tylko we właściwym lokalu', async () => {
  const row = welcomeRows(VENUE, 'race@example.com')[0];
  const here = await lookupPromoCode(memoryAdmin, { userId: VENUE, code: row.code });
  const there = await lookupPromoCode(memoryAdmin, { userId: OTHER, code: row.code });
  assert.strictEqual(here.outcome, 'active');
  assert.strictEqual(there.outcome, 'invalid');
});

await check('6. samo sprawdzenie nie zużywa kodu', async () => {
  const row = welcomeRows(VENUE, 'race@example.com')[0];
  const looked = await lookupPromoCode(memoryAdmin, { userId: VENUE, code: row.code });
  assert.strictEqual(looked.outcome, 'active');
  assert.strictEqual(looked.rewardName, 'Rabat powitalny Klubu Gości');
  assert.strictEqual(looked.welcomePercent, 5);
  assert.strictEqual(looked.welcomeScope, 'whole_bill');
  assert.ok(looked.expiresAt);
  assert.strictEqual(row.status, 'active');
  assert.ok(!looked.email);
});

await check('7. realizacja jest jednorazowa, także równolegle', async () => {
  const row = welcomeRows(VENUE, 'race@example.com')[0];
  const [a, b] = await Promise.all([
    redeemPromoCodeAtomic(memoryAdmin, { userId: VENUE, code: row.code, usedByDevice: 'a' }),
    redeemPromoCodeAtomic(memoryAdmin, { userId: VENUE, code: row.code, usedByDevice: 'b' }),
  ]);
  const outcomes = [a.outcome, b.outcome].sort();
  assert.deepStrictEqual(outcomes, ['redeemed', 'used']);
  const third = await redeemPromoCodeAtomic(memoryAdmin, { userId: VENUE, code: row.code });
  assert.strictEqual(third.outcome, 'used');
  assert.strictEqual(row.status, 'used');
});

await check('8. kod wygasły jest odrzucany', async () => {
  const email = 'expired@example.com';
  const { mail } = await signup(email);
  await confirm(tokenFrom(mail));
  const row = welcomeRows(VENUE, email)[0];
  row.expires_at = new Date(Date.now() - 60_000).toISOString();
  const looked = await lookupPromoCode(memoryAdmin, { userId: VENUE, code: row.code });
  assert.strictEqual(looked.outcome, 'expired');
  assert.strictEqual(looked.welcomePercent, 5);
  const redeemed = await redeemPromoCodeAtomic(memoryAdmin, { userId: VENUE, code: row.code });
  assert.strictEqual(redeemed.outcome, 'expired');
  assert.notStrictEqual(row.status, 'used');
});

await check('9. zmiana rabatu nie rusza wcześniejszej oferty ani kodu', async () => {
  const email = 'snapshot@example.com';
  const { mail } = await signup(email);
  const lead = leadByEmail(email);
  const promised = lead.metadata.welcome_offer.percent;
  setOwnerUserForTests({ id: VENUE });
  const saved = await handleOwnerPromoOffer({
    req: req(),
    authorization: 'Bearer test',
    method: 'POST',
    body: { welcomeEnabled: true, welcomePercent: 20 },
  });
  assert.strictEqual(saved.status, 200);
  assert.strictEqual(lead.metadata.welcome_offer.percent, promised);
  const joined = await confirm(tokenFrom(mail));
  assert.strictEqual(joined.body.welcome.percent, 5);
  assert.strictEqual(welcomeRows(VENUE, email)[0].metadata.percent, 5);
  store.profiles.find((row) => row.id === VENUE).guest_promo.welcome_percent = 5;
});

await check('10. wypis i ponowny zapis nie dają nowego bonusu', async () => {
  const email = 'snapshot@example.com';
  const code = welcomeRows(VENUE, email)[0].code;
  const lead = leadByEmail(email);
  const { createUnsubscribeToken } = await import('../lib/promoGuest.js');
  const token = createUnsubscribeToken(lead.id);
  const unsub = await handleGuestPromoUnsubscribe({
    req: req(),
    method: 'POST',
    body: { token },
  });
  assert.strictEqual(unsub.body.outcome, 'unsubscribed');
  assert.strictEqual(welcomeRows(VENUE, email)[0].status, 'active');
  const again = await signup(email);
  assert.strictEqual(again.result.body.checkInbox, true);
  assert.ok(!again.result.body.status);
  assert.strictEqual(leadByEmail(email).metadata.welcome_offer.percent, 5);
  const joined = await confirm(tokenFrom(again.mail));
  assert.strictEqual(joined.body.welcome.code, code);
  assert.strictEqual(welcomeRows(VENUE, email).length, 1);
});

await check('11. dotychczasowe kody Verify nadal działają', async () => {
  store.promo_codes.push({
    id: randomUUID(),
    user_id: VENUE,
    code: 'KT-4827',
    reward_name: 'Kawa',
    reward_description: 'Mała kawa',
    status: 'active',
    expires_at: null,
    email: null,
    metadata: { source: 'manual' },
    created_at: new Date().toISOString(),
  });
  const looked = await lookupPromoCode(memoryAdmin, { userId: VENUE, code: 'KT-4827' });
  assert.strictEqual(looked.outcome, 'active');
  assert.strictEqual(looked.rewardName, 'Kawa');
  assert.ok(!('welcomePercent' in looked));
  const redeemed = await redeemPromoCodeAtomic(memoryAdmin, { userId: VENUE, code: 'KT-4827' });
  assert.strictEqual(redeemed.outcome, 'redeemed');
});

await check('12. Premium jest sprawdzane na backendzie, stare kontakty bez bonusu', async () => {
  setOwnerUserForTests({ id: START });
  const denied = await handleOwnerPromoOffer({
    req: req(),
    authorization: 'Bearer test',
    method: 'POST',
    body: { welcomeEnabled: true, welcomePercent: 10 },
  });
  assert.strictEqual(denied.status, 403);
  const leads = await handleOwnerPromoLeads({
    req: req(),
    authorization: 'Bearer test',
    method: 'GET',
  });
  assert.strictEqual(leads.status, 200);

  const hidden = await handlePublicPromoOffer({ query: { restaurantId: START } });
  assert.strictEqual(hidden.body.active, false);
  const blockedSignup = await signup('start@example.com', START);
  assert.strictEqual(blockedSignup.result.status, 400);
  assert.strictEqual(blockedSignup.mail, null);

  const oldEmail = 'old-pending@example.com';
  const oldToken = 'stary-token-potwierdzenia-32b';
  store.promo_leads.push({
    id: randomUUID(),
    user_id: VENUE,
    first_name: 'Stary',
    email: oldEmail,
    status: 'pending',
    confirmation_token_hash: hashToken(oldToken),
    confirmation_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    promo_code_id: null,
    metadata: { source: 'guest_club' },
    created_at: new Date().toISOString(),
  });
  const oldJoin = await confirm(oldToken);
  assert.strictEqual(oldJoin.body.outcome, 'joined');
  assert.strictEqual(oldJoin.body.welcome, null);
  assert.strictEqual(welcomeRows(VENUE, oldEmail).length, 0);

  const fresh = 'after-drop@example.com';
  const { mail } = await signup(fresh);
  store.profiles.find((row) => row.id === VENUE).plan = 'start';
  const dropped = await confirm(tokenFrom(mail));
  assert.strictEqual(dropped.body.outcome, 'joined');
  assert.strictEqual(dropped.body.welcome, null);
  assert.strictEqual(welcomeRows(VENUE, fresh).length, 0);
  const issued = welcomeRows(VENUE, 'snapshot@example.com')[0];
  const still = await lookupPromoCode(memoryAdmin, { userId: VENUE, code: issued.code });
  assert.strictEqual(still.outcome, 'active');
  store.profiles.find((row) => row.id === VENUE).plan = 'premium';
});

await check('włączenie bez procentu i zły procent są odrzucane', async () => {
  setOwnerUserForTests({ id: VENUE });
  const empty = await handleOwnerPromoOffer({
    req: req(),
    authorization: 'Bearer test',
    method: 'POST',
    body: { welcomeEnabled: true, welcomePercent: null },
  });
  assert.strictEqual(empty.status, 400);
  const bad = await handleOwnerPromoOffer({
    req: req(),
    authorization: 'Bearer test',
    method: 'POST',
    body: { welcomeEnabled: true, welcomePercent: 91 },
  });
  assert.strictEqual(bad.status, 400);
  const kept = await handleOwnerPromoOffer({
    req: req(),
    authorization: 'Bearer test',
    method: 'POST',
    body: { active: true },
  });
  assert.strictEqual(kept.status, 200);
  assert.strictEqual(kept.body.welcomePercent, 5);
});

await check('ponowny formularz istniejącego adresu nie zdradza członkostwa', async () => {
  const first = await signup('quiet@example.com');
  const second = await signup('quiet@example.com');
  assert.deepStrictEqual(second.result.body, first.result.body);
  assert.ok(!JSON.stringify(second.result.body).includes('confirmed'));
});

if (failed) {
  console.error(`\n${failed} test(ów) nie przeszło`);
  process.exit(1);
}
console.log('\nWszystkie testy rabatu powitalnego OK');
