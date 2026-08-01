import type { CSSProperties } from 'react';
import {
  LOGO_POSITION_GRID,
  normalizeLogoPosition,
  type LogoObjectPosition,
} from './logoFrame';

/** Punkt kadrowania zdjęcia dania w menu cyfrowym (CSS object-position). */
export type DishObjectPosition = LogoObjectPosition;

export const DISH_POSITION_GRID = LOGO_POSITION_GRID;
export const DEFAULT_DISH_POSITION: DishObjectPosition = 'center';
export const DEFAULT_DISH_SCALE = 1;
/** Tylko zoom w głąb kadru — karty menu zawsze używają object-cover. */
export const MIN_DISH_SCALE = 1;
export const MAX_DISH_SCALE = 2.5;

export function normalizeDishPosition(value: unknown): DishObjectPosition {
  return normalizeLogoPosition(value);
}

export function normalizeDishScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DISH_SCALE;
  return Math.min(MAX_DISH_SCALE, Math.max(MIN_DISH_SCALE, n));
}

export function isMissingDishFrameColumns(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('image_object_position') ||
    msg.includes('image_scale') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

/** Styl zdjęcia dania w karcie / szczegółach menu live. */
export function dishImageStyle(
  position: DishObjectPosition | string | null | undefined,
  scale: number | null | undefined,
): CSSProperties {
  const s = normalizeDishScale(scale);
  const pos = normalizeDishPosition(position);
  return {
    objectFit: 'cover',
    objectPosition: pos,
    width: '100%',
    height: '100%',
    transform: s === 1 ? undefined : `scale(${s})`,
    transformOrigin: pos,
  };
}
