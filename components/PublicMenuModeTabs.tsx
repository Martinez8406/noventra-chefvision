import React from 'react';
import { formatHotelHubAvailability } from '../utils/hotelHub';
import type { HotelHubSection, PublicMenuLocale } from '../types';
import { HotelHubSectionIcon } from './HotelHubSectionIcon';

interface Props {
  active: 'restaurant' | 'hub';
  onChange: (mode: 'restaurant' | 'hub') => void;
  primaryColor: string;
  secondaryColor: string;
  locale?: PublicMenuLocale;
  sticky?: boolean;
}

export const PublicMenuModeTabs: React.FC<Props> = ({
  active,
  onChange,
  primaryColor,
  secondaryColor,
  locale = 'pl',
  sticky = true,
}) => {
  const isPl = locale === 'pl';
  const restaurantLabel = isPl ? 'Restauracja' : 'Restaurant';
  const hubLabel = 'Hotel Hub';

  return (
    <div
      className={`w-full max-w-6xl mx-auto z-[100] ${sticky ? 'sticky top-0 pt-3 pb-2' : 'pt-2'}`}
      style={{ backgroundColor: secondaryColor }}
    >
      <div
        className="flex rounded-2xl p-1 shadow-md border border-black/5 max-w-md mx-auto backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
        role="tablist"
        aria-label={isPl ? 'Nawigacja menu' : 'Menu navigation'}
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === 'restaurant'}
          onClick={() => onChange('restaurant')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all duration-200 ${
            active === 'restaurant' ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
          style={active === 'restaurant' ? { backgroundColor: primaryColor } : undefined}
        >
          {restaurantLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'hub'}
          onClick={() => onChange('hub')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all duration-200 ${
            active === 'hub' ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
          style={active === 'hub' ? { backgroundColor: primaryColor } : undefined}
        >
          {hubLabel}
        </button>
      </div>
    </div>
  );
};

interface SectionCardProps {
  section: HotelHubSection;
  locale?: PublicMenuLocale;
  primaryColor: string;
  onClick: () => void;
}

export const HotelHubSectionCard: React.FC<SectionCardProps> = ({
  section,
  locale = 'pl',
  primaryColor,
  onClick,
}) => {
  const availability = formatHotelHubAvailability(section, locale === 'pl' ? 'pl' : 'en');

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-[28px] overflow-hidden bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100/80 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <div className="relative h-40 sm:h-48 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {section.heroImageUrl ? (
          <img
            src={section.heroImageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center opacity-90"
            style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}08)` }}
          >
            <HotelHubSectionIcon icon={section.iconEmoji} size="xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 drop-shadow-lg">
          <HotelHubSectionIcon icon={section.iconEmoji} size="lg" className="brightness-0 invert" />
        </span>
      </div>
      <div className="p-5 sm:p-6 space-y-2">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">{section.name}</h3>
        <p className="text-xs font-semibold pt-1" style={{ color: primaryColor }}>
          {availability}
        </p>
      </div>
    </button>
  );
};
