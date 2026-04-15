import React, { useState, useEffect } from 'react';
import { Dish } from '../types';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';
import { supabase } from '../services/supabaseService';
import { MENU_CATEGORIES } from '../constants';

interface Props {
  dishes: Dish[];
  dishId: string | null;
  userId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
  loading?: boolean;
}

const CATEGORY_ORDER = [...MENU_CATEGORIES];

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
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [showReviewTooltip, setShowReviewTooltip] = useState(false);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from('profiles')
      .select('logo_url, cover_url, primary_color, secondary_color, font_family, restaurant_name, google_place_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
        if (data?.cover_url) setCoverUrl(data.cover_url);
        if (data?.primary_color) setPrimaryColor(data.primary_color);
        if (data?.secondary_color) setSecondaryColor(data.secondary_color);
        if (data?.font_family) setFontFamily(data.font_family);
        if (data?.restaurant_name) setRestaurantName(data.restaurant_name);
        setGooglePlaceId(data?.google_place_id?.trim() || null);
      });
  }, [userId]);

  useEffect(() => {
    if (!googlePlaceId) {
      setShowReviewTooltip(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setShowReviewTooltip(true);
    }, 5000);
    const hideTimer = window.setTimeout(() => {
      setShowReviewTooltip(false);
    }, 11000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [googlePlaceId]);

  const userDishes = dishes.filter((d) => d.isOnline);
  const hasGoogleReviews = !!googlePlaceId;
  const reviewUrl = hasGoogleReviews
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId!)}`
    : '';
  const restaurantTitle = restaurantName?.trim() || 'Nasza restauracja';

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
        <>
          <PublicDishDetail dish={dish} onBack={goBack} showWatermark={showWatermark} fontFamily={fontFamily} />
          {hasGoogleReviews && (
            <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2">
              {showReviewTooltip && (
                <div className="bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-slate-200 whitespace-nowrap">
                  Pomóż nam się rozwijać! 20 sek
                </div>
              )}
              <button
                type="button"
                onClick={() => window.open(reviewUrl, '_blank', 'noopener,noreferrer')}
                className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
                style={{ backgroundColor: '#4285F4' }}
              >
                ⭐ Oceń nas
              </button>
            </div>
          )}
        </>
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
    <div className="min-h-screen pb-20 px-4 sm:px-6" style={{ backgroundColor: secondaryColor, fontFamily }}>
      <div className="max-w-6xl mx-auto pt-5 sm:pt-7">
        {/* HERO + tożsamość restauracji pod zdjęciem */}
        <section className="relative">
          <div className="relative h-56 sm:h-72 lg:h-80 rounded-[30px] overflow-hidden shadow-2xl border border-black/5">
            {coverUrl ? (
              <>
                <img
                  src={coverUrl}
                  alt="Cover menu"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.5) 100%)' }}
                />
              </>
            ) : (
              <div
                className="w-full h-full"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}
              />
            )}
          </div>

          <div className="-mt-14 sm:-mt-16 px-2 sm:px-6 relative z-10">
            <div className="flex items-end gap-4 sm:gap-5">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-white border-4 border-white shadow-xl overflow-hidden shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo restauracji"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xl font-black">
                    {restaurantTitle.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 pb-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight drop-shadow-sm">
                  {restaurantTitle}
                </h1>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main className="max-w-6xl mx-auto pt-10 sm:pt-12 space-y-14">
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

      {hasGoogleReviews && (
        <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2">
          {showReviewTooltip && (
            <div className="bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-slate-200 whitespace-nowrap">
              Pomóż nam się rozwijać! 20 sek
            </div>
          )}
          <button
            type="button"
            onClick={() => window.open(reviewUrl, '_blank', 'noopener,noreferrer')}
            className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
            style={{ backgroundColor: '#4285F4' }}
          >
            ⭐ Oceń nas
          </button>
        </div>
      )}
    </div>
  );
};
