import type { CSSProperties } from 'react';

export type LogoObjectPosition =
  | 'top left'
  | 'top'
  | 'top right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom left'
  | 'bottom'
  | 'bottom right';

export const DEFAULT_LOGO_POSITION: LogoObjectPosition = 'center';
export const DEFAULT_LOGO_SCALE = 1;
export const MIN_LOGO_SCALE = 0.45;
export const MAX_LOGO_SCALE = 2;

export const LOGO_POSITION_GRID: { id: LogoObjectPosition; label: string }[] = [
  { id: 'top left', label: 'Góra lewo' },
  { id: 'top', label: 'Góra' },
  { id: 'top right', label: 'Góra prawo' },
  { id: 'left', label: 'Lewo' },
  { id: 'center', label: 'Środek' },
  { id: 'right', label: 'Prawo' },
  { id: 'bottom left', label: 'Dół lewo' },
  { id: 'bottom', label: 'Dół' },
  { id: 'bottom right', label: 'Dół prawo' },
];

const VALID_POSITIONS = new Set<string>(LOGO_POSITION_GRID.map((p) => p.id));

export function normalizeLogoPosition(value: unknown): LogoObjectPosition {
  if (typeof value === 'string' && VALID_POSITIONS.has(value)) {
    return value as LogoObjectPosition;
  }
  return DEFAULT_LOGO_POSITION;
}

/** Czy błąd Supabase/PostgREST wskazuje na brak kolumn kadrowania w profiles. */
export function isMissingLogoFrameColumns(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('logo_object_position') ||
    msg.includes('logo_scale') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

export function normalizeLogoScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGO_SCALE;
  return Math.min(MAX_LOGO_SCALE, Math.max(MIN_LOGO_SCALE, n));
}

export function logoImageStyle(
  position: LogoObjectPosition,
  scale: number
): CSSProperties {
  const s = normalizeLogoScale(scale);
  return {
    // Gdy pomniejszamy (< 1), użytkownik chce zmieścić całe logo w ramce bez przycinania.
    // Kadrowanie ma sens dopiero przy powiększaniu (>= 1).
    objectFit: s < 1 ? 'contain' : 'cover',
    objectPosition: s < 1 ? 'center' : position,
    transform: s === 1 ? undefined : `scale(${s})`,
    transformOrigin: s < 1 ? 'center' : position,
  };
}
