/**
 * W dev odpowiedź z /api/generate-image ma ~3 MB (base64).
 * Proxy Vite często zrywa połączenie (ECONNRESET) — długie żądanie idzie bezpośrednio na Express.
 */
export function getApiBase(): string {
  if (!import.meta.env.DEV) return '';
  const port = import.meta.env.VITE_STRIPE_API_PORT || '3002';
  return `http://localhost:${port}`;
}

export function apiUrl(path: string): string {
  if (import.meta.env.DEV && path.startsWith('/api/generate-image')) {
    return `${getApiBase()}${path}`;
  }
  return path;
}
