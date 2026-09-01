import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';
import { getSupabaseAdmin } from './stripe/supabaseAdmin.js';
import { isValidEmail, rateLimitOk, sanitizeText } from './feedbackUtils.js';
import {
  IMPLEMENTATION_BUNDLE_PLAN,
  createFreeImplementationOrdersForUser,
} from './implementationOffer.js';
import {
  buildAdminProvisionedClientMessage,
  sendDiscordNotification,
} from './discord.js';

const TRIAL_DAYS = 14;
const TRIAL_TOKENS = 50;

const STAFF_CREATE_WINDOW_MS = 60 * 60 * 1000;
const STAFF_CREATE_MAX = 20;

function alreadyRegistered(error) {
  const msg = String(error?.message || error?.error_description || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('user already exists') ||
    msg.includes('email address has already')
  );
}

async function defaultVerifyToken(authHeader) {
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

function appOriginFromUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isAllowedRedirectOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host === 'chefvision.pl' || host.endsWith('.chefvision.pl')) return true;
    if (host.endsWith('.vercel.app')) return true;
    const base = appOriginFromUrl(process.env.BASE_URL);
    if (base && origin === base) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveRedirectTo(requested) {
  const requestedOrigin = appOriginFromUrl(requested);
  if (requestedOrigin && isAllowedRedirectOrigin(requestedOrigin)) return requestedOrigin;
  const base = appOriginFromUrl(process.env.BASE_URL);
  if (base) return base;
  return requestedOrigin;
}

async function findProfileByEmail(admin, email) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, restaurant_name, name, platform_role')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findAuthUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function upsertClientProfile(admin, { userId, email, restaurantName, created }) {
  const displayName = restaurantName || email.split('@')[0] || 'Restauracja';

  if (!created) {
    const patch = { email };
    if (restaurantName) {
      patch.name = restaurantName;
      patch.restaurant_name = restaurantName;
    }
    const { error } = await admin.from('profiles').update(patch).eq('id', userId);
    if (error) console.warn('[create-client-account] existing profile update failed', error.message);
    return;
  }

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);
  const fullRow = {
    id: userId,
    email,
    name: displayName,
    restaurant_name: restaurantName || displayName,
    plan: 'trial',
    subscription_status: 'trial',
    trial_tokens: TRIAL_TOKENS,
    trial_ends_at: trialEnds.toISOString(),
    ai_credits: TRIAL_TOKENS,
  };

  let { error } = await admin.from('profiles').upsert(fullRow, { onConflict: 'id' });
  if (!error) return;

  console.warn('[create-client-account] full profile upsert failed, retrying minimal', error.message);
  ({ error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      name: displayName,
    },
    { onConflict: 'id' },
  ));
  if (error) {
    console.warn('[create-client-account] minimal profile upsert failed', error.message);
  }
}

async function latestMenuOrder(admin, userId) {
  const { data, error } = await admin
    .from('menu_service_orders')
    .select('id, status, created_at')
    .eq('client_user_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[create-client-account] latest menu order', error.message);
    return null;
  }
  return data || null;
}

async function createOrInviteUser(admin, { email, restaurantName, redirectTo }) {
  const metadata = {
    provisioned_by: 'admin',
    ...(restaurantName ? { restaurant_name: restaurantName } : {}),
  };

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    data: metadata,
    redirectTo: redirectTo || undefined,
  });
  if (invited.data?.user?.id) {
    return { user: invited.data.user, created: true, inviteSent: true };
  }

  if (!alreadyRegistered(invited.error)) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (created.data?.user?.id) {
      return { user: created.data.user, created: true, inviteSent: false };
    }
    if (!alreadyRegistered(created.error)) {
      const message =
        invited.error?.message || created.error?.message || 'Nie udało się utworzyć konta.';
      return { error: message };
    }
  }

  const existingAuth = await findAuthUserByEmail(admin, email);
  if (existingAuth?.id) {
    return { user: existingAuth, created: false, inviteSent: false };
  }

  return { error: invited.error?.message || 'Konto z tym e-mailem już istnieje, ale nie udało się go odnaleźć.' };
}

export async function handleCreateClientAccount({
  authorization,
  body = {},
  deps = {},
} = {}) {
  const verifyToken = deps.verifyToken || defaultVerifyToken;
  const staffUser = await verifyToken(authorization);
  if (!staffUser) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const getAdmin = deps.getAdmin || getSupabaseAdmin;
  const admin = getAdmin();
  if (!admin) {
    return { status: 503, body: { error: 'Serwer nie jest skonfigurowany.' } };
  }

  const { data: staffProfile, error: staffError } = await admin
    .from('profiles')
    .select('platform_role')
    .eq('id', staffUser.id)
    .maybeSingle();
  if (staffError) {
    console.error('[create-client-account] staff profile', staffError.message);
    return { status: 500, body: { error: 'Nie udało się sprawdzić uprawnień.' } };
  }
  const role = staffProfile?.platform_role;
  if (role !== 'admin' && role !== 'staff') {
    return { status: 403, body: { error: 'Brak uprawnień.' } };
  }

  const checkRate = deps.rateLimitOk || rateLimitOk;
  if (!checkRate(`create-client:${staffUser.id}`, STAFF_CREATE_WINDOW_MS, STAFF_CREATE_MAX)) {
    return { status: 429, body: { error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.' } };
  }

  const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(emailRaw)) {
    return { status: 400, body: { error: 'Podaj prawidłowy adres e-mail klienta.' } };
  }

  const restaurantName = sanitizeText(body?.restaurantName, 80);
  const redirectTo = resolveRedirectTo(body?.redirectTo);

  let created = false;
  let inviteSent = false;
  let userId = null;
  let existingProfile = null;

  try {
    existingProfile = await findProfileByEmail(admin, emailRaw);
    if (existingProfile?.id) {
      if (existingProfile.platform_role === 'admin' || existingProfile.platform_role === 'staff') {
        return { status: 400, body: { error: 'Nie można założyć konta klienta na e-mail zespołu Chefvision.' } };
      }
      userId = existingProfile.id;
    } else {
      const result = await createOrInviteUser(admin, {
        email: emailRaw,
        restaurantName,
        redirectTo,
      });
      if (result.error || !result.user?.id) {
        return { status: 500, body: { error: result.error || 'Nie udało się utworzyć konta.' } };
      }
      userId = result.user.id;
      created = Boolean(result.created);
      inviteSent = Boolean(result.inviteSent);
    }
  } catch (err) {
    console.error('[create-client-account] lookup/create failed', err);
    return { status: 500, body: { error: err?.message || 'Nie udało się utworzyć konta.' } };
  }

  await upsertClientProfile(admin, {
    userId,
    email: emailRaw,
    restaurantName,
    created: created || !existingProfile,
  });

  const createOrders = deps.createOrders || createFreeImplementationOrdersForUser;
  const ordersResult = await createOrders({
    userId,
    email: emailRaw,
    planType: IMPLEMENTATION_BUNDLE_PLAN,
    deps: { getAdmin, sendDiscord: async () => ({ ok: true, skipped: true }) },
  });

  if (ordersResult.status >= 500) {
    return {
      status: 500,
      body: {
        error: 'Konto jest, ale nie udało się dodać zlecenia wdrożeniowego.',
        userId,
        created,
      },
    };
  }

  const alreadyHadOrders = ordersResult.status === 409;
  let orderId = ordersResult.body?.orderId || null;
  let orderStatus = ordersResult.body?.status || null;
  if (!orderId) {
    const existingOrder = await latestMenuOrder(admin, userId);
    orderId = existingOrder?.id || null;
    orderStatus = existingOrder?.status || orderStatus;
  }

  const sendDiscord = deps.sendDiscord || sendDiscordNotification;
  try {
    await sendDiscord(
      buildAdminProvisionedClientMessage({
        email: emailRaw,
        restaurantName,
        created,
        inviteSent,
      }),
    );
  } catch (err) {
    console.error('[create-client-account] Discord error after save', err);
  }

  return {
    status: 200,
    body: {
      ok: true,
      created,
      inviteSent,
      alreadyHadOrders,
      userId,
      email: emailRaw,
      restaurantName: restaurantName || emailRaw.split('@')[0],
      orderId,
      orderStatus: orderStatus || 'pending',
    },
  };
}
