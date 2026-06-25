
import React from 'react';
import { Dish, PublicMenuLocale } from '../types';
import {
  getPublicAllergenDisplay,
  getPublicDishCopy,
  getPublicIngredientsDisplay,
  getPublicIngredientsMoreLabel,
  getPublicMoreInfoLabel,
  isRtlMenuLocale,
} from '../utils/menuTranslations';
import { formatRecommendationPrice, resolveRecommendationCurrency } from '../utils/recommendationCurrency';
import { Info, UtensilsCrossed } from 'lucide-react';
import { WatermarkWrapper } from './WatermarkWrapper';
import { DishRecommendationBadge, DishRecommendationBox } from './DishRecommendationBox';
import { DishDietaryBadges } from './DishDietaryBadges';
import { ShareLinkButton } from './ShareLinkButton';
import { SocialLinkButton } from './SocialLinkButton';
import type { DishRecommendation } from '../types';
import type { RecommendationTranslationCache } from '../utils/recommendationTranslations';

interface Props {
  dish: Dish;
  recommendation?: DishRecommendation | null;
  recTranslationCache?: RecommendationTranslationCache | null;
  menuLocale?: PublicMenuLocale;
  basePath?: string;
  baseHash?: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
}

export const PublicDishCard: React.FC<Props> = ({
  dish,
  recommendation = null,
  recTranslationCache = null,
  menuLocale = 'pl',
  basePath = '/menu/demo',
  baseHash = '#/menu/demo',
  usePathRouting,
  onPathChange,
  showWatermark,
  shareUrl,
  shareTitle,
  shareText,
}) => {
  const copy = getPublicDishCopy(dish, menuLocale);
  const allergensUi = getPublicAllergenDisplay(dish, menuLocale);
  const ingredientsUi = getPublicIngredientsDisplay(dish, menuLocale);
  const isRtl = isRtlMenuLocale(menuLocale);
  const openDetail = () => {
    const encodedDishId = encodeURIComponent(dish.id);
    if (usePathRouting) {
      history.pushState({}, '', `${basePath}/dish/${encodedDishId}`);
      onPathChange?.();
    } else {
      window.location.hash = `${baseHash}/dish/${encodedDishId}`;
    }
  };

  return (
    <div 
      onClick={openDetail}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={menuLocale === 'pl' ? 'pl' : menuLocale}
      className="flex w-full max-w-none flex-col self-stretch overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl transition-all cursor-pointer group sm:hover:scale-[1.02]"
      style={
        isRtl
          ? { fontFamily: `'Noto Sans Hebrew', 'Noto Naskh Arabic', 'Segoe UI', system-ui, sans-serif` }
          : undefined
      }
    >
      {/* Hero Image */}
      <div className="relative h-64 w-full shrink-0 overflow-hidden">
        {recommendation?.isActive && (
          <DishRecommendationBadge type={recommendation.type} menuLocale={menuLocale} />
        )}
        <WatermarkWrapper show={!!showWatermark} className="block h-full w-full">
          <img
            src={dish.imageUrl}
            alt={copy.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </WatermarkWrapper>
      </div>

      <div className="w-full min-w-0 p-6">
        {dish.menuPrice ? (
          <div className={`mb-2 flex items-baseline gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className={`font-serif text-2xl text-slate-900 leading-tight ${isRtl ? 'text-end' : ''}`}>
              {copy.name}
            </h3>
            <div className="flex-1 border-b border-dotted border-slate-200 min-w-[1rem]" />
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap tabular-nums">
              {formatRecommendationPrice(dish.menuPrice, resolveRecommendationCurrency(dish.menuPriceCurrency))}
            </span>
          </div>
        ) : (
          <h3 className={`font-serif text-2xl text-slate-900 mb-2 leading-tight ${isRtl ? 'text-end' : ''}`}>
            {copy.name}
          </h3>
        )}
        <p className={`text-slate-600 text-sm mb-4 line-clamp-3 leading-relaxed ${isRtl ? 'text-end' : ''}`}>
          {copy.description}
        </p>

        <DishDietaryBadges
          dietaryTags={dish.dietaryTags}
          spiceLevel={dish.spiceLevel}
          className={`mb-4 ${isRtl ? 'justify-end' : ''}`}
        />

        {/* Ingredients */}
        <div className="mb-4">
          <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : ''}`}>
            {ingredientsUi.slice(0, 4).map((ing, i) => (
              <span
                key={i}
                className={`text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md ${isRtl ? '' : 'capitalize'}`}
              >
                {ing}
              </span>
            ))}
            {ingredientsUi.length > 4 && (
              <span className="text-[11px] text-slate-400">{getPublicIngredientsMoreLabel(menuLocale, ingredientsUi.length - 4)}</span>
            )}
          </div>
        </div>

        {recommendation?.isActive && (
          <DishRecommendationBox
            recommendation={recommendation}
            dishName={copy.name}
            menuLocale={menuLocale}
            translationCache={recTranslationCache}
            className="mb-4"
          />
        )}

        {/* Więcej info + Share it */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); openDetail(); }}
            className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-2xl text-xs font-bold hover:bg-amber-100 transition-colors border border-amber-100"
          >
            <Info size={16} />
            {getPublicMoreInfoLabel(menuLocale)}
          </button>
          {shareUrl && (
            <ShareLinkButton
              url={shareUrl}
              title={shareTitle || copy.name}
              text={shareText || copy.name}
              menuLocale={menuLocale}
              variant="compact"
            />
          )}
        </div>

        {/* Alergeny (neutralne tło + zamiana z sekcją "Więcej info" w kolejności) */}
        <div className="mt-4 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3">
          <UtensilsCrossed className="text-amber-700 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{allergensUi.sectionTitle}</p>
            <p className="text-xs text-slate-600">
              {allergensUi.labels.length > 0 ? allergensUi.labels.join(', ') : allergensUi.noAllergensMessage}
            </p>
          </div>
        </div>

        {dish.videoUrl && (
          <SocialLinkButton
            href={dish.videoUrl}
            className="mt-4"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
};
