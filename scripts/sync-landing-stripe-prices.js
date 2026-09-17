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

async function productFromPrice(priceId) {
  if (!priceId) return null;
  const price = await stripe.prices.retrieve(priceId);
  return typeof price.product === 'string' ? price.product : price.product.id;
}

async function findProductByPlan(planType, nameRe) {
  const products = await stripe.products.list({ limit: 100, active: true });
  return (
    products.data.find((p) => p.metadata?.planType === planType) ||
    products.data.find((p) => nameRe.test(p.name)) ||
    null
  );
}

async function ensureRecurringPrice({
  envKey,
  productId,
  amount,
  interval,
  nickname,
  metadata,
}) {
  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const already = listed.data.find(
    (p) =>
      p.unit_amount === amount &&
      p.currency === 'pln' &&
      p.recurring?.interval === interval,
  );
  const price =
    already ||
    (await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: 'pln',
      recurring: { interval },
      metadata,
      nickname,
    }));
  console.log(
    `${already ? 'REUSED' : 'CREATED'} ${envKey}=${price.id} (${amount / 100} zł / ${interval})`,
  );
  return price.id;
}

let startProductId = await productFromPrice(get('STRIPE_START_PRICE_ID'));
if (!startProductId) {
  const startProduct = await findProductByPlan('start', /plan start|^start$/i);
  if (!startProduct) {
    console.error('START_PRODUCT_NOT_FOUND');
    process.exit(1);
  }
  startProductId = startProduct.id;
}

let premiumProductId = await productFromPrice(get('STRIPE_PRICE_ID'));
if (!premiumProductId) {
  const premiumProduct = await findProductByPlan('premium', /premium/i);
  if (!premiumProduct) {
    console.error('PREMIUM_PRODUCT_NOT_FOUND');
    process.exit(1);
  }
  premiumProductId = premiumProduct.id;
}

console.log(`start_product=${startProductId}`);
console.log(`premium_product=${premiumProductId}`);

const startPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_START_PRICE_ID',
  productId: startProductId,
  amount: 2000,
  interval: 'month',
  nickname: 'Start 20 zł/mies.',
  metadata: { planType: 'start' },
});

const premiumPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_PRICE_ID',
  productId: premiumProductId,
  amount: 5000,
  interval: 'month',
  nickname: 'Premium 50 zł/mies.',
  metadata: { planType: 'premium' },
});

const annualPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_ANNUAL_PRICE_ID',
  productId: premiumProductId,
  amount: 29900,
  interval: 'year',
  nickname: 'Plan Roczny 299 zł/rok',
  metadata: { planType: 'annual' },
});

let next = env;
next = upsertEnv(next, 'STRIPE_START_PRICE_ID', startPriceId);
next = upsertEnv(next, 'STRIPE_PRICE_ID', premiumPriceId);
next = upsertEnv(next, 'STRIPE_ANNUAL_PRICE_ID', annualPriceId);
fs.writeFileSync(envPath, next, 'utf8');

console.log('updated=.env.local');
console.log('VERCEL_SET STRIPE_START_PRICE_ID=' + startPriceId);
console.log('VERCEL_SET STRIPE_PRICE_ID=' + premiumPriceId);
console.log('VERCEL_SET STRIPE_ANNUAL_PRICE_ID=' + annualPriceId);
