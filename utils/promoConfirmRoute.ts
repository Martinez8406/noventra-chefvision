export type PromoConfirmRoute = {
  isConfirm: boolean;
  token: string | null;
};

function tokenFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('token');
  const token = raw?.trim() || null;
  return token && token.length > 8 ? token : null;
}

export function parsePromoConfirmRoute(pathname: string, hash: string, search = ''): PromoConfirmRoute {
  const path = pathname.split('?')[0] || '';
  const pathIsConfirm = path === '/promo/confirm' || path === '/promo/confirm/';
  const hashIsConfirm = hash.includes('#/promo/confirm');
  const isConfirm = pathIsConfirm || hashIsConfirm;
  if (!isConfirm) return { isConfirm: false, token: null };

  const fromSearch = tokenFromSearch(search);
  const qIdx = hash.indexOf('?');
  const fromHash = qIdx >= 0 ? tokenFromSearch(hash.slice(qIdx + 1)) : null;
  return { isConfirm: true, token: fromSearch || fromHash };
}
