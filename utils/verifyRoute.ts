export type VerifyRoute = {
  isVerify: boolean;
  restaurantId: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeDecode(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRestaurantId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return UUID_RE.test(trimmed) ? trimmed : null;
}

/** /verify | /verify/{restaurantId} oraz odpowiedniki hash. */
export function parseVerifyRoute(pathname: string, hash: string, search = ''): VerifyRoute {
  const path = pathname.split('?')[0] || '';
  const pathMatch = path.match(/^\/verify(?:\/([^/]+))?\/?$/);
  const hashMatch = hash.match(/#\/verify(?:\/([^/?#]+))?/);
  const fromQuery = new URLSearchParams(search).get('r');

  const isVerify = !!pathMatch || !!hashMatch || path === '/verify' || hash.includes('#/verify');

  if (!isVerify) {
    return { isVerify: false, restaurantId: null };
  }

  const fromPath = pathMatch?.[1] ? safeDecode(pathMatch[1]) : null;
  const fromHash = hashMatch?.[1] ? safeDecode(hashMatch[1]) : null;
  const restaurantId =
    parseRestaurantId(fromPath) || parseRestaurantId(fromHash) || parseRestaurantId(fromQuery);

  return { isVerify: true, restaurantId };
}

export function buildVerifyUrl(restaurantId: string, usePathRouting = true): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const encoded = encodeURIComponent(restaurantId);
  if (usePathRouting) return `${origin}/verify/${encoded}`;
  return `${origin}#/verify/${encoded}`;
}
