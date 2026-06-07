/**
 * Shared Zod schemas — used by mobile, admin, and backend so that validation
 * logic is identical everywhere a value crosses a boundary.
 */

import { z } from 'zod';
import { validateAzPhone } from './phone';

/** Azerbaijani mobile number (any accepted format). */
export const AzPhoneSchema = z
  .string()
  .refine(validateAzPhone, { message: 'Invalid Azerbaijani phone number' });

/** 6-digit OTP code. */
export const OtpSchema = z.string().regex(/^\d{6}$/, '6-digit code required');

/** Charge amount (AZN): positive, <= 100, in 0.50 increments. */
export const ChargeAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(100, 'Amount too high')
  .refine((n) => Math.round(n * 100) % 50 === 0, {
    message: 'Amount must be in 0,50 ₼ increments',
  });

/** Email address. */
export const EmailSchema = z.string().email('Invalid email address');

/** Strong password (≥8 chars, at least one number + letter). */
export const StrongPasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

/** Hex color (#RGB or #RRGGBB). Used for tenant brand color. */
export const HexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color');

/** AZ language code. */
export const LanguageSchema = z.enum(['az', 'ru', 'en']);

/** A `{ az, ru, en }` translatable string object (all three required). */
export const TranslatableStringSchema = z.object({
  az: z.string().min(1),
  ru: z.string().min(1),
  en: z.string().min(1),
});

export type TranslatableString = z.infer<typeof TranslatableStringSchema>;
