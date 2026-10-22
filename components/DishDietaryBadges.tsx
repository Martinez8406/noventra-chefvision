import React from 'react';
import { DietaryTag, PublicMenuLocale, SpiceLevel } from '../types';
import { DIETARY_TAG_BY_ID, SPICE_LEVEL_BY_ID } from '../constants';
import { getPublicGlutenFreeNote } from '../utils/menuTranslations';

interface Props {
  dietaryTags?: DietaryTag[];
  spiceLevel?: SpiceLevel | null;
  size?: 'sm' | 'md';
  className?: string;
  menuLocale?: PublicMenuLocale;
  showGlutenTraceNote?: boolean;
}

/**
 * Ikony oznaczeń dietetycznych i ostrości w menu live.
 */
export const DishDietaryBadges: React.FC<Props> = ({
  dietaryTags = [],
  spiceLevel = null,
  size = 'sm',
  className = '',
  menuLocale = 'pl',
  showGlutenTraceNote = true,
}) => {
  const tags = (dietaryTags || []).filter((t) => DIETARY_TAG_BY_ID[t]);
  if (tags.length === 0 && !spiceLevel) return null;

  const pillSize = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[10px]';
  const noteSize = size === 'md' ? 'text-xs' : 'text-[10px]';
  const spice = spiceLevel ? SPICE_LEVEL_BY_ID[spiceLevel] : null;
  const hasGlutenFree = tags.includes('gluten_free');

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tags.map((tag) => {
        const opt = DIETARY_TAG_BY_ID[tag];
        return (
          <span
            key={tag}
            title={opt.description ? `${opt.label}: ${opt.description}` : opt.label}
            className={`inline-flex items-center rounded-lg border font-black uppercase tracking-wide ${pillSize} ${opt.badgeClass}`}
          >
            {opt.shortLabel}
          </span>
        );
      })}
      {spice && (
        <span
          title={`${spice.label}: ${spice.description}`}
          className={`inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 text-red-800 font-bold ${pillSize}`}
        >
          <span aria-hidden>{spice.peppers}</span>
          <span className="normal-case font-semibold">{spice.label}</span>
        </span>
      )}
      {showGlutenTraceNote && hasGlutenFree && (
        <span className={`${noteSize} text-slate-500 leading-snug w-full`}>
          {getPublicGlutenFreeNote(menuLocale)}
        </span>
      )}
    </div>
  );
};
