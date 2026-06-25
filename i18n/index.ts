import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import plNav from '../locales/pl/nav.json';
import enNav from '../locales/en/nav.json';
import plSidebar from '../locales/pl/sidebar.json';
import enSidebar from '../locales/en/sidebar.json';
import plKitchen from '../locales/pl/kitchen.json';
import enKitchen from '../locales/en/kitchen.json';
import plStudio from '../locales/pl/studio.json';
import enStudio from '../locales/en/studio.json';
import plThemes from '../locales/pl/themes.json';
import enThemes from '../locales/en/themes.json';
import plBackdrops from '../locales/pl/backdrops.json';
import enBackdrops from '../locales/en/backdrops.json';
import plMenu from '../locales/pl/menu.json';
import enMenu from '../locales/en/menu.json';
import plStats from '../locales/pl/stats.json';
import enStats from '../locales/en/stats.json';
import plPromotions from '../locales/pl/promotions.json';
import enPromotions from '../locales/en/promotions.json';
import plHotelHub from '../locales/pl/hotelHub.json';
import enHotelHub from '../locales/en/hotelHub.json';
import plSettings from '../locales/pl/settings.json';
import enSettings from '../locales/en/settings.json';

export const APP_LANG_STORAGE_KEY = 'chefvision_app_lang';

export type AppLanguage = 'pl' | 'en';

function resolveInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'pl';
  const stored = localStorage.getItem(APP_LANG_STORAGE_KEY);
  if (stored === 'en' || stored === 'pl') return stored;
  const nav = navigator.language?.toLowerCase() ?? '';
  if (nav.startsWith('en')) return 'en';
  return 'pl';
}

function syncDocumentLanguage(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng.startsWith('en') ? 'en' : 'pl';
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    pl: { nav: plNav, sidebar: plSidebar, kitchen: plKitchen, studio: plStudio, themes: plThemes, backdrops: plBackdrops, menu: plMenu, stats: plStats, promotions: plPromotions, hotelHub: plHotelHub, settings: plSettings },
    en: { nav: enNav, sidebar: enSidebar, kitchen: enKitchen, studio: enStudio, themes: enThemes, backdrops: enBackdrops, menu: enMenu, stats: enStats, promotions: enPromotions, hotelHub: enHotelHub, settings: enSettings },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: 'pl',
  defaultNS: 'nav',
  ns: ['nav', 'sidebar', 'kitchen', 'studio', 'themes', 'backdrops', 'menu', 'stats', 'promotions', 'hotelHub', 'settings'],
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  const normalized: AppLanguage = lng.startsWith('en') ? 'en' : 'pl';
  localStorage.setItem(APP_LANG_STORAGE_KEY, normalized);
  syncDocumentLanguage(normalized);
});

syncDocumentLanguage(i18n.language);

export default i18n;
