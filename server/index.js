import { config } from 'dotenv';
import express from 'express';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleGenerateImage } from '../api/generate-image.js';
import { handleTranslateDish } from '../api/translate-dish.js';
import { handleTranslateCategory } from '../api/translate-category.js';
import { handleTranslateRecommendation } from '../api/translate-recommendation.js';
import { handleSaveMenuCategories } from '../api/save-menu-categories.js';
import { handleTrackMenuOpen } from '../api/track-menu-open.js';
import { handleGetMenuOpenStats } from '../api/get-menu-open-stats.js';
import { handleStripeWebhook, readStripeWebhookBody } from '../api/stripe/webhook.js';
import { createBillingPortalSession } from '../api/stripe/createBillingPortalSession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env.local') });

const app = express();

// CORS tylko gdy klient woła API bezpośrednio (np. inny port) — domyślnie używaj proxy Vite (/api).
const DEV_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && DEV_ORIGIN_RE.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// Stripe webhook MUST receive the raw body for signature verification (register before express.json).
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const rawBody = await readStripeWebhookBody(req);
    const result = await handleStripeWebhook({
      rawBody,
      signature: req.headers['stripe-signature'],
    });
    return res.status(result.status).json(result.body);
  }
);

app.use(express.json({ limit: '15mb' }));

const stripeSecret = process.env.STRIPE_SECRET_KEY;
// W Stripe Dashboard użyj Price ID (price_...), nie Product ID (prod_...)
const priceId = process.env.STRIPE_PRICE_ID;

if (!stripeSecret || !priceId) {
  console.warn('Brak STRIPE_SECRET_KEY lub STRIPE_PRICE_ID w .env.local – API Stripe nie będzie działać.');
}

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-11-20.acacia' }) : null;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe || !priceId) {
    return res.status(503).json({ error: 'Stripe nie jest skonfigurowany.' });
  }
  try {
    const { userId, successUrl, cancelUrl } = req.body;
    const session = await stripe.checkout.sessions.create({
      // Używamy subskrypcji, bo Price ID jest cykliczny
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || BASE_URL,
      client_reference_id: userId || undefined,
      metadata: userId ? { userId } : undefined,
      subscription_data: userId
        ? { metadata: { userId } }
        : undefined,
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe create-checkout-session:', e);
    return res.status(500).json({ error: e.message || 'Błąd tworzenia sesji.' });
  }
});

app.post('/api/create-billing-portal-session', async (req, res) => {
  const { userId, returnUrl } = req.body || {};
  const result = await createBillingPortalSession({
    userId,
    returnUrl: returnUrl || BASE_URL,
  });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.json({ url: result.url });
});

app.get('/api/confirm-premium', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe nie jest skonfigurowany.' });
  }
  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Brak session_id.' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Płatność nie została zakończona.' });
    }
    const userId = session.client_reference_id || null;
    return res.json({ ok: true, userId });
  } catch (e) {
    console.error('Stripe confirm-premium:', e);
    return res.status(500).json({ error: e.message || 'Błąd weryfikacji sesji.' });
  }
});

app.post('/api/generate-image', async (req, res) => {
  req.setTimeout(600_000);
  res.setTimeout(600_000);
  try {
    const result = await handleGenerateImage({
      authorization: req.headers.authorization,
      body: req.body || {},
    });
    try {
      const payload = JSON.stringify(result.body);
      console.log(
        `[api/generate-image] → ${result.status}, ~${Math.round(payload.length / 1024)} KB`
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(result.status).send(payload);
    } catch (jsonErr) {
      console.error('[api/generate-image] JSON response failed:', jsonErr?.message);
      return res.status(500).json({ error: 'Obraz jest zbyt duży do wysłania. Spróbuj mniejszego zdjęcia wejściowego.' });
    }
  } catch (err) {
    console.error('[api/generate-image] unhandled:', err);
    return res.status(500).json({ error: err?.message || 'Błąd serwera podczas generowania.' });
  }
});

app.post('/api/translate-dish', async (req, res) => {
  const dishId =
    typeof req?.body?.dishId === 'string' ? req.body.dishId.trim() : '';
  const hasAuth = typeof req.headers.authorization === 'string' && req.headers.authorization.trim().length > 0;
  console.log(`[translate-dish] request dishId=${dishId || '(missing)'} auth=${hasAuth ? 'yes' : 'no'}`);
  const result = await handleTranslateDish({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  if (result.status !== 200) {
    console.warn('[translate-dish] response', result.status, result.body?.error || result.body);
  } else {
    console.log('[translate-dish] ok');
  }
  return res.status(result.status).json(result.body);
});

app.post('/api/translate-category', async (req, res) => {
  const result = await handleTranslateCategory({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/translate-recommendation', async (req, res) => {
  const result = await handleTranslateRecommendation({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/save-menu-categories', async (req, res) => {
  const result = await handleSaveMenuCategories({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/track-menu-open', async (req, res) => {
  const result = await handleTrackMenuOpen({
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.get('/api/get-menu-open-stats', async (req, res) => {
  const result = await handleGetMenuOpenStats({
    authorization: req.headers.authorization,
    query: req.query || {},
  });
  return res.status(result.status).json(result.body);
});

// Domyślnie 3002 — 3001 często zajęty przez inną stronę (np. chefvision.pl) równolegle w dev.
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[SERVER] uncaughtException:', err);
});

const PORT = Number(process.env.STRIPE_API_PORT) || 3002;
const hasServiceRole = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
const httpServer = app.listen(PORT, () => {
  console.log(`[SERVER] API: http://localhost:${PORT} (CORS dla dev włączony)`);
  if (!hasServiceRole) {
    console.warn(
      '[SERVER] Brak SUPABASE_SERVICE_ROLE_KEY w .env.local — generowanie AI wymaga poprawnego JWT użytkownika przy UPDATE profilu.'
    );
  }
});

httpServer.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `[SERVER] Port ${PORT} jest zajęty — zamknij stary terminal (Ctrl+C) lub zabij proces:\n` +
        `  netstat -ano | findstr :${PORT}\n` +
        `  taskkill /PID <PID> /F`
    );
  } else {
    console.error('[SERVER] Błąd uruchomienia:', err);
  }
  process.exit(1);
});
