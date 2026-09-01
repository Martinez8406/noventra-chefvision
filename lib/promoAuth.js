import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';
import { isValidUuid } from './feedbackUtils.js';

export async function verifyOwnerToken(authHeader) {
  const token =
    typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : null;
  if (!token) return null;

  const { url, key } = getSupabaseServerCredentials();
  if (!url || !key) return null;

  const client = createClient(url, key);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function resolveRestaurantUserId(admin, { user, targetUserId }) {
  const requested =
    typeof targetUserId === 'string' && isValidUuid(targetUserId.trim()) ? targetUserId.trim() : null;

  if (!requested || requested === user.id) {
    return { ok: true, userId: user.id };
  }

  const { data: me, error } = await admin
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message || 'Nie udało się sprawdzić uprawnień.' };
  }

  const role = me?.platform_role;
  if (role !== 'admin' && role !== 'staff') {
    return { ok: false, status: 403, error: 'Brak uprawnień do konta klienta.' };
  }

  return { ok: true, userId: requested };
}

export function getVerifySessionHeader(req) {
  const header = req?.headers?.['x-verify-session'] || req?.headers?.['X-Verify-Session'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('verify ')) {
    return auth.slice(7).trim();
  }
  return null;
}
