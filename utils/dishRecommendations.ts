import type { Dish, DishRecommendation, DishRecommendationItem, DishRecommendationType } from '../types';
import { db, supabase } from '../services/supabaseService';

export const RECOMMENDATIONS_STORAGE_KEY = (userId: string) =>
  `chefvision_dish_recommendations:${userId}`;

export const RECOMMENDATION_BADGE: Record<DishRecommendationType, string> = {
  polecane: 'Szef kuchni poleca',
  popularne: 'Najlepiej sprzedawane',
  zestaw: 'W zestawie taniej',
};

export const RECOMMENDATION_DEFAULT_HEADER: Record<DishRecommendationType, string> = {
  polecane: 'Polecamy do tego dania',
  popularne: 'Inni często zamawiają z',
  zestaw: 'Najpopularniejszy zestaw',
};

/** Stałe sloty rekomendacji „Szef kuchni poleca” — zawsze 3 pozycje w tej kolejności. */
export const POLECANE_SLOT_IDS = ['polecane-perfect-with', 'polecane-finish-with', 'polecane-add-a'] as const;
export type PolecaneSlotId = (typeof POLECANE_SLOT_IDS)[number];

export const POLECANE_SLOTS: { id: PolecaneSlotId; emoji: string }[] = [
  { id: 'polecane-perfect-with', emoji: '🍷' },
  { id: 'polecane-finish-with', emoji: '🍰' },
  { id: 'polecane-add-a', emoji: '🥤' },
];

export function createPolecaneItems(existing?: DishRecommendationItem[]): DishRecommendationItem[] {
  return POLECANE_SLOTS.map((slot, idx) => {
    const prev =
      existing?.find((i) => i.id === slot.id) ??
      (existing?.length === 1 && idx === 0 ? existing[0] : undefined) ??
      existing?.[idx];
    return {
      id: slot.id,
      title: prev?.title ?? '',
      price: prev?.price,
      emoji: slot.emoji,
    };
  });
}

/** Uzupełnia brakujące sloty i migruje stare rekomendacje z jedną pozycją. */
export function normalizePolecaneItems(items: DishRecommendationItem[]): DishRecommendationItem[] {
  return createPolecaneItems(items);
}

export function getRecommendationHeader(rec: DishRecommendation): string {
  return rec.customHeaderText?.trim() || RECOMMENDATION_DEFAULT_HEADER[rec.type];
}

/** Składa tytuł zestawu: pozycje z panelu + nazwa dania głównego (jeśli jej jeszcze nie ma). */
export function formatZestawDisplayTitles(
  items: DishRecommendationItem[],
  dishName: string,
): string {
  const parts = items.map((i) => i.title.trim()).filter(Boolean);
  const main = dishName.trim();
  if (!main) return parts.join(' + ');
  const alreadyIncluded = parts.some((p) => p.toLowerCase() === main.toLowerCase());
  if (!alreadyIncluded) parts.push(main);
  return parts.join(' + ');
}

export function parsePriceNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = parseFloat(value.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function calcSavingsPercent(priceOutside: string, bundlePrice: string): number | null {
  const outside = parsePriceNumber(priceOutside);
  const bundle = parsePriceNumber(bundlePrice);
  if (outside == null || bundle == null || outside <= 0 || bundle >= outside) return null;
  return Math.round(((outside - bundle) / outside) * 100);
}

export function loadStoredRecommendations(userId: string): DishRecommendation[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(RECOMMENDATIONS_STORAGE_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DishRecommendation[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredRecommendations(userId: string, recommendations: DishRecommendation[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(RECOMMENDATIONS_STORAGE_KEY(userId), JSON.stringify(recommendations));
  } catch {
    /* ignore quota */
  }
}

export function getActiveRecommendationForDish(
  recommendations: DishRecommendation[],
  dishId: string,
): DishRecommendation | null {
  const rec = recommendations.find((r) => r.dishId === dishId && r.isActive);
  return rec ?? null;
}

export function recommendationsByDishId(
  recommendations: DishRecommendation[],
): Record<string, DishRecommendation> {
  const map: Record<string, DishRecommendation> = {};
  for (const rec of recommendations) {
    if (rec.isActive) map[rec.dishId] = rec;
  }
  return map;
}

/** Przykładowe rekomendacje — przypisane do pierwszych 3 dań online (lub dowolnych 3). */
export function buildMockRecommendations(dishes: Dish[]): DishRecommendation[] {
  const targets = dishes.filter((d) => d.isOnline).slice(0, 3);
  if (targets.length === 0) return [];

  const mocks: DishRecommendation[] = [];

  if (targets[0]) {
    mocks.push({
      id: 'mock-rec-polecane',
      dishId: targets[0].id,
      type: 'polecane',
      isActive: true,
      items: createPolecaneItems([
        { id: 'polecane-perfect-with', title: 'Pinot Grigio', price: '22', emoji: '🍷' },
        { id: 'polecane-finish-with', title: 'Domowe tiramisu', price: '18', emoji: '🍰' },
        { id: 'polecane-add-a', title: 'Świeża lemoniada', price: '12', emoji: '🥤' },
      ]),
    });
  }

  if (targets[1]) {
    mocks.push({
      id: 'mock-rec-popularne',
      dishId: targets[1].id,
      type: 'popularne',
      isActive: true,
      items: [
        {
          id: 'mock-item-fries',
          title: 'Frytki z batatów',
          subtitle: 'Chrupiące i lekko słodkie',
          price: '15',
          emoji: '🍟',
          imageUrl:
            'https://images.unsplash.com/photo-1573080496219-b080abffe19f?w=120&h=120&fit=crop',
        },
        {
          id: 'mock-item-beer',
          title: 'Piwo kraftowe IPA',
          subtitle: 'Cytrusowe, lekko goryczkowe',
          price: '18',
          emoji: '🍺',
          imageUrl:
            'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=120&h=120&fit=crop',
        },
      ],
    });
  }

  if (targets[2]) {
    mocks.push({
      id: 'mock-rec-zestaw',
      dishId: targets[2].id,
      type: 'zestaw',
      isActive: true,
      bundlePriceOutside: '67',
      bundlePrice: '55',
      items: [
        {
          id: 'mock-set-main',
          title: 'Schab',
          imageUrl: targets[2].imageUrl,
        },
        {
          id: 'mock-set-side',
          title: 'Mizeria',
          emoji: '🥒',
          imageUrl:
            'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=120&h=120&fit=crop',
        },
        {
          id: 'mock-set-drink',
          title: 'Lemoniada',
          emoji: '🍋',
          imageUrl:
            'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=120&h=120&fit=crop',
        },
      ],
    });
  }

  return mocks;
}

/** Zwraca zapisane rekomendacje lub mocki, gdy brak zapisanych danych (tryb demo / offline). */
export function resolveRecommendations(userId: string, dishes: Dish[]): DishRecommendation[] {
  const stored = loadStoredRecommendations(userId);
  if (stored.length > 0) return stored;
  return buildMockRecommendations(dishes);
}

function useLocalRecommendationsOnly(userId: string): boolean {
  return !supabase || userId === 'local-chef';
}

/** Panel managera — Supabase z jednorazową migracją z localStorage. */
export async function fetchRecommendationsForOwner(userId: string): Promise<DishRecommendation[]> {
  if (useLocalRecommendationsOnly(userId)) {
    return loadStoredRecommendations(userId);
  }
  try {
    const fromDb = await db.getDishRecommendations(userId);
    if (fromDb.length > 0) return fromDb;

    const local = loadStoredRecommendations(userId);
    if (local.length > 0) {
      const migrated = await db.syncDishRecommendations(userId, local);
      saveStoredRecommendations(userId, []);
      return migrated;
    }
    return [];
  } catch (e) {
    console.warn('[fetchRecommendationsForOwner]', e);
    return loadStoredRecommendations(userId);
  }
}

/** Menu publiczne — tylko aktywne rekomendacje z bazy. */
export async function fetchRecommendationsForPublicMenu(
  userId: string,
  dishes: Dish[],
): Promise<DishRecommendation[]> {
  if (useLocalRecommendationsOnly(userId)) {
    return resolveRecommendations(userId, dishes);
  }
  try {
    return await db.getDishRecommendationsForPublicMenu(userId);
  } catch (e) {
    console.warn('[fetchRecommendationsForPublicMenu]', e);
    return [];
  }
}

/** Zapis listy rekomendacji (Supabase lub localStorage). */
export async function persistRecommendations(
  userId: string,
  recommendations: DishRecommendation[],
): Promise<DishRecommendation[]> {
  if (useLocalRecommendationsOnly(userId)) {
    saveStoredRecommendations(userId, recommendations);
    return recommendations;
  }
  try {
    const saved = await db.syncDishRecommendations(userId, recommendations);
    saveStoredRecommendations(userId, saved);
    return saved;
  } catch (e) {
    console.error('[persistRecommendations]', e);
    throw e;
  }
}
