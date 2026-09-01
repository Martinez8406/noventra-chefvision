import assert from 'assert';
import {
  getLifetimeLimits,
  getLifetimePriceIdForTier,
  publicLifetimeOfferView,
  resolveLifetimeTier,
  LIFETIME_BONUS_TOKENS,
  LIFETIME_PLAN_TYPE,
  LIFETIME_PRICE_PLN_FIRST,
  LIFETIME_PRICE_PLN_SECOND,
} from '../lib/stripe/lifetimeOffer.js';
import { isLifetimeProfile, LIFETIME_STRIPE_SENTINEL } from '../utils/tokens.js';

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err.message);
  }
}

check('plan type slug', () => {
  assert.strictEqual(LIFETIME_PLAN_TYPE, 'founder_lifetime');
});

check('lifetime bonus is 100 extra_tokens, one-shot', () => {
  assert.strictEqual(LIFETIME_BONUS_TOKENS, 100);
});

check('tier 0–9 → 599, badge first pool, next-price note', () => {
  for (let sold = 0; sold < 10; sold++) {
    const t = resolveLifetimeTier(sold, { firstTierLimit: 10, totalLimit: 20 });
    assert.strictEqual(t.soldOut, false, `sold=${sold}`);
    assert.strictEqual(t.pricePln, LIFETIME_PRICE_PLN_FIRST);
    assert.strictEqual(t.tier, '599');
    assert.strictEqual(t.badge, 'Tylko 10 kont w tej cenie');
    assert.strictEqual(t.nextTierNote, 'Kolejne 10 kont: 799 zł');
    assert.strictEqual(t.buttonLabel, 'Kupuję');
  }
});

check('tier 10–19 → 799, last-10 badge, no 599 note', () => {
  for (let sold = 10; sold < 20; sold++) {
    const t = resolveLifetimeTier(sold, { firstTierLimit: 10, totalLimit: 20 });
    assert.strictEqual(t.soldOut, false, `sold=${sold}`);
    assert.strictEqual(t.pricePln, LIFETIME_PRICE_PLN_SECOND);
    assert.strictEqual(t.tier, '799');
    assert.strictEqual(t.badge, 'Ostatnie 10 kont');
    assert.strictEqual(t.nextTierNote, null);
    assert.strictEqual(t.buttonLabel, 'Kupuję');
  }
});

check('tier 20+ → sold out', () => {
  const t = resolveLifetimeTier(20, { firstTierLimit: 10, totalLimit: 20 });
  assert.strictEqual(t.soldOut, true);
  assert.strictEqual(t.pricePln, null);
  assert.strictEqual(t.tier, 'sold_out');
  assert.strictEqual(t.badge, 'Oferta Founder Lifetime wyprzedana');
  assert.strictEqual(t.buttonLabel, 'Oferta wyprzedana');
  assert.strictEqual(t.nextTierNote, null);
});

check('public view does not expose Stripe price ids', () => {
  const view = publicLifetimeOfferView({
    ...resolveLifetimeTier(0),
    firstTierLimit: 10,
    totalLimit: 20,
    priceId: 'price_secret',
  });
  assert.strictEqual('priceId' in view, false);
  assert.ok(view.pricePln === 599);
});

check('env limits default to 10 / 20', () => {
  const prevFirst = process.env.LIFETIME_FIRST_TIER_LIMIT;
  const prevTotal = process.env.LIFETIME_TOTAL_LIMIT;
  delete process.env.LIFETIME_FIRST_TIER_LIMIT;
  delete process.env.LIFETIME_TOTAL_LIMIT;
  const limits = getLifetimeLimits();
  assert.strictEqual(limits.firstTierLimit, 10);
  assert.strictEqual(limits.totalLimit, 20);
  if (prevFirst != null) process.env.LIFETIME_FIRST_TIER_LIMIT = prevFirst;
  if (prevTotal != null) process.env.LIFETIME_TOTAL_LIMIT = prevTotal;
});

check('price id mapping uses server env, not client payload', () => {
  const prev599 = process.env.STRIPE_LIFETIME_PRICE_ID_599;
  const prev799 = process.env.STRIPE_LIFETIME_PRICE_ID_799;
  process.env.STRIPE_LIFETIME_PRICE_ID_599 = 'price_599_server';
  process.env.STRIPE_LIFETIME_PRICE_ID_799 = 'price_799_server';
  assert.strictEqual(getLifetimePriceIdForTier('599'), 'price_599_server');
  assert.strictEqual(getLifetimePriceIdForTier('799'), 'price_799_server');
  assert.strictEqual(getLifetimePriceIdForTier('sold_out'), null);
  if (prev599 != null) process.env.STRIPE_LIFETIME_PRICE_ID_599 = prev599;
  else delete process.env.STRIPE_LIFETIME_PRICE_ID_599;
  if (prev799 != null) process.env.STRIPE_LIFETIME_PRICE_ID_799 = prev799;
  else delete process.env.STRIPE_LIFETIME_PRICE_ID_799;
});

check('lifetime profile detection', () => {
  assert.strictEqual(isLifetimeProfile({ lifetime_purchased_at: '2026-01-01' }), true);
  assert.strictEqual(isLifetimeProfile({ stripe_subscription_id: LIFETIME_STRIPE_SENTINEL }), true);
  assert.strictEqual(isLifetimeProfile({ stripe_subscription_status: 'lifetime' }), true);
  assert.strictEqual(isLifetimeProfile({ plan: 'premium', stripe_subscription_id: 'sub_abc' }), false);
  assert.strictEqual(isLifetimeProfile(null), false);
});

function mockSupabase({ paid = 0, pending = 0, profile = { id: 'user-1' }, insertError = null } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: profile, error: null }),
                lt: () => ({ then: undefined }),
                gte: async () => ({ count: table === 'lifetime_purchases' ? pending : 0, error: null }),
              };
            },
            or: async () => ({ count: paid, error: null }),
          };
        },
        update() {
          return {
            eq() {
              return {
                eq: async () => ({ error: null }),
                lt: async () => ({ error: null }),
              };
            },
          };
        },
        insert(row) {
          inserts.push(row);
          return {
            select() {
              return {
                maybeSingle: async () => {
                  if (insertError) return { data: null, error: insertError };
                  return {
                    data: { id: 'pur-1', slot_number: row.slot_number, price_pln: row.price_pln },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err.message);
  }
}

const { reserveLifetimeCheckout } = await import('../lib/stripe/lifetimeOffer.js');

await checkAsync('checkout price comes from sold count, ignores client 799 at 0 sold', async () => {
  process.env.STRIPE_LIFETIME_PRICE_ID_599 = 'price_599_server';
  process.env.STRIPE_LIFETIME_PRICE_ID_799 = 'price_799_server';
  const supabase = mockSupabase({ paid: 0, pending: 0, profile: { id: 'user-1' } });
  const result = await reserveLifetimeCheckout({
    supabase,
    userId: 'user-1',
    clientPricePln: 799,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.pricePln, 599);
  assert.strictEqual(result.priceId, 'price_599_server');
  assert.strictEqual(result.tier, '599');
});

await checkAsync('checkout uses 799 after 10 sold', async () => {
  process.env.STRIPE_LIFETIME_PRICE_ID_599 = 'price_599_server';
  process.env.STRIPE_LIFETIME_PRICE_ID_799 = 'price_799_server';
  const supabase = mockSupabase({ paid: 10, pending: 0, profile: { id: 'user-2' } });
  const result = await reserveLifetimeCheckout({ supabase, userId: 'user-2' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.pricePln, 799);
  assert.strictEqual(result.priceId, 'price_799_server');
});

await checkAsync('checkout blocked after 20 sold', async () => {
  const supabase = mockSupabase({ paid: 20, pending: 0, profile: { id: 'user-3' } });
  const result = await reserveLifetimeCheckout({ supabase, userId: 'user-3' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 409);
  assert.match(result.error, /wyprzedana/i);
});

await checkAsync('existing lifetime buyer cannot buy again', async () => {
  const supabase = mockSupabase({
    paid: 3,
    profile: { id: 'user-4', lifetime_purchased_at: '2026-01-01' },
  });
  const result = await reserveLifetimeCheckout({ supabase, userId: 'user-4' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 409);
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll lifetime offer tests passed');
