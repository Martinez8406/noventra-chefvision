import assert from 'assert';
import '../lib/loadEnv.js';
import {
  formatPromoCodeInput,
  generatePromoCodeValue,
  isValidPin,
  isValidPromoCodeFormat,
  normalizePromoCode,
  PROMO_CODE_LETTERS,
  hashPin,
  verifyPin,
  hashToken,
  issuePromoCodeAfterConfirmedOptIn,
  lookupPromoCode,
  redeemPromoCodeAtomic,
} from '../lib/promoCodes.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';

let failed = 0;
function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      throw new Error('Użyj checkAsync dla testów async');
    }
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

check('format AB-1234', () => {
  assert.strictEqual(normalizePromoCode('ab1234'), 'AB-1234');
  assert.strictEqual(normalizePromoCode('kt-4827'), 'KT-4827');
  assert.strictEqual(formatPromoCodeInput('kt4827'), 'KT-4827');
});

check('rejects I, L, O', () => {
  assert.strictEqual(normalizePromoCode('IL-1234'), null);
  assert.strictEqual(normalizePromoCode('IO-1234'), null);
  assert.strictEqual(formatPromoCodeInput('ILO1234'), '');
  assert.ok(!PROMO_CODE_LETTERS.includes('I'));
  assert.ok(!PROMO_CODE_LETTERS.includes('L'));
  assert.ok(!PROMO_CODE_LETTERS.includes('O'));
});

check('rejects bad format', () => {
  assert.strictEqual(isValidPromoCodeFormat('AB1234'), false);
  assert.strictEqual(isValidPromoCodeFormat('A-1234'), false);
  assert.strictEqual(isValidPromoCodeFormat('AB-12'), false);
  assert.strictEqual(normalizePromoCode('****'), null);
});

check('generated codes match format and allowed letters', () => {
  for (let i = 0; i < 50; i += 1) {
    const code = generatePromoCodeValue();
    assert.ok(isValidPromoCodeFormat(code), code);
    assert.ok(PROMO_CODE_LETTERS.includes(code[0]));
    assert.ok(PROMO_CODE_LETTERS.includes(code[1]));
  }
});

check('PIN 4–8 digits', () => {
  assert.strictEqual(isValidPin('1234'), true);
  assert.strictEqual(isValidPin('12345678'), true);
  assert.strictEqual(isValidPin('12'), false);
  assert.strictEqual(isValidPin('abcdef'), false);
});

await checkAsync('PIN hash is not plaintext and verifies', async () => {
  const stored = await hashPin('4827');
  assert.ok(stored.startsWith('pbkdf2$'));
  assert.notStrictEqual(stored, '4827');
  assert.strictEqual(await verifyPin('4827', stored), true);
  assert.strictEqual(await verifyPin('0000', stored), false);
});

check('session token hash is one-way', () => {
  const hash = hashToken('secret-token');
  assert.notStrictEqual(hash, 'secret-token');
  assert.strictEqual(hash.length, 64);
});

const userId = process.env.TEST_PROMO_USER_ID?.trim();
const admin = getSupabaseAdmin();

if (!userId || !admin) {
  console.log('\nPomijam testy integracyjne (ustaw TEST_PROMO_USER_ID oraz SUPABASE_SERVICE_ROLE_KEY).');
} else {
  await checkAsync('issue + lookup KT-4827', async () => {
    await admin.from('promo_codes').delete().eq('user_id', userId).eq('code', 'KT-4827');
    const created = await issuePromoCodeAfterConfirmedOptIn(admin, {
      userId,
      rewardName: 'Darmowy deser',
      rewardDescription: 'Do zamówienia dania głównego',
      code: 'KT-4827',
      metadata: { source: 'test' },
    });
    assert.strictEqual(created.ok, true, created.error);
    const lookup = await lookupPromoCode(admin, { userId, code: 'KT-4827' });
    assert.strictEqual(lookup.outcome, 'active');
    assert.strictEqual(lookup.rewardName, 'Darmowy deser');
    assert.ok(!('email' in lookup) || lookup.email == null);
  });

  await checkAsync('invalid code', async () => {
    const lookup = await lookupPromoCode(admin, { userId, code: 'ZZ-0000' });
    assert.strictEqual(lookup.outcome, 'invalid');
  });

  await checkAsync('expired code', async () => {
    await admin.from('promo_codes').delete().eq('user_id', userId).eq('code', 'KT-0001');
    const created = await issuePromoCodeAfterConfirmedOptIn(admin, {
      userId,
      rewardName: 'Wygasły test',
      code: 'KT-0001',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    assert.strictEqual(created.ok, true, created.error);
    const lookup = await lookupPromoCode(admin, { userId, code: 'KT-0001' });
    assert.strictEqual(lookup.outcome, 'expired');
  });

  await checkAsync('code from another restaurant is invalid', async () => {
    const otherId = '00000000-0000-4000-8000-000000000000';
    const lookup = await lookupPromoCode(admin, { userId: otherId, code: 'KT-4827' });
    assert.strictEqual(lookup.outcome, 'invalid');
  });

  await checkAsync('atomic redeem: only first concurrent request wins', async () => {
    await admin.from('promo_codes').delete().eq('user_id', userId).eq('code', 'KT-9999');
    const created = await issuePromoCodeAfterConfirmedOptIn(admin, {
      userId,
      rewardName: 'Race test',
      code: 'KT-9999',
    });
    assert.strictEqual(created.ok, true, created.error);

    const [a, b] = await Promise.all([
      redeemPromoCodeAtomic(admin, { userId, code: 'KT-9999', usedByDevice: 'device-a' }),
      redeemPromoCodeAtomic(admin, { userId, code: 'KT-9999', usedByDevice: 'device-b' }),
    ]);
    const outcomes = [a.outcome, b.outcome];
    assert.strictEqual(outcomes.filter((x) => x === 'redeemed').length, 1, String(outcomes));
    assert.ok(outcomes.includes('used') || outcomes.includes('invalid'), String(outcomes));

    const again = await redeemPromoCodeAtomic(admin, { userId, code: 'KT-9999' });
    assert.strictEqual(again.outcome, 'used');
  });
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nWszystkie testy promo OK');
