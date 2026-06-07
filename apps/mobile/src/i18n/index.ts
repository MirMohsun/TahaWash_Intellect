import { locales } from '@tahawash/i18n-locales';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getStoredLanguage } from '../lib/language-store';

/**
 * Tahawash mobile i18n setup.
 *
 * Translations come from `@tahawash/i18n-locales` so mobile and admin share
 * the exact same source files. Adding/editing a key in one place updates both.
 *
 * Initial language is auto-detected from device via expo-localization;
 * falls back to AZ if device language isn't AZ/RU/EN.
 */
const deviceLocales = Localization.getLocales();
const deviceLang = deviceLocales[0]?.languageCode ?? 'az';
const supported = ['az', 'ru', 'en'] as const;
const initialLang: (typeof supported)[number] = supported.includes(
  deviceLang as (typeof supported)[number],
)
  ? (deviceLang as (typeof supported)[number])
  : 'az';

void i18n.use(initReactI18next).init({
  resources: {
    az: { translation: locales.az },
    ru: { translation: locales.ru },
    en: { translation: locales.en },
  },
  lng: initialLang,
  fallbackLng: 'az',
  supportedLngs: ['az', 'ru', 'en'],
  interpolation: { escapeValue: false },
});

// Restore the user's saved language over the device-locale default. The
// SecureStore read is async (i18next init is sync), so we initialize with
// the device guess above, then flip to the stored choice as soon as it
// resolves (~tens of ms). This is what makes the picked language survive a
// full app close/reopen instead of resetting to the device locale.
void getStoredLanguage().then((stored) => {
  if (stored && stored !== i18n.resolvedLanguage) {
    void i18n.changeLanguage(stored);
  }
});

export default i18n;
