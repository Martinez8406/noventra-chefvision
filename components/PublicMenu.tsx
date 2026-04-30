import React, { useState, useEffect } from 'react';
import { Dish, PublicMenuLocale } from '../types';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';
import { MenuLanguageSwitcher } from './MenuLanguageSwitcher';
import { supabase } from '../services/supabaseService';
import { MENU_CATEGORIES } from '../constants';
import { getPublicMenuCategoryDisplay } from '../utils/menuTranslations';

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

const MENU_LOCALE_KEY = (uid: string) => `chefvision_public_menu_locale:${uid}`;

const isPublicLocale = (v: string): v is PublicMenuLocale =>
  v === 'pl' ||
  v === 'en' ||
  v === 'uk' ||
  v === 'de' ||
  v === 'es' ||
  v === 'it' ||
  v === 'ko' ||
  v === 'fr' ||
  v === 'zh';

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
  const CATEGORY_TRANSLATIONS_KEY = (uid: string) => `chefvision_public_category_translations:${uid}`;
  const normalizeCategoryKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

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
  const [menuLocale, setMenuLocale] = useState<PublicMenuLocale>('pl');
  const [customCategoryTranslations, setCustomCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});
  const [profileMenuCategories, setProfileMenuCategories] = useState<string[]>([]);
  const [profileCategoryTranslations, setProfileCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});

  // Track in-flight category translation requests to avoid duplicates
  const [inFlightKeys, setInFlightKeys] = useState<Record<string, true>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MENU_LOCALE_KEY(userId));
      if (raw && isPublicLocale(raw)) setMenuLocale(raw);
      else setMenuLocale('pl');
    } catch {
      setMenuLocale('pl');
    }
  }, [userId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CATEGORY_TRANSLATIONS_KEY(userId));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        setCustomCategoryTranslations(parsed);
      } else {
        setCustomCategoryTranslations({});
      }
    } catch {
      setCustomCategoryTranslations({});
    }
    setInFlightKeys({});
  }, [userId]);

  const persistMenuLocale = (locale: PublicMenuLocale) => {
    setMenuLocale(locale);
    try {
      localStorage.setItem(MENU_LOCALE_KEY(userId), locale);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from('profiles')
      .select('logo_url, cover_url, primary_color, secondary_color, font_family, restaurant_name, google_place_id, menu_categories, menu_category_translations')
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
        if (Array.isArray((data as any)?.menu_categories)) {
          const list = (data as any).menu_categories.map((x: any) => String(x).trim()).filter(Boolean);
          setProfileMenuCategories(list);
        } else {
          setProfileMenuCategories([]);
        }
        const tr = (data as any)?.menu_category_translations;
        if (tr && typeof tr === 'object') {
          setProfileCategoryTranslations(tr);
        } else {
          setProfileCategoryTranslations({});
        }
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

  const decodeRouteParam = (value: string | null): string | null => {
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  // Grupowanie dań po kategorii; brak kategorii -> "Inne"
  const groups: Record<string, Dish[]> = {};
  for (const dish of userDishes) {
    const key =
      dish.category && dish.category.trim() ? dish.category.trim() : 'Inne';
    if (!groups[key]) groups[key] = [];
    groups[key].push(dish);
  }

  const categoryOrder = profileMenuCategories.length > 0 ? profileMenuCategories : CATEGORY_ORDER;

  // Sekcje w ustalonej kolejności; dodatkowe kategorie (spoza listy) na końcu
  const orderedKeys = [
    ...categoryOrder.filter((c) => groups[c]?.length),
    ...Object.keys(groups).filter((c) => !categoryOrder.includes(c) && groups[c]?.length),
  ];

  // Pre-translate custom categories (not covered by our static map) and cache in localStorage.
  // This runs even in PL so that switching language later is instant.
  useEffect(() => {
    const missing = orderedKeys
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((category) => {
        const mappedEn = getPublicMenuCategoryDisplay(category, 'en');
        if (mappedEn !== category) return false; // covered by static map (standard categories)
        const key = normalizeCategoryKey(category);
        const cached = customCategoryTranslations[key];
        const hasAll =
          !!cached?.en?.trim() &&
          !!cached?.uk?.trim() &&
          !!cached?.de?.trim() &&
          !!cached?.es?.trim() &&
          !!cached?.it?.trim() &&
          !!cached?.ko?.trim() &&
          !!cached?.fr?.trim() &&
          !!cached?.zh?.trim();
        if (hasAll) return false;
        const inflight = inFlightKeys[key];
        return !inflight;
      });

    if (missing.length === 0) return;

    // Translate in small batches (endpoint is single-text; keep it light)
    missing.slice(0, 5).forEach((category) => {
      const key = normalizeCategoryKey(category);
      setInFlightKeys((prev) => ({ ...prev, [key]: true }));
      fetch('/api/translate-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: category }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
          return data;
        })
        .then((data) => {
          const tr = data?.translations;
          if (!tr || typeof tr !== 'object') return;
          setCustomCategoryTranslations((prev) => {
            const next = { ...prev };
            const existing = next[key] || {};
            next[key] = {
              ...existing,
              en: tr.en,
              uk: tr.uk,
              de: tr.de,
              es: tr.es,
              it: tr.it,
              ko: tr.ko,
              fr: tr.fr,
              zh: tr.zh,
            };
            try {
              localStorage.setItem(CATEGORY_TRANSLATIONS_KEY(userId), JSON.stringify(next));
            } catch {
              /* ignore */
            }
            return next;
          });
        })
        .catch(() => {
          // ignore errors; fallback will keep original category label
        })
        .finally(() => {
          setInFlightKeys((prev) => {
            const { [key]: _, ...rest } = prev;
            return rest;
          });
        });
    });
  }, [orderedKeys.join('|'), userId, customCategoryTranslations, inFlightKeys]);

  if (dishId) {
    const rawDishId = String(dishId).trim();
    const decodedDishId = (decodeRouteParam(dishId) || '').trim();
    const dish = userDishes.find((d) => {
      const rowId = String(d.id || '').trim();
      if (!rowId) return false;
      return (
        rowId === rawDishId ||
        rowId === decodedDishId ||
        encodeURIComponent(rowId) === rawDishId
      );
    });
    if (dish) {
      return (
        <>
          <style>
            {`
            @keyframes googleReviewFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
            }

            .google-review-fab-wrap {
              position: fixed;
              bottom: 24px;
              right: 24px;
              z-index: 120;
            }

            .google-review-fab-tooltip {
              position: absolute;
              right: 0;
              bottom: calc(100% + 10px);
              background: #ffffff;
              color: #3c4043;
              font-weight: 600;
              font-size: 12px;
              padding: 10px 14px;
              border-radius: 14px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.12);
              border: 1px solid rgba(60, 64, 67, 0.12);
              white-space: nowrap;
            }

            .google-review-fab {
              display: inline-flex;
              align-items: center;
              gap: 12px;

              padding: 12px 24px;
              border-radius: 50px;

              background: #ffffff;
              color: #3c4043;
              text-decoration: none;
              font-family: Roboto, "Open Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
              font-weight: 500;

              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              transition: transform 180ms ease, box-shadow 180ms ease;

              animation: googleReviewFloat 3.8s ease-in-out infinite;
            }

            .google-review-fab:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 16px rgba(0,0,0,0.18);
            }

            .google-review-fab:focus-visible {
              outline: none;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(66, 133, 244, 0.25);
            }

            .google-review-fab__icon {
              display: block;
              width: 20px;
              height: 20px;
              flex: 0 0 auto;
            }

            .google-review-fab__text--mobile {
              display: none;
            }

            @media (prefers-reduced-motion: reduce) {
              .google-review-fab {
                animation: none;
              }
            }

            @media (max-width: 600px) {
              .google-review-fab-wrap {
                bottom: 16px;
                right: 16px;
              }

              .google-review-fab {
                padding: 10px 16px;
              }

              .google-review-fab__text--desktop {
                display: none;
              }

              .google-review-fab__text--mobile {
                display: inline;
              }
            }
          `}
          </style>
          <MenuLanguageSwitcher value={menuLocale} onChange={persistMenuLocale} />
          <PublicDishDetail
            dish={dish}
            menuLocale={menuLocale}
            onBack={goBack}
            showWatermark={showWatermark}
            fontFamily={fontFamily}
          />
          {hasGoogleReviews && (
            <div className="google-review-fab-wrap">
              {showReviewTooltip && (
                <div className="google-review-fab-tooltip">Pomóż nam się rozwijać! 20 sek</div>
              )}
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="google-review-fab"
                aria-label="Oceń nas w Google"
              >
                <img
                  className="google-review-fab__icon"
                  src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                  alt="Google"
                  width={20}
                  height={20}
                />
                <span className="google-review-fab__text google-review-fab__text--desktop">
                  Oceń nas w Google
                </span>
                <span className="google-review-fab__text google-review-fab__text--mobile">
                  Oceń nas
                </span>
              </a>
            </div>
          )}
        </>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ backgroundColor: secondaryColor, fontFamily }}>
        <div className="max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-4">
          <p className="text-slate-700 font-semibold">Nie znaleziono dania pod tym adresem.</p>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            Wróć do menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 sm:px-6" style={{ backgroundColor: secondaryColor, fontFamily }}>
      <style>
        {`
          @keyframes googleReviewFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }

          .google-review-fab-wrap {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 120;
          }

          .google-review-fab-tooltip {
            position: absolute;
            right: 0;
            bottom: calc(100% + 10px);
            background: #ffffff;
            color: #3c4043;
            font-weight: 600;
            font-size: 12px;
            padding: 10px 14px;
            border-radius: 14px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.12);
            border: 1px solid rgba(60, 64, 67, 0.12);
            white-space: nowrap;
          }

          .google-review-fab {
            display: inline-flex;
            align-items: center;
            gap: 12px;

            padding: 12px 24px;
            border-radius: 50px;

            background: #ffffff;
            color: #3c4043;
            text-decoration: none;
            font-family: Roboto, "Open Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
            font-weight: 500;

            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: transform 180ms ease, box-shadow 180ms ease;

            animation: googleReviewFloat 3.8s ease-in-out infinite;
          }

          .google-review-fab:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.18);
          }

          .google-review-fab:focus-visible {
            outline: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(66, 133, 244, 0.25);
          }

          .google-review-fab__icon {
            display: block;
            width: 20px;
            height: 20px;
            flex: 0 0 auto;
          }

          .google-review-fab__text--mobile {
            display: none;
          }

          @media (prefers-reduced-motion: reduce) {
            .google-review-fab {
              animation: none;
            }
          }

          @media (max-width: 600px) {
            .google-review-fab-wrap {
              bottom: 16px;
              right: 16px;
            }

            .google-review-fab {
              padding: 10px 16px;
            }

            .google-review-fab__text--desktop {
              display: none;
            }

            .google-review-fab__text--mobile {
              display: inline;
            }
          }
        `}
      </style>
      <MenuLanguageSwitcher value={menuLocale} onChange={persistMenuLocale} />
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
                {(() => {
                  const base = getPublicMenuCategoryDisplay(category, menuLocale);
                  if (menuLocale === 'pl') return base;
                  const key = normalizeCategoryKey(category);

                  // 1) translations persisted in Supabase profiles
                  const fromProfile = Object.entries(profileCategoryTranslations || {}).find(
                    ([k]) => normalizeCategoryKey(String(k)) === key
                  )?.[1]?.[menuLocale];
                  if (typeof fromProfile === 'string' && fromProfile.trim()) return fromProfile;

                  // 2) static map for built-in categories
                  if (base !== category) return base;

                  // 3) local cache / fallback
                  return customCategoryTranslations[key]?.[menuLocale] || category;
                })()}
              </h2>
              <div className="flex-1 h-px" style={{ backgroundColor: primaryColor, opacity: 0.25 }} />
            </div>

            {/* Siatka kart */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {groups[category].map((dish) => (
                <PublicDishCard
                  key={dish.id}
                  dish={dish}
                  menuLocale={menuLocale}
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
        <div className="google-review-fab-wrap">
          {showReviewTooltip && <div className="google-review-fab-tooltip">Pomóż nam się rozwijać! 20 sek</div>}
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="google-review-fab"
            aria-label="Oceń nas w Google"
          >
            <img
              className="google-review-fab__icon"
              src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
              alt="Google"
              width={20}
              height={20}
            />
            <span className="google-review-fab__text google-review-fab__text--desktop">
              Oceń nas w Google
            </span>
            <span className="google-review-fab__text google-review-fab__text--mobile">
              Oceń nas
            </span>
          </a>
        </div>
      )}
    </div>
  );
};
