import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
const env = fs.readFileSync(envPath, 'utf8');

function get(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function upsertEnv(content, key, value) {
  let next = content;
  if (!next.endsWith('\n')) next += '\n';
  if (new RegExp(`^${key}=`, 'm').test(next)) {
    return next.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  }
  return `${next}${key}=${value}\n`;
}

const secret = get('STRIPE_SECRET_KEY');
if (!secret) {
  console.error('MISSING_STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia' });

async function ensurePrice({ envKey, amount, nickname }) {
  const existingId = get(envKey);
  if (existingId) {
    const current = await stripe.prices.retrieve(existingId);
    if (current.unit_amount === amount && current.currency === 'pln' && !current.recurring) {
      console.log(`${envKey} already ok: ${current.id}`);
      return current.id;
    }
    console.log(`${envKey} exists but amount mismatch (${current.unit_amount} ${current.currency}) — creating new price`);
  }

  const products = await stripe.products.list({ limit: 100, active: true });
  let product = products.data.find(
    (p) =>
      p.metadata?.planType === 'founder_lifetime' ||
      /founder lifetime/i.test(p.name),
  );
  if (!product) {
    product = await stripe.products.create({
      name: 'ChefVision Founder Lifetime',
      description: 'Dożywotni dostęp do ChefVision Premium — płatność jednorazowa, bez abonamentu.',
      metadata: { planType: 'founder_lifetime' },
    });
    console.log(`created_product=${product.id}`);
  }

  const listed = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const already = listed.data.find(
    (p) => p.unit_amount === amount && p.currency === 'pln' && !p.recurring,
  );
  const price =
    already ||
    (await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: 'pln',
      metadata: { planType: 'founder_lifetime', lifetimePricePln: String(amount / 100) },
      nickname,
    }));

  console.log(`${already ? 'REUSED' : 'CREATED'} ${envKey}=${price.id} (${amount / 100} zł)`);
  return price.id;
}

const price599 = await ensurePrice({
  envKey: 'STRIPE_LIFETIME_PRICE_ID_599',
  amount: 59900,
  nickname: 'Founder Lifetime 599 zł',
});
const price799 = await ensurePrice({
  envKey: 'STRIPE_LIFETIME_PRICE_ID_799',
  amount: 79900,
  nickname: 'Founder Lifetime 799 zł',
});

let next = env;
next = upsertEnv(next, 'STRIPE_LIFETIME_PRICE_ID_599', price599);
next = upsertEnv(next, 'STRIPE_LIFETIME_PRICE_ID_799', price799);
if (!/^LIFETIME_FIRST_TIER_LIMIT=/m.test(next)) {
  next = upsertEnv(next, 'LIFETIME_FIRST_TIER_LIMIT', '10');
}
if (!/^LIFETIME_TOTAL_LIMIT=/m.test(next)) {
  next = upsertEnv(next, 'LIFETIME_TOTAL_LIMIT', '20');
}
fs.writeFileSync(envPath, next, 'utf8');

console.log('updated=.env.local');
console.log('NOTE: ustaw te same zmienne na Vercel:');
console.log('  STRIPE_LIFETIME_PRICE_ID_599');
console.log('  STRIPE_LIFETIME_PRICE_ID_799');
console.log('  LIFETIME_FIRST_TIER_LIMIT=10');
console.log('  LIFETIME_TOTAL_LIMIT=20');
console.log('oraz uruchom supabase/lifetime_offer.sql w SQL Editor.');
