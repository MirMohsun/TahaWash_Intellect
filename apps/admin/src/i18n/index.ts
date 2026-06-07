import { locales } from '@tahawash/i18n-locales';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/**
 * Tahawash admin i18n setup.
 *
 * Translations come from `@tahawash/i18n-locales` so mobile and admin share
 * the exact same source files. Adding/editing a key in one place updates both.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      az: { translation: locales.az },
      ru: { translation: locales.ru },
      en: { translation: locales.en },
    },
    fallbackLng: 'az',
    supportedLngs: ['az', 'ru', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tahawash.admin.lang',
    },
  });

export default i18n;
