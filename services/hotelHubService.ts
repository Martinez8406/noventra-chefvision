import { v4 as uuidv4 } from 'uuid';
import {
  HotelHubCategory,
  HotelHubData,
  HotelHubSection,
  ProductSectionAssignment,
} from '../types';
import { HOTEL_HUB_DEFAULT_SECTION_TEMPLATES } from '../utils/hotelHub';
import { HOTEL_HUB_ICON_SRC } from '../constants';
import { EMPTY_HOTEL_INFO_FIELDS, HOTEL_INFO_SECTION_DEFAULT_NAME, isHotelInfoSection, normalizeHotelInfoFields } from '../utils/hotelHubInfo';
import { canUseHotelHub } from '../utils/tokens';
import { supabase, uploadBackdropImage } from './supabaseService';

const LOCAL_SECTIONS_KEY = 'chefvision_hotel_hub_sections_v1';
const LOCAL_CATEGORIES_KEY = 'chefvision_hotel_hub_categories_v1';
const LOCAL_ASSIGNMENTS_KEY = 'chefvision_hotel_hub_assignments_v1';
const LOCAL_ENABLED_KEY = 'chefvision_hotel_hub_enabled_v1';

function useLocalOnly(userId: string): boolean {
  return !supabase || userId === 'local-chef';
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

async function ownerCanUseHotelHub(userId: string): Promise<boolean> {
  if (useLocalOnly(userId)) return true;
  const { data } = await supabase!
    .from('profiles')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', userId)
    .single();
  return canUseHotelHub(data as Record<string, unknown>);
}

function mapSectionRow(row: Record<string, unknown>): HotelHubSection {
  const name = String(row.name ?? '');
  const rawType = String(row.section_type ?? row.sectionType ?? 'menu');
  const sectionType: HotelHubSection['sectionType'] =
    rawType === 'info' || name.trim() === HOTEL_INFO_SECTION_DEFAULT_NAME ? 'info' : 'menu';
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    name,
    iconEmoji: String(row.icon_emoji ?? row.iconEmoji ?? HOTEL_HUB_ICON_SRC),
    heroImageUrl: (row.hero_image_url ?? row.heroImageUrl ?? null) as string | null,
    description: String(row.description ?? ''),
    isVisible: row.is_visible !== false && row.isVisible !== false,
    availabilityMode: (row.availability_mode ?? row.availabilityMode ?? '24h') as HotelHubSection['availabilityMode'],
    availabilityFrom: (row.availability_from ?? row.availabilityFrom ?? null) as string | null,
    availabilityTo: (row.availability_to ?? row.availabilityTo ?? null) as string | null,
    serviceNotes: String(row.service_notes ?? row.serviceNotes ?? ''),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    sectionType,
    infoFields: normalizeHotelInfoFields(
      (row.info_fields ?? row.infoFields) as HotelHubSection['infoFields'],
    ),
  };
}

function mapCategoryRow(row: Record<string, unknown>): HotelHubCategory {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    sectionId: String(row.section_id ?? row.sectionId),
    name: String(row.name ?? ''),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
  };
}

function isSchemaColumnError(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('section_type')
    || m.includes('info_fields')
    || m.includes('schema cache')
    || m.includes('could not find')
    || (m.includes('column') && m.includes('does not exist'))
  );
}

function buildSectionDbPayload(userId: string, payload: {
  id?: string;
  name: string;
  iconEmoji: string;
  heroImageUrl: string | null;
  description: string;
  isVisible: boolean;
  availabilityMode: HotelHubSection['availabilityMode'];
  availabilityFrom: string | null;
  availabilityTo: string | null;
  serviceNotes: string;
  sortOrder: number;
  sectionType: HotelHubSection['sectionType'];
  infoFields: HotelHubSection['infoFields'];
}, withInfoColumns: boolean): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {
    user_id: userId,
    name: payload.name,
    icon_emoji: payload.iconEmoji,
    hero_image_url: payload.heroImageUrl,
    description: payload.description,
    is_visible: payload.isVisible,
    availability_mode: payload.availabilityMode,
    availability_from: payload.availabilityFrom,
    availability_to: payload.availabilityTo,
    service_notes: payload.serviceNotes,
    sort_order: payload.sortOrder,
  };
  if (payload.id) dbPayload.id = payload.id;
  if (withInfoColumns) {
    dbPayload.section_type = payload.sectionType;
    dbPayload.info_fields = payload.sectionType === 'info' ? payload.infoFields : {};
  }
  return dbPayload;
}

function mapAssignmentRow(row: Record<string, unknown>): ProductSectionAssignment {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    dishId: String(row.dish_id ?? row.dishId),
    sectionId: String(row.section_id ?? row.sectionId),
    categoryId: String(row.category_id ?? row.categoryId),
  };
}

export const hotelHubDb = {
  async isHotelHubEnabled(userId: string): Promise<boolean> {
    if (useLocalOnly(userId)) {
      return localStorage.getItem(`${LOCAL_ENABLED_KEY}:${userId}`) === '1';
    }
    const { data, error } = await supabase!
      .from('profiles')
      .select('hotel_hub_enabled')
      .eq('id', userId)
      .single();
    if (error || !data) return false;
    return data.hotel_hub_enabled === true;
  },

  async setHotelHubEnabled(userId: string, enabled: boolean): Promise<boolean> {
    if (enabled && !(await ownerCanUseHotelHub(userId))) {
      return false;
    }
    if (useLocalOnly(userId)) {
      localStorage.setItem(`${LOCAL_ENABLED_KEY}:${userId}`, enabled ? '1' : '0');
      return true;
    }
    const { error } = await supabase!
      .from('profiles')
      .update({ hotel_hub_enabled: enabled })
      .eq('id', userId);
    return !error;
  },

  async getHotelHubData(userId: string): Promise<HotelHubData> {
    const enabled = await this.isHotelHubEnabled(userId);

    if (useLocalOnly(userId)) {
      const sections = readLocal<HotelHubSection>(LOCAL_SECTIONS_KEY).filter((s) => s.userId === userId);
      const categories = readLocal<HotelHubCategory>(LOCAL_CATEGORIES_KEY).filter((c) => c.userId === userId);
      const assignments = readLocal<ProductSectionAssignment>(LOCAL_ASSIGNMENTS_KEY).filter((a) => a.userId === userId);
      return { enabled, sections, categories, assignments };
    }

    const [sectionsRes, categoriesRes, assignmentsRes] = await Promise.all([
      supabase!.from('hotel_hub_sections').select('*').eq('user_id', userId).order('sort_order'),
      supabase!.from('hotel_hub_categories').select('*').eq('user_id', userId).order('sort_order'),
      supabase!.from('product_section_assignments').select('*').eq('user_id', userId),
    ]);

    return {
      enabled,
      sections: (sectionsRes.data || []).map((r) => mapSectionRow(r as Record<string, unknown>)),
      categories: (categoriesRes.data || []).map((r) => mapCategoryRow(r as Record<string, unknown>)),
      assignments: (assignmentsRes.data || []).map((r) => mapAssignmentRow(r as Record<string, unknown>)),
    };
  },

  async getHotelHubDataForPublicMenu(userId: string): Promise<HotelHubData> {
    const data = await this.getHotelHubData(userId);
    if (!data.enabled) {
      return { enabled: false, sections: [], categories: [], assignments: [] };
    }
    if (!(await ownerCanUseHotelHub(userId))) {
      return { enabled: false, sections: [], categories: [], assignments: [] };
    }
    await this.ensureHotelInfoSection(userId);
    const refreshed = await this.getHotelHubData(userId);
    return {
      ...refreshed,
      enabled: true,
      sections: refreshed.sections.filter((s) => s.isVisible),
    };
  },

  async seedDefaultSections(userId: string): Promise<HotelHubSection[]> {
    const existing = await this.getHotelHubData(userId);
    if (existing.sections.length > 0) return existing.sections;

    const created: HotelHubSection[] = [];
    for (let i = 0; i < HOTEL_HUB_DEFAULT_SECTION_TEMPLATES.length; i++) {
      const tpl = HOTEL_HUB_DEFAULT_SECTION_TEMPLATES[i];
      const section = await this.saveSection(userId, {
        name: tpl.name,
        iconEmoji: tpl.iconEmoji,
        description: tpl.description,
        sectionType: tpl.sectionType ?? 'menu',
        infoFields: tpl.sectionType === 'info' ? { ...EMPTY_HOTEL_INFO_FIELDS } : undefined,
        isVisible: true,
        availabilityMode: tpl.availabilityMode,
        availabilityFrom: tpl.availabilityFrom ?? null,
        availabilityTo: tpl.availabilityTo ?? null,
        serviceNotes: tpl.serviceNotes,
        sortOrder: i,
      });
      if (!section) continue;
      created.push(section);
      if (tpl.sectionType === 'info' || tpl.categories.length === 0) continue;
      for (let j = 0; j < tpl.categories.length; j++) {
        await this.saveCategory(userId, {
          sectionId: section.id,
          name: tpl.categories[j],
          sortOrder: j,
        });
      }
    }
    return created;
  },

  /** Dodaje sekcję informacyjną, jeśli użytkownik ma już starsze sekcje bez niej. */
  async ensureHotelInfoSection(userId: string): Promise<HotelHubSection | null> {
    const data = await this.getHotelHubData(userId);
    const existing = data.sections.find((s) => isHotelInfoSection(s));
    if (existing) {
      if (existing.sectionType !== 'info') {
        return this.saveSection(userId, {
          ...existing,
          sectionType: 'info',
          infoFields: normalizeHotelInfoFields(existing.infoFields),
        });
      }
      return existing;
    }

    const tpl = HOTEL_HUB_DEFAULT_SECTION_TEMPLATES.find((t) => t.sectionType === 'info');
    if (!tpl) return null;

    const minSort = data.sections.reduce((m, s) => Math.min(m, s.sortOrder), 0);
    return this.saveSection(userId, {
      name: tpl.name,
      iconEmoji: tpl.iconEmoji,
      description: '',
      sectionType: 'info',
      infoFields: { ...EMPTY_HOTEL_INFO_FIELDS },
      isVisible: true,
      availabilityMode: '24h',
      serviceNotes: '',
      sortOrder: minSort > 0 ? 0 : minSort - 1,
    });
  },

  async saveSection(
    userId: string,
    input: Partial<HotelHubSection> & { name: string },
  ): Promise<HotelHubSection | null> {
    const payload = {
      id: input.id,
      userId,
      name: input.name.trim(),
      iconEmoji: (input.iconEmoji || HOTEL_HUB_ICON_SRC).trim() || HOTEL_HUB_ICON_SRC,
      heroImageUrl: input.heroImageUrl ?? null,
      description: (input.description ?? '').trim(),
      isVisible: input.isVisible !== false,
      availabilityMode: input.availabilityMode ?? '24h',
      availabilityFrom: input.availabilityMode === 'custom' ? input.availabilityFrom ?? '07:00' : null,
      availabilityTo: input.availabilityMode === 'custom' ? input.availabilityTo ?? '22:00' : null,
      serviceNotes: (input.serviceNotes ?? '').trim(),
      sortOrder: input.sortOrder ?? 0,
      sectionType: input.sectionType ?? 'menu',
      infoFields:
        input.sectionType === 'info'
          ? normalizeHotelInfoFields(input.infoFields)
          : null,
    };

    if (useLocalOnly(userId)) {
      const all = readLocal<HotelHubSection>(LOCAL_SECTIONS_KEY);
      const id = payload.id || uuidv4();
      const row: HotelHubSection = {
        ...payload,
        id,
        userId,
        infoFields: payload.sectionType === 'info' ? payload.infoFields : null,
      };
      writeLocal(LOCAL_SECTIONS_KEY, [row, ...all.filter((s) => s.id !== id)]);
      return row;
    }

    const dbPayload: Record<string, unknown> = buildSectionDbPayload(userId, payload, true);

    let { data, error } = await supabase!
      .from('hotel_hub_sections')
      .upsert(dbPayload)
      .select('*')
      .single();

    if (error && isSchemaColumnError(error.message)) {
      const legacyPayload = buildSectionDbPayload(userId, payload, false);
      ({ data, error } = await supabase!
        .from('hotel_hub_sections')
        .upsert(legacyPayload)
        .select('*')
        .single());
    }

    if (error || !data) {
      console.error('[saveSection]', error?.message);
      return null;
    }
    return mapSectionRow(data as Record<string, unknown>);
  },

  async deleteSection(userId: string, sectionId: string): Promise<boolean> {
    if (useLocalOnly(userId)) {
      writeLocal(LOCAL_SECTIONS_KEY, readLocal<HotelHubSection>(LOCAL_SECTIONS_KEY).filter((s) => s.id !== sectionId));
      writeLocal(
        LOCAL_CATEGORIES_KEY,
        readLocal<HotelHubCategory>(LOCAL_CATEGORIES_KEY).filter((c) => c.sectionId !== sectionId),
      );
      writeLocal(
        LOCAL_ASSIGNMENTS_KEY,
        readLocal<ProductSectionAssignment>(LOCAL_ASSIGNMENTS_KEY).filter((a) => a.sectionId !== sectionId),
      );
      return true;
    }
    const { error } = await supabase!.from('hotel_hub_sections').delete().eq('id', sectionId).eq('user_id', userId);
    return !error;
  },

  async saveCategory(
    userId: string,
    input: Partial<HotelHubCategory> & { sectionId: string; name: string },
  ): Promise<HotelHubCategory | null> {
    const payload = {
      id: input.id,
      userId,
      sectionId: input.sectionId,
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? 0,
    };

    if (useLocalOnly(userId)) {
      const all = readLocal<HotelHubCategory>(LOCAL_CATEGORIES_KEY);
      const id = payload.id || uuidv4();
      const row: HotelHubCategory = { ...payload, id, userId };
      writeLocal(LOCAL_CATEGORIES_KEY, [row, ...all.filter((c) => c.id !== id)]);
      return row;
    }

    const dbPayload: Record<string, unknown> = {
      user_id: userId,
      section_id: payload.sectionId,
      name: payload.name,
      sort_order: payload.sortOrder,
    };
    if (payload.id) dbPayload.id = payload.id;

    const { data, error } = await supabase!
      .from('hotel_hub_categories')
      .upsert(dbPayload)
      .select('*')
      .single();
    if (error || !data) {
      console.error('[saveCategory]', error?.message);
      return null;
    }
    return mapCategoryRow(data as Record<string, unknown>);
  },

  async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    if (useLocalOnly(userId)) {
      writeLocal(
        LOCAL_CATEGORIES_KEY,
        readLocal<HotelHubCategory>(LOCAL_CATEGORIES_KEY).filter((c) => c.id !== categoryId),
      );
      writeLocal(
        LOCAL_ASSIGNMENTS_KEY,
        readLocal<ProductSectionAssignment>(LOCAL_ASSIGNMENTS_KEY).filter((a) => a.categoryId !== categoryId),
      );
      return true;
    }
    const { error } = await supabase!.from('hotel_hub_categories').delete().eq('id', categoryId).eq('user_id', userId);
    return !error;
  },

  async setDishHotelHubVisibility(dishId: string, visible: boolean): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('dishes').update({ visible_in_hotel_hub: visible }).eq('id', dishId);
      return !error;
    }
    return true;
  },

  async setDishAssignments(
    userId: string,
    dishId: string,
    assignments: Array<{ sectionId: string; categoryId: string }>,
  ): Promise<boolean> {
    if (useLocalOnly(userId)) {
      const others = readLocal<ProductSectionAssignment>(LOCAL_ASSIGNMENTS_KEY).filter(
        (a) => !(a.dishId === dishId && a.userId === userId),
      );
      const next = assignments.map((a) => ({
        id: uuidv4(),
        userId,
        dishId,
        sectionId: a.sectionId,
        categoryId: a.categoryId,
      }));
      writeLocal(LOCAL_ASSIGNMENTS_KEY, [...next, ...others]);
      return true;
    }

    const { error: delErr } = await supabase!
      .from('product_section_assignments')
      .delete()
      .eq('dish_id', dishId)
      .eq('user_id', userId);
    if (delErr) {
      console.error('[setDishAssignments] delete:', delErr.message, delErr.hint);
      return false;
    }

    if (assignments.length === 0) return true;

    const rows = assignments.map((a) => ({
      user_id: userId,
      dish_id: dishId,
      section_id: a.sectionId,
      category_id: a.categoryId,
    }));
    const { error: insErr } = await supabase!.from('product_section_assignments').insert(rows);
    if (insErr) {
      console.error('[setDishAssignments] insert:', insErr.message, insErr.hint);
      return false;
    }
    return true;
  },

  async uploadSectionHeroImage(userId: string, dataUrl: string): Promise<string> {
    return uploadBackdropImage(dataUrl, userId);
  },

  /** Ustawia ikonę hotelu we wszystkich sekcjach użytkownika. */
  async syncAllSectionIcons(userId: string): Promise<void> {
    const data = await this.getHotelHubData(userId);
    await Promise.all(
      data.sections
        .filter((s) => s.iconEmoji !== HOTEL_HUB_ICON_SRC)
        .map((s) => this.saveSection(userId, { ...s, iconEmoji: HOTEL_HUB_ICON_SRC })),
    );
  },
};
