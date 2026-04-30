
import React from 'react';
import { Dish, PublicMenuLocale } from '../types';
import {
  getPublicAllergenDisplay,
  getPublicDishCopy,
  getPublicIngredientsDisplay,
  getPublicIngredientsMoreLabel,
} from '../utils/menuTranslations';
import { Youtube, Instagram, Link2, Music2, Info, UtensilsCrossed } from 'lucide-react';
import { WatermarkWrapper } from './WatermarkWrapper';

interface Props {
  dish: Dish;
  menuLocale?: PublicMenuLocale;
  basePath?: string;
  baseHash?: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
}

const renderSocialIcon = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return <Youtube size={16} className="text-red-500" />;
  }
  if (lower.includes('tiktok.com')) {
    return <Music2 size={16} className="text-slate-50" />;
  }
  if (lower.includes('instagram.com')) {
    return <Instagram size={16} className="text-pink-500" />;
  }
  return <Link2 size={16} className="text-slate-200" />;
};

export const PublicDishCard: React.FC<Props> = ({
  dish,
  menuLocale = 'pl',
  basePath = '/menu/demo',
  baseHash = '#/menu/demo',
  usePathRouting,
  onPathChange,
  showWatermark,
}) => {
  const copy = getPublicDishCopy(dish, menuLocale);
  const allergensUi = getPublicAllergenDisplay(dish, menuLocale);
  const ingredientsUi = getPublicIngredientsDisplay(dish, menuLocale);
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
      className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 max-w-sm mx-auto transition-all hover:scale-[1.02] cursor-pointer group"
    >
      {/* Hero Image */}
      <WatermarkWrapper show={!!showWatermark} className="h-64 overflow-hidden">
        <img
          src={dish.imageUrl}
          alt={copy.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </WatermarkWrapper>

      <div className="p-6">
        {dish.menuPrice ? (
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="font-serif text-2xl text-slate-900 leading-tight">
              {copy.name}
            </h3>
            <div className="flex-1 border-b border-dotted border-slate-200" />
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap tabular-nums">
              {dish.menuPrice} zł
            </span>
          </div>
        ) : (
          <h3 className="font-serif text-2xl text-slate-900 mb-2 leading-tight">
            {copy.name}
          </h3>
        )}
        <p className="text-slate-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {copy.description}
        </p>

        {/* Ingredients & Allergens */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {ingredientsUi.slice(0, 4).map((ing, i) => (
              <span key={i} className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md capitalize">
                {ing}
              </span>
            ))}
            {ingredientsUi.length > 4 && (
              <span className="text-[11px] text-slate-400">{getPublicIngredientsMoreLabel(menuLocale, ingredientsUi.length - 4)}</span>
            )}
          </div>
        </div>

        {/* Social Link + Więcej info */}
        <div className="grid grid-cols-2 gap-3">
          {dish.videoUrl && (
            <a
              href={dish.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              {renderSocialIcon(dish.videoUrl)}
              Social Link
            </a>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); openDetail(); }}
            className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-2xl text-xs font-bold hover:bg-amber-100 transition-colors border border-amber-100"
          >
            <Info size={16} />
            Więcej info
          </button>
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
      </div>
    </div>
  );
};
