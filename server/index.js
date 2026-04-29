import { config } from 'dotenv';
import express from 'express';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleGenerateImage } from '../api/generate-image.js';
import { handleTranslateDish } from '../api/translate-dish.js';
import { handleTranslateCategory } from '../api/translate-category.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env.local') });

const app = express();
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
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe create-checkout-session:', e);
    return res.status(500).json({ error: e.message || 'Błąd tworzenia sesji.' });
  }
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
  const result = await handleGenerateImage({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/translate-dish', async (req, res) => {
  const result = await handleTranslateDish({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/translate-category', async (req, res) => {
  const result = await handleTranslateCategory({
    req,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
});

// Domyślnie 3002 — 3001 często zajęty przez inną stronę (np. chefvision.pl) równolegle w dev.
const PORT = process.env.STRIPE_API_PORT || 3002;
app.listen(PORT, () => {
  console.log(`Stripe API: http://localhost:${PORT}`);
});
