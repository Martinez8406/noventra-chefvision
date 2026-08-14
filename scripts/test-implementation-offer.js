import assert from 'assert';
import {
  createFreeImplementationOrder,
  isFreeImplementationPlan,
  IMPLEMENTATION_OFFERS,
} from '../lib/implementationOffer.js';
import { buildImplementationOfferMessage } from '../lib/discord.js';

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

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err.message);
  }
}

check('flag: menu, flyer and bundle are free, start is not', () => {
  assert.strictEqual(isFreeImplementationPlan('menu_service'), true);
  assert.strictEqual(isFreeImplementationPlan('flyer_service'), true);
  assert.strictEqual(isFreeImplementationPlan('implementation_bundle'), true);
  assert.strictEqual(isFreeImplementationPlan('start'), false);
  assert.strictEqual(isFreeImplementationPlan('premium'), false);
  assert.strictEqual(IMPLEMENTATION_OFFERS.menu_service.price, 0);
  assert.strictEqual(IMPLEMENTATION_OFFERS.flyer_service.paidPrice, 149);
});

check('discord menu message', () => {
  const msg = buildImplementationOfferMessage({
    kind: 'menu',
    email: 'klient@example.com',
    restaurantName: 'Bistro Test',
  });
  assert.match(msg, /NOWE ZLECENIE — MENU/);
  assert.match(msg, /Klient: klient@example.com/);
  assert.match(msg, /Restauracja: Bistro Test/);
  assert.match(msg, /Cena: 0 zł/);
  assert.match(msg, /Oferta: Wdrożeniowa/);
});

check('discord bundle message', () => {
  const msg = buildImplementationOfferMessage({
    kind: 'bundle',
    email: 'klient@example.com',
    restaurantName: 'Bistro Test',
  });
  assert.match(msg, /NOWE ZLECENIE — WDROŻENIE/);
  assert.match(msg, /Wykonanie menu \+ Ulotka QR/);
  assert.match(msg, /Cena: 0 zł/);
});

await checkAsync('TEST D: no auth → 401, no insert, no discord', async () => {
  let inserted = false;
  let discorded = false;
  const result = await createFreeImplementationOrder({
    authorization: '',
    planType: 'menu_service',
    deps: {
      verifyToken: async () => null,
      getAdmin: () => ({
        from: () => {
          inserted = true;
          return {};
        },
      }),
      sendDiscord: async () => {
        discorded = true;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 401);
  assert.strictEqual(inserted, false);
  assert.strictEqual(discorded, false);
});

function mockAdmin({ existing = null, existingByTable = {}, insertError = null, inserted = { id: 'ord-1', status: 'pending' } } = {}) {
  const calls = { inserts: 0, discords: 0, insertedTables: [] };
  const admin = {
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle: async () => {
          if (table === 'profiles') {
            return { data: { email: 'klient@example.com', restaurant_name: 'Bistro' }, error: null };
          }
          if (Object.prototype.hasOwnProperty.call(existingByTable, table)) {
            return { data: existingByTable[table], error: null };
          }
          return { data: existing, error: null };
        },
        insert(row) {
          calls.inserts += 1;
          calls.lastRow = row;
          calls.insertedTables.push(table);
          return {
            select() {
              return this;
            },
            maybeSingle: async () => {
              if (insertError) return { data: null, error: insertError };
              return { data: { ...inserted, id: `${table}-1` }, error: null };
            },
          };
        },
      };
    },
  };
  return { admin, calls };
}

await checkAsync('TEST A: menu free order, no stripe, discord after insert', async () => {
  const { admin, calls } = mockAdmin();
  let discordPayload = null;
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'menu_service',
    deps: {
      verifyToken: async () => ({ id: 'user-1', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async (msg) => {
        discordPayload = msg;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.free, true);
  assert.strictEqual(result.body.payment_status, 'free');
  assert.strictEqual(result.body.serviceType, 'menu_creation');
  assert.strictEqual(calls.lastRow.price, 0);
  assert.strictEqual(calls.lastRow.payment_status, 'free');
  assert.strictEqual(calls.lastRow.status, 'pending');
  assert.match(discordPayload, /NOWE ZLECENIE — MENU/);
});

await checkAsync('TEST B: flyer free order', async () => {
  const { admin, calls } = mockAdmin();
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'flyer_service',
    deps: {
      verifyToken: async () => ({ id: 'user-2', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async () => ({ ok: true }),
    },
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.serviceType, 'qr_flyer');
  assert.strictEqual(calls.lastRow.price, 0);
});

await checkAsync('TEST BUNDLE: one click creates menu + flyer and one discord', async () => {
  const { admin, calls } = mockAdmin();
  let discordPayload = null;
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'implementation_bundle',
    deps: {
      verifyToken: async () => ({ id: 'user-bundle', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async (msg) => {
        discordPayload = msg;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.free, true);
  assert.strictEqual(result.body.serviceType, 'implementation_bundle');
  assert.deepStrictEqual(result.body.created, ['menu_service', 'flyer_service']);
  assert.strictEqual(calls.inserts, 2);
  assert.match(discordPayload, /NOWE ZLECENIE — WDROŻENIE/);
});

await checkAsync('TEST BUNDLE duplicate → 409, no insert, no discord', async () => {
  const { admin, calls } = mockAdmin({
    existingByTable: {
      menu_service_orders: { id: 'm1' },
      flyer_service_orders: { id: 'f1' },
    },
  });
  let discorded = false;
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'implementation_bundle',
    deps: {
      verifyToken: async () => ({ id: 'user-bundle-2', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async () => {
        discorded = true;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 409);
  assert.strictEqual(calls.inserts, 0);
  assert.strictEqual(discorded, false);
});

await checkAsync('TEST C: duplicate active order → 409, no second insert', async () => {
  const { admin, calls } = mockAdmin({ existing: { id: 'already' } });
  let discorded = false;
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'menu_service',
    deps: {
      verifyToken: async () => ({ id: 'user-3', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async () => {
        discorded = true;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 409);
  assert.strictEqual(result.body.error, 'To zlecenie zostało już wysłane.');
  assert.strictEqual(calls.inserts, 0);
  assert.strictEqual(discorded, false);
});

await checkAsync('TEST E: discord fails, order still accepted', async () => {
  const { admin } = mockAdmin();
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'flyer_service',
    deps: {
      verifyToken: async () => ({ id: 'user-4', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async () => ({ ok: false, reason: 'timeout' }),
    },
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.free, true);
});

await checkAsync('insert failure → 500, no discord', async () => {
  const { admin } = mockAdmin({ insertError: { message: 'db down' } });
  let discorded = false;
  const result = await createFreeImplementationOrder({
    authorization: 'Bearer test',
    planType: 'menu_service',
    deps: {
      verifyToken: async () => ({ id: 'user-5', email: 'klient@example.com' }),
      getAdmin: () => admin,
      sendDiscord: async () => {
        discorded = true;
        return { ok: true };
      },
    },
  });
  assert.strictEqual(result.status, 500);
  assert.strictEqual(discorded, false);
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll implementation-offer tests passed');
