import type { CSSProperties } from 'react';
import {
  LOGO_POSITION_GRID,
  normalizeLogoPosition,
  type LogoObjectPosition,
} from './logoFrame';

export type CoverObjectPosition = LogoObjectPosition;
export const COVER_POSITION_GRID = LOGO_POSITION_GRID;
export const DEFAULT_COVER_POSITION: CoverObjectPosition = 'center';
export const DEFAULT_COVER_SCALE = 1;
// Pozwalamy "pomniejszać" jak w logo: poniżej 1 przełączamy object-fit na "contain"
// aby nie przycinać zdjęcia.
export const MIN_COVER_SCALE = 0.45;
export const MAX_COVER_SCALE = 2.5;

export function normalizeCoverPosition(value: unknown): CoverObjectPosition {
  return normalizeLogoPosition(value);
}

export function normalizeCoverScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_COVER_SCALE;
  return Math.min(MAX_COVER_SCALE, Math.max(MIN_COVER_SCALE, n));
}

export function isMissingCoverFrameColumns(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('cover_object_position') ||
    msg.includes('cover_scale') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

/** Styl covera w banerze Live Menu — zawsze object-cover + opcjonalny zoom. */
export function coverImageStyle(position: CoverObjectPosition, scale: number): CSSProperties {
  const s = normalizeCoverScale(scale);
  const pos = normalizeCoverPosition(position);
  return {
    // Gdy pomniejszamy (< 1), użytkownik chce zobaczyć całe zdjęcie bez przycinania.
    objectFit: s < 1 ? 'contain' : 'cover',
    objectPosition: s < 1 ? 'center' : pos,
    width: '100%',
    height: '100%',
    transform: s === 1 ? undefined : `scale(${s})`,
    transformOrigin: s < 1 ? 'center' : pos,
  };
}
