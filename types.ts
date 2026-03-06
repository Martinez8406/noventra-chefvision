
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
  isStandard: boolean;
  isOnline: boolean;
  status: DishStatus;
  restaurantId: string;
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
