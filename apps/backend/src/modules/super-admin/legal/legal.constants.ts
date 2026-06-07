/**
 * Legal document constants (C10.4).
 *
 * Type + language are typed at the DB column level as plain strings to
 * keep the schema simple; the allowed values live here as the single
 * source of truth. DTOs reference these arrays and the service validates
 * against `isLegalDocType` / `isLegalLanguage`.
 */
export const LEGAL_DOC_TYPES = ['terms', 'privacy'] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

export const LEGAL_LANGUAGES = ['az', 'ru', 'en'] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

export function isLegalDocType(v: string): v is LegalDocType {
  return (LEGAL_DOC_TYPES as readonly string[]).includes(v);
}

export function isLegalLanguage(v: string): v is LegalLanguage {
  return (LEGAL_LANGUAGES as readonly string[]).includes(v);
}

export interface LegalSection {
  heading: string;
  body: string;
}
