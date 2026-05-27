import React from 'react';
import {
  DEFAULT_LOGO_POSITION,
  DEFAULT_LOGO_SCALE,
  logoImageStyle,
  normalizeLogoPosition,
  normalizeLogoScale,
  type LogoObjectPosition,
} from '../utils/logoFrame';

interface Props {
  logoUrl: string | null;
  logoPosition?: LogoObjectPosition | string | null;
  logoScale?: number | null;
  restaurantTitle: string;
  className?: string;
}

/** Ramka logo — te same wymiary i style co w PublicMenu (Live Menu). */
export const MenuLogoBadge: React.FC<Props> = ({
  logoUrl,
  logoPosition,
  logoScale,
  restaurantTitle,
  className = '',
}) => {
  const position = normalizeLogoPosition(logoPosition ?? DEFAULT_LOGO_POSITION);
  const scale = normalizeLogoScale(logoScale ?? DEFAULT_LOGO_SCALE);
  const fallbackLetter = restaurantTitle.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div
      className={`h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden shrink-0 ${className}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo restauracji"
          className="w-full h-full"
          style={logoImageStyle(position, scale)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xl font-black">
          {fallbackLetter}
        </div>
      )}
    </div>
  );
};
