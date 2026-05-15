import React from 'react';
import type { DishRecommendation } from '../types';
import {
  calcSavingsPercent,
  formatZestawDisplayTitles,
  getRecommendationHeader,
  RECOMMENDATION_BADGE,
} from '../utils/dishRecommendations';

interface Props {
  recommendation: DishRecommendation;
  /** Nazwa dania, do którego przypisana jest rekomendacja (dla zestawu dopisywana automatycznie). */
  dishName?: string;
  className?: string;
}

const TYPE_STYLES = {
  polecane: {
    box: 'bg-emerald-50/80 border-emerald-100',
    header: 'text-emerald-700',
    iconEmoji: '👌',
  },
  popularne: {
    box: 'bg-violet-50/70 border-violet-100',
    header: 'text-violet-700',
    iconEmoji: '🔥',
  },
  zestaw: {
    box: 'bg-emerald-50/80 border-emerald-100',
    header: 'text-emerald-700',
    iconEmoji: '⭐',
  },
} as const;

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

export const DishRecommendationBadge: React.FC<{ type: DishRecommendation['type'] }> = ({ type }) => {
  const badgeClass =
    type === 'popularne' ? 'bg-violet-600/90 text-white' : 'bg-emerald-600/90 text-white';

  return (
    <span
      className={`absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${badgeClass}`}
    >
      {RECOMMENDATION_BADGE[type]}
    </span>
  );
};

function PolecaneContent({ items }: { items: DishRecommendation['items'] }) {
  const item = items[0];
  if (!item) return null;
  return (
    <div className="flex items-center gap-3">
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.subtitle}</p>
        )}
        {item.price && (
          <p className="text-xs font-semibold text-slate-700 mt-1 tabular-nums">{item.price} zł</p>
        )}
      </div>
    </div>
  );
}

function PopularneContent({ items }: { items: DishRecommendation['items'] }) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <ItemThumb item={item} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 leading-tight truncate">{item.title}</p>
            {item.subtitle && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{item.subtitle}</p>
            )}
          </div>
          {item.price && (
            <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">{item.price} zł</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ZestawContent({
  items,
  dishName,
  bundlePrice,
  bundlePriceOutside,
  savingsPercent,
}: {
  items: DishRecommendation['items'];
  dishName?: string;
  bundlePrice?: string;
  bundlePriceOutside?: string;
  savingsPercent: number | null;
}) {
  const titles = formatZestawDisplayTitles(items, dishName ?? '');

  return (
    <div>
      <p className="text-sm font-bold text-slate-800 text-center leading-snug">{titles}</p>
      {savingsPercent != null && savingsPercent > 0 && (
        <p className="text-[11px] text-emerald-700 font-medium text-center mt-1">
          Oszczędzasz {savingsPercent}%
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

export const DishRecommendationBox: React.FC<Props> = ({ recommendation, dishName = '', className = '' }) => {
  const { type, items } = recommendation;
  const styles = TYPE_STYLES[type];
  const headerText = getRecommendationHeader(recommendation);

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
        <span className="text-sm leading-none shrink-0" aria-hidden>
          {styles.iconEmoji}
        </span>
        <p className="text-[9px] font-black uppercase tracking-[0.12em] leading-tight">{headerText}</p>
      </div>

      {type === 'zestaw' ? (
        <ZestawContent
          items={items}
          dishName={dishName}
          bundlePrice={recommendation.bundlePrice}
          bundlePriceOutside={recommendation.bundlePriceOutside}
          savingsPercent={savingsPercent}
        />
      ) : type === 'polecane' ? (
        <PolecaneContent items={items} />
      ) : (
        <PopularneContent items={items} />
      )}
    </div>
  );
};
