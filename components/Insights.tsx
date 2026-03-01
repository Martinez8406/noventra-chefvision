
import React from 'react';
import { Dish } from '../types';
// Fix: Added missing 'Eye' icon import
import { BarChart3, PieChart, Users, TrendingUp, Eye } from 'lucide-react';

interface Props {
  dishes: Dish[];
}

export const Insights: React.FC<Props> = ({ dishes }) => {
  const totalClicks = dishes.reduce((sum, d) => sum + d.clicks, 0);
  const allergenCounts: Record<string, number> = {};
  
  dishes.forEach(d => {
    d.allergens.forEach(a => {
      allergenCounts[a] = (allergenCounts[a] || 0) + 1;
    });
  });

  return (
    <div className="space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Odsłony Menu', value: '12,450', icon: Eye, color: 'indigo' },
          { label: 'Kliknięcia Dań', value: totalClicks.toLocaleString(), icon: TrendingUp, color: 'green' },
          { label: 'Skanowania QR', value: '890', icon: Users, color: 'amber' },
          { label: 'Ratio Konwersji', value: '14.2%', icon: BarChart3, color: 'purple' },
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
            {dishes.sort((a,b) => b.clicks - a.clicks).slice(0, 5).map(dish => (
              <div key={dish.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">{dish.name}</span>
                  <span className="text-slate-400">{dish.clicks}</span>
                </div>
                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000"
                    style={{ width: `${(dish.clicks / Math.max(...dishes.map(d => d.clicks))) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allergen Distribution */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <PieChart size={24} className="text-amber-500" /> Mapa Alergenów
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(allergenCounts).map(([name, count]) => (
              <div key={name} className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-[100px]">
                <span className="text-xs font-black uppercase text-slate-400 mb-1">{name}</span>
                <span className="text-xl font-black text-slate-800">{count}</span>
                <span className="text-[10px] text-slate-400">dań</span>
              </div>
            ))}
            {Object.keys(allergenCounts).length === 0 && (
              <p className="text-slate-400 text-sm italic">Brak danych o alergenach.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
