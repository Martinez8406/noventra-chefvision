import '../lib/loadEnv.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';
import { issuePromoCodeAfterConfirmedOptIn } from '../lib/promoCodes.js';

const userId = (process.argv[2] || process.env.TEST_PROMO_USER_ID || '').trim();
if (!userId) {
  console.error('Użycie: node scripts/seed-test-promo-code.js <RESTAURANT_USER_ID>');
  process.exit(1);
}

const admin = getSupabaseAdmin();
if (!admin) {
  console.error('Brak SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL w .env.local');
  process.exit(1);
}

await admin.from('promo_codes').delete().eq('user_id', userId).eq('code', 'KT-4827');

const result = await issuePromoCodeAfterConfirmedOptIn(admin, {
  userId,
  rewardName: 'Darmowy deser',
  rewardDescription: 'Do zamówienia dania głównego',
  code: 'KT-4827',
  metadata: { source: 'seed_test' },
});

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

console.log('Utworzono kod testowy KT-4827 dla restauracji', userId);
console.log('Nagroda:', result.code.reward_name);
console.log('Otwórz /verify/' + userId);
