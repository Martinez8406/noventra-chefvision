import { createClient } from '@supabase/supabase-js';

let adminOverride = null;

/** Tylko testy lokalne. Produkcja nie wywołuje tej funkcji. */
export function setSupabaseAdminForTests(client) {
  adminOverride = client || null;
}

/**
 * Service-role Supabase client for Stripe webhooks.
 * Webhooks have no user JWT — updates must bypass RLS via SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseAdmin() {
  if (adminOverride) return adminOverride;
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_PUBLIC_SUPABASE_URL ||
    '';

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
