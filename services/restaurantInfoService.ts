import type { RestaurantInfoContent, RestaurantInfoData } from '../types';
import { canUseRestaurantInfo } from '../utils/tokens';
import {
  emptyRestaurantInfoContent,
  normalizeRestaurantInfoContent,
} from '../utils/restaurantInfo';
import { supabase, uploadBackdropImage } from './supabaseService';

const LOCAL_KEY = 'chefvision_restaurant_info_v1';

function useLocalOnly(userId: string): boolean {
  return !supabase || userId === 'local-chef';
}

function readLocalMap(): Record<string, RestaurantInfoData> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RestaurantInfoData>) : {};
  } catch {
    return {};
  }
}

function writeLocalMap(map: Record<string, RestaurantInfoData>): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
}

async function ownerCanUse(userId: string): Promise<boolean> {
  if (useLocalOnly(userId)) return true;
  const { data } = await supabase!
    .from('profiles')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', userId)
    .single();
  return canUseRestaurantInfo(data as Record<string, unknown>);
}

export const restaurantInfoDb = {
  async get(userId: string): Promise<RestaurantInfoData> {
    const empty: RestaurantInfoData = { enabled: false, content: emptyRestaurantInfoContent() };
    if (useLocalOnly(userId)) {
      return readLocalMap()[userId] ?? empty;
    }

    const { data, error } = await supabase!
      .from('profiles')
      .select('restaurant_info_enabled, restaurant_info')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const missing = /restaurant_info/i.test(error.message || '');
      if (missing) return empty;
      console.warn('[restaurant-info] get failed:', error.message);
      return empty;
    }

    return {
      enabled: data?.restaurant_info_enabled === true,
      content: normalizeRestaurantInfoContent(data?.restaurant_info),
    };
  },

  async getForPublicMenu(userId: string): Promise<RestaurantInfoData> {
    const data = await this.get(userId);
    if (!data.enabled) return { enabled: false, content: emptyRestaurantInfoContent() };
    if (!(await ownerCanUse(userId))) {
      return { enabled: false, content: emptyRestaurantInfoContent() };
    }
    return data;
  },

  async setEnabled(userId: string, enabled: boolean): Promise<boolean> {
    if (enabled && !(await ownerCanUse(userId))) return false;
    if (useLocalOnly(userId)) {
      const map = readLocalMap();
      const current = map[userId] ?? { enabled: false, content: emptyRestaurantInfoContent() };
      map[userId] = { ...current, enabled };
      writeLocalMap(map);
      return true;
    }

    const { error } = await supabase!
      .from('profiles')
      .update({ restaurant_info_enabled: enabled })
      .eq('id', userId);

    if (error) {
      console.warn('[restaurant-info] setEnabled failed:', error.message);
      return false;
    }
    return true;
  },

  async saveContent(userId: string, content: RestaurantInfoContent): Promise<boolean> {
    const normalized = normalizeRestaurantInfoContent(content);
    if (useLocalOnly(userId)) {
      const map = readLocalMap();
      const current = map[userId] ?? { enabled: false, content: emptyRestaurantInfoContent() };
      map[userId] = { ...current, content: normalized };
      writeLocalMap(map);
      return true;
    }

    const { error } = await supabase!
      .from('profiles')
      .update({ restaurant_info: normalized })
      .eq('id', userId);

    if (error) {
      console.warn('[restaurant-info] saveContent failed:', error.message);
      return false;
    }
    return true;
  },

  async uploadImage(userId: string, dataUrl: string): Promise<string> {
    return uploadBackdropImage(dataUrl, userId);
  },
};
