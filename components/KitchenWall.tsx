
import React, { useState } from 'react';
import { Dish, DishStatus } from '../types';
import { Search, CheckCircle2, Clock, AlertTriangle, Download, Trash2 } from 'lucide-react';

interface Props {
  dishes: Dish[];
  onApprove: (id: string) => void;
  onOpenTraining: (dish: Dish) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  selectedId: string | null;
}

export const KitchenWall: React.FC<Props> = ({ dishes, onApprove, onOpenTraining, onSelect, onDelete, selectedId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const filteredDishes = dishes.filter(d => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = d.name.toLowerCase().includes(query) || 
                          d.ingredients.some(i => i.toLowerCase().includes(query)) ||
                          d.allergens.some(a => a.toLowerCase().includes(query));
    
    const matchesFilter = filter === 'all' || 
                         (filter === 'approved' && d.status === DishStatus.APPROVED) ||
                         (filter === 'pending' && d.status === DishStatus.PENDING);
    return matchesSearch && matchesFilter;
  });

  const handleDownload = (e: React.MouseEvent, imageUrl: string, name: string) => {
    e.stopPropagation(); // Zapobiegamy otwarciu panelu edycji przy kliknięciu w pobieranie
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${name.replace(/\s+/g, '_')}_Chefvision.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Quick Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-[450px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Szukaj dania lub składnika..." 
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-chef-gold/10 bg-white text-sm font-medium shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
          {(['all', 'approved', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f === 'all' ? 'Wszystkie' : f === 'approved' ? 'Standardy' : 'Oczekujące'}
            </button>
          ))}
        </div>
      </div>

      {/* Dishes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredDishes.map(dish => (
          <div 
            key={dish.id} 
            onClick={() => onSelect(dish.id)}
            className={`group bg-white rounded-[32px] overflow-hidden border-2 transition-all cursor-pointer flex flex-col ${selectedId === dish.id ? 'border-chef-gold ring-4 ring-chef-gold/10 shadow-2xl' : 'border-white hover:border-slate-200 shadow-md hover:shadow-xl'}`}
          >
            {/* Image Container */}
            <div className="relative h-72 overflow-hidden bg-slate-100">
              <img 
                src={dish.imageUrl} 
                className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700 ease-in-out" 
                alt={dish.name}
              />
              
              {/* Action Overlays */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {/* Status Indicator */}
                {dish.status === DishStatus.APPROVED ? (
                  <div className="bg-green-500/90 backdrop-blur-sm text-white p-2.5 rounded-2xl shadow-xl border border-white/20" title="Zatwierdzony Standard">
                    <CheckCircle2 size={18} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="bg-chef-gold/90 backdrop-blur-sm text-white p-2.5 rounded-2xl shadow-xl border border-white/20 animate-pulse" title="Oczekuje na akceptację">
                    <Clock size={18} strokeWidth={3} />
                  </div>
                )}

                {/* Download Button */}
                <button 
                  onClick={(e) => handleDownload(e, dish.imageUrl, dish.name)}
                  className="bg-chef-dark/60 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-xl border border-white/10 hover:bg-chef-gold transition-all hover:scale-110 active:scale-95"
                  title="Pobierz zdjęcie na urządzenie"
                >
                  <Download size={18} strokeWidth={3} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(dish.id);
                  }}
                  className="bg-red-600/85 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-xl border border-white/10 hover:bg-red-600 transition-all hover:scale-110 active:scale-95"
                  title="Usuń zdjęcie"
                >
                  <Trash2 size={18} strokeWidth={3} />
                </button>
              </div>
              
              {/* Overlay for pending status text */}
              {dish.status === DishStatus.PENDING && (
                <div className="absolute bottom-4 left-4">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/10">
                    Wymaga akceptacji
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-serif italic text-lg text-slate-800 mb-1 truncate leading-tight">{dish.name}</h4>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {dish.allergens.slice(0, 3).map(a => (
                    <span key={a} className="text-[8px] bg-red-50 text-red-500 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter border border-red-100">
                      {a}
                    </span>
                  ))}
                  {dish.allergens.length > 3 && <span className="text-[8px] text-slate-400 font-bold">+{dish.allergens.length - 3}</span>}
                </div>
              </div>

              <div className="mt-2">
                {dish.status === DishStatus.PENDING ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onApprove(dish.id); }}
                    className="w-full bg-slate-900 text-white py-3 rounded-2xl text-[11px] font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                  >
                    <CheckCircle2 size={14} /> ZATWIERDŹ STANDARD
                  </button>
                ) : (
                  <div className="w-full bg-green-50 text-green-700 py-3 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 border border-green-100">
                    <CheckCircle2 size={14} /> ZATWIERDZONE
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredDishes.length === 0 && (
          <div className="col-span-full py-24 text-center space-y-4 bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm">
              <AlertTriangle className="text-slate-200" size={40} />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">Brak wyników</p>
              <p className="text-slate-300 text-xs font-medium">Spróbuj zmienić filtry lub wyszukiwaną frazę</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
