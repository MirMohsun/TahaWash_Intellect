/**
 * Customer — end user of the Tahawash mobile app.
 * Identified by phone number (+994 only). Name is optional.
 */

export type CustomerLanguage = 'az' | 'ru' | 'en';

export interface Customer {
  id: string;
  phone: string; // +994... format
  name: string | null;
  language: CustomerLanguage;
  city: string | null;
  pushToken: string | null;
  pushPlatform: 'ios' | 'android' | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CardBrand = 'visa' | 'mastercard' | 'unionpay' | 'maestro' | 'unknown';

export interface SavedCard {
  id: string;
  customerId: string;
  ePointToken: string;
  brand: CardBrand;
  lastFour: string;
  isDefault: boolean;
  createdAt: string;
}
