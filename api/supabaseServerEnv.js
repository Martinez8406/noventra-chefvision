/**
 * Zmienne Supabase dla procesu Node (server/index.js, api/*.js).
 * W .env.local często są tylko VITE_* — bez tego nagłówka verifyToken by zwracał null (401).
 */
export function getSupabaseServerCredentials() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return { url, key };
}

/** Właściciel rekordu dishes – kolumna może być jako userId (camelCase) lub user_id. */
export function getDishOwnerId(row) {
  if (!row || typeof row !== 'object') return null;
  return row.userId ?? row.user_id ?? row.userid ?? null;
}
