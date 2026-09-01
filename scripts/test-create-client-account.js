import assert from 'assert';
import { handleCreateClientAccount } from '../lib/createClientAccount.js';
import { buildAdminProvisionedClientMessage } from '../lib/discord.js';
import { createFreeImplementationOrdersForUser } from '../lib/implementationOffer.js';

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

const staffUser = { id: 'staff-1', email: 'admin@chefvision.pl' };

function mockAdmin({
  staffRole = 'admin',
  existingProfile = null,
  inviteUser = { id: 'new-client' },
  inviteError = null,
} = {}) {
  const calls = { invites: 0, creates: 0, upserts: 0, updates: 0 };
  const admin = {
    auth: {
      admin: {
        inviteUserByEmail: async () => {
          calls.invites += 1;
          if (inviteError) return { data: { user: null }, error: inviteError };
          return { data: { user: inviteUser }, error: null };
        },
        createUser: async () => {
          calls.creates += 1;
          return { data: { user: inviteUser }, error: null };
        },
        generateLink: async () => ({ data: { user: inviteUser }, error: null }),
      },
    },
    from(table) {
      const ctx = {};
      const chain = {
        select() {
          return chain;
        },
        eq(col, val) {
          ctx.eq = { col, val };
          return chain;
        },
        ilike(col, val) {
          ctx.ilike = { col, val };
          return chain;
        },
        neq() {
          return chain;
        },
        in() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle: async () => {
          if (table === 'profiles') {
            if (ctx.ilike) return { data: existingProfile, error: null };
            return { data: { platform_role: staffRole }, error: null };
          }
          if (table === 'menu_service_orders') {
            return { data: { id: 'ord-1', status: 'pending', created_at: '2026-01-01' }, error: null };
          }
          return { data: null, error: null };
        },
        upsert: async () => {
          calls.upserts += 1;
          return { error: null };
        },
        update() {
          calls.updates += 1;
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
      return chain;
    },
  };
  return { admin, calls };
}

const commonDeps = (admin, extra = {}) => ({
  verifyToken: extra.verifyToken || (async () => staffUser),
  getAdmin: () => admin,
  rateLimitOk: () => true,
  sendDiscord: extra.sendDiscord || (async () => ({ ok: true })),
  createOrders:
    extra.createOrders ||
    (async () => ({ status: 200, body: { ok: true, orderId: 'ord-1', status: 'pending' } })),
});

check('discord admin provisioned message', () => {
  const msg = buildAdminProvisionedClientMessage({
    email: 'lokal@example.com',
    restaurantName: 'Bistro Test',
    created: true,
    inviteSent: true,
  });
  assert.match(msg, /Konto klienta założone przez admina/);
  assert.match(msg, /Klient: lokal@example.com/);
  assert.match(msg, /Restauracja: Bistro Test/);
  assert.match(msg, /Zaproszenie: wysłane/);
});

await checkAsync('no auth → 401', async () => {
  const { admin } = mockAdmin();
  const result = await handleCreateClientAccount({
    authorization: '',
    body: { email: 'lokal@example.com' },
    deps: commonDeps(admin, { verifyToken: async () => null }),
  });
  assert.strictEqual(result.status, 401);
});

await checkAsync('not staff → 403', async () => {
  const { admin } = mockAdmin({ staffRole: 'user' });
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'lokal@example.com' },
    deps: commonDeps(admin),
  });
  assert.strictEqual(result.status, 403);
});

await checkAsync('invalid email → 400', async () => {
  const { admin } = mockAdmin();
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'not-an-email' },
    deps: commonDeps(admin),
  });
  assert.strictEqual(result.status, 400);
});

await checkAsync('staff email blocked → 400', async () => {
  const { admin, calls } = mockAdmin({
    existingProfile: { id: 'staff-2', platform_role: 'admin', email: 'szef@chefvision.pl' },
  });
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'szef@chefvision.pl' },
    deps: commonDeps(admin),
  });
  assert.strictEqual(result.status, 400);
  assert.strictEqual(calls.invites, 0);
});

await checkAsync('new email creates user, invite, orders, discord', async () => {
  const { admin, calls } = mockAdmin();
  let discordPayload = null;
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'lokal@example.com', restaurantName: 'Bistro Test' },
    deps: commonDeps(admin, {
      sendDiscord: async (msg) => {
        discordPayload = msg;
        return { ok: true };
      },
    }),
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.created, true);
  assert.strictEqual(result.body.inviteSent, true);
  assert.strictEqual(result.body.userId, 'new-client');
  assert.strictEqual(result.body.orderId, 'ord-1');
  assert.strictEqual(calls.invites, 1);
  assert.strictEqual(calls.upserts, 1);
  assert.match(discordPayload, /Konto klienta założone przez admina/);
  assert.match(discordPayload, /Bistro Test/);
});

await checkAsync('existing client attaches orders without invite', async () => {
  const { admin, calls } = mockAdmin({
    existingProfile: { id: 'client-1', platform_role: 'user', email: 'lokal@example.com' },
  });
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'lokal@example.com', restaurantName: 'Bistro Test' },
    deps: commonDeps(admin),
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.created, false);
  assert.strictEqual(result.body.userId, 'client-1');
  assert.strictEqual(calls.invites, 0);
  assert.strictEqual(calls.updates, 1);
  assert.strictEqual(calls.upserts, 0);
});

await checkAsync('existing orders still 200', async () => {
  const { admin } = mockAdmin({
    existingProfile: { id: 'client-2', platform_role: 'user', email: 'lokal@example.com' },
  });
  const result = await handleCreateClientAccount({
    authorization: 'Bearer test',
    body: { email: 'lokal@example.com' },
    deps: commonDeps(admin, {
      createOrders: async () => ({
        status: 409,
        body: { error: 'To zlecenie zostało już wysłane.', code: 'already_sent' },
      }),
    }),
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.alreadyHadOrders, true);
  assert.strictEqual(result.body.orderId, 'ord-1');
});

await checkAsync('createFreeImplementationOrdersForUser injects client identity', async () => {
  let seenUserId = null;
  const result = await createFreeImplementationOrdersForUser({
    userId: 'client-9',
    email: 'lokal@example.com',
    planType: 'menu_service',
    deps: {
      verifyToken: async () => ({ id: 'should-be-overridden' }),
      getAdmin: () => ({
        from(table) {
          return {
            select() {
              return this;
            },
            eq(col, val) {
              if (col === 'client_user_id') seenUserId = val;
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
                return { data: { email: 'lokal@example.com', restaurant_name: 'Bistro' }, error: null };
              }
              return { data: null, error: null };
            },
            insert() {
              return {
                select() {
                  return this;
                },
                maybeSingle: async () => ({ data: { id: 'ord-x', status: 'pending' }, error: null }),
              };
            },
          };
        },
      }),
      sendDiscord: async () => ({ ok: true }),
    },
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(seenUserId, 'client-9');
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll create-client-account tests passed');
