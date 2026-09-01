import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';
import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import { buildNewUserRegisteredMessage, sendDiscordNotification } from './discord.js';

const inFlightUserIds = new Set();

async function verifyToken(authHeader) {
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
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

export async function handleNotifyNewUser({ authorization }) {
  const user = await verifyToken(authorization);
  if (!user) {
    console.warn('[notify-new-user] Unauthorized — brak lub nieprawidłowy token');
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (inFlightUserIds.has(user.id)) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'in_flight' } };
  }

  inFlightUserIds.add(user.id);
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('discord_registration_notified_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('[notify-new-user] Odczyt profilu:', profileError.message);
      } else if (profile?.discord_registration_notified_at) {
        console.log('[notify-new-user] Pominięto — już powiadomiono', {
          userId: user.id,
          email: user.email,
          notifiedAt: profile.discord_registration_notified_at,
        });
        return { status: 200, body: { ok: true, skipped: true, reason: 'already_notified' } };
      }
    } else {
      console.warn('[notify-new-user] Brak SUPABASE_SERVICE_ROLE_KEY — deduplikacja tylko w tej sesji serwera');
    }

    const email = user.email?.trim() || 'unknown';
    console.log('[notify-new-user] Wysyłam powiadomienie Discord', { userId: user.id, email });
    await sendDiscordNotification(buildNewUserRegisteredMessage(email));

    if (admin) {
      const { error: updateError } = await admin
        .from('profiles')
        .update({ discord_registration_notified_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.warn(
          '[notify-new-user] Discord wysłany, ale nie zapisano flagi — uruchom supabase/discord_registration_notified.sql:',
          updateError.message,
        );
      }
    }

    console.log('[notify-new-user] Powiadomienie Discord wysłane', { userId: user.id, email });
    return { status: 200, body: { ok: true, notified: true } };
  } finally {
    inFlightUserIds.delete(user.id);
  }
}
