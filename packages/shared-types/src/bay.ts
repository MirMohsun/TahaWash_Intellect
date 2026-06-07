/**
 * Bay — an individual wash box at a location. Each bay has a unique QR.
 */

export type BayStatus = 'active' | 'disabled';

export interface Bay {
  id: string;
  locationId: string;
  tenantId: string;
  name: string;
  /** Hardware identifier (set when hardware is wired up). */
  hardwareIdentifier: string | null;
  /** Short ID embedded in the QR code URL, e.g. "9KX42P". */
  qrShortId: string;
  status: BayStatus;
  createdAt: string;
}

/** The minimal view returned when a customer scans a QR. */
export interface PublicBayCharge {
  id: string;
  name: string;
  qrShortId: string;
  tenantId: string;
  tenantName: string;
  locationName: string;
  locationAddress: string;
  /** Tenant-configured minimum charge in AZN. */
  minChargeAmount: number;
  /** Tenant-configured increment step in AZN. */
  chargeStep: number;
}
