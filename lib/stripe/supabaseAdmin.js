import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for Stripe webhooks.
 * Webhooks have no user JWT — updates must bypass RLS via SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseAdmin() {
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
