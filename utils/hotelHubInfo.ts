import type { HotelHubInfoAttraction, HotelHubInfoFields, PublicMenuLocale } from '../types';

export const EMPTY_HOTEL_INFO_FIELDS: HotelHubInfoFields = {
  contact: '',
  address: '',
  receptionPhone: '',
  email: '',
  receptionHours: '',
  checkIn: '',
  checkOut: '',
  breakfast: '',
  spa: '',
  bar: '',
  wifiNetworkName: '',
  wifiPassword: '',
  taxiOrder: '',
  parking: '',
  airportTransfer: '',
  attractions: [],
};

export const HOTEL_INFO_SECTION_DEFAULT_NAME = 'Informacje o hotelu';

type InfoFieldKey = Exclude<keyof HotelHubInfoFields, 'attractions'>;
type InfoFieldGroup = 'contact' | 'hours' | 'wifi' | 'transport';

const FIELD_DEFS: Array<{
  key: InfoFieldKey;
  labelPl: string;
  labelEn: string;
  placeholderPl: string;
  placeholderEn: string;
  group: InfoFieldGroup;
}> = [
  {
    key: 'contact',
    labelPl: 'Kontakt',
    labelEn: 'Contact',
    placeholderPl: 'Np. recepcja — dzwonek 0',
    placeholderEn: 'e.g. Reception — dial 0',
    group: 'contact',
  },
  {
    key: 'address',
    labelPl: 'Adres',
    labelEn: 'Address',
    placeholderPl: 'Ulica, kod, miasto',
    placeholderEn: 'Street, postcode, city',
    group: 'contact',
  },
  {
    key: 'receptionPhone',
    labelPl: 'Telefon recepcji',
    labelEn: 'Reception phone',
    placeholderPl: '+48 …',
    placeholderEn: '+48 …',
    group: 'contact',
  },
  {
    key: 'email',
    labelPl: 'E-mail',
    labelEn: 'Email',
    placeholderPl: 'recepcja@hotel.pl',
    placeholderEn: 'reception@hotel.com',
    group: 'contact',
  },
  {
    key: 'receptionHours',
    labelPl: 'Godziny recepcji',
    labelEn: 'Reception hours',
    placeholderPl: 'Np. 24h lub 07:00–23:00',
    placeholderEn: 'e.g. 24h or 07:00–23:00',
    group: 'contact',
  },
  {
    key: 'checkIn',
    labelPl: 'Check-in',
    labelEn: 'Check-in',
    placeholderPl: 'Np. od 15:00',
    placeholderEn: 'e.g. from 3:00 PM',
    group: 'hours',
  },
  {
    key: 'checkOut',
    labelPl: 'Check-out',
    labelEn: 'Check-out',
    placeholderPl: 'Np. do 11:00',
    placeholderEn: 'e.g. until 11:00 AM',
    group: 'hours',
  },
  {
    key: 'breakfast',
    labelPl: 'Śniadania',
    labelEn: 'Breakfast',
    placeholderPl: 'Np. 07:00–10:30',
    placeholderEn: 'e.g. 7:00–10:30 AM',
    group: 'hours',
  },
  {
    key: 'spa',
    labelPl: 'Spa',
    labelEn: 'Spa',
    placeholderPl: 'Np. 09:00–21:00',
    placeholderEn: 'e.g. 9:00 AM–9:00 PM',
    group: 'hours',
  },
  {
    key: 'bar',
    labelPl: 'Bar',
    labelEn: 'Bar',
    placeholderPl: 'Np. 17:00–01:00',
    placeholderEn: 'e.g. 5:00 PM–1:00 AM',
    group: 'hours',
  },
  {
    key: 'wifiNetworkName',
    labelPl: 'Nazwa sieci',
    labelEn: 'Network name',
    placeholderPl: 'np. Hotel Guest',
    placeholderEn: 'e.g. Hotel Guest',
    group: 'wifi',
  },
  {
    key: 'wifiPassword',
    labelPl: 'Hasło',
    labelEn: 'Password',
    placeholderPl: 'np. welcome123',
    placeholderEn: 'e.g. welcome123',
    group: 'wifi',
  },
  {
    key: 'taxiOrder',
    labelPl: 'Zamów taksówkę',
    labelEn: 'Order a taxi',
    placeholderPl: 'Np. tel. +48 … lub link do aplikacji',
    placeholderEn: 'e.g. phone +48 … or app link',
    group: 'transport',
  },
  {
    key: 'parking',
    labelPl: 'Parking',
    labelEn: 'Parking',
    placeholderPl: 'Np. parking podziemny — 50 zł/dobę',
    placeholderEn: 'e.g. underground parking — €10/night',
    group: 'transport',
  },
  {
    key: 'airportTransfer',
    labelPl: 'Transfer lotniskowy',
    labelEn: 'Airport transfer',
    placeholderPl: 'Np. zamów w recepcji, od 120 zł',
    placeholderEn: 'e.g. book at reception, from €30',
    group: 'transport',
  },
];

function normalizeAttractions(raw: unknown): HotelHubInfoAttraction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = String((item as HotelHubInfoAttraction).name ?? '').trim();
      const mapsUrl = String((item as HotelHubInfoAttraction).mapsUrl ?? '').trim();
      if (!name) return null;
      return { name, mapsUrl: mapsUrl || undefined };
    })
    .filter((item): item is HotelHubInfoAttraction => item !== null);
}

export function normalizeHotelInfoFields(raw?: HotelHubInfoFields | null): HotelHubInfoFields {
  const base = { ...EMPTY_HOTEL_INFO_FIELDS, attractions: [] as HotelHubInfoAttraction[] };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base) as (keyof HotelHubInfoFields)[]) {
    if (key === 'attractions') continue;
    const v = raw[key];
    if (typeof v === 'string') (base as Record<string, string>)[key] = v;
  }
  base.attractions = normalizeAttractions(raw.attractions);
  return base;
}

export function getHotelInfoFieldDefs(locale: PublicMenuLocale = 'pl') {
  const en = locale !== 'pl';
  return FIELD_DEFS.map((f) => ({
    ...f,
    label: en ? f.labelEn : f.labelPl,
    placeholder: en ? f.placeholderEn : f.placeholderPl,
  }));
}

export function getImportantHoursGroupLabel(locale: PublicMenuLocale): string {
  return locale === 'pl' ? 'Ważne godziny' : 'Important hours';
}

export function getContactGroupLabel(locale: PublicMenuLocale): string {
  return locale === 'pl' ? 'Kontakt' : 'Contact';
}

export function getWifiGroupLabel(locale: PublicMenuLocale): string {
  return 'Wi-Fi';
}

export function getTransportGroupLabel(locale: PublicMenuLocale): string {
  return locale === 'pl' ? 'Transport' : 'Transport';
}

export function getAttractionsGroupLabel(locale: PublicMenuLocale): string {
  return locale === 'pl' ? 'Atrakcje w okolicy' : 'Nearby attractions';
}

export function buildGoogleMapsUrl(name: string, mapsUrl?: string): string {
  const custom = (mapsUrl || '').trim();
  if (custom) {
    if (/^https?:\/\//i.test(custom)) return custom;
    return `https://${custom}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

export function infoFieldsForPublicDisplay(
  fields: HotelHubInfoFields,
  locale: PublicMenuLocale,
): Array<{ label: string; value: string; group: InfoFieldGroup }> {
  const defs = getHotelInfoFieldDefs(locale);
  return defs
    .map((d) => ({
      label: d.label,
      value: (fields[d.key] || '').trim(),
      group: d.group,
    }))
    .filter((row) => row.value.length > 0);
}

export function attractionsForPublicDisplay(fields: HotelHubInfoFields): HotelHubInfoAttraction[] {
  return normalizeAttractions(fields.attractions);
}

export function hasAnyHotelInfoContent(fields: HotelHubInfoFields, locale: PublicMenuLocale): boolean {
  return infoFieldsForPublicDisplay(fields, locale).length > 0 || attractionsForPublicDisplay(fields).length > 0;
}

export function isHotelInfoSection(section: { sectionType?: string; name?: string }): boolean {
  if (section.sectionType === 'info') return true;
  return (section.name || '').trim() === HOTEL_INFO_SECTION_DEFAULT_NAME;
}
