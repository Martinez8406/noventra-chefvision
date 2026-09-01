
export type SubscriptionStatus = 'trial' | 'premium' | 'free_limited' | 'start';

export type PlanSlug = 'trial' | 'premium' | 'free' | 'start';

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
export type DishRecommendationType = 'polecane' | 'popularne' | 'zestaw' | 'oferta_tygodnia';

/** Waluta cen w rekomendacji sprzedażowej. */
export type RecommendationCurrency =
  | 'PLN'
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'CHF'
  | 'CZK'
  | 'SEK'
  | 'NOK'
  | 'DKK'
  | 'HUF'
  | 'UAH'
  | 'ILS'
  | 'AED'
  | 'CAD'
  | 'AUD';

export interface DishRecommendationItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Cena liczbowa (bez symbolu waluty) */
  price?: string;
  imageUrl?: string;
  emoji?: string;
  /** Własna etykieta slotu w „Szef kuchni poleca” (np. Wino, Piwo) */
  slotLabel?: string;
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
  /** Waluta wszystkich cen w tej rekomendacji */
  currency?: RecommendationCurrency;
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
  /** Cena pozycji w menu cyfrowym (bez symbolu waluty) */
  menuPrice?: string | null;
  /** Waluta ceny w menu cyfrowym */
  menuPriceCurrency?: RecommendationCurrency;
  /** Kategoria w karcie menu */
  category?: string | null;
  /** Punkt kadrowania zdjęcia w menu cyfrowym (CSS object-position) */
  imageObjectPosition?: string | null;
  /** Powiększenie kadru zdjęcia w menu cyfrowym (1 = 100%) */
  imageScale?: number | null;
  /** Tłumaczenia opisu i alergenów (JSONB). Klucze: en, he, ar, uk, de, es, it, ko, ja, fr, cs, nl, zh. Nazwa zawsze z pola `name`. */
  translations?: Partial<Record<'en' | 'he' | 'ar' | 'uk' | 'de' | 'es' | 'it' | 'ko' | 'ja' | 'fr' | 'cs' | 'nl' | 'zh', MenuTranslationEntry>> | null;
  isStandard: boolean;
  /** Widoczne w menu restauracji (Live Menu → Restaurant) */
  isOnline: boolean;
  /** Widoczne w sekcjach Hotel Hub */
  visibleInHotelHub?: boolean;
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

/** Rola w zespole ChefVision (nie mylić z UserRole CHEF/STAFF w UI). */
export type PlatformRole = 'user' | 'admin' | 'staff';

/** Status płatnego zlecenia wykonania menu cyfrowego. */
export type MenuServiceStatus = 'pending' | 'paid' | 'in_progress' | 'done' | 'cancelled';

/** Status płatnego zlecenia ulotki QR (ten sam cykl co menu). */
export type FlyerServiceStatus = MenuServiceStatus;

export interface MenuServiceOrder {
  id: string;
  clientUserId: string;
  clientName?: string;
  clientEmail?: string | null;
  status: MenuServiceStatus;
  notes?: string | null;
  assignedTo?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

/** Kontekst edycji konta klienta przez admina (ze zlecenia menu lub listy Premium). */
export interface ManagingClientContext {
  clientUserId: string;
  clientName: string;
  clientEmail?: string | null;
  /** Jeśli otwarto ze zlecenia menu — ID i status zlecenia. */
  menuOrderId?: string | null;
  menuOrderStatus?: MenuServiceStatus | null;
}

export interface AdminClientProfile {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  subscriptionStatus: string;
  waiterEnabled: boolean;
  waiterConfigured: boolean;
}

export type FlyerServiceOrder = MenuServiceOrder;

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
  /** admin/staff widzą panel zleceń i mogą edytować menu klientów. */
  platformRole?: PlatformRole;
  /** Najnowsze aktywne zlecenie wykonania menu (jeśli jest). */
  menuServiceStatus?: MenuServiceStatus | null;
  /** Najnowsze aktywne zlecenie ulotki QR (jeśli jest). */
  flyerServiceStatus?: FlyerServiceStatus | null;
  /** Jednorazowy plan Founder Lifetime (Premium bez abonamentu). */
  isLifetime?: boolean;
}

export interface Backdrop {
  id: string;
  imageUrl: string;
}

export type HotelHubAvailabilityMode = '24h' | 'custom';

export type HotelHubSectionType = 'menu' | 'info';

/** Pola sekcji „Informacje o hotelu”. */
export interface HotelHubInfoAttraction {
  name: string;
  mapsUrl?: string;
}

export interface HotelHubInfoFields {
  contact?: string;
  address?: string;
  receptionPhone?: string;
  email?: string;
  receptionHours?: string;
  checkIn?: string;
  checkOut?: string;
  breakfast?: string;
  spa?: string;
  bar?: string;
  wifiNetworkName?: string;
  wifiPassword?: string;
  taxiOrder?: string;
  parking?: string;
  airportTransfer?: string;
  attractions?: HotelHubInfoAttraction[];
}

export interface HotelHubSection {
  id: string;
  userId: string;
  name: string;
  iconEmoji: string;
  heroImageUrl?: string | null;
  description: string;
  isVisible: boolean;
  sectionType: HotelHubSectionType;
  infoFields?: HotelHubInfoFields | null;
  availabilityMode: HotelHubAvailabilityMode;
  availabilityFrom?: string | null;
  availabilityTo?: string | null;
  serviceNotes: string;
  sortOrder: number;
}

export interface HotelHubCategory {
  id: string;
  userId: string;
  sectionId: string;
  name: string;
  sortOrder: number;
}

export interface ProductSectionAssignment {
  id: string;
  userId: string;
  dishId: string;
  sectionId: string;
  categoryId: string;
}

/** Pełny stan Hotel Hub dla panelu admina i menu publicznego */
export interface HotelHubData {
  enabled: boolean;
  sections: HotelHubSection[];
  categories: HotelHubCategory[];
  assignments: ProductSectionAssignment[];
}

export type RestaurantInfoWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface RestaurantHoursDay {
  closed: boolean;
  from: string;
  to: string;
}

export interface RestaurantHoursException {
  id: string;
  date: string;
  note: string;
  closed: boolean;
}

export interface RestaurantInfoEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  imageUrl?: string | null;
}

export interface RestaurantInfoContent {
  about: { enabled: boolean; description: string; heroImageUrl: string | null };
  hours: {
    enabled: boolean;
    weekly: Record<RestaurantInfoWeekday, RestaurantHoursDay>;
    exceptions: RestaurantHoursException[];
  };
  contact: {
    enabled: boolean;
    phone: string;
    email: string;
    reservationUrl: string;
    instagram: string;
  };
  access: {
    enabled: boolean;
    address: string;
    mapsUrl: string;
    parking: string;
    directions: string;
  };
  events: { enabled: boolean; items: RestaurantInfoEvent[] };
  extras: {
    enabled: boolean;
    dressCode: string;
    allergies: string;
    privateDining: string;
  };
}

export interface RestaurantInfoData {
  enabled: boolean;
  content: RestaurantInfoContent;
}

export type PublicMenuMode = 'restaurant' | 'hub' | 'info';

export type PromoCodeStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface PromoCodeRecord {
  id: string;
  code: string;
  rewardName: string;
  rewardDescription: string | null;
  status: PromoCodeStatus;
  email?: string | null;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
}
