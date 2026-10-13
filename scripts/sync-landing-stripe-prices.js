import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { CHECKOUT_PRICE_SPEC, PRICES_PLN } from '../lib/pricingCatalog.js';

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

async function ensureOneTimePrice({ envKey, productId, amount, nickname, metadata }) {
  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const already = listed.data.find(
    (p) => p.unit_amount === amount && p.currency === 'pln' && !p.recurring,
  );
  const price =
    already ||
    (await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: 'pln',
      metadata,
      nickname,
    }));
  console.log(`${already ? 'REUSED' : 'CREATED'} ${envKey}=${price.id} (${amount / 100} zł jednorazowo)`);
  return price.id;
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
  amount: CHECKOUT_PRICE_SPEC.start.amount,
  interval: 'month',
  nickname: `Start ${PRICES_PLN.startMonth} zł/mies.`,
  metadata: { planType: 'start' },
});

const startAnnualPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_START_ANNUAL_PRICE_ID',
  productId: startProductId,
  amount: CHECKOUT_PRICE_SPEC.start_annual.amount,
  interval: 'year',
  nickname: `Start ${PRICES_PLN.startYear} zł/rok`,
  metadata: { planType: 'start_annual' },
});

const premiumPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_PRICE_ID',
  productId: premiumProductId,
  amount: CHECKOUT_PRICE_SPEC.premium.amount,
  interval: 'month',
  nickname: `Premium ${PRICES_PLN.premiumMonth} zł/mies.`,
  metadata: { planType: 'premium' },
});

const annualPriceId = await ensureRecurringPrice({
  envKey: 'STRIPE_ANNUAL_PRICE_ID',
  productId: premiumProductId,
  amount: CHECKOUT_PRICE_SPEC.annual.amount,
  interval: 'year',
  nickname: `Premium ${PRICES_PLN.premiumYear} zł/rok`,
  metadata: { planType: 'annual' },
});

let menuProductId = await productFromPrice(get('STRIPE_MENU_SERVICE_PRICE_ID'));
if (!menuProductId) {
  const menuProduct = await findProductByPlan('menu_service', /menu|wdroż/i);
  if (!menuProduct) {
    const created = await stripe.products.create({
      name: 'Wdrożenie menu',
      description: 'Zespół ChefVision buduje menu cyfrowe — zdjęcia, opisy, kategorie i ceny.',
      metadata: { planType: 'menu_service' },
    });
    menuProductId = created.id;
    console.log(`CREATED menu_product=${menuProductId}`);
  } else {
    menuProductId = menuProduct.id;
  }
}

let flyerProductId = await productFromPrice(get('STRIPE_FLYER_SERVICE_PRICE_ID'));
if (!flyerProductId) {
  const flyerProduct = await findProductByPlan('flyer_service', /ulotk|flyer/i);
  if (!flyerProduct) {
    const created = await stripe.products.create({
      name: 'Ulotka QR',
      description:
        'Spersonalizowany projekt ulotki z kodem QR do menu — 3 warianty, 3 poprawki, PDF A5.',
      metadata: { planType: 'flyer_service' },
    });
    flyerProductId = created.id;
    console.log(`CREATED flyer_product=${flyerProductId}`);
  } else {
    flyerProductId = flyerProduct.id;
  }
}

const menuPriceId = await ensureOneTimePrice({
  envKey: 'STRIPE_MENU_SERVICE_PRICE_ID',
  productId: menuProductId,
  amount: CHECKOUT_PRICE_SPEC.menu_service.amount,
  nickname: `Wdrożenie menu ${PRICES_PLN.menuService} zł`,
  metadata: { planType: 'menu_service' },
});

const flyerPriceId = await ensureOneTimePrice({
  envKey: 'STRIPE_FLYER_SERVICE_PRICE_ID',
  productId: flyerProductId,
  amount: CHECKOUT_PRICE_SPEC.flyer_service.amount,
  nickname: `Ulotka QR ${PRICES_PLN.flyerService} zł`,
  metadata: { planType: 'flyer_service' },
});

let next = env;
next = upsertEnv(next, 'STRIPE_START_PRICE_ID', startPriceId);
next = upsertEnv(next, 'STRIPE_START_ANNUAL_PRICE_ID', startAnnualPriceId);
next = upsertEnv(next, 'STRIPE_PRICE_ID', premiumPriceId);
next = upsertEnv(next, 'STRIPE_ANNUAL_PRICE_ID', annualPriceId);
next = upsertEnv(next, 'STRIPE_MENU_SERVICE_PRICE_ID', menuPriceId);
next = upsertEnv(next, 'STRIPE_FLYER_SERVICE_PRICE_ID', flyerPriceId);
fs.writeFileSync(envPath, next, 'utf8');

console.log('updated=.env.local');
console.log('VERCEL_SET STRIPE_START_PRICE_ID=' + startPriceId);
console.log('VERCEL_SET STRIPE_START_ANNUAL_PRICE_ID=' + startAnnualPriceId);
console.log('VERCEL_SET STRIPE_PRICE_ID=' + premiumPriceId);
console.log('VERCEL_SET STRIPE_ANNUAL_PRICE_ID=' + annualPriceId);
console.log('VERCEL_SET STRIPE_MENU_SERVICE_PRICE_ID=' + menuPriceId);
console.log('VERCEL_SET STRIPE_FLYER_SERVICE_PRICE_ID=' + flyerPriceId);
