
export type SubscriptionStatus = 'trial' | 'premium' | 'free_limited';

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

/** Języki w publicznym menu (UI); `pl` = oryginał z panelu (polski). */
export type PublicMenuLocale = 'pl' | 'en' | 'uk' | 'de' | 'es' | 'it' | 'ko' | 'fr' | 'zh';

/** Nazwa dania jest zawsze z `Dish.name` (PL) — nie tłumaczymy w API. */
export interface MenuTranslationEntry {
  description: string;
  /** Etykiety alergenów w danym języku — ta sama kolejność co `dish.allergens` (PL). */
  allergens?: string[];
  /** Nazwy składników w danym języku — ta sama kolejność co `dish.ingredients` (PL). */
  ingredients?: string[];
}

export interface Dish {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  technique: string;
  ingredients: string[];
  allergens: Allergen[];
  videoUrl?: string;
  /** Cena pozycji w menu cyfrowym (bez sufiksu "zł") */
  menuPrice?: string | null;
  /** Kategoria w karcie menu */
  category?: string | null;
  /** Tłumaczenia opisu i alergenów (JSONB). Klucze: en, uk, de, es, it, ko, fr, zh. Nazwa zawsze z pola `name`. */
  translations?: Partial<Record<'en' | 'uk' | 'de' | 'es' | 'it' | 'ko' | 'fr' | 'zh', MenuTranslationEntry>> | null;
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
  generationsUsed: number;
  /** Liczba kredytów na generowanie zdjęć (0 = wymaga Premium) */
  credits: number;
}

export interface Backdrop {
  id: string;
  imageUrl: string;
}
