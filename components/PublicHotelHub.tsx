import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Dish, DishRecommendation, HotelHubCategory, HotelHubData, PublicMenuLocale } from '../types';
import { formatHotelHubAvailability, sortHotelHubCategories, sortHotelHubSections } from '../utils/hotelHub';
import { isHotelInfoSection } from '../utils/hotelHubInfo';
import {
  getServiceNoteSectionLabel,
  getPublicServiceNotesSync,
  resolvePublicServiceNotes,
} from '../utils/hotelHubServiceNotes';
import { PublicDishCard } from './PublicDishCard';
import { PublicHotelInfoSection } from './PublicHotelInfoSection';
import { HotelHubSectionCard } from './PublicMenuModeTabs';
import { HotelHubSectionIcon } from './HotelHubSectionIcon';
import { getPublicDishCopy } from '../utils/menuTranslations';
import { buildPublicMenuUrl } from '../utils/publicMenuShare';
import type { RecommendationTranslationCache } from '../utils/recommendationTranslations';

interface Props {
  userId: string;
  hubData: HotelHubData;
  dishes: Dish[];
  sectionId: string | null;
  menuLocale: PublicMenuLocale;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  restaurantTitle: string;
  menuBasePath: string;
  menuBaseHash: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
  onSelectSection: (sectionId: string | null) => void;
  showWatermark?: boolean;
  recByDish: Record<string, DishRecommendation>;
  recTranslations: Record<string, RecommendationTranslationCache>;
}

export const PublicHotelHub: React.FC<Props> = ({
  userId,
  hubData,
  dishes,
  sectionId,
  menuLocale,
  primaryColor,
  secondaryColor,
  fontFamily,
  restaurantTitle,
  menuBasePath,
  menuBaseHash,
  usePathRouting,
  onPathChange,
  onSelectSection,
  showWatermark,
  recByDish,
  recTranslations,
}) => {
  const isPl = menuLocale === 'pl';
  const sections = sortHotelHubSections(hubData.sections);
  const activeSection = sectionId ? sections.find((s) => s.id === sectionId) : null;

  const hubDishes = useMemo(
    () =>
      dishes.filter((d) => {
        if (d.visibleInHotelHub === true) return true;
        // Dania przypisane do sekcji, ale bez flagi widoczności (legacy / przed poprawką)
        return hubData.assignments.some((a) => a.dishId === d.id);
      }),
    [dishes, hubData.assignments],
  );

  const sectionCategories = useMemo(() => {
    if (!activeSection) return [];
    return sortHotelHubCategories(hubData.categories.filter((c) => c.sectionId === activeSection.id));
  }, [activeSection, hubData.categories]);

  const dishesByCategory = useMemo(() => {
    if (!activeSection) return {} as Record<string, Dish[]>;
    const map: Record<string, Dish[]> = {};
    for (const cat of sectionCategories) {
      map[cat.id] = [];
    }
    for (const assignment of hubData.assignments) {
      if (assignment.sectionId !== activeSection.id) continue;
      const dish = hubDishes.find((d) => d.id === assignment.dishId);
      if (!dish) continue;
      if (!map[assignment.categoryId]) map[assignment.categoryId] = [];
      if (!map[assignment.categoryId].some((d) => d.id === dish.id)) {
        map[assignment.categoryId].push(dish);
      }
    }
    return map;
  }, [activeSection, sectionCategories, hubData.assignments, hubDishes]);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const displayCategories = sectionCategories.filter((c) => (dishesByCategory[c.id]?.length ?? 0) > 0);
  const effectiveCategoryId = activeCategoryId && dishesByCategory[activeCategoryId]?.length
    ? activeCategoryId
    : displayCategories[0]?.id ?? null;

  const [serviceNotesDisplay, setServiceNotesDisplay] = useState('');

  useEffect(() => {
    if (!activeSection?.serviceNotes?.trim()) {
      setServiceNotesDisplay('');
      return;
    }
    const raw = activeSection.serviceNotes.trim();
    if (menuLocale === 'pl') {
      setServiceNotesDisplay(raw);
      return;
    }
    setServiceNotesDisplay(getPublicServiceNotesSync(raw, menuLocale));
    let cancelled = false;
    void resolvePublicServiceNotes(raw, menuLocale).then((translated) => {
      if (!cancelled && translated) setServiceNotesDisplay(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSection?.id, activeSection?.serviceNotes, menuLocale]);

  if (!activeSection) {
    return (
      <div className="w-full max-w-6xl mx-auto pt-4 pb-16 px-1">
        <div className="mb-8 text-center space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
            {isPl ? 'Doświadczenie gościa' : 'Guest experience'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tight">Hotel Hub</h2>
        </div>
        {sections.length === 0 ? (
          <p className="text-center text-slate-400 py-16">
            {isPl ? 'Sekcje Hotel Hub wkrótce dostępne.' : 'Hotel Hub sections coming soon.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {sections.map((section) => (
              <HotelHubSectionCard
                key={section.id}
                section={section}
                locale={menuLocale}
                primaryColor={primaryColor}
                onClick={() => onSelectSection(section.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isHotelInfoSection(activeSection)) {
    return (
      <div style={{ fontFamily }}>
        <PublicHotelInfoSection
          section={activeSection}
          menuLocale={menuLocale}
          primaryColor={primaryColor}
          onBack={() => onSelectSection(null)}
        />
      </div>
    );
  }

  const availability = formatHotelHubAvailability(activeSection, isPl ? 'pl' : 'en');

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-16" style={{ fontFamily }}>
      <button
        type="button"
        onClick={() => onSelectSection(null)}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-6 px-1"
      >
        <ArrowLeft size={18} />
        {isPl ? 'Wszystkie sekcje' : 'All sections'}
      </button>

      <header className="rounded-[32px] overflow-hidden bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 mb-8">
        {activeSection.heroImageUrl ? (
          <div className="h-44 sm:h-56 relative">
            <img src={activeSection.heroImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
              <div className="mb-2">
                <HotelHubSectionIcon icon={activeSection.iconEmoji} size="xl" className="brightness-0 invert" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black italic tracking-tight">{activeSection.name}</h1>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${primaryColor}18, white)` }}>
            <div className="mb-2">
              <HotelHubSectionIcon icon={activeSection.iconEmoji} size="xl" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tight">{activeSection.name}</h1>
          </div>
        )}
        <div className="px-6 sm:px-8 py-5 space-y-2 border-t border-slate-100">
          <p className="text-sm font-bold" style={{ color: primaryColor }}>
            {isPl ? 'Dostępność:' : 'Available:'}{' '}
            {availability.replace(/^(Dostępne|Available)\s*/i, '')}
          </p>
          {serviceNotesDisplay && (
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                {getServiceNoteSectionLabel(menuLocale)}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">{serviceNotesDisplay}</p>
            </div>
          )}
        </div>
      </header>

      {displayCategories.length > 0 && (
        <div
          className="flex flex-wrap gap-2 mb-8 sticky top-[4.5rem] z-[90] py-2 -mx-1 px-1"
          style={{ backgroundColor: secondaryColor }}
        >
          {displayCategories.map((cat: HotelHubCategory) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide transition-all ${
                effectiveCategoryId === cat.id
                  ? 'text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
              style={effectiveCategoryId === cat.id ? { backgroundColor: primaryColor } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-12">
        {(effectiveCategoryId ? [effectiveCategoryId] : displayCategories.map((c) => c.id)).map((catId) => {
          const cat = sectionCategories.find((c) => c.id === catId);
          const catDishes = dishesByCategory[catId] || [];
          if (!cat || catDishes.length === 0) return null;
          return (
            <section key={catId}>
              {!effectiveCategoryId && (
                <h2
                  className="text-xs font-black uppercase tracking-[0.15em] mb-6"
                  style={{ color: primaryColor }}
                >
                  {cat.name}
                </h2>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {catDishes.map((dish) => {
                  const dishCopy = getPublicDishCopy(dish, menuLocale);
                  const hubPath = `${menuBasePath}/hub/${activeSection.id}`;
                  const hubHash = `${menuBaseHash}/hub/${activeSection.id}`;
                  return (
                    <PublicDishCard
                      key={dish.id}
                      dish={dish}
                      recommendation={recByDish[dish.id] ?? null}
                      recTranslationCache={
                        recByDish[dish.id] ? recTranslations[recByDish[dish.id].id] ?? null : null
                      }
                      menuLocale={menuLocale}
                      basePath={hubPath}
                      baseHash={hubHash}
                      usePathRouting={!!usePathRouting}
                      onPathChange={onPathChange}
                      showWatermark={showWatermark}
                      shareUrl={buildPublicMenuUrl(userId, {
                        dishId: dish.id,
                        usePathRouting: !!usePathRouting,
                        hubSectionId: activeSection.id,
                      })}
                      shareTitle={dishCopy.name}
                      shareText={`${dishCopy.name} — ${restaurantTitle}`}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {displayCategories.length === 0 && (
        <p className="text-center text-slate-400 py-16">
          {isPl ? 'Brak pozycji w tej sekcji.' : 'No items in this section yet.'}
        </p>
      )}
    </div>
  );
};
