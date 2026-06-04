import React, { useState, useEffect } from 'react';
import { Dish, DishRecommendation, PublicMenuLocale } from '../types';
import { fetchRecommendationsForPublicMenu, recommendationsByDishId } from '../utils/dishRecommendations';
import { PublicDishCard } from './PublicDishCard';
import { PublicDishDetail } from './PublicDishDetail';
import { MenuLanguageSwitcher } from './MenuLanguageSwitcher';
import { supabase } from '../services/supabaseService';
import { MENU_CATEGORIES } from '../constants';
import { getPublicMenuCategoryDisplay, getPublicDishCopy, isRtlMenuLocale } from '../utils/menuTranslations';
import { MenuHeroIdentityPreview } from './MenuHeroIdentityPreview';
import { ShareLinkButton } from './ShareLinkButton';
import { normalizeLogoPosition, normalizeLogoScale } from '../utils/logoFrame';
import { normalizeCoverPosition, normalizeCoverScale } from '../utils/coverFrame';
import { buildPublicMenuUrl, getShareMenuText } from '../utils/publicMenuShare';

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
  const [customCategoryTranslations, setCustomCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});
  const [profileMenuCategories, setProfileMenuCategories] = useState<string[]>([]);
  const [profileCategoryTranslations, setProfileCategoryTranslations] = useState<Record<string, Partial<Record<PublicMenuLocale, string>>>>({});

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
    if (!supabase || !userId) return;
    supabase
      .from('profiles')
      .select('logo_url, logo_object_position, logo_scale, cover_url, cover_object_position, cover_scale, primary_color, secondary_color, font_family, restaurant_name, google_place_id, menu_categories, menu_category_translations')
      .eq('id', userId)
      .single()
      .then(({ data, error: profileError }) => {
        if (profileError) {
          supabase
            .from('profiles')
            .select('logo_url, cover_url, primary_color, secondary_color, font_family, restaurant_name, google_place_id, menu_categories, menu_category_translations')
            .eq('id', userId)
            .single()
            .then(({ data: fallback }) => {
              if (fallback?.logo_url) setLogoUrl(fallback.logo_url);
              if (fallback?.cover_url) setCoverUrl(fallback.cover_url);
              if (fallback?.primary_color) setPrimaryColor(fallback.primary_color);
              if (fallback?.secondary_color) setSecondaryColor(fallback.secondary_color);
              if (fallback?.font_family) setFontFamily(fallback.font_family);
              if (fallback?.restaurant_name) setRestaurantName(fallback.restaurant_name);
              setGooglePlaceId(fallback?.google_place_id?.trim() || null);
            });
          return;
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

  const userDishes = dishes.filter((d) => d.isOnline);
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
          className="min-h-screen"
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
    <div
      className="min-h-screen pb-20 px-4 sm:px-6"
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
      <div className="max-w-6xl mx-auto pt-5 sm:pt-7">
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
              {groups[category].map((dish) => {
                const dishCopy = getPublicDishCopy(dish, menuLocale);
                return (
                <PublicDishCard
                  key={dish.id}
                  dish={dish}
                  recommendation={recByDish[dish.id] ?? null}
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
              )})}
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
