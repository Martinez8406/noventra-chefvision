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
  titleAsH1 = false,
}) => {
  const coverHeight = compactCover ? 'h-40 sm:h-48' : 'h-56 sm:h-72 lg:h-80';
  const logoOverlap = compactCover ? '-mt-12 sm:-mt-14' : '-mt-14 sm:-mt-16';
  const coverPos = normalizeCoverPosition(coverPosition ?? DEFAULT_COVER_POSITION);
  const coverZoom = normalizeCoverScale(coverScale ?? DEFAULT_COVER_SCALE);

  return (
    <section className="relative pointer-events-none select-none">
      <div
        className={`relative ${coverHeight} rounded-[30px] overflow-hidden shadow-2xl border border-black/5`}
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

      <div className="px-2 sm:px-6 relative z-10">
        <div className="flex items-end gap-4 sm:gap-5 mt-4 sm:mt-5">
          <MenuLogoBadge
            logoUrl={logoUrl}
            logoPosition={logoPosition}
            logoScale={logoScale}
            restaurantTitle={restaurantTitle}
            className={logoOverlap}
          />
          <div className="min-w-0 pb-2">
            {titleAsH1 ? (
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                {restaurantTitle}
              </h1>
            ) : (
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight truncate">
                {restaurantTitle}
              </h2>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
