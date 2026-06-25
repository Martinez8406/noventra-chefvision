import React from 'react';
import { Flame, Gift, Star } from 'lucide-react';
import type { DishRecommendation, PublicMenuLocale } from '../types';
import { calcSavingsPercent } from '../utils/dishRecommendations';
import { formatRecommendationPrice, resolveRecommendationCurrency } from '../utils/recommendationCurrency';
import {
  formatZestawDisplayTitlesLocalized,
  getPublicPolecaneSlotLabel,
  getPublicRecommendationBadge,
  getPublicRecommendationHeader,
  getPublicRecommendationItemCopy,
  getPublicSavingsLabel,
  type RecommendationTranslationCache,
} from '../utils/recommendationTranslations';
import { normalizePolecaneItems, POLECANE_SLOTS } from '../utils/dishRecommendations';

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

const GOLD_RIBBON_STYLES = `
  .chefvision-gold-ribbon-wrap {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    max-width: calc(100% - 20px);
    pointer-events: none;
  }
  .chefvision-gold-ribbon {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: #D4AF37;
    color: #ffffff;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
  .chefvision-gold-ribbon::after {
    content: '';
    position: absolute;
    top: 0;
    left: -120%;
    width: 55%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 35%,
      rgba(255, 255, 255, 0.45) 50%,
      rgba(255, 255, 255, 0.15) 65%,
      transparent 100%
    );
    transform: skewX(-18deg);
    animation: chefvisionRibbonShine 2.8s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes chefvisionRibbonShine {
    0% {
      left: -120%;
    }
    100% {
      left: 140%;
    }
  }
  .chefvision-gold-ribbon__icon,
  .chefvision-gold-ribbon__text {
    position: relative;
    z-index: 1;
  }
  .chefvision-gold-ribbon__icon {
    flex-shrink: 0;
    opacity: 0.95;
  }
  @media (prefers-reduced-motion: reduce) {
    .chefvision-gold-ribbon::after {
      animation: none;
    }
  }
`;

function RibbonIcon({ type }: { type: DishRecommendation['type'] }) {
  const cls = 'chefvision-gold-ribbon__icon';
  if (type === 'polecane') return <Star size={11} className={cls} strokeWidth={2.5} aria-hidden />;
  if (type === 'popularne') return <Flame size={11} className={cls} strokeWidth={2.5} aria-hidden />;
  return <Gift size={11} className={cls} strokeWidth={2.25} aria-hidden />;
}

export const DishRecommendationBadge: React.FC<{
  type: DishRecommendation['type'];
  menuLocale?: PublicMenuLocale;
}> = ({ type, menuLocale = 'pl' }) => {
  const label = getPublicRecommendationBadge(type, menuLocale);

  return (
    <>
      <style>{GOLD_RIBBON_STYLES}</style>
      <div className="chefvision-gold-ribbon-wrap" aria-hidden>
        <div className="chefvision-gold-ribbon">
          <RibbonIcon type={type} />
          <span className="chefvision-gold-ribbon__text">{label}</span>
        </div>
      </div>
    </>
  );
};

function PolecaneContent({
  items,
  currency,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  currency: DishRecommendation['currency'];
  menuLocale: PublicMenuLocale;
  translationCache?: RecommendationTranslationCache | null;
}) {
  const slots = normalizePolecaneItems(items).filter((item) => item.title.trim());
  if (slots.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {slots.map((item) => {
        const slot = POLECANE_SLOTS.find((s) => s.id === item.id);
        if (!slot) return null;
        const copy = getPublicRecommendationItemCopy(item, menuLocale, translationCache);
        const label = getPublicPolecaneSlotLabel(slot.id, menuLocale);
        return (
          <div key={item.id} className="min-w-0">
            <p className="text-[11px] font-bold text-slate-600 leading-snug">
              <span aria-hidden>{slot.emoji}</span> {label}
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <p className="text-sm font-bold text-slate-800 leading-tight truncate">{copy.title}</p>
              {item.price && (
                <span className="text-2xl font-semibold text-slate-700 tabular-nums shrink-0">
                  {formatRecommendationPrice(item.price, currency)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PopularneContent({
  items,
  currency,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  currency: DishRecommendation['currency'];
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
              <span className="text-2xl font-semibold text-slate-700 tabular-nums shrink-0">
                {formatRecommendationPrice(item.price, currency)}
              </span>
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
  currency,
  savingsPercent,
  menuLocale,
  translationCache,
}: {
  items: DishRecommendation['items'];
  dishName?: string;
  bundlePrice?: string;
  bundlePriceOutside?: string;
  currency: DishRecommendation['currency'];
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
            <span className="text-[2rem] font-black text-slate-900 tabular-nums">
              {formatRecommendationPrice(bundlePrice, currency)}
            </span>
          )}
          {bundlePriceOutside && (
            <span className="text-[1.75rem] text-slate-400 line-through tabular-nums">
              {formatRecommendationPrice(bundlePriceOutside, currency)}
            </span>
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
  const currency = resolveRecommendationCurrency(recommendation.currency);
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
      {type !== 'polecane' && (
        <div className={`flex items-center gap-1.5 mb-2.5 ${styles.header}`}>
          <RecommendationTypeIcon type={type} />
          <p className="text-[9px] font-black uppercase tracking-[0.12em] leading-tight">{headerText}</p>
        </div>
      )}

      {type === 'zestaw' ? (
        <ZestawContent
          items={items}
          dishName={dishName}
          bundlePrice={recommendation.bundlePrice}
          bundlePriceOutside={recommendation.bundlePriceOutside}
          currency={currency}
          savingsPercent={savingsPercent}
          menuLocale={menuLocale}
          translationCache={translationCache}
        />
      ) : type === 'polecane' ? (
        <PolecaneContent
          items={items}
          currency={currency}
          menuLocale={menuLocale}
          translationCache={translationCache}
        />
      ) : (
        <PopularneContent
          items={items}
          currency={currency}
          menuLocale={menuLocale}
          translationCache={translationCache}
        />
      )}
    </div>
  );
};
