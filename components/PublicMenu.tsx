import React from 'react';
import { Dish } from '../types';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';

interface Props {
  dishes: Dish[];
  dishId: string | null;
  userId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
  loading?: boolean;
}

const CATEGORY_ORDER = ['Przystawka', 'Zupy', 'Dania główne', 'Desery', 'Napoje', 'Inne'];

/**
 * Publiczny widok menu dla gości – bez logowania.
 * Wyświetla listę dań (isOnline) pogrupowanych po kategorii.
 * Link: /menu/[userId] (path) lub #/menu/[userId] (hash)
 */
export const PublicMenu: React.FC<Props> = ({
  dishes,
  dishId,
  userId,
  usePathRouting,
  onPathChange,
  showWatermark,
  loading = false,
}) => {
  const menuBasePath = `/menu/${userId}`;
  const menuBaseHash = `#/menu/${userId}`;

  const userDishes = dishes.filter((d) => d.isOnline);

  const goBack = () => {
    if (usePathRouting) {
      history.pushState({}, '', menuBasePath);
      onPathChange?.();
    } else {
      window.location.hash = menuBaseHash;
    }
  };

  if (dishId) {
    const dish = userDishes.find((d) => d.id === dishId);
    if (dish) {
      return (
        <PublicDishDetail dish={dish} onBack={goBack} showWatermark={showWatermark} />
      );
    }
  }

  // Grupowanie dań po kategorii; brak kategorii → "Inne"
  const groups: Record<string, Dish[]> = {};
  for (const dish of userDishes) {
    const key =
      dish.category && dish.category.trim() ? dish.category.trim() : 'Inne';
    if (!groups[key]) groups[key] = [];
    groups[key].push(dish);
  }

  // Sekcje w ustalonej kolejności; dodatkowe kategorie (spoza listy) na końcu
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((c) => groups[c]?.length),
    ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c) && groups[c]?.length),
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-50 py-8 px-6 text-center border-b border-slate-100">
        <h1 className="font-serif italic text-4xl text-slate-900">Karta Menu</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-14">
        {/* Stan ładowania */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-medium tracking-wide">Ładowanie menu…</p>
          </div>
        )}

        {!loading && orderedKeys.map((category) => (
          <section key={category}>
            {/* Nagłówek kategorii */}
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xs font-black tracking-[0.25em] uppercase text-slate-400 whitespace-nowrap">
                {category}
              </h2>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Siatka kart */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {groups[category].map((dish) => (
                <PublicDishCard
                  key={dish.id}
                  dish={dish}
                  basePath={menuBasePath}
                  baseHash={menuBaseHash}
                  usePathRouting={!!usePathRouting}
                  onPathChange={onPathChange}
                  showWatermark={showWatermark}
                />
              ))}
            </div>
          </section>
        ))}

        {!loading && userDishes.length === 0 && (
          <p className="text-center text-slate-400 py-24 font-medium">
            Menu jest puste – zajrzyj tu wkrótce!
          </p>
        )}
      </main>
    </div>
  );
};
