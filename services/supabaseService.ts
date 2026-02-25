
import { createClient } from '@supabase/supabase-js';
import { Dish, UserProfile, DishStatus, SubscriptionStatus } from '../types';

const SUPABASE_URL = (process.env as any).SUPABASE_URL || (process.env as any).NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = (process.env as any).SUPABASE_ANON_KEY || (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const isRealSupabase = !!SUPABASE_URL && !SUPABASE_URL.includes('placeholder') && SUPABASE_URL.startsWith('https://');

export const supabase = isRealSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const LOCAL_STORAGE_KEY = 'chefvision_dishes_v1';
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
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
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

export const db = {
  async getDishes(restaurantId: string): Promise<Dish[]> {
    if (supabase) {
      const { data, error } = await supabase.from('dishes').select('*').eq('restaurantId', restaurantId).order('createdAt', { ascending: false });
      if (!error) return data || [];
    }
    return getLocalDishes().filter(d => d.restaurantId === restaurantId);
  },

  /** Pobiera dania menu publicznego – tylko dania danego użytkownika (user_id / restaurantId) z isOnline = true. */
  async getDishesForPublicMenu(userId: string): Promise<Dish[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .eq('user_id', userId)
        .eq('isOnline', true)
        .order('createdAt', { ascending: false });
      if (!error) return data || [];
      const { data: fallback, error: err2 } = await supabase
        .from('dishes')
        .select('*')
        .eq('restaurantId', userId)
        .eq('isOnline', true)
        .order('createdAt', { ascending: false });
      if (!err2) return fallback || [];
    }
    return getLocalDishes().filter(d => (d.restaurantId === userId || (d as any).user_id === userId) && d.isOnline);
  },

  async saveDish(dish: Partial<Dish>): Promise<Dish | null> {
    if (supabase) {
      const { data, error } = await supabase.from('dishes').upsert(dish).select().single();
      if (!error) return data;
    }
    const dishes = getLocalDishes();
    const newDish = { id: dish.id || Math.random().toString(36).substr(2, 9), createdAt: Date.now(), clicks: 0, ...dish } as Dish;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newDish, ...dishes.filter(d => d.id !== newDish.id)]));
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
      const { error } = await supabase.from('dishes').update({ status, isStandard: status === DishStatus.APPROVED }).eq('id', id);
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
  }
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
      const credits = Math.max(0, 5 - localGens);
      const status: SubscriptionStatus = localPremiumFlag
        ? 'premium'
        : credits <= 0 ? 'free_limited' : 'trial';
      return {
        id: 'local-chef',
        name: 'Restauracja Testowa',
        email: 'demo@chefvision.pl',
        subscriptionStatus: status,
        generationsUsed: localGens,
        credits: localPremiumFlag ? 999999 : credits
      };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      let { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // Nowy użytkownik: utwórz profil z 5 kredytami
      if (!profileData) {
        const { data: inserted } = await supabase.from('profiles').upsert({
          id: user.id,
          name: user.email?.split('@')[0] || 'Restauracja',
          email: user.email,
          credits: 5,
          generations_used: 0,
          subscription_status: 'trial'
        }).select().single();
        profileData = inserted;
      }

      const gensUsed = profileData?.generations_used ?? localGens;
      const credits = profileData?.credits ?? 5;
      const isPremiumFromDb = profileData?.subscription_status === 'premium';
      const isPremium = isPremiumFromDb || localPremiumFlag;
      
      let status: SubscriptionStatus = 'trial';
      if (isPremium) {
        status = 'premium';
      } else if (credits <= 0) {
        status = 'free_limited';
      } else if (gensUsed >= 5) {
        status = 'free_limited';
      }

      return {
        id: user.id,
        name: profileData?.name || user.email?.split('@')[0] || 'Restauracja',
        email: user.email,
        subscriptionStatus: status,
        generationsUsed: gensUsed,
        credits: isPremium ? 999999 : (credits ?? 5)
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
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        subscriptionStatus: (data.subscription_status as SubscriptionStatus) ?? 'trial',
        generationsUsed: data.generations_used ?? 0,
        credits: data.credits ?? 5
      };
    } catch (e) {
      console.error('Błąd pobierania profilu po ID:', e);
      return null;
    }
  },

  /** Zapisuje użycie generacji i odejmuje 1 kredyt (dla użytkowników nie-Premium). Zwraca nową liczbę kredytów i generationsUsed. */
  async incrementGenerations(userId: string): Promise<{ generationsUsed: number; credits: number }> {
    const current = parseInt(localStorage.getItem(USER_GENS_KEY) || '0');
    const newGens = current + 1;
    localStorage.setItem(USER_GENS_KEY, newGens.toString());

    if (supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('credits, generations_used, subscription_status').eq('id', userId).single();
        const isPremium = profile?.subscription_status === 'premium';
        const gensUsed = (profile?.generations_used ?? 0) + 1;
        if (!isPremium && profile && (profile.credits ?? 5) > 0) {
          await supabase.from('profiles').update({
            credits: Math.max(0, (profile.credits ?? 5) - 1),
            generations_used: gensUsed
          }).eq('id', userId);
        } else if (isPremium) {
          await supabase.from('profiles').update({ generations_used: gensUsed }).eq('id', userId);
        }
      } catch (e) {
        console.error('incrementGenerations', e);
      }
    }

    const { data: updated } = supabase
      ? await supabase.from('profiles').select('credits, generations_used').eq('id', userId).single()
      : { data: null };
    const credits = updated?.credits ?? Math.max(0, 5 - newGens);
    return { generationsUsed: updated?.generations_used ?? newGens, credits };
  },

  async signOut() {
    if (supabase) await supabase.auth.signOut();
  },

  /** Ustawia status Premium w profilu (wywołaj po potwierdzeniu płatności Stripe). */
  async setPremiumStatus(userId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: 'premium' })
      .eq('id', userId);
    return !error;
  }
};
