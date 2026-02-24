
import React, { useState } from 'react';
import { Dish } from '../types';
import { Youtube, Eye, EyeOff, ExternalLink, QrCode, Trash2, Edit } from 'lucide-react';

interface Props {
  dishes: Dish[];
  onToggleOnline: (id: string) => void;
  onUpdateVideo: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  menuUserId: string | null;
}

export const MenuManager: React.FC<Props> = ({ dishes, onToggleOnline, onUpdateVideo, onDelete, onSelect, menuUserId }) => {
  const [justToggledId, setJustToggledId] = useState<string | null>(null);

  const handleToggleClick = (id: string) => {
    onToggleOnline(id);
    setJustToggledId(id);
    setTimeout(() => setJustToggledId(null), 400);
  };
  const getBaseUrl = () => `${window.location.origin}${(window.location.pathname || '/').replace(/\/+$/, '') || ''}`;
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
              <th className="px-8 py-4">Produkt</th>
              <th className="px-8 py-4">Status Online</th>
              <th className="px-8 py-4">Video Link (YT)</th>
              <th className="px-8 py-4">Popularność</th>
              <th className="px-8 py-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dishes.map(dish => (
              <tr key={dish.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-4">
                    <img src={dish.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
                    <span className="font-bold text-slate-800">{dish.name}</span>
                  </div>
                </td>
                <td className="px-8 py-4">
                  <button 
                    onClick={() => handleToggleClick(dish.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all duration-200 ${justToggledId === dish.id ? 'ring-2 ring-green-500 ring-offset-2 scale-105' : ''} ${dish.isOnline ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {dish.isOnline ? <Eye size={14} /> : <EyeOff size={14} />}
                    {dish.isOnline ? 'Widoczne' : 'Ukryte'}
                  </button>
                </td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2 group">
                    <div className="relative flex-1 max-w-[200px]">
                      <Youtube className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500" size={16} />
                      <input 
                        type="text" 
                        value={dish.videoUrl || ''} 
                        onChange={(e) => onUpdateVideo(dish.id, e.target.value)}
                        placeholder="Link do YouTube..."
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-100 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (dish.clicks / 500) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400">{dish.clicks}</span>
                  </div>
                </td>
                <td className="px-8 py-4 text-right">
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
                        if (confirm('Czy na pewno chcesz usunąć to danie?')) {
                          onDelete(dish.id);
                        }
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
                <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
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
