
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { TRIAL_TOKENS, SUBSCRIPTION_TOKENS, MAX_USER_BACKDROPS } from '../constants';
import { Dish, DishRecommendation, UserProfile, DishStatus, SubscriptionStatus, Backdrop } from '../types';
import { mapProfileTokens } from '../utils/tokens.js';

// Vite exposes env vars via import.meta.env (only keys prefixed with VITE_).
// We still keep process.env fallback for server-like environments.
const VITE_ENV = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) as any;

const SUPABASE_URL =
  VITE_ENV?.VITE_SUPABASE_URL ||
  VITE_ENV?.VITE_PUBLIC_SUPABASE_URL ||
  (process.env as any).VITE_SUPABASE_URL ||
  (process.env as any).SUPABASE_URL ||
  (process.env as any).NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  VITE_ENV?.VITE_SUPABASE_ANON_KEY ||
  VITE_ENV?.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  (process.env as any).VITE_SUPABASE_ANON_KEY ||
  (process.env as any).SUPABASE_ANON_KEY ||
  (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const isRealSupabase = !!SUPABASE_URL && !SUPABASE_URL.includes('placeholder') && SUPABASE_URL.startsWith('https://');

export const supabase = isRealSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const LOCAL_STORAGE_KEY = 'chefvision_dishes_v1';
const LOCAL_BACKDROPS_KEY = 'chefvision_backdrops_v1';
const USER_GENS_KEY = 'chefvision_user_gens';
const FOOD_IMAGES_BUCKET = 'food-images';
const DISH_IMAGES_BUCKET = 'dish-images';

const getLocalDishes = (): Dish[] => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocalDishes = (dishes: Dish[]) => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dishes));

const STORAGE_PUBLIC_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/`
  : '';

function getBucketAndPathFromImageUrl(imageUrl: string): { bucket: string; path: string } | null {
  if (!supabase || !STORAGE_PUBLIC_PREFIX) return null;
  if (!imageUrl.startsWith(STORAGE_PUBLIC_PREFIX)) return null;
  const rest = imageUrl.slice(STORAGE_PUBLIC_PREFIX.length); // e.g. "dish-images/userId/file.jpg"
  const [bucket, ...pathParts] = rest.split('/');
  if (!bucket || pathParts.length === 0) return null;
  const path = pathParts.join('/');
  if (bucket !== DISH_IMAGES_BUCKET && bucket !== FOOD_IMAGES_BUCKET) return null;
  return { bucket, path };
}

/** Przesyła obraz (data URL) do bucketu food-images i zwraca publiczny URL. */
export async function uploadDishImage(dataUrl: string, userId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany.');
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Nieprawidłowy format obrazu (oczekiwano data URL).');
  const mimeType = match[1];
  const base64 = match[2];
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${uuidv4()}.${ext}`;
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bucket = DISH_IMAGES_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(path, binary, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    const fallback = await supabase.storage.from(FOOD_IMAGES_BUCKET).upload(path, binary, {
      contentType: mimeType,
      upsert: false,
    });
    if (fallback.error) throw new Error(fallback.error.message || 'Błąd przesyłania obrazu.');
    const { data } = supabase.storage.from(FOOD_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload tła (data URL) do Storage — ścieżka `{userId}/backdrops/...` (zgodna z politykami folderu użytkownika). */
export async function uploadBackdropImage(dataUrl: string, userId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany.');
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Nieprawidłowy format obrazu (oczekiwano data URL).');
  const mimeType = match[1];
  const base64 = match[2];
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/backdrops/${uuidv4()}.${ext}`;
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bucket = DISH_IMAGES_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(path, binary, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    const fallback = await supabase.storage.from(FOOD_IMAGES_BUCKET).upload(path, binary, {
      contentType: mimeType,
      upsert: false,
    });
    if (fallback.error) throw new Error(fallback.error.message || 'Błąd przesyłania tła.');
    const { data } = supabase.storage.from(FOOD_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

type LocalBackdropRow = { id: string; userId: string; imageUrl: string; createdAt: number };

function useLocalBackdropsOnly(userId: string): boolean {
  return !supabase || userId === 'local-chef';
}

function readLocalBackdropRows(): LocalBackdropRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_BACKDROPS_KEY);
    return raw ? (JSON.parse(raw) as LocalBackdropRow[]) : [];
  } catch {
    return [];
  }
}

function writeLocalBackdropRows(rows: LocalBackdropRow[]) {
  localStorage.setItem(LOCAL_BACKDROPS_KEY, JSON.stringify(rows));
}

async function removeBackdropFileFromStorageIfAppOwned(imageUrl: string): Promise<void> {
  if (!supabase) return;
  const info = getBucketAndPathFromImageUrl(imageUrl);
  if (!info) return;
  try {
    await supabase.storage.from(info.bucket).remove([info.path]);
  } catch {
    /* ignore */
  }
}

async function fetchBackdropsFromSupabase(userId: string): Promise<Backdrop[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_backdrops')
    .select('id, image_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row: { id: string; image_url: string }) => ({
    id: row.id,
    imageUrl: row.image_url,
  }));
}

/** Jednolite tablice tekstowe z Supabase (czasem JSON w text / json jako string). */
function coerceStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) {
        return j
          .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      /* nie JSON — lista rozdzielona przecinkiem */
    }
    return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const mapRecommendationRow = (row: Record<string, unknown>): DishRecommendation => ({
  id: String(row.id),
  dishId: String(row.dish_id ?? row.dishId),
  type: row.type as DishRecommendation['type'],
  isActive: row.is_active !== false && row.isActive !== false,
  customHeaderText:
    (row.custom_header_text as string | null) ?? (row.customHeaderText as string | undefined) ?? undefined,
  items: Array.isArray(row.items) ? (row.items as DishRecommendation['items']) : [],
  bundlePriceOutside:
    (row.bundle_price_outside as string | null) ??
    (row.bundlePriceOutside as string | undefined) ??
    undefined,
  bundlePrice:
    (row.bundle_price as string | null) ?? (row.bundlePrice as string | undefined) ?? undefined,
});

function recommendationToPayload(userId: string, rec: DishRecommendation): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    dish_id: rec.dishId,
    type: rec.type,
    is_active: rec.isActive,
    custom_header_text: rec.customHeaderText?.trim() || null,
    bundle_price_outside: rec.bundlePriceOutside?.trim() || null,
    bundle_price: rec.bundlePrice?.trim() || null,
    items: rec.items,
  };
  if (isUuid(rec.id)) payload.id = rec.id;
  return payload;
}

const mapRow = (row: any): Dish => ({
  ...row,
  name: row.name ?? '',
  imageUrl: row.imageUrl ?? row.image_url ?? '',
  description: row.description ?? '',
  technique: row.technique ?? '',
  ingredients: coerceStringArray(row.ingredients),
  allergens: coerceStringArray(row.allergens) as Dish['allergens'],
  videoUrl: row.social_link ?? row.video_url ?? row.videoUrl ?? undefined,
  menuPrice: row.menu_price ?? row.menuPrice ?? null,
  category: row.category ?? null,
  translations: row.translations ?? null,
});

export const db = {
  async getDishes(userId: string): Promise<Dish[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false });
      if (!error && data) {
        return data.map(mapRow) as Dish[];
      }
    }
    return getLocalDishes().filter(d => d.restaurantId === userId || (d as any).userId === userId);
  },

  /** Pobiera dania menu publicznego – tylko dania danego użytkownika z isOnline = true. */
  async getDishesForPublicMenu(userId: string): Promise<Dish[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .eq('userId', userId)
        .eq('isOnline', true)
        .order('createdAt', { ascending: false });
      if (!error && data) {
        return data.map(mapRow) as Dish[];
      }
    }
    return getLocalDishes().filter(d => (d.restaurantId === userId || (d as any).userId === userId) && d.isOnline);
  },

  async saveDish(dish: Partial<Dish>): Promise<Dish | null> {
    if (supabase) {
      // Budujemy payload tylko ze znanych kolumn – unikamy błędu "unknown column"
      const payload: Record<string, any> = {};

      // Pola podstawowe (camelCase zgodne z tabelą dishes)
      if (dish.id)          payload.id           = dish.id;
      if (dish.name        !== undefined) payload.name        = dish.name;
      if (dish.imageUrl    !== undefined) payload.imageUrl    = dish.imageUrl;
      if (dish.description !== undefined) payload.description = dish.description;
      if (dish.technique   !== undefined) payload.technique   = dish.technique;
      if (dish.ingredients !== undefined) payload.ingredients = dish.ingredients;
      if (dish.allergens   !== undefined) payload.allergens   = dish.allergens;
      if (dish.isOnline    !== undefined) payload.isOnline    = dish.isOnline;
      if (dish.status      !== undefined) payload.status      = dish.status;
      if (dish.createdAt   !== undefined) payload.createdAt   = dish.createdAt;
      if (dish.clicks      !== undefined) payload.clicks      = dish.clicks;

      // Kolumny dodatkowe (snake_case)
      payload.social_link = (dish as any).videoUrl ?? (dish as any).social_link ?? null;
      payload.menu_price  = (dish as any).menuPrice ?? (dish as any).menu_price ?? null;
      payload.category    = (dish as any).category ?? null;
      if (dish.translations !== undefined) payload.translations = dish.translations;

      const { data, error } = await supabase
        .from('dishes')
        .upsert(payload)
        .select('*')
        .single();

      if (!error && data) {
        return mapRow(data) as Dish;
      }

      // Gdy Supabase zwróci błąd – rzucamy go jawnie, żeby alert był widoczny w UI
      const msg = error?.message || 'Nieznany błąd Supabase';
      console.error('[saveDish] Supabase error:', msg, error?.details, error?.hint);
      throw new Error(msg);
    }

    // Tryb bez Supabase (demo / offline) – zapis lokalny
    const dishes = getLocalDishes();
    const newDish = {
      id: dish.id || uuidv4(),
      createdAt: Date.now(),
      clicks: 0,
      ...dish,
    } as Dish;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify([newDish, ...dishes.filter(d => d.id !== newDish.id)])
      );
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        throw new Error('QuotaExceeded – obraz za duży do zapisania lokalnie.');
      }
      throw e;
    }
    return newDish;
  },

  async deleteDish(id: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('dishes').delete().eq('id', id);
      return !error;
    }
    saveLocalDishes(getLocalDishes().filter(d => d.id !== id));
    return true;
  },

  /**
   * Usuwa danie wraz z plikiem obrazu w Supabase Storage (jeśli pochodzi z bucketa food-images / dish-images).
   * Jeśli usuwanie pliku się nie uda, mimo to usuwa rekord z bazy.
   */
  async deleteDishWithImage(dish: Dish): Promise<boolean> {
    const { id, imageUrl } = dish;

    if (supabase && imageUrl) {
      const info = getBucketAndPathFromImageUrl(imageUrl);
      if (info) {
        try {
          const { bucket, path } = info;
          const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
          if (storageError) {
            console.warn('Błąd usuwania obrazu ze Storage:', storageError.message || storageError);
          }
        } catch (e) {
          console.warn('Wyjątek podczas usuwania obrazu ze Storage:', e);
        }
      }
    }

    // Zawsze próbujemy usunąć rekord z bazy, nawet jeśli storage się nie udał
    if (supabase) {
      const { error } = await supabase.from('dishes').delete().eq('id', id);
      return !error;
    }

    // Tryb lokalny (bez Supabase)
    saveLocalDishes(getLocalDishes().filter(d => d.id !== id));
    return true;
  },

  async updateDishStatus(id: string, status: DishStatus): Promise<boolean> {
    if (supabase) {
      // Aktualizujemy wyłącznie kolumnę "status" – nie dotykamy isStandard/is_standard,
      // bo kolumna może nie istnieć i spowodowałoby to błąd całego UPDATE.
      const { error } = await supabase
        .from('dishes')
        .update({ status })
        .eq('id', id);
      if (error) console.error('[updateDishStatus] Supabase error:', error?.message, error?.hint);
      return !error;
    }
    const updated = getLocalDishes().map(d => d.id === id ? { ...d, status, isStandard: status === DishStatus.APPROVED } : d);
    saveLocalDishes(updated);
    return true;
  },

  async toggleDishOnline(id: string, isOnline: boolean): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('dishes').update({ isOnline }).eq('id', id);
      return !error;
    }
    const updated = getLocalDishes().map(d => d.id === id ? { ...d, isOnline } : d);
    saveLocalDishes(updated);
    return true;
  },

  /** Aktualizuje tylko link społecznościowy dania (UPDATE jednego pola – reszta rekordu bez zmian). */
  async updateDishSocialLink(id: string, url: string): Promise<boolean> {
    if (supabase) {
      const value = url.trim() || null;
      let err = (await supabase.from('dishes').update({ social_link: value }).eq('id', id)).error;
      if (err) err = (await supabase.from('dishes').update({ video_url: value }).eq('id', id)).error;
      return !err;
    }
    const updated = getLocalDishes().map(d => d.id === id ? { ...d, videoUrl: url } : d);
    saveLocalDishes(updated);
    return true;
  },

  /** Aktualizuje wyłącznie cenę pozycji w menu cyfrowym. */
  async updateDishPrice(id: string, menuPrice: string | null): Promise<boolean> {
    const value = (menuPrice || '').trim() || null;
    if (supabase) {
      let err = (await supabase.from('dishes').update({ menu_price: value }).eq('id', id)).error;
      if (err) err = (await supabase.from('dishes').update({ menuPrice: value }).eq('id', id)).error;
      return !err;
    }
    const updated = getLocalDishes().map(d =>
      d.id === id ? { ...d, menuPrice: value } : d
    );
    saveLocalDishes(updated);
    return true;
  },

  /** Aktualizuje wyłącznie kategorię dania w menu cyfrowym. */
  async updateDishCategory(id: string, category: string | null): Promise<boolean> {
    const value = (category || '').trim() || null;
    if (supabase) {
      const { error } = await supabase.from('dishes').update({ category: value }).eq('id', id);
      return !error;
    }
    const updated = getLocalDishes().map(d =>
      d.id === id ? { ...d, category: value } : d
    );
    saveLocalDishes(updated);
    return true;
  },

  /** Zapisane tła Studio (tylko pamięć przeglądarki w trybie demo / bez Supabase). */
  async getBackdrops(userId: string): Promise<Backdrop[]> {
    if (useLocalBackdropsOnly(userId)) {
      return readLocalBackdropRows()
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({ id: r.id, imageUrl: r.imageUrl }));
    }
    return fetchBackdropsFromSupabase(userId);
  },

  /**
   * Zapisuje tło (upload data URL do Storage + rekord w `user_backdrops`).
   * Limit MAX_USER_BACKDROPS — przy przekroczeniu usuwa najstarsze (rekord + plik w Storage, jeśli nasz).
   */
  async saveBackdrop(userId: string, imageUrl: string): Promise<Backdrop[]> {
    if (useLocalBackdropsOnly(userId)) {
      let rows = readLocalBackdropRows();
      while (rows.filter((r) => r.userId === userId).length >= MAX_USER_BACKDROPS) {
        const mine = rows
          .filter((r) => r.userId === userId)
          .sort((a, b) => a.createdAt - b.createdAt);
        const oldest = mine[0];
        if (!oldest) break;
        rows = rows.filter((r) => r.id !== oldest.id);
      }
      const newRow: LocalBackdropRow = {
        id: `backdrop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId,
        imageUrl,
        createdAt: Date.now(),
      };
      rows.push(newRow);
      try {
        writeLocalBackdropRows(rows);
      } catch (e: any) {
        if (e?.name === 'QuotaExceededError' || e?.code === 22) {
          throw new Error('Brak miejsca w przeglądarce — zaloguj się (Supabase), aby zapisywać tła w chmurze.');
        }
        throw e;
      }
      return db.getBackdrops(userId);
    }

    if (!supabase) throw new Error('Supabase nie jest skonfigurowany.');

    let finalUrl = imageUrl;
    if (imageUrl.startsWith('data:')) {
      finalUrl = await uploadBackdropImage(imageUrl, userId);
    }

    const { data: existing, error: selErr } = await supabase
      .from('user_backdrops')
      .select('id, image_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (selErr) throw new Error(selErr.message || 'Błąd odczytu teł.');

    const ordered = existing || [];
    let toTrim = [...ordered];
    while (toTrim.length >= MAX_USER_BACKDROPS) {
      const victim = toTrim.shift();
      if (!victim) break;
      await removeBackdropFileFromStorageIfAppOwned(victim.image_url);
      const { error: delErr } = await supabase.from('user_backdrops').delete().eq('id', victim.id);
      if (delErr) console.warn('[saveBackdrop] delete oldest:', delErr.message);
    }

    const { error: insErr } = await supabase.from('user_backdrops').insert({
      user_id: userId,
      image_url: finalUrl,
    });
    if (insErr) throw new Error(insErr.message || 'Nie udało się zapisać tła.');

    return fetchBackdropsFromSupabase(userId);
  },

  /** Rekomendacje sprzedażowe — panel managera (wszystkie wpisy użytkownika). */
  async getDishRecommendations(userId: string): Promise<DishRecommendation[]> {
    if (!supabase || userId === 'local-chef') return [];
    const { data, error } = await supabase
      .from('dish_recommendations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('[getDishRecommendations]', error.message);
      return [];
    }
    return (data || []).map((row) => mapRecommendationRow(row as Record<string, unknown>));
  },

  /** Aktywne rekomendacje dla menu publicznego (RLS filtruje is_active + isOnline). */
  async getDishRecommendationsForPublicMenu(userId: string): Promise<DishRecommendation[]> {
    if (!supabase || userId === 'local-chef') return [];
    const { data, error } = await supabase
      .from('dish_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) {
      console.warn('[getDishRecommendationsForPublicMenu]', error.message);
      return [];
    }
    return (data || []).map((row) => mapRecommendationRow(row as Record<string, unknown>));
  },

  /**
   * Zapisuje pełną listę rekomendacji użytkownika (upsert + usuwa brakujące).
   * Zwraca listę z id z bazy (ważne po pierwszym zapisie z tymczasowym id).
   */
  async syncDishRecommendations(
    userId: string,
    recommendations: DishRecommendation[],
  ): Promise<DishRecommendation[]> {
    if (!supabase || userId === 'local-chef') return recommendations;

    const { data: existing, error: selErr } = await supabase
      .from('dish_recommendations')
      .select('id')
      .eq('user_id', userId);
    if (selErr) throw new Error(selErr.message || 'Nie udało się odczytać rekomendacji.');

    const keepIds = new Set<string>();
    const saved: DishRecommendation[] = [];

    for (const rec of recommendations) {
      const { data, error } = await supabase
        .from('dish_recommendations')
        .upsert(recommendationToPayload(userId, rec), { onConflict: 'dish_id' })
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Nie udało się zapisać rekomendacji.');
      if (data) {
        const mapped = mapRecommendationRow(data as Record<string, unknown>);
        saved.push(mapped);
        keepIds.add(mapped.id);
      }
    }

    const toDelete = (existing || [])
      .map((r: { id: string }) => r.id)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('dish_recommendations')
        .delete()
        .in('id', toDelete);
      if (delErr) console.warn('[syncDishRecommendations] delete:', delErr.message);
    }

    return saved;
  },
};

export const authService = {
  async getSession() {
    if (!supabase) return { data: { session: null } };
    try { return await supabase.auth.getSession(); } catch (e) { return { data: { session: null } }; }
  },

  async getCurrentProfile(): Promise<UserProfile | null> {
    const localGens = parseInt(localStorage.getItem(USER_GENS_KEY) || '0');
    const localPremiumFlag = typeof window !== 'undefined' ? localStorage.getItem('chefvision_premium') === '1' : false;
    
    // Jeśli nie ma Supabase (Tryb Demo)
    if (!supabase) {
      const credits = Math.max(0, TRIAL_TOKENS - localGens);
      const status: SubscriptionStatus = localPremiumFlag
        ? 'premium'
        : credits <= 0 ? 'free_limited' : 'trial';
      return {
        id: 'local-chef',
        name: 'Restauracja Testowa',
        email: 'demo@chefvision.pl',
        subscriptionStatus: status,
        plan: localPremiumFlag ? 'premium' : credits <= 0 ? 'free' : 'trial',
        generationsUsed: localGens,
        credits: localPremiumFlag ? SUBSCRIPTION_TOKENS : credits,
        tokens: {
          trial: localPremiumFlag ? 0 : credits,
          subscription: localPremiumFlag ? SUBSCRIPTION_TOKENS : 0,
          extra: 0,
          total: localPremiumFlag ? SUBSCRIPTION_TOKENS : credits,
        },
      };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      let { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // Nowy użytkownik: profil trial (tokeny ustawia trigger SQL lub webhook)
      if (!profileData) {
        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 14);
        const { data: inserted } = await supabase.from('profiles').upsert({
          id: user.id,
          name: user.email?.split('@')[0] || 'Restauracja',
          email: user.email,
          plan: 'trial',
          subscription_status: 'trial',
          trial_tokens: TRIAL_TOKENS,
          trial_ends_at: trialEnds.toISOString(),
          ai_credits: TRIAL_TOKENS,
        }).select().single();
        profileData = inserted;
      }

      const gensUsed = profileData?.generations_used ?? localGens;
      const mapped = mapProfileTokens(profileData, { localPremiumFlag });

      return {
        id: user.id,
        name: profileData?.name || user.email?.split('@')[0] || 'Restauracja',
        email: user.email,
        subscriptionStatus: mapped.subscriptionStatus as SubscriptionStatus,
        plan: mapped.plan as UserProfile['plan'],
        generationsUsed: gensUsed,
        credits: mapped.credits,
        tokens: mapped.tokens,
        trialEndsAt: mapped.trialEndsAt,
      };
    } catch (e) { return null; }
  },

  async getProfileById(id: string): Promise<UserProfile | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return null;
      const mapped = mapProfileTokens(data);
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        subscriptionStatus: mapped.subscriptionStatus as SubscriptionStatus,
        plan: mapped.plan as UserProfile['plan'],
        generationsUsed: data.generations_used ?? 0,
        credits: mapped.credits,
        tokens: mapped.tokens,
        trialEndsAt: mapped.trialEndsAt,
      };
    } catch (e) {
      console.error('Błąd pobierania profilu po ID:', e);
      return null;
    }
  },

  /**
   * Zwiększa licznik generacji (statystyka). Tokeny odejmuje wyłącznie /api/generate-image.
   */
  async incrementGenerations(userId: string): Promise<{ generationsUsed: number; credits: number }> {
    const current = parseInt(localStorage.getItem(USER_GENS_KEY) || '0');
    const newGens = current + 1;
    localStorage.setItem(USER_GENS_KEY, newGens.toString());

    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ generations_used: newGens })
          .eq('id', userId);
      } catch (e) {
        console.error('incrementGenerations', e);
      }
    }

    const { data: updated } = supabase
      ? await supabase
          .from('profiles')
          .select(
            'plan, subscription_status, trial_tokens, trial_ends_at, subscription_tokens, extra_tokens, ai_credits, generations_used'
          )
          .eq('id', userId)
          .single()
      : { data: null };

    const credits = updated
      ? mapProfileTokens(updated).credits
      : Math.max(0, TRIAL_TOKENS - newGens);
    return { generationsUsed: newGens, credits };
  },

  async signOut() {
    if (supabase) await supabase.auth.signOut();
  },

  /** Ustawia status Premium w profilu (wywołaj po potwierdzeniu płatności Stripe). */
  async setPremiumStatus(userId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('profiles')
      .update({
        plan: 'premium',
        subscription_status: 'premium',
        subscription_tokens: SUBSCRIPTION_TOKENS,
        tokens_reset_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return !error;
  }
};
