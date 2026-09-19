export type PromoUnsubscribeRoute = {
  isUnsubscribe: boolean;
  token: string | null;
};

function tokenFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('token');
  const token = raw?.trim() || null;
  return token && token.length > 16 ? token : null;
}

export function parsePromoUnsubscribeRoute(pathname: string, hash: string, search = ''): PromoUnsubscribeRoute {
  const path = pathname.split('?')[0] || '';
  const pathIsUnsub = path === '/promo/unsubscribe' || path === '/promo/unsubscribe/';
  const hashIsUnsub = hash.includes('#/promo/unsubscribe');
  const isUnsubscribe = pathIsUnsub || hashIsUnsub;
  if (!isUnsubscribe) return { isUnsubscribe: false, token: null };

  const fromSearch = tokenFromSearch(search);
  const qIdx = hash.indexOf('?');
  const fromHash = qIdx >= 0 ? tokenFromSearch(hash.slice(qIdx + 1)) : null;
  return { isUnsubscribe: true, token: fromSearch || fromHash };
}
