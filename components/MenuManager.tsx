
import React, { useState } from 'react';
import { Dish } from '../types';
import { Link2, Eye, EyeOff, ExternalLink, QrCode, Trash2, Edit } from 'lucide-react';

const CATEGORIES = ['Przystawka', 'Zupy', 'Sałatki', 'Dania główne', 'Desery', 'Napoje', 'Inne'] as const;

interface Props {
  dishes: Dish[];
  onToggleOnline: (id: string) => void;
  onUpdateVideo: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdatePrice: (id: string, price: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  menuUserId: string | null;
}

export const MenuManager: React.FC<Props> = ({
  dishes,
  onToggleOnline,
  onUpdateVideo,
  onDelete,
  onSelect,
  onUpdatePrice,
  onUpdateCategory,
  menuUserId,
}) => {
  const [justToggledId, setJustToggledId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState<string>('');

  const handleToggleClick = (id: string) => {
    onToggleOnline(id);
    setJustToggledId(id);
    setTimeout(() => setJustToggledId(null), 400);
  };

  const beginEditPrice = (dish: Dish) => {
    setEditingPriceId(dish.id);
    setDraftPrice(dish.menuPrice || '');
  };

  const commitPrice = (dishId: string) => {
    onUpdatePrice(dishId, draftPrice);
    setEditingPriceId(null);
    setDraftPrice('');
  };

  const getBaseUrl = () =>
    `${window.location.origin}${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`;
  const menuUrl = menuUserId ? `${getBaseUrl()}/#/menu/${menuUserId}` : '';

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Zarządzanie Menu Cyfrowym</h2>
          <p className="text-slate-500 text-sm">Decyduj co widzą Twoi goście w czasie rzeczywistym</p>
        </div>
        <button
          onClick={() => window.open(menuUrl, '_blank')}
          disabled={!menuUserId}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode size={18} /> Podgląd Menu Live
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Produkt</th>
              <th className="px-6 py-4">Kategoria</th>
              <th className="px-6 py-4">Status Online</th>
              <th className="px-6 py-4">Cena</th>
              <th className="px-6 py-4">Social Link</th>
              <th className="px-6 py-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dishes.map((dish) => (
              <tr key={dish.id} className="hover:bg-slate-50/50 transition-colors">

                {/* Produkt */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={dish.imageUrl}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-100 shrink-0"
                      alt={dish.name}
                    />
                    <span className="font-bold text-slate-800 text-sm leading-tight">{dish.name}</span>
                  </div>
                </td>

                {/* Kategoria */}
                <td className="px-6 py-4">
                  <select
                    value={dish.category || ''}
                    onChange={(e) => onUpdateCategory(dish.id, e.target.value || null)}
                    className="w-36 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">— brak —</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>

                {/* Status Online */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleClick(dish.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-200
                      ${justToggledId === dish.id ? 'ring-2 ring-green-500 ring-offset-2 scale-105' : ''}
                      ${dish.isOnline
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {dish.isOnline ? <Eye size={14} /> : <EyeOff size={14} />}
                    {dish.isOnline ? 'Widoczne' : 'Ukryte'}
                  </button>
                </td>

                {/* Cena – inline edit */}
                <td className="px-6 py-4">
                  {editingPriceId === dish.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(e.target.value)}
                      onBlur={() => commitPrice(dish.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitPrice(dish.id);
                        else if (e.key === 'Escape') { setEditingPriceId(null); setDraftPrice(''); }
                      }}
                      className="w-24 px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-right"
                      placeholder="np. 39"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEditPrice(dish)}
                      className="inline-flex items-center justify-end gap-1 min-w-[3.5rem] text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      {dish.menuPrice
                        ? <span className="tabular-nums">{dish.menuPrice} zł</span>
                        : <span className="text-slate-400 italic">Dodaj cenę</span>}
                    </button>
                  )}
                </td>

                {/* Social Link */}
                <td className="px-6 py-4">
                  <div className="relative max-w-[220px]">
                    <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={dish.videoUrl || ''}
                      onChange={(e) => onUpdateVideo(dish.id, e.target.value)}
                      placeholder="YT, TikTok, Instagram..."
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-100 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </td>

                {/* Akcje */}
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onSelect(dish.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Edytuj szczegóły"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => menuUrl && window.open(`${menuUrl}/dish/${dish.id}`, '_blank')}
                      disabled={!menuUserId}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Podgląd w menu"
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz usunąć to danie?')) onDelete(dish.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Usuń danie"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {dishes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-medium">
                  Brak dań w menu. Przejdź do Chef's Studio, aby stworzyć pierwsze danie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
