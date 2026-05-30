
import React from 'react';
import { Dish, PublicMenuLocale } from '../types';
import {
  getPublicAllergenDisplay,
  getPublicDishCopy,
  getPublicIngredientsDisplay,
  getPublicIngredientsMoreLabel,
  isRtlMenuLocale,
} from '../utils/menuTranslations';
import { Info, UtensilsCrossed } from 'lucide-react';
import { WatermarkWrapper } from './WatermarkWrapper';
import { DishRecommendationBadge, DishRecommendationBox } from './DishRecommendationBox';
import { ShareLinkButton } from './ShareLinkButton';
import type { DishRecommendation } from '../types';

interface Props {
  dish: Dish;
  recommendation?: DishRecommendation | null;
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
      className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 max-w-sm mx-auto transition-all hover:scale-[1.02] cursor-pointer group"
      style={
        isRtl
          ? { fontFamily: `'Noto Sans Hebrew', 'Noto Naskh Arabic', 'Segoe UI', system-ui, sans-serif` }
          : undefined
      }
    >
      <style>
        {`
          @keyframes socialLinkFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @keyframes socialLinkGlow {
            0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.45), 0 0 14px rgba(34, 197, 94, 0.25); }
            50% { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0.65), 0 0 22px rgba(34, 197, 94, 0.4); }
          }
          .social-link-cta {
            animation: socialLinkFloat 3.2s ease-in-out infinite, socialLinkGlow 3.2s ease-in-out infinite;
          }
          .social-link-cta:hover {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .social-link-cta {
              animation: none;
            }
          }
        `}
      </style>
      {/* Hero Image */}
      <WatermarkWrapper show={!!showWatermark} className="h-64 overflow-hidden relative">
        {recommendation?.isActive && <DishRecommendationBadge type={recommendation.type} />}
        <img
          src={dish.imageUrl}
          alt={copy.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </WatermarkWrapper>

      <div className="p-6">
        {dish.menuPrice ? (
          <div className={`mb-2 flex items-baseline gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className={`font-serif text-2xl text-slate-900 leading-tight ${isRtl ? 'text-end' : ''}`}>
              {copy.name}
            </h3>
            <div className="flex-1 border-b border-dotted border-slate-200 min-w-[1rem]" />
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap tabular-nums">
              {dish.menuPrice} zł
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
            Więcej info
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

        {/* Social Link (przeniesiony niżej, pod alergeny) */}
        {dish.videoUrl && (
          <a
            href={dish.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="social-link-cta mt-4 block rounded-2xl overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-0.5 active:-translate-y-0.5"
            aria-label="Social Link"
          >
            <img
              src="/Gemini_Generated_Image_HD.png"
              alt="Social Link"
              className="w-full h-24 object-cover object-[center_65%]"
              loading="lazy"
            />
          </a>
        )}
      </div>
    </div>
  );
};
