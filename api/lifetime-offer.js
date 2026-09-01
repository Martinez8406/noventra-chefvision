import { getLifetimeOfferState, publicLifetimeOfferView } from '../lib/stripe/lifetimeOffer.js';
import { getSupabaseAdmin } from '../lib/stripe/supabaseAdmin.js';

export async function handleGetLifetimeOffer() {
  try {
    const state = await getLifetimeOfferState(getSupabaseAdmin());
    return { status: 200, body: publicLifetimeOfferView(state) };
  } catch (e) {
    console.error('[lifetime-offer]', e);
    return { status: 500, body: { error: e.message || 'Nie udało się pobrać oferty Lifetime.' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { status, body } = await handleGetLifetimeOffer();
  return res.status(status).json(body);
}
