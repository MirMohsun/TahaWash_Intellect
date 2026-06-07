/**
 * @tahawash/i18n-locales
 *
 * Single source of truth for translation files. Mobile, admin, and (where
 * relevant) backend all import from here.
 *
 * Add new keys here; the type of `Translations` will narrow automatically
 * via TypeScript inference, and missing keys will surface as type errors.
 */

import az from './az.json';
import en from './en.json';
import ru from './ru.json';

export const locales = { az, ru, en } as const;

export type SupportedLanguage = keyof typeof locales;
export type Translations = (typeof locales)['en'];

export { az, en, ru };
