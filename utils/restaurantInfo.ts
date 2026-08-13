import type {
  PublicMenuLocale,
  RestaurantHoursDay,
  RestaurantHoursException,
  RestaurantInfoContent,
  RestaurantInfoEvent,
  RestaurantInfoWeekday,
} from '../types';

export const RESTAURANT_INFO_WEEKDAYS: RestaurantInfoWeekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

const EMPTY_DAY: RestaurantHoursDay = { closed: false, from: '12:00', to: '22:00' };

function emptyWeekly(): Record<RestaurantInfoWeekday, RestaurantHoursDay> {
  return {
    mon: { ...EMPTY_DAY },
    tue: { ...EMPTY_DAY },
    wed: { ...EMPTY_DAY },
    thu: { ...EMPTY_DAY },
    fri: { ...EMPTY_DAY },
    sat: { ...EMPTY_DAY },
    sun: { ...EMPTY_DAY },
  };
}

export function emptyRestaurantInfoContent(): RestaurantInfoContent {
  return {
    about: { enabled: true, description: '', heroImageUrl: null },
    hours: { enabled: true, weekly: emptyWeekly(), exceptions: [] },
    contact: { enabled: true, phone: '', email: '', reservationUrl: '', instagram: '' },
    access: { enabled: true, address: '', mapsUrl: '', parking: '', directions: '' },
    events: { enabled: true, items: [] },
    extras: { enabled: false, dressCode: '', allergies: '', privateDining: '' },
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeDay(raw: unknown): RestaurantHoursDay {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_DAY };
  const row = raw as Record<string, unknown>;
  return {
    closed: asBool(row.closed),
    from: asString(row.from) || EMPTY_DAY.from,
    to: asString(row.to) || EMPTY_DAY.to,
  };
}

export function normalizeRestaurantInfoContent(raw?: unknown): RestaurantInfoContent {
  const base = emptyRestaurantInfoContent();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;

  const about = (src.about && typeof src.about === 'object' ? src.about : {}) as Record<string, unknown>;
  base.about = {
    enabled: asBool(about.enabled, true),
    description: asString(about.description),
    heroImageUrl: asString(about.heroImageUrl) || null,
  };

  const hours = (src.hours && typeof src.hours === 'object' ? src.hours : {}) as Record<string, unknown>;
  const weeklyRaw = (hours.weekly && typeof hours.weekly === 'object' ? hours.weekly : {}) as Record<string, unknown>;
  const weekly = emptyWeekly();
  for (const day of RESTAURANT_INFO_WEEKDAYS) {
    weekly[day] = normalizeDay(weeklyRaw[day]);
  }
  const exceptionsRaw = Array.isArray(hours.exceptions) ? hours.exceptions : [];
  base.hours = {
    enabled: asBool(hours.enabled, true),
    weekly,
    exceptions: exceptionsRaw
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const date = asString(row.date).trim();
        if (!date) return null;
        return {
          id: asString(row.id) || `ex-${index}-${date}`,
          date,
          note: asString(row.note),
          closed: asBool(row.closed, true),
        } satisfies RestaurantHoursException;
      })
      .filter((item): item is RestaurantHoursException => item !== null),
  };

  const contact = (src.contact && typeof src.contact === 'object' ? src.contact : {}) as Record<string, unknown>;
  base.contact = {
    enabled: asBool(contact.enabled, true),
    phone: asString(contact.phone),
    email: asString(contact.email),
    reservationUrl: asString(contact.reservationUrl),
    instagram: asString(contact.instagram),
  };

  const access = (src.access && typeof src.access === 'object' ? src.access : {}) as Record<string, unknown>;
  base.access = {
    enabled: asBool(access.enabled, true),
    address: asString(access.address),
    mapsUrl: asString(access.mapsUrl),
    parking: asString(access.parking),
    directions: asString(access.directions),
  };

  const events = (src.events && typeof src.events === 'object' ? src.events : {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(events.items) ? events.items : [];
  base.events = {
    enabled: asBool(events.enabled, true),
    items: itemsRaw
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const title = asString(row.title).trim();
        const date = asString(row.date).trim();
        if (!title && !date) return null;
        return {
          id: asString(row.id) || `ev-${index}-${date || title}`,
          title,
          date,
          description: asString(row.description),
          imageUrl: asString(row.imageUrl) || null,
        } satisfies RestaurantInfoEvent;
      })
      .filter((item): item is RestaurantInfoEvent => item !== null),
  };

  const extras = (src.extras && typeof src.extras === 'object' ? src.extras : {}) as Record<string, unknown>;
  base.extras = {
    enabled: asBool(extras.enabled, false),
    dressCode: asString(extras.dressCode),
    allergies: asString(extras.allergies),
    privateDining: asString(extras.privateDining),
  };

  return base;
}

export function weekdayLabel(day: RestaurantInfoWeekday, locale: PublicMenuLocale | 'en'): string {
  const isPl = locale === 'pl';
  const labels: Record<RestaurantInfoWeekday, [string, string]> = {
    mon: ['Poniedziałek', 'Monday'],
    tue: ['Wtorek', 'Tuesday'],
    wed: ['Środa', 'Wednesday'],
    thu: ['Czwartek', 'Thursday'],
    fri: ['Piątek', 'Friday'],
    sat: ['Sobota', 'Saturday'],
    sun: ['Niedziela', 'Sunday'],
  };
  return isPl ? labels[day][0] : labels[day][1];
}

function localIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayFromDate(now = new Date()): RestaurantInfoWeekday {
  const map: RestaurantInfoWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[now.getDay()];
}

export function getTodayHoursStatus(content: RestaurantInfoContent, now = new Date()) {
  const today = localIsoDate(now);
  const exception = content.hours.exceptions.find((item) => item.date === today);
  if (exception) {
    return {
      closed: exception.closed,
      from: '',
      to: '',
      note: exception.note,
      exception: true,
    };
  }
  const day = content.hours.weekly[weekdayFromDate(now)];
  return {
    closed: day.closed,
    from: day.from,
    to: day.to,
    note: '',
    exception: false,
  };
}

export function upcomingEvents(content: RestaurantInfoContent, now = new Date()): RestaurantInfoEvent[] {
  const today = localIsoDate(now);
  return [...content.events.items]
    .filter((item) => item.title.trim() && (!item.date || item.date >= today))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildMapsUrl(address: string, mapsUrl?: string): string {
  const custom = (mapsUrl || '').trim();
  if (/^https?:\/\//i.test(custom)) return custom;
  const query = encodeURIComponent((address || custom).trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function hasPublicRestaurantInfoContent(content: RestaurantInfoContent): boolean {
  if (content.about.description.trim() || content.about.heroImageUrl) return true;
  if (content.hours.weekly) return true;
  if (content.contact.phone || content.contact.email || content.contact.reservationUrl || content.contact.instagram) {
    return true;
  }
  if (content.access.address || content.access.parking || content.access.directions || content.access.mapsUrl) {
    return true;
  }
  if (upcomingEvents(content).length > 0) return true;
  if (content.extras.dressCode || content.extras.allergies || content.extras.privateDining) {
    return true;
  }
  return false;
}
