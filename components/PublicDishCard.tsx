
import React from 'react';
import { Dish } from '../types';
import { Youtube, AlertTriangle, ChefHat, Info } from 'lucide-react';

interface Props {
  dish: Dish;
  /** Hash bazowy menu publicznego, np. #/public-menu */
  baseHash?: string;
}

export const PublicDishCard: React.FC<Props> = ({ dish, baseHash = '#/public-menu' }) => {
  const openDetail = () => {
    window.location.hash = `${baseHash}/dish/${dish.id}`;
  };

  return (
    <div 
      onClick={openDetail}
      className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 max-w-sm mx-auto transition-all hover:scale-[1.02] cursor-pointer group"
    >
      {/* Hero Image */}
      <div className="relative h-64 overflow-hidden">
        <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-slate-800 shadow-sm border border-slate-100">
          Chef Signature
        </div>
      </div>

      <div className="p-6">
        <h3 className="font-serif text-2xl text-slate-900 mb-2 leading-tight">{dish.name}</h3>
        <p className="text-slate-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {dish.description}
        </p>

        {/* Ingredients & Allergens */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {dish.ingredients.slice(0, 4).map((ing, i) => (
              <span key={i} className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md capitalize">
                {ing}
              </span>
            ))}
            {dish.ingredients.length > 4 && <span className="text-[11px] text-slate-400">+{dish.ingredients.length - 4} więcej</span>}
          </div>

          <div className="bg-red-50 p-3 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Alergeny</p>
              <p className="text-xs text-red-600">
                {dish.allergens.length > 0 ? dish.allergens.join(', ') : 'Brak głównych alergenów'}
              </p>
            </div>
          </div>
        </div>

        {/* Technical/Video Section (Interactive) */}
        <div className="grid grid-cols-2 gap-3">
          {dish.videoUrl && (
            <a
              href={dish.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              <Youtube size={16} className="text-red-500" />
              Video Recipe
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
      </div>
    </div>
  );
};
