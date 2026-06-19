import type { HotelHubAvailabilityMode, HotelHubSection } from '../types';
import { HOTEL_HUB_ICON_SRC } from '../constants';

export const HOTEL_HUB_SERVICE_NOTE_TEMPLATES = [
  'Usually follows restaurant opening hours.',
  'Full restaurant menu during the day. Limited menu during late-night hours.',
] as const;

export interface HotelHubSectionTemplate {
  name: string;
  iconEmoji: string;
  description: string;
  categories: string[];
  availabilityMode: HotelHubAvailabilityMode;
  availabilityFrom?: string;
  availabilityTo?: string;
  serviceNotes: string;
}

export const HOTEL_HUB_DEFAULT_SECTION_TEMPLATES: HotelHubSectionTemplate[] = [
  {
    name: 'Room Service',
    iconEmoji: HOTEL_HUB_ICON_SRC,
    description: 'Order to your room — breakfast, all-day dining and late-night bites.',
    categories: ['Breakfast', 'All Day Dining', 'Late Night Menu', 'Kids Menu', 'Beverages'],
    availabilityMode: 'custom',
    availabilityFrom: '07:00',
    availabilityTo: '22:00',
    serviceNotes: HOTEL_HUB_SERVICE_NOTE_TEMPLATES[1],
  },
  {
    name: 'Bar',
    iconEmoji: HOTEL_HUB_ICON_SRC,
    description: 'Cocktails, wines and refreshments in a relaxed hotel atmosphere.',
    categories: ['Cocktails', 'Wine', 'Beer', 'Soft Drinks'],
    availabilityMode: 'custom',
    availabilityFrom: '16:00',
    availabilityTo: '01:00',
    serviceNotes: HOTEL_HUB_SERVICE_NOTE_TEMPLATES[0],
  },
  {
    name: 'Spa',
    iconEmoji: HOTEL_HUB_ICON_SRC,
    description: 'Treatments and wellness experiences for complete relaxation.',
    categories: ['Massages', 'Facial Treatments', 'Wellness Packages'],
    availabilityMode: 'custom',
    availabilityFrom: '09:00',
    availabilityTo: '20:00',
    serviceNotes: 'Advance booking recommended.',
  },
];

/** Formatuje godzinę HH:MM do wyświetlenia (usuwa sekundy). */
export function formatHotelHubTime(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function formatHotelHubAvailability(
  section: Pick<HotelHubSection, 'availabilityMode' | 'availabilityFrom' | 'availabilityTo'>,
  locale: 'pl' | 'en' = 'pl',
): string {
  if (section.availabilityMode === '24h') {
    return locale === 'pl' ? 'Dostępne 24h' : 'Available 24h';
  }
  const from = formatHotelHubTime(section.availabilityFrom);
  const to = formatHotelHubTime(section.availabilityTo);
  if (!from && !to) {
    return locale === 'pl' ? 'Godziny do ustalenia' : 'Hours to be confirmed';
  }
  if (locale === 'pl') {
    return `Dostępne od ${from || '—'} do ${to || '—'}`;
  }
  return `Available from ${from || '—'} to ${to || '—'}`;
}

export function sortHotelHubSections<T extends { sortOrder: number; name: string }>(sections: T[]): T[] {
  return [...sections].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortHotelHubCategories<T extends { sortOrder: number; name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
