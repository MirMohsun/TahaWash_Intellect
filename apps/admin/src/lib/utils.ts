import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Local utilities specific to the admin app.
 *
 * Shared formatters (currency, phone, time) live in `@tahawash/shared-utils`
 * — import them directly there instead of re-exporting through this file.
 */

/**
 * Merge Tailwind class names, deduplicating conflicting utilities.
 * shadcn-style helper used throughout components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Re-exports kept for backward compatibility with code already importing from
// `@/lib/utils`. New code should import directly from '@tahawash/shared-utils'.
export { formatAZN, formatAzPhone } from '@tahawash/shared-utils';
