/**
 * Transaction — a customer payment for a wash session.
 *
 * Status values mirror the Prisma `TransactionStatus` enum exactly.
 */

export type TransactionStatus =
  | 'pending' // created, awaiting ePoint authorization
  | 'paid_crediting' // bank approved, waiting for hardware ACK
  | 'paid_credited' // hardware confirmed — successful end-to-end
  | 'paid_hardware_error' // bank approved but hardware never confirmed (30s timeout)
  | 'declined' // bank declined
  | 'cancelled'; // user cancelled in ePoint sheet

import type { CardBrand } from './customer';

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'cash';

export interface Transaction {
  id: string;
  customerId: string | null; // null after account deletion (anonymized)
  bayId: string;
  locationId: string;
  tenantId: string;
  amountAzn: string; // Decimal serialized as string (e.g. "2.50")
  status: TransactionStatus;
  ePointReference: string | null;
  paymentMethod: PaymentMethod | null;
  cardBrand: CardBrand | null;
  cardLastFour: string | null;
  hardwareCreditedAt: string | null;
  errorReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the customer sees in their History tab. */
export interface CustomerTransaction {
  id: string;
  amountAzn: string;
  status: TransactionStatus;
  tenantBrandName: string;
  tenantLogoUrl: string | null;
  bayName: string;
  locationAddress: string;
  paymentMethod: PaymentMethod | null;
  cardBrand: CardBrand | null;
  cardLastFour: string | null;
  createdAt: string;
}
