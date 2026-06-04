import React from 'react';
import { Gift } from 'lucide-react';
import type { DishRecommendation, PublicMenuLocale } from '../types';
import { calcSavingsPercent } from '../utils/dishRecommendations';
import {
  formatZestawDisplayTitlesLocalized,
  getPublicRecommendationBadge,
  getPublicRecommendationHeader,
  getPublicRecommendationItemCopy,
  getPublicSavingsLabel,
  type RecommendationTranslationCache,
} from '../utils/recommendationTranslations';

interface Props {
  recommendation: DishRecommendation;
  /** Nazwa dania, do którego przypisana jest rekomendacja (dla zestawu dopisywana automatycznie). */
  dishName?: string;
  menuLocale?: PublicMenuLocale;
  translationCache?: RecommendationTranslationCache | null;
  className?: string;
}

const TYPE_STYLES = {
  polecane: {
    box: 'bg-emerald-50/80 border-emerald-100',
    header: 'text-emerald-700',
  },
  popularne: {
    box: 'bg-violet-50/70 border-violet-100',
    header: 'text-violet-700',
  },
  zestaw: {
    box: 'bg-emerald-50/80 border-emerald-100',
    header: 'text-emerald-700',
  },
} as const;

function RecommendationTypeIcon({ type }: { type: DishRecommendation['type'] }) {
  if (type === 'zestaw') {
    return <Gift size={14} className="shrink-0" strokeWidth={2.25} aria-hidden />;
  }
  const emoji = type === 'polecane' ? '👌' : '🔥';
  return (
    <span className="text-sm leading-none shrink-0" aria-hidden>
      {emoji}
    </span>
  );
}

function ItemThumb({ item }: { item: DishRecommendation['items'][0] }) {
  if (!item.imageUrl) return null;
  return (
    <img
      src={item.imageUrl}
      alt=""
      className="w-10 h-10 rounded-lg object-cover shrink-0"
      loading="lazy"
    />
  );
}

const BADGE_SWAY_STYLES = `
  @keyframes chefvisionRecBadgeSway {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(3px); }
    75% { transform: translateX(-3px); }
  }
  .chefvision-rec-badge-sway {
    animation: chefvisionRecBadgeSway 3.2s ease-in-out infinite;
  }
  .group:hover .chefvision-rec-badge-sway {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .chefvision-rec-badge-sway {
      animation: none;
    }
  }
`;

export const DishRecommendationBadge: React.FC<{
  type: DishRecommendation['type'];
  menuLocale?: PublicMenuLocale;
}> = ({ type, menuLocale = 'pl' }) => {
  const badgeClass =
    type === 'popularne' ? 'bg-violet-600/90 text-white' : 'bg-emerald-600/90 text-white';

  return (
    <>
      <style>{BADGE_SWAY_STYLES}</style>
      <span
        className={`chefvision-rec-badge-sway absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${badgeClass}`}
      >
        {getPublicRecommendationBadge(type, menuLocale)}
      </span>
    </>
  );
};

function PolecaneContent({
  items,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  menuLocale: PublicMenuLocale;
  translationCache?: RecommendationTranslationCache | null;
}) {
  const item = items[0];
  if (!item) return null;
  const copy = getPublicRecommendationItemCopy(item, menuLocale, translationCache);
  return (
    <div className="flex items-center gap-3">
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{copy.title}</p>
        {copy.subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{copy.subtitle}</p>
        )}
        {item.price && (
          <p className="text-xs font-semibold text-slate-700 mt-1 tabular-nums">{item.price} zł</p>
        )}
      </div>
    </div>
  );
}

function PopularneContent({
  items,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  menuLocale: PublicMenuLocale;
  translationCache?: RecommendationTranslationCache | null;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const copy = getPublicRecommendationItemCopy(item, menuLocale, translationCache);
        return (
          <div key={item.id} className="flex items-center gap-3">
            <ItemThumb item={item} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 leading-tight truncate">{copy.title}</p>
              {copy.subtitle && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{copy.subtitle}</p>
              )}
            </div>
            {item.price && (
              <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">{item.price} zł</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ZestawContent({
  items,
  dishName,
  bundlePrice,
  bundlePriceOutside,
  savingsPercent,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  dishName?: string;
  bundlePrice?: string;
  bundlePriceOutside?: string;
  savingsPercent: number | null;
  menuLocale: PublicMenuLocale;
  translationCache?: RecommendationTranslationCache | null;
}) {
  const titles = formatZestawDisplayTitlesLocalized(items, dishName ?? '', menuLocale, translationCache);

  return (
    <div>
      <p className="text-sm font-bold text-slate-800 text-center leading-snug">{titles}</p>
      {savingsPercent != null && savingsPercent > 0 && (
        <p className="text-[11px] text-emerald-700 font-medium text-center mt-1">
          {getPublicSavingsLabel(savingsPercent, menuLocale)}
        </p>
      )}
      {(bundlePrice || bundlePriceOutside) && (
        <div className="flex items-center justify-center gap-2 mt-2">
          {bundlePrice && (
            <span className="text-base font-black text-slate-900 tabular-nums">{bundlePrice} zł</span>
          )}
          {bundlePriceOutside && (
            <span className="text-sm text-slate-400 line-through tabular-nums">{bundlePriceOutside} zł</span>
          )}
        </div>
      )}
    </div>
  );
}

export const DishRecommendationBox: React.FC<Props> = ({
  recommendation,
  dishName = '',
  menuLocale = 'pl',
  translationCache = null,
  className = '',
}) => {
  const { type, items } = recommendation;
  const styles = TYPE_STYLES[type];
  const headerText = getPublicRecommendationHeader(recommendation, menuLocale, translationCache);

  const savingsPercent =
    type === 'zestaw'
      ? calcSavingsPercent(recommendation.bundlePriceOutside ?? '', recommendation.bundlePrice ?? '')
      : null;

  return (
    <div
      className={`rounded-xl border p-3 shadow-sm ${styles.box} ${className}`}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div className={`flex items-center gap-1.5 mb-2.5 ${styles.header}`}>
        <RecommendationTypeIcon type={type} />
        <p className="text-[9px] font-black uppercase tracking-[0.12em] leading-tight">{headerText}</p>
      </div>

      {type === 'zestaw' ? (
        <ZestawContent
          items={items}
          dishName={dishName}
          bundlePrice={recommendation.bundlePrice}
          bundlePriceOutside={recommendation.bundlePriceOutside}
          savingsPercent={savingsPercent}
          menuLocale={menuLocale}
          translationCache={translationCache}
        />
      ) : type === 'polecane' ? (
        <PolecaneContent items={items} menuLocale={menuLocale} translationCache={translationCache} />
      ) : (
        <PopularneContent items={items} menuLocale={menuLocale} translationCache={translationCache} />
      )}
    </div>
  );
};
