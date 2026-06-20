import React, { useState, useEffect } from 'react';
import { Dish, DishRecommendation, HotelHubData, PublicMenuLocale } from '../types';
import { fetchRecommendationsForPublicMenu, recommendationsByDishId } from '../utils/dishRecommendations';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';
import { PublicHotelHub } from './PublicHotelHub';
import { PublicMenuModeTabs } from './PublicMenuModeTabs';
import { MenuLanguageSwitcher } from './MenuLanguageSwitcher';
import { supabase } from '../services/supabaseService';
import { hotelHubDb } from '../services/hotelHubService';
import { MENU_CATEGORIES } from '../constants';
import { getPublicMenuCategoryDisplay, getPublicDishCopy, isRtlMenuLocale } from '../utils/menuTranslations';
import { MenuHeroIdentityPreview } from './MenuHeroIdentityPreview';
import { ShareLinkButton } from './ShareLinkButton';
import { normalizeLogoPosition, normalizeLogoScale } from '../utils/logoFrame';
import { normalizeCoverPosition, normalizeCoverScale } from '../utils/coverFrame';
import { buildPublicMenuUrl, getShareMenuText } from '../utils/publicMenuShare';
import { PublicMenuSkeleton } from './PublicMenuSkeleton';
import { PublicMenuCategoryTabs } from './PublicMenuCategoryTabs';
import { GuestFeedbackSection } from './GuestFeedbackSection';
import {
  fetchRecommendationTranslation,
  loadRecommendationTranslations,
  recommendationCacheReady,
  recommendationNeedsTranslation,
  saveRecommendationTranslations,
  type RecommendationTranslationCache,
} from '../utils/recommendationTranslations';

interface Props {
  dishes: Dish[];
  dishId: string | null;
  userId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  showWatermark?: boolean;
  loading?: boolean;
  /** Aktywna sekcja Hotel Hub z URL (null = home hub) */
  hubSectionId?: string | null;
  /** restaurant | hub — z URL */
  initialMenuMode?: 'restaurant' | 'hub';
}

const CATEGORY_ORDER = [...MENU_CATEGORIES];

const MENU_LOCALE_KEY = (uid: string) => `chefvision_public_menu_locale:${uid}`;

const isPublicLocale = (v: string): v is PublicMenuLocale =>
  v === 'pl' ||
  v === 'en' ||
  v === 'he' ||
  v === 'ar' ||
  v === 'uk' ||
  v === 'de' ||
  v === 'es' ||
  v === 'it' ||
  v === 'ko' ||
  v === 'ja' ||
  v === 'fr' ||
  v === 'cs' ||
  v === 'nl' ||
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
  hubSectionId = null,
  initialMenuMode = 'restaurant',
}) => {
  const CATEGORY_TRANSLATIONS_KEY = (uid: string) => `chefvision_public_category_translations:${uid}`;
  const normalizeCategoryKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const menuBasePath = `/menu/${userId}`;
  const menuBaseHash = `#/menu/${userId}`;

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoObjectPosition, setLogoObjectPosition] = useState<string>('center');
  const [logoScale, setLogoScale] = useState(1);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverObjectPosition, setCoverObjectPosition] = useState<string>('center');
  const [coverScale, setCoverScale] = useState(1);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [showReviewTooltip, setShowReviewTooltip] = useState(false);
  const [menuLocale, setMenuLocale] = useState<PublicMenuLocale>('pl');
  const [recommendations, setRecommendations] = useState<DishRecommendation[]>([]);
  const [recTranslations, setRecTranslations] = useState<Record<string, RecommendationTranslationCache>>({});
  const [customCategoryTranslations, setCustomCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});
  const [profileMenuCategories, setProfileMenuCategories] = useState<string[]>([]);
  const [profileCategoryTranslations, setProfileCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [feedbackAvailable, setFeedbackAvailable] = useState(false);
  const [hotelHubEnabled, setHotelHubEnabled] = useState(false);
  const [hubData, setHubData] = useState<HotelHubData>({
    enabled: false,
    sections: [],
    categories: [],
    assignments: [],
  });
  const [menuMode, setMenuMode] = useState<'restaurant' | 'hub'>(initialMenuMode);
  const [activeHubSectionId, setActiveHubSectionId] = useState<string | null>(hubSectionId);

  useEffect(() => {
    setMenuMode(initialMenuMode);
    setActiveHubSectionId(hubSectionId);
  }, [initialMenuMode, hubSectionId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    hotelHubDb.getHotelHubDataForPublicMenu(userId).then((data) => {
      if (!cancelled) {
        setHubData(data);
        setHotelHubEnabled(data.enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!hotelHubEnabled && menuMode === 'hub') {
      setMenuMode('restaurant');
      setActiveHubSectionId(null);
    }
  }, [hotelHubEnabled, menuMode]);

  // Track in-flight category translation requests to avoid duplicates
  const [inFlightKeys, setInFlightKeys] = useState<Record<string, true>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MENU_LOCALE_KEY(userId));
      if (raw === 'en-us') {
        setMenuLocale('he');
        try {
          localStorage.setItem(MENU_LOCALE_KEY(userId), 'he');
        } catch {
          /* ignore */
        }
      } else if (raw && isPublicLocale(raw)) setMenuLocale(raw);
      else setMenuLocale('pl');
    } catch {
      setMenuLocale('pl');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchRecommendationsForPublicMenu(userId, dishes).then((list) => {
      if (!cancelled) setRecommendations(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, dishes]);

  useEffect(() => {
    if (!userId) {
      setRecTranslations({});
      return;
    }
    setRecTranslations(loadRecommendationTranslations(userId));
  }, [userId]);

  // Tłumaczenia treści rekomendacji (nagłówki własne, tytuły, opisy pozycji) — cache w localStorage.
  useEffect(() => {
    if (!userId || recommendations.length === 0) return;

    const missing = recommendations.filter(
      (rec) => recommendationNeedsTranslation(rec) && !recommendationCacheReady(rec, recTranslations[rec.id]),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    missing.slice(0, 4).forEach((rec) => {
      fetchRecommendationTranslation(rec)
        .then((cache) => {
          if (cancelled) return;
          setRecTranslations((prev) => {
            const next = { ...prev, [rec.id]: cache };
            saveRecommendationTranslations(userId, next);
            return next;
          });
        })
        .catch(() => {
          /* fallback: polskie etykiety statyczne + oryginalne treści */
        });
    });

    return () => {
      cancelled = true;
    };
  }, [userId, recommendations, recTranslations]);

  const recByDish = recommendationsByDishId(recommendations);

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
    setProfileLoaded(false);
    setLogoUrl(null);
    setLogoObjectPosition('center');
    setLogoScale(1);
    setCoverUrl(null);
    setCoverObjectPosition('center');
    setCoverScale(1);
    setPrimaryColor('#6366f1');
    setSecondaryColor('#ffffff');
    setFontFamily('Inter');
    setRestaurantName(null);
    setGooglePlaceId(null);
    setProfileMenuCategories([]);
    setProfileCategoryTranslations({});
    setFeedbackAvailable(false);

    if (!supabase || !userId) {
      setProfileLoaded(true);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('logo_url, logo_object_position, logo_scale, cover_url, cover_object_position, cover_scale, primary_color, secondary_color, font_family, restaurant_name, google_place_id, menu_categories, menu_category_translations, feedback_available, hotel_hub_enabled')
      .eq('id', userId)
      .single()
      .then(({ data, error: profileError }) => {
        if (cancelled) return;
        if (profileError) {
          return supabase
            .from('profiles')
            .select('logo_url, cover_url, primary_color, secondary_color, font_family, restaurant_name, google_place_id, menu_categories, menu_category_translations')
            .eq('id', userId)
            .single()
            .then(({ data: fallback }) => {
              if (cancelled) return;
              if (fallback?.logo_url) setLogoUrl(fallback.logo_url);
              if (fallback?.cover_url) setCoverUrl(fallback.cover_url);
              if (fallback?.primary_color) setPrimaryColor(fallback.primary_color);
              if (fallback?.secondary_color) setSecondaryColor(fallback.secondary_color);
              if (fallback?.font_family) setFontFamily(fallback.font_family);
              if (fallback?.restaurant_name) setRestaurantName(fallback.restaurant_name);
              setGooglePlaceId(fallback?.google_place_id?.trim() || null);
              setFeedbackAvailable(false);
            });
        }
        if (data?.logo_url) setLogoUrl(data.logo_url);
        setLogoObjectPosition(normalizeLogoPosition(data?.logo_object_position));
        setLogoScale(normalizeLogoScale(data?.logo_scale));
        if (data?.cover_url) setCoverUrl(data.cover_url);
        setCoverObjectPosition(normalizeCoverPosition(data?.cover_object_position));
        setCoverScale(normalizeCoverScale(data?.cover_scale));
        if (data?.primary_color) setPrimaryColor(data.primary_color);
        if (data?.secondary_color) setSecondaryColor(data.secondary_color);
        if (data?.font_family) setFontFamily(data.font_family);
        if (data?.restaurant_name) setRestaurantName(data.restaurant_name);
        setGooglePlaceId(data?.google_place_id?.trim() || null);
        setFeedbackAvailable((data as { feedback_available?: boolean })?.feedback_available === true);
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
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true);
      });

    return () => {
      cancelled = true;
    };
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

  // Publiczne wejścia do menu (1x na sesję przeglądarki dla danego menu i dnia).
  useEffect(() => {
    if (!userId) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `chefvision_menu_open_tracked:${userId}:${day}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // jeśli sessionStorage niedostępny, i tak spróbujemy trackować
    }

    fetch('/api/track-menu-open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {
      // brak blokowania UI przy błędzie trackingu
    });
  }, [userId]);

  const navigateMenuMode = (mode: 'restaurant' | 'hub', sectionId?: string | null) => {
    setMenuMode(mode);
    setActiveHubSectionId(sectionId ?? null);
    if (usePathRouting) {
      if (mode === 'restaurant') {
        history.pushState({}, '', menuBasePath);
      } else if (sectionId) {
        history.pushState({}, '', `${menuBasePath}/hub/${encodeURIComponent(sectionId)}`);
      } else {
        history.pushState({}, '', `${menuBasePath}/hub`);
      }
      onPathChange?.();
    } else if (mode === 'restaurant') {
      window.location.hash = menuBaseHash;
    } else if (sectionId) {
      window.location.hash = `${menuBaseHash}/hub/${encodeURIComponent(sectionId)}`;
    } else {
      window.location.hash = `${menuBaseHash}/hub`;
    }
  };

  const userDishes = dishes.filter((d) =>
    menuMode === 'hub' ? d.visibleInHotelHub === true : d.isOnline,
  );
  const hasGoogleReviews = !!googlePlaceId;
  const reviewUrl = hasGoogleReviews
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId!)}`
    : '';
  const restaurantTitle = restaurantName?.trim() || 'Nasza restauracja';
  const isRtl = isRtlMenuLocale(menuLocale);
  const menuLangAttr: string = menuLocale === 'pl' ? 'pl' : menuLocale;
  const rtlFontStack = `'Noto Sans Hebrew', 'Noto Naskh Arabic', 'Segoe UI', system-ui, sans-serif`;
  const isPolishLocale = menuLocale === 'pl';
  const menuShareUrl = buildPublicMenuUrl(userId, { usePathRouting: !!usePathRouting });
  const menuShareTitle = restaurantTitle;
  const menuShareText = `${restaurantTitle} — ${getShareMenuText(menuLocale)}`;
  const reviewFabLabels = isPolishLocale
    ? {
        tooltip: 'Pomóż nam się rozwijać! 20 sek',
        ariaLabel: 'Oceń nas w Google',
        desktopTitle: 'Oceń nas w Google',
        desktopSubtitle: 'Zostaw opinię w Google',
        mobileTitle: 'Oceń nas',
        mobileSubtitle: 'Zostaw opinię',
      }
    : {
        tooltip: 'Help us grow! 20 sec',
        ariaLabel: 'Leave a review on Google',
        desktopTitle: 'Leave a review on Google',
        desktopSubtitle: 'Your feedback helps us improve',
        mobileTitle: 'Leave a review',
        mobileSubtitle: 'Share your feedback',
      };

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

  const categorySectionId = (category: string) =>
    `menu-cat-${normalizeCategoryKey(category).replace(/\s+/g, '-')}`;

  const getCategoryLabel = (category: string): string => {
    const base = getPublicMenuCategoryDisplay(category, menuLocale);
    if (menuLocale === 'pl') return base;
    const key = normalizeCategoryKey(category);
    const fromProfile = Object.entries(profileCategoryTranslations || {}).find(
      ([k]) => normalizeCategoryKey(String(k)) === key
    )?.[1]?.[menuLocale];
    if (typeof fromProfile === 'string' && fromProfile.trim()) return fromProfile;
    if (base !== category) return base;
    return customCategoryTranslations[key]?.[menuLocale] || category;
  };

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
          !!cached?.he?.trim() &&
          !!cached?.ar?.trim() &&
          !!cached?.uk?.trim() &&
          !!cached?.de?.trim() &&
          !!cached?.es?.trim() &&
          !!cached?.it?.trim() &&
          !!cached?.ko?.trim() &&
          !!cached?.ja?.trim() &&
          !!cached?.fr?.trim() &&
          !!cached?.cs?.trim() &&
          !!cached?.nl?.trim() &&
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
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'category', text: category }),
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
              he: tr.he,
              ar: tr.ar,
              uk: tr.uk,
              de: tr.de,
              es: tr.es,
              it: tr.it,
              ko: tr.ko,
              ja: tr.ja,
              fr: tr.fr,
              cs: tr.cs,
              nl: tr.nl,
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

  const isMenuReady = !loading && profileLoaded;
  if (!isMenuReady) {
    return <PublicMenuSkeleton />;
  }

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
        <div
          className="min-h-screen w-full max-w-full overflow-x-hidden"
          dir={isRtl ? 'rtl' : 'ltr'}
          lang={menuLangAttr}
          style={{ fontFamily: isRtl ? `${rtlFontStack}, ${fontFamily}` : fontFamily }}
        >
          <style>
            {`
            @keyframes googleReviewFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
            }

            .google-review-fab-wrap {
              position: fixed;
              bottom: 24px;
              left: 24px;
              right: auto;
              z-index: 120;
            }

            .google-review-fab-wrap--rtl {
              left: auto;
              right: 24px;
            }

            .google-review-fab-tooltip {
              position: absolute;
              left: 0;
              right: auto;
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

            .google-review-fab-wrap--rtl .google-review-fab-tooltip {
              left: auto;
              right: 0;
            }

            @media (max-width: 600px) {
              .google-review-fab-wrap {
                bottom: 16px;
                left: 16px;
              }

              .google-review-fab-wrap--rtl {
                left: auto;
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
            recommendation={recByDish[dish.id] ?? null}
            recTranslationCache={recTranslations[recByDish[dish.id]?.id ?? ''] ?? null}
            menuLocale={menuLocale}
            onBack={goBack}
            showWatermark={showWatermark}
            fontFamily={fontFamily}
            shareUrl={buildPublicMenuUrl(userId, {
              dishId: dish.id,
              usePathRouting: !!usePathRouting,
            })}
            shareTitle={getPublicDishCopy(dish, menuLocale).name}
            shareText={`${getPublicDishCopy(dish, menuLocale).name} — ${restaurantTitle}`}
          />
          {hasGoogleReviews && (
            <div className={`google-review-fab-wrap${isRtl ? ' google-review-fab-wrap--rtl' : ''}`}>
              {showReviewTooltip && (
                <div className="google-review-fab-tooltip">{reviewFabLabels.tooltip}</div>
              )}
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="google-review-fab"
                aria-label={reviewFabLabels.ariaLabel}
              >
                <img
                  className="google-review-fab__icon"
                  src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                  alt="Google"
                  width={20}
                  height={20}
                />
                <span className="google-review-fab__text google-review-fab__text--desktop leading-tight">
                  <span className="block">{reviewFabLabels.desktopTitle}</span>
                  <span className="block text-[11px] opacity-80">{reviewFabLabels.desktopSubtitle}</span>
                </span>
                <span className="google-review-fab__text google-review-fab__text--mobile leading-tight">
                  <span className="block">{reviewFabLabels.mobileTitle}</span>
                  <span className="block text-[10px] opacity-80">{reviewFabLabels.mobileSubtitle}</span>
                </span>
              </a>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden flex items-center justify-center px-6 text-center" style={{ backgroundColor: secondaryColor, fontFamily }}>
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
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden pb-20 px-4 sm:px-6"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={menuLangAttr}
      style={{
        backgroundColor: secondaryColor,
        fontFamily: isRtl ? `${rtlFontStack}, ${fontFamily}` : fontFamily,
      }}
    >
      <style>
        {`
          @keyframes googleReviewFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }

          .google-review-fab-wrap {
            position: fixed;
            bottom: 24px;
            left: 24px;
            right: auto;
            z-index: 120;
          }

          .google-review-fab-wrap--rtl {
            left: auto;
            right: 24px;
          }

          .google-review-fab-tooltip {
            position: absolute;
            left: 0;
            right: auto;
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

          .google-review-fab-wrap--rtl .google-review-fab-tooltip {
            left: auto;
            right: 0;
          }

          @media (max-width: 600px) {
            .google-review-fab-wrap {
              bottom: 16px;
              left: 16px;
            }

            .google-review-fab-wrap--rtl {
              left: auto;
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
      <div className={`fixed top-4 z-[110] ${isRtl ? 'right-4 left-auto' : 'left-4 right-auto'}`}>
        <ShareLinkButton
          url={menuShareUrl}
          title={menuShareTitle}
          text={menuShareText}
          menuLocale={menuLocale}
          variant="fab"
        />
      </div>
      <div className="w-full max-w-6xl mx-auto pt-5 sm:pt-7">
        <MenuHeroIdentityPreview
          logoUrl={logoUrl}
          logoPosition={logoObjectPosition}
          logoScale={logoScale}
          restaurantTitle={restaurantTitle}
          coverUrl={coverUrl}
          coverPosition={coverObjectPosition}
          coverScale={coverScale}
          primaryColor={primaryColor}
          titleAsH1
        />
      </div>

      {hotelHubEnabled && (
        <PublicMenuModeTabs
          active={menuMode}
          onChange={(mode) => navigateMenuMode(mode, mode === 'hub' ? activeHubSectionId : null)}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          locale={menuLocale}
        />
      )}

      {menuMode === 'hub' && hotelHubEnabled ? (
        <PublicHotelHub
          userId={userId}
          hubData={hubData}
          dishes={dishes}
          sectionId={activeHubSectionId}
          menuLocale={menuLocale}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          fontFamily={isRtl ? `${rtlFontStack}, ${fontFamily}` : fontFamily}
          restaurantTitle={restaurantTitle}
          menuBasePath={menuBasePath}
          menuBaseHash={menuBaseHash}
          usePathRouting={!!usePathRouting}
          onPathChange={onPathChange}
          onSelectSection={(id) => navigateMenuMode('hub', id)}
          showWatermark={showWatermark}
          recByDish={recByDish}
          recTranslations={recTranslations}
        />
      ) : (
        <>
      {orderedKeys.length > 0 && (
        <div className="w-full max-w-6xl mx-auto">
          <PublicMenuCategoryTabs
            categories={orderedKeys}
            getLabel={getCategoryLabel}
            getSectionId={categorySectionId}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            fontFamily={isRtl ? `${rtlFontStack}, ${fontFamily}` : fontFamily}
            isRtl={isRtl}
          />
        </div>
      )}

      <main className="w-full max-w-6xl mx-auto overflow-x-hidden pt-6 sm:pt-8 space-y-14">
        {orderedKeys.map((category) => (
          <section
            key={category}
            id={categorySectionId(category)}
            className="w-full min-w-0 max-w-full scroll-mt-20"
          >
            {/* Nagłówek kategorii — długie tłumaczenia zawijają się w dół, bez rozciągania menu */}
            <div className="mb-8 min-w-0 max-w-full space-y-3">
              <h2
                className="max-w-full text-xs font-black uppercase leading-relaxed tracking-[0.15em] break-words [overflow-wrap:anywhere] sm:tracking-[0.2em]"
                style={{ color: primaryColor }}
              >
                {getCategoryLabel(category)}
              </h2>
              <div className="h-px w-full" style={{ backgroundColor: primaryColor, opacity: 0.25 }} />
            </div>

            {/* Siatka kart — na mobile zawsze 1 kolumna; pojedyncze danie rozciąga się na całą szerokość siatki */}
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3 justify-items-stretch">
              {groups[category].map((dish) => {
                const dishCopy = getPublicDishCopy(dish, menuLocale);
                const singleDishInSection = groups[category].length === 1;
                return (
                <div
                  key={dish.id}
                  className={`w-full min-w-0 ${singleDishInSection ? 'md:col-span-2 lg:col-span-3' : ''}`}
                >
                <PublicDishCard
                  dish={dish}
                  recommendation={recByDish[dish.id] ?? null}
                  recTranslationCache={
                    recByDish[dish.id] ? recTranslations[recByDish[dish.id].id] ?? null : null
                  }
                  menuLocale={menuLocale}
                  basePath={menuBasePath}
                  baseHash={menuBaseHash}
                  usePathRouting={!!usePathRouting}
                  onPathChange={onPathChange}
                  showWatermark={showWatermark}
                  shareUrl={buildPublicMenuUrl(userId, {
                    dishId: dish.id,
                    usePathRouting: !!usePathRouting,
                  })}
                  shareTitle={dishCopy.name}
                  shareText={`${dishCopy.name} — ${restaurantTitle}`}
                />
                </div>
              );
              })}
            </div>
          </section>
        ))}

        {userDishes.length === 0 && (
          <p className="text-center text-slate-400 py-24 font-medium">
            Menu jest puste – zajrzyj tu wkrótce!
          </p>
        )}

        {userDishes.length > 0 && (
          <p className="text-slate-400 text-xs text-center mt-6 pb-2 px-2">
            {isPolishLocale
              ? 'W naszej kuchni stawiamy na świeże składniki, dlatego każde podane danie jest unikalne i może nieznacznie różnić się od tego na zdjęciu'
              : 'In our kitchen we focus on fresh ingredients, so each dish served is unique and may differ slightly from the one in the photo'}
          </p>
        )}

        {feedbackAvailable && (
          <GuestFeedbackSection
            restaurantId={userId}
            primaryColor={primaryColor}
            menuLocale={menuLocale}
          />
        )}
      </main>
        </>
      )}

      {menuMode === 'restaurant' && hasGoogleReviews && (
        <div className={`google-review-fab-wrap${isRtl ? ' google-review-fab-wrap--rtl' : ''}`}>
          {showReviewTooltip && <div className="google-review-fab-tooltip">{reviewFabLabels.tooltip}</div>}
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="google-review-fab"
            aria-label={reviewFabLabels.ariaLabel}
          >
            <img
              className="google-review-fab__icon"
              src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
              alt="Google"
              width={20}
              height={20}
            />
            <span className="google-review-fab__text google-review-fab__text--desktop leading-tight">
              <span className="block">{reviewFabLabels.desktopTitle}</span>
              <span className="block text-[11px] opacity-80">{reviewFabLabels.desktopSubtitle}</span>
            </span>
            <span className="google-review-fab__text google-review-fab__text--mobile leading-tight">
              <span className="block">{reviewFabLabels.mobileTitle}</span>
              <span className="block text-[10px] opacity-80">{reviewFabLabels.mobileSubtitle}</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
};
