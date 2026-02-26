
import React, { useMemo } from 'react';
import { Dish } from '../types';
import { BarChart3, PieChart, Users, TrendingUp, Eye } from 'lucide-react';

interface Props {
  dishes: Dish[];
}

export const Insights: React.FC<Props> = ({ dishes }) => {
  const totalClicks = useMemo(
    () => dishes.reduce((sum, d) => sum + (d.clicks ?? 0), 0),
    [dishes]
  );

  const topDishes = useMemo(() => {
    if (dishes.length === 0) return [];
    // Sortujemy wszystkie dania malejąco po liczbie kliknięć
    return [...dishes].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
  }, [dishes]);

  const maxClicks = useMemo(() => {
    const values = dishes.map(d => d.clicks ?? 0);
    const max = Math.max(0, ...values);
    return max === 0 ? 1 : max;
  }, [dishes]);

  const allergenCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dishes.forEach(d => {
      d.allergens.forEach(a => {
        counts[a] = (counts[a] || 0) + 1;
      });
    });
    return counts;
  }, [dishes]);

  return (
    <div className="space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Odsłony Menu', value: '—', icon: Eye, color: 'indigo' },
            { label: 'Kliknięcia Dań', value: totalClicks.toLocaleString(), icon: TrendingUp, color: 'green' },
            { label: 'Skanowania QR', value: '—', icon: Users, color: 'amber' },
            { label: 'Ratio Konwersji', value: '—', icon: BarChart3, color: 'purple' },
          ].map(stat => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className={`p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl w-fit mb-4`}>
              <stat.icon size={20} />
            </div>
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Popularity Chart */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <TrendingUp size={24} className="text-green-500" /> Najczęściej Wybierane
          </h3>
          <div className="space-y-4">
            {topDishes.map(dish => (
              <div key={dish.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">{dish.name}</span>
                  <span className="text-slate-400">{dish.clicks ?? 0}</span>
                </div>
                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000"
                    style={{ width: `${((dish.clicks ?? 0) / maxClicks) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {topDishes.length === 0 && (
              <p className="text-slate-400 text-sm italic">Brak danych o kliknięciach dań.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
