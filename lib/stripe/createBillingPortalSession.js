import Stripe from 'stripe';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-11-20.acacia' }) : null;

/**
 * Stripe Customer Portal — anulowanie, zmiana karty, faktury.
 */
export async function createBillingPortalSession({ userId, returnUrl }) {
  if (!stripe) {
    return { ok: false, status: 503, error: 'Stripe nie jest skonfigurowany.' };
  }
  if (!userId) {
    return { ok: false, status: 400, error: 'Brak identyfikatora użytkownika.' };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, status: 503, error: 'Brak konfiguracji Supabase (service role).' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, error: profileError.message };
  }

  const customerId = profile?.stripe_customer_id?.trim();
  if (!customerId || customerId === 'manual') {
    return {
      ok: false,
      status: 400,
      error: 'Brak powiązanego konta Stripe. Kup Premium przez aplikację lub skontaktuj się z obsługą.',
    };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.BASE_URL || 'http://localhost:3000',
    });
    return { ok: true, status: 200, url: session.url };
  } catch (e) {
    console.error('[billing-portal]', e);
    return { ok: false, status: 500, error: e.message || 'Nie udało się otworzyć portalu Stripe.' };
  }
}
