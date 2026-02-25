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
}

/**
 * Publiczny widok menu dla gości – bez logowania.
 * Wyświetla listę dań (isOnline) lub szczegóły dania.
 * Link: /menu/[userId] (path) lub #/menu/[userId] (hash)
 */
export const PublicMenu: React.FC<Props> = ({ dishes, dishId, userId, usePathRouting, onPathChange, showWatermark }) => {
  const menuBasePath = `/menu/${userId}`;
  const menuBaseHash = `#/menu/${userId}`;

  const userDishes = dishes.filter(
    (d) => d.restaurantId === userId || d.authorId === userId
  ).filter((d) => d.isOnline);

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
        <PublicDishDetail
          dish={dish}
          onBack={goBack}
          showWatermark={showWatermark}
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
        {userDishes.map((dish) => (
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
      </main>
    </div>
  );
};
