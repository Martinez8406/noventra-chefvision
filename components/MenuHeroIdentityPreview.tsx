import React from 'react';
import { MenuLogoBadge } from './MenuLogoBadge';
import type { LogoObjectPosition } from '../utils/logoFrame';
import {
  coverImageStyle,
  DEFAULT_COVER_POSITION,
  DEFAULT_COVER_SCALE,
  normalizeCoverPosition,
  normalizeCoverScale,
  type CoverObjectPosition,
} from '../utils/coverFrame';

interface Props {
  logoUrl: string | null;
  logoPosition?: LogoObjectPosition | string | null;
  logoScale?: number | null;
  restaurantTitle: string;
  coverUrl?: string | null;
  coverPosition?: CoverObjectPosition | string | null;
  coverScale?: number | null;
  primaryColor?: string;
  /** Mniejsza wysokość covera w panelu ustawień (proporcje jak Live Menu). */
  compactCover?: boolean;
  /**
   * Wymusza układ telefonu (wąski kadr Live Menu na mobile) —
   * bez breakpointów sm/lg, żeby podgląd na desktopie odpowiadał telefonowi.
   */
  phoneLayout?: boolean;
  /** W Live Menu użyj <h1>; w edytorze <h2>. */
  titleAsH1?: boolean;
}

/**
 * Fragment nagłówka menu publicznego — używany w PublicMenu i w edytorze logo (podgląd 1:1).
 */
export const MenuHeroIdentityPreview: React.FC<Props> = ({
  logoUrl,
  logoPosition,
  logoScale,
  restaurantTitle,
  coverUrl,
  coverPosition,
  coverScale,
  primaryColor = '#6366f1',
  compactCover = false,
  phoneLayout = false,
  titleAsH1 = false,
}) => {
  const coverHeight = phoneLayout
    ? 'h-56'
    : compactCover
      ? 'h-40 sm:h-48'
      : 'h-56 sm:h-72 lg:h-80';
  const logoOverlap = phoneLayout
    ? '-mt-14'
    : compactCover
      ? '-mt-12 sm:-mt-14'
      : '-mt-14 sm:-mt-16';
  const coverRadius = phoneLayout ? 'rounded-[22px]' : 'rounded-[30px]';
  const coverPos = normalizeCoverPosition(coverPosition ?? DEFAULT_COVER_POSITION);
  const coverZoom = normalizeCoverScale(coverScale ?? DEFAULT_COVER_SCALE);

  return (
    <section className="relative pointer-events-none select-none">
      <div
        className={`relative ${coverHeight} ${coverRadius} overflow-hidden shadow-2xl border border-black/5`}
      >
        {coverUrl ? (
          <>
            <img src={coverUrl} alt="" style={coverImageStyle(coverPos, coverZoom)} />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.5) 100%)' }}
            />
          </>
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}
          />
        )}
      </div>

      <div className={`relative z-10 ${phoneLayout ? 'px-3' : 'px-2 sm:px-6'}`}>
        <div
          className={`flex items-end ${phoneLayout ? 'gap-3 mt-4' : 'gap-4 sm:gap-5 mt-4 sm:mt-5'}`}
        >
          <MenuLogoBadge
            logoUrl={logoUrl}
            logoPosition={logoPosition}
            logoScale={logoScale}
            restaurantTitle={restaurantTitle}
            className={logoOverlap}
            phoneLayout={phoneLayout}
          />
          <div className="min-w-0 pb-2">
            {titleAsH1 ? (
              <h1
                className={`font-black tracking-tight text-slate-900 leading-tight ${
                  phoneLayout ? 'text-2xl' : 'text-3xl sm:text-4xl'
                }`}
              >
                {restaurantTitle}
              </h1>
            ) : (
              <h2
                className={`font-black tracking-tight text-slate-900 leading-tight truncate ${
                  phoneLayout ? 'text-xl' : 'text-2xl sm:text-3xl'
                }`}
              >
                {restaurantTitle}
              </h2>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
