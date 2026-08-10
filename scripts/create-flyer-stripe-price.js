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

const existing = get('STRIPE_FLYER_SERVICE_PRICE_ID');
if (existing) {
  console.log('ALREADY_SET');
  console.log(`price_id=${existing}`);
  process.exit(0);
}

const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia' });

const product = await stripe.products.create({
  name: 'Ulotka QR',
  description:
    'Spersonalizowany projekt ulotki z kodem QR do menu — 3 warianty, 3 poprawki, PDF A5, realizacja w 3 dni robocze.',
  metadata: { planType: 'flyer_service' },
});

const price = await stripe.prices.create({
  product: product.id,
  unit_amount: 14900,
  currency: 'pln',
  metadata: { planType: 'flyer_service' },
});

let next = env;
if (!next.endsWith('\n')) next += '\n';
if (/^STRIPE_FLYER_SERVICE_PRICE_ID=/m.test(next)) {
  next = next.replace(
    /^STRIPE_FLYER_SERVICE_PRICE_ID=.*$/m,
    `STRIPE_FLYER_SERVICE_PRICE_ID=${price.id}`,
  );
} else {
  next += `STRIPE_FLYER_SERVICE_PRICE_ID=${price.id}\n`;
}
fs.writeFileSync(envPath, next, 'utf8');

console.log('CREATED');
console.log(`product_id=${product.id}`);
console.log(`price_id=${price.id}`);
