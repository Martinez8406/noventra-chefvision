
import React from 'react';
import { Dish, DishRecommendation, PublicMenuLocale } from '../types';
import { DishRecommendationBadge, DishRecommendationBox } from './DishRecommendationBox';
import { DishDietaryBadges } from './DishDietaryBadges';
import {
  getPublicAllergenDisplay,
  getPublicDishCopy,
  getPublicIngredientsDisplay,
  getPublicIngredientsSectionTitle,
  isRtlMenuLocale,
} from '../utils/menuTranslations';
import { ChevronLeft, Info, Utensils, UtensilsCrossed } from 'lucide-react';
import { BRAND_LOGO_SRC } from '../constants';
import { WatermarkWrapper } from './WatermarkWrapper';
import { ShareLinkButton } from './ShareLinkButton';
import { SocialLinkButton } from './SocialLinkButton';
import type { RecommendationTranslationCache } from '../utils/recommendationTranslations';

interface Props {
  dish: Dish;
  recommendation?: DishRecommendation | null;
  recTranslationCache?: RecommendationTranslationCache | null;
  menuLocale?: PublicMenuLocale;
  onBack: () => void;
  showWatermark?: boolean;
  fontFamily?: string;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
}

export const PublicDishDetail: React.FC<Props> = ({
  dish,
  recommendation = null,
  recTranslationCache = null,
  menuLocale = 'pl',
  onBack,
  showWatermark,
  fontFamily,
  shareUrl,
  shareTitle,
  shareText,
}) => {
  const copy = getPublicDishCopy(dish, menuLocale);
  const allergensUi = getPublicAllergenDisplay(dish, menuLocale);
  const ingredients = getPublicIngredientsDisplay(dish, menuLocale);
  const isRtl = isRtlMenuLocale(menuLocale);
  const bodyFont = isRtl
    ? `'Noto Sans Hebrew', 'Noto Naskh Arabic', 'Segoe UI', system-ui, ${fontFamily || 'Inter'}, sans-serif`
    : fontFamily || 'Inter';
  return (
    <div
      className="min-h-screen bg-white animate-in fade-in slide-in-from-bottom-4 duration-500"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={menuLocale === 'pl' ? 'pl' : menuLocale}
      style={{ fontFamily: bodyFont }}
    >
      {/* Hero Image Section – wysokość tak, by całe danie + znak wodny były widoczne */}
      <div className="relative h-[75vh] md:h-[85vh] min-h-[400px] overflow-hidden bg-slate-950">
        {recommendation?.isActive && (
          <DishRecommendationBadge type={recommendation.type} menuLocale={menuLocale} />
        )}
        <WatermarkWrapper show={!!showWatermark} className="relative h-full">
          <>
            <img src={dish.imageUrl} alt={copy.name} className="w-full h-full object-cover object-center scale-150" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <button 
            onClick={onBack}
            type="button"
            className="absolute top-6 start-6 p-3 bg-white/90 backdrop-blur-xl rounded-2xl text-slate-900 shadow-xl hover:scale-105 transition-transform"
          >
            <ChevronLeft size={24} className={isRtl ? 'scale-x-[-1]' : undefined} aria-hidden />
          </button>

            <div className="absolute bottom-8 start-8 end-8 text-white">
              <h1 className="text-4xl md:text-6xl font-serif italic mb-2 tracking-tight">{copy.name}</h1>
            </div>
          </>
        </WatermarkWrapper>
      </div>

      {shareUrl && (
        <div className="max-w-2xl mx-auto px-6 pt-4 flex justify-end">
          <ShareLinkButton
            url={shareUrl}
            title={shareTitle || copy.name}
            text={shareText || copy.name}
            menuLocale={menuLocale}
            variant="pill"
          />
        </div>
      )}

      {/* Content Section – zwarty blok, żeby nie zasłaniał zdjęcia */}
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Alergeny (zamienione z sekcją "O daniu") */}
        <div className="space-y-3 bg-amber-50/60 border border-amber-100 rounded-2xl p-4">
          <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] flex items-center gap-2">
            <UtensilsCrossed size={14} className="text-amber-600" /> {allergensUi.sectionTitle}
          </h2>
          <div className="flex flex-wrap gap-2">
            {allergensUi.labels.length > 0 ? (
              allergensUi.labels.map((a, i) => (
                <span
                  key={`${dish.id}-allergen-${i}`}
                  className="bg-amber-50 text-amber-900 px-4 py-2 rounded-xl text-xs font-black uppercase border border-amber-100"
                >
                  {a}
                </span>
              ))
            ) : (
              <span className="text-slate-400 text-sm font-medium">{allergensUi.noAllergensMessage}</span>
            )}
          </div>
        </div>

        <DishDietaryBadges
          dietaryTags={dish.dietaryTags}
          spiceLevel={dish.spiceLevel}
          size="md"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Ingredients */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2">
              <Utensils size={14} className="text-amber-500" /> {getPublicIngredientsSectionTitle(menuLocale)}
            </h3>
            <ul className="space-y-2">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-600 font-bold border-b border-slate-50 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          {/* O daniu (zamienione z sekcją "Alergeny") */}
          <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2">
              <Info size={14} className="text-amber-500" /> O daniu
            </h3>
            <p className="text-base text-slate-700 leading-relaxed font-medium">
              {copy.description}
            </p>
          </div>
        </div>

        {recommendation?.isActive && (
          <DishRecommendationBox
            recommendation={recommendation}
            dishName={copy.name}
            menuLocale={menuLocale}
            translationCache={recTranslationCache}
          />
        )}

        {dish.videoUrl && (
          <SocialLinkButton
            href={dish.videoUrl}
            wrapperClassName="pt-4 border-t border-slate-100"
          />
        )}
      </div>

      {/* Footer Branding */}
      <footer className="py-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 opacity-20 grayscale">
          <img src={BRAND_LOGO_SRC} alt="" width={28} height={28} className="h-7 w-7 rounded-md object-cover" />
          <div className="leading-none">
            <h2 className="text-xl font-black italic tracking-tighter">Chefvision</h2>
            <span className="mt-1 block text-right text-[9px] font-black uppercase tracking-[0.2em] text-black">BETA</span>
          </div>
        </div>
        <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.4em]">Professional Digital Menu</p>
      </footer>
    </div>
  );
};
