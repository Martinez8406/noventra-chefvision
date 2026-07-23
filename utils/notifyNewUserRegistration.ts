import type { Session } from '@supabase/supabase-js';

const STORAGE_KEY = (userId: string) => `chefvision_discord_new_user:${userId}`;
const inFlightUserIds = new Set<string>();

export async function notifyNewUserRegistration(session: Session): Promise<void> {
  const user = session.user;
  if (!user?.id) return;

  if (inFlightUserIds.has(user.id)) return;

  try {
    if (sessionStorage.getItem(STORAGE_KEY(user.id)) === '1') return;
  } catch {
    /* ignore */
  }

  inFlightUserIds.add(user.id);
  try {
    const response = await fetch('/api/notify-new-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) return;

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      skipped?: boolean;
      notified?: boolean;
    } | null;

    if (data?.ok && (data.notified || data.skipped)) {
      try {
        sessionStorage.setItem(STORAGE_KEY(user.id), '1');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* never block auth flow */
  } finally {
    inFlightUserIds.delete(user.id);
  }
}
