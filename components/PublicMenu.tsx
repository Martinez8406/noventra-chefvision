import React from 'react';
import { Dish } from '../types';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';

const PUBLIC_MENU_HASH = '#/public-menu';

interface Props {
  dishes: Dish[];
  dishId: string | null;
}

/**
 * Publiczny widok menu dla gości – bez logowania.
 * Wyświetla listę dań (isOnline) lub szczegóły dania.
 */
export const PublicMenu: React.FC<Props> = ({ dishes, dishId }) => {
  if (dishId) {
    const dish = dishes.find(d => d.id === dishId);
    if (dish && dish.isOnline) {
      return (
        <PublicDishDetail
          dish={dish}
          onBack={() => { window.location.hash = PUBLIC_MENU_HASH; }}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-50 py-8 px-6 text-center border-b border-slate-100">
        <h1 className="font-serif italic text-4xl text-slate-900">Karta Menu</h1>
      </header>
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {dishes.map(dish => (
          <PublicDishCard key={dish.id} dish={dish} baseHash={PUBLIC_MENU_HASH} />
        ))}
      </main>
    </div>
  );
};
