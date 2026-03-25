import React, { useState, useEffect } from 'react';
import { Dish } from '../types';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';
import { supabase } from '../services/supabaseService';

interface Props {
  dishes: Dish[];
  dishId: string | null;
  userId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
  loading?: boolean;
}

const CATEGORY_ORDER = ['Przystawka', 'Zupy', 'Sałatki', 'Dania główne', 'Desery', 'Napoje', 'Inne'];

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

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from('profiles')
      .select('logo_url, cover_url, primary_color, secondary_color, font_family, restaurant_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
        if (data?.cover_url) setCoverUrl(data.cover_url);
        if (data?.primary_color) setPrimaryColor(data.primary_color);
        if (data?.secondary_color) setSecondaryColor(data.secondary_color);
        if (data?.font_family) setFontFamily(data.font_family);
        if (data?.restaurant_name) setRestaurantName(data.restaurant_name);
      });
  }, [userId]);

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
        <PublicDishDetail dish={dish} onBack={goBack} showWatermark={showWatermark} fontFamily={fontFamily} />
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: secondaryColor, fontFamily }}>
      {/* HERO – widoczny tylko gdy jest cover */}
      {coverUrl ? (
        <div className="relative w-full h-56 sm:h-72 overflow-hidden">
          <img
            src={coverUrl}
            alt="Cover menu"
            className="w-full h-full object-cover"
          />
          {/* Ciemny overlay */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
          {/* Treść na środku */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white text-center px-6">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo restauracji"
                className="h-36 object-contain drop-shadow-lg"
              />
            )}
            {restaurantName && (
              <h1 className="font-serif italic text-4xl sm:text-5xl drop-shadow-lg">{restaurantName}</h1>
            )}
          </div>
        </div>
      ) : (
        /* Sticky header gdy brak cover */
        <header
          className="backdrop-blur-xl sticky top-0 z-50 py-8 px-6 text-center border-b border-black/10"
          style={{ backgroundColor: primaryColor }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo restauracji"
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          {restaurantName && (
            <h1 className="font-serif italic text-3xl" style={{ color: secondaryColor }}>{restaurantName}</h1>
          )}
        </header>
      )}

      <main className="max-w-7xl mx-auto px-6 pt-8 mt-6 space-y-14">
        {/* Stan ładowania */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-10 h-10 border-4 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: primaryColor }} />
            <p className="text-slate-400 text-sm font-medium tracking-wide">Ładowanie menu…</p>
          </div>
        )}

        {!loading && orderedKeys.map((category) => (
          <section key={category}>
            {/* Nagłówek kategorii */}
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xs font-black tracking-[0.25em] uppercase whitespace-nowrap" style={{ color: primaryColor }}>
                {category}
              </h2>
              <div className="flex-1 h-px" style={{ backgroundColor: primaryColor, opacity: 0.25 }} />
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

        {!loading && userDishes.length > 0 && (
          <p className="text-slate-400 text-xs text-center mt-6 pb-2 px-2">
            W naszej kuchni stawiamy na świeże składniki, dlatego każde podane danie jest unikalne i może
            nieznacznie różnić się od tego na zdjęciu
          </p>
        )}
      </main>
    </div>
  );
};
