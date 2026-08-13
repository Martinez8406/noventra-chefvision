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

const secret = get('STRIPE_SECRET_KEY');
if (!secret) {
  console.error('MISSING_STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia' });
const currentPriceId = get('STRIPE_START_PRICE_ID');

let productId = null;
let currentAmount = null;
let currentInterval = null;

if (currentPriceId) {
  const current = await stripe.prices.retrieve(currentPriceId);
  productId = typeof current.product === 'string' ? current.product : current.product.id;
  currentAmount = current.unit_amount;
  currentInterval = current.recurring?.interval ?? null;
  console.log(`existing_price_id=${current.id}`);
  console.log(`existing_amount=${current.unit_amount} ${current.currency}`);
  console.log(`existing_interval=${currentInterval || 'one_time'}`);
  console.log(`product_id=${productId}`);

  if (current.unit_amount === 3900 && current.currency === 'pln' && current.recurring?.interval === 'month') {
    console.log('ALREADY_39');
    process.exit(0);
  }
}

if (!productId) {
  const products = await stripe.products.list({ limit: 100, active: true });
  const startProduct = products.data.find(
    (p) =>
      p.metadata?.planType === 'start' ||
      /^plan start$/i.test(p.name) ||
      /^start$/i.test(p.name),
  );
  if (!startProduct) {
    console.error('START_PRODUCT_NOT_FOUND');
    process.exit(1);
  }
  productId = startProduct.id;
  console.log(`product_id=${productId}`);
}

const existing39 = await stripe.prices.list({
  product: productId,
  active: true,
  limit: 100,
});
const already = existing39.data.find(
  (p) => p.unit_amount === 3900 && p.currency === 'pln' && p.recurring?.interval === 'month',
);

const price =
  already ||
  (await stripe.prices.create({
    product: productId,
    unit_amount: 3900,
    currency: 'pln',
    recurring: { interval: 'month' },
    metadata: { planType: 'start' },
    nickname: 'Start 39 zł/mies.',
  }));

let next = env;
if (!next.endsWith('\n')) next += '\n';
if (/^STRIPE_START_PRICE_ID=/m.test(next)) {
  next = next.replace(/^STRIPE_START_PRICE_ID=.*$/m, `STRIPE_START_PRICE_ID=${price.id}`);
} else {
  next += `STRIPE_START_PRICE_ID=${price.id}\n`;
}
fs.writeFileSync(envPath, next, 'utf8');

console.log(already ? 'REUSED_EXISTING_39' : 'CREATED');
console.log(`price_id=${price.id}`);
console.log(`amount=${price.unit_amount} ${price.currency}/${price.recurring?.interval}`);
console.log('updated=.env.local STRIPE_START_PRICE_ID');
console.log('NOTE: ustaw to samo price_id na Vercel (STRIPE_START_PRICE_ID).');
