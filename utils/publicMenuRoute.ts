import type { PublicMenuMode } from '../types';

export type PublicMenuRoute = {
  userId: string | null;
  hubSectionId: string | null;
  dishId: string | null;
  mode: PublicMenuMode;
};

function safeDecodeRouteParam(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** /menu/{userId}/dish/{dishId} | /hub/... | /info */
const PUBLIC_MENU_PATH_RE =
  /^\/menu\/([^/]+)(?:\/(?:dish\/([^/]+)|hub(?:\/([^/]+))?(?:\/dish\/([^/]+))?|info))?\/?$/;

const PUBLIC_MENU_HASH_RE =
  /#\/menu\/([^/?#]+)(?:\/(?:dish\/([^/?#]+)|hub(?:\/([^/?#]+))?(?:\/dish\/([^/?#]+))?|info)?)?/;

function matchToRoute(
  match: RegExpMatchArray | null,
  source: string,
): PublicMenuRoute | null {
  if (!match) return null;

  const userId = safeDecodeRouteParam(match[1]);
  if (!userId) return null;

  const restaurantDishId = safeDecodeRouteParam(match[2]);
  const hubSectionId = safeDecodeRouteParam(match[3]);
  const hubDishId = safeDecodeRouteParam(match[4]);
  const isHub = source.includes('/hub');
  const isInfo = /\/info(?:\/|$|\?|#)/.test(source) || source.endsWith('/info');

  return {
    userId,
    hubSectionId: isHub ? hubSectionId : null,
    dishId: restaurantDishId || hubDishId,
    mode: isHub ? 'hub' : isInfo ? 'info' : 'restaurant',
  };
}

export function parsePublicMenuRoute(pathname: string, hash: string): PublicMenuRoute {
  const fromPath = matchToRoute(pathname.match(PUBLIC_MENU_PATH_RE), pathname);
  const fromHash = matchToRoute(hash.match(PUBLIC_MENU_HASH_RE), hash);

  const userId = fromPath?.userId ?? fromHash?.userId ?? null;
  if (!userId) {
    return {
      userId: null,
      hubSectionId: null,
      dishId: null,
      mode: 'restaurant',
    };
  }

  const isHub = pathname.includes('/hub') || hash.includes('/hub');
  const isInfo = pathname.includes('/info') || hash.includes('/info');

  return {
    userId,
    hubSectionId: isHub ? fromPath?.hubSectionId ?? fromHash?.hubSectionId ?? null : null,
    dishId: fromPath?.dishId ?? fromHash?.dishId ?? null,
    mode: isHub ? 'hub' : isInfo ? 'info' : 'restaurant',
  };
}
