/** Litery kodu — bez I, L, O (łatwe do pomylenia z 1/0). */
export const PROMO_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export const PROMO_CODE_FORMAT_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{2}-[0-9]{4}$/;

/** Normalizuje wpis kelnera: wielkie litery, automatyczny myślnik, odrzuca I/L/O. */
export function formatPromoCodeInput(raw: string): string {
  const upper = String(raw || '').toUpperCase();
  let letters = '';
  let digits = '';
  for (const ch of upper) {
    if (letters.length < 2 && PROMO_CODE_LETTERS.includes(ch)) {
      letters += ch;
      continue;
    }
    if (letters.length >= 2 && digits.length < 4 && ch >= '0' && ch <= '9') {
      digits += ch;
    }
  }
  if (digits.length > 0) return `${letters}-${digits}`;
  return letters;
}

export function isValidPromoCodeFormat(code: string): boolean {
  return PROMO_CODE_FORMAT_RE.test(String(code || '').trim().toUpperCase());
}

export function normalizePromoCode(raw: string): string | null {
  const formatted = formatPromoCodeInput(raw);
  return isValidPromoCodeFormat(formatted) ? formatted : null;
}
