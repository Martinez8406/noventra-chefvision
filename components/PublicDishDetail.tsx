
import React from 'react';
import { Dish } from '../types';
import { Youtube, ChevronLeft, AlertCircle, Utensils, Info } from 'lucide-react';

interface Props {
  dish: Dish;
  onBack: () => void;
}

export const PublicDishDetail: React.FC<Props> = ({ dish, onBack }) => {
  return (
    <div className="min-h-screen bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Image Section */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-3 bg-white/90 backdrop-blur-xl rounded-2xl text-slate-900 shadow-xl hover:scale-105 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
              Chef Signature
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif italic mb-2 tracking-tight">{dish.name}</h1>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <div className="space-y-6">
          <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2">
            <Info size={14} className="text-amber-500" /> O daniu
          </h2>
          <p className="text-xl text-slate-700 leading-relaxed font-medium">
            {dish.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Ingredients */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2">
              <Utensils size={14} className="text-amber-500" /> Składniki
            </h3>
            <ul className="space-y-3">
              {dish.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-600 font-bold border-b border-slate-50 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          {/* Allergens */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-2 text-red-500">
              <AlertCircle size={14} /> Alergeny
            </h3>
            <div className="flex flex-wrap gap-2">
              {dish.allergens.length > 0 ? dish.allergens.map(a => (
                <span key={a} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase border border-red-100">
                  {a}
                </span>
              )) : (
                <span className="text-slate-400 text-sm font-medium">Brak głównych alergenów</span>
              )}
            </div>
          </div>
        </div>

        {/* Video Section */}
        {dish.videoUrl && (
          <div className="pt-12 border-t border-slate-100">
            <a 
              href={dish.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-8 bg-slate-950 rounded-[40px] text-white hover:scale-[1.01] transition-all group shadow-2xl shadow-indigo-500/10"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <Youtube size={32} />
                </div>
                <div>
                  <h4 className="text-2xl font-black italic">Video Recipe</h4>
                  <p className="text-slate-400 text-sm font-medium tracking-tight">Zobacz proces powstawania dania</p>
                </div>
              </div>
              <ChevronLeft size={32} className="rotate-180 opacity-40 group-hover:translate-x-2 transition-transform" />
            </a>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="py-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 opacity-20 grayscale">
          <Utensils size={24} />
          <h2 className="text-xl font-black italic tracking-tighter">Chefvision</h2>
        </div>
        <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.4em]">Professional Digital Menu</p>
      </footer>
    </div>
  );
};
