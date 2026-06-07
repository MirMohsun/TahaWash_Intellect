/**
 * Tenant — a carwash business operating on the Tahawash platform.
 *
 * These types describe API contracts (what the backend serializes to JSON
 * for the frontends). They mirror the Prisma `Tenant` + `TenantUser`
 * models in apps/backend/prisma/schema.prisma but as flat plain-old-data
 * shapes that are runtime-importable by mobile + admin without pulling in
 * the Prisma client.
 */

export type TenantStatus = 'pending' | 'active' | 'suspended' | 'hidden';

/** Full tenant record — used by super-admin views and tenant self-view. */
export interface Tenant {
  id: string;
  brandName: string;
  legalName: string;
  voen: string; // AZ tax ID
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: string; // Decimal serialized as string (e.g. "1.00")
  chargeStep: string; // Decimal serialized as string (e.g. "0.50")
  status: TenantStatus;
  subscriptionStart: string | null; // ISO datetime
  subscriptionEnd: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Tenant owner login record (separate from Tenant). */
export interface TenantUser {
  id: string;
  tenantId: string;
  username: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tenant view a customer sees on the tenant brand page. */
export interface PublicTenant {
  id: string;
  brandName: string;
  logoUrl: string | null;
  themeColor: string;
  photoUrls: string[];
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  isActive: boolean;
}
