
export type SubscriptionStatus = 'trial' | 'premium' | 'free_limited';

export type PlanSlug = 'trial' | 'premium' | 'free';

export interface UserTokens {
  trial: number;
  subscription: number;
  extra: number;
  total: number;
}

export enum DishStatus {
  APPROVED = 'Approved',
  PENDING = 'Pending Approval'
}

// Added UserRole enum to satisfy imports in components like DishGenerator.tsx
export enum UserRole {
  CHEF = 'CHEF',
  STAFF = 'STAFF'
}

export enum BlurLevel {
  NATURAL = 'NATURAL',
  INSTAGRAM = 'INSTAGRAM',
  FINE_DINING = 'FINE DINING'
}

export type Allergen = 'Gluten' | 'Laktoza' | 'Orzechy' | 'Skorupiaki' | 'Jaja' | 'Ryby' | 'Soja' | 'Gorczyca';

/** Oznaczenia dietetyczne / religijne w karcie menu. */
export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'lactose_free';

/** Poziom ostrości dania. */
export type SpiceLevel = 'mild' | 'medium' | 'hot';

/** Języki w publicznym menu (UI); `pl` = oryginał z panelu (polski). */
export type PublicMenuLocale =
  | 'pl'
  | 'en'
  | 'he'
  | 'ar'
  | 'uk'
  | 'de'
  | 'es'
  | 'it'
  | 'ko'
  | 'ja'
  | 'fr'
  | 'cs'
  | 'nl'
  | 'zh';

/** Nazwa dania jest zawsze z `Dish.name` (PL) — nie tłumaczymy w API. */
export interface MenuTranslationEntry {
  description: string;
  /** Etykiety alergenów w danym języku — ta sama kolejność co `dish.allergens` (PL). */
  allergens?: string[];
  /** Nazwy składników w danym języku — ta sama kolejność co `dish.ingredients` (PL). */
  ingredients?: string[];
}

/** Typ rekomendacji sprzedażowej na karcie dania (max. jeden na danie). */
export type DishRecommendationType = 'polecane' | 'popularne' | 'zestaw';

export interface DishRecommendationItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Cena bez sufiksu „zł” */
  price?: string;
  imageUrl?: string;
  emoji?: string;
}

export interface DishRecommendation {
  id: string;
  dishId: string;
  type: DishRecommendationType;
  isActive: boolean;
  /** Opcjonalny własny nagłówek sekcji (zamiast domyślnego) */
  customHeaderText?: string;
  items: DishRecommendationItem[];
  /** Tylko dla typu „zestaw” — suma cen pozycji poza zestawem */
  bundlePriceOutside?: string;
  /** Tylko dla typu „zestaw” — cena zestawu */
  bundlePrice?: string;
}

export interface Dish {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  technique: string;
  ingredients: string[];
  allergens: Allergen[];
  /** Oznaczenia dietetyczne / religijne (V, VG, Halal, itd.) */
  dietaryTags?: DietaryTag[];
  /** Poziom ostrości — null = brak oznaczenia */
  spiceLevel?: SpiceLevel | null;
  videoUrl?: string;
  /** Cena pozycji w menu cyfrowym (bez sufiksu "zł") */
  menuPrice?: string | null;
  /** Kategoria w karcie menu */
  category?: string | null;
  /** Tłumaczenia opisu i alergenów (JSONB). Klucze: en, he, ar, uk, de, es, it, ko, ja, fr, cs, nl, zh. Nazwa zawsze z pola `name`. */
  translations?: Partial<Record<'en' | 'he' | 'ar' | 'uk' | 'de' | 'es' | 'it' | 'ko' | 'ja' | 'fr' | 'cs' | 'nl' | 'zh', MenuTranslationEntry>> | null;
  isStandard: boolean;
  isOnline: boolean;
  status: DishStatus;
  restaurantId?: string;
  createdAt: number;
  clicks: number;
  authorId?: string;
}

export interface GeneratorParams {
  dishName: string;
  lighting: string;
  plateType: string;
  cameraAngle: string;
  style: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  subscriptionStatus: SubscriptionStatus;
  plan?: PlanSlug;
  generationsUsed: number;
  /** Suma dostępnych tokenów (trial + subscription + extra). */
  credits: number;
  tokens?: UserTokens;
  trialEndsAt?: string | null;
}

export interface Backdrop {
  id: string;
  imageUrl: string;
}
