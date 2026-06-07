import { api } from './api';

/**
 * Typed wrappers over the public carwashes endpoints (Phase 1.6).
 *
 * Public = no auth header needed. Used by the Wash tab (map + list) and
 * the Tenant brand page.
 */

export interface PublicLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  workingHours: unknown;
  is24_7: boolean;
  bayCount: number;
  /** Present only when the request included a centerLat/Lng/radiusKm filter. */
  distanceKm?: number;
}

export interface PublicCarwash {
  id: string;
  brandName: string;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: string;
  chargeStep: string;
  photoUrls: string[];
  heroPhotoUrl: string | null;
  locations: PublicLocation[];
}

export interface ListCarwashesParams {
  page?: number;
  pageSize?: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

export interface ListCarwashesResponse {
  items: PublicCarwash[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /public/carwashes */
export async function listCarwashes(
  params: ListCarwashesParams = {},
): Promise<ListCarwashesResponse> {
  const res = await api.get<ListCarwashesResponse>('/public/carwashes', { params });
  return res.data;
}

export interface PublicService {
  id: string;
  iconKey: string;
  labelAz: string;
  labelRu: string;
  labelEn: string;
  sortOrder: number;
}

export interface PublicCarwashDetail extends PublicCarwash {
  services: PublicService[];
}

/** GET /public/carwashes/:id */
export async function getCarwashById(id: string): Promise<PublicCarwashDetail> {
  const res = await api.get<PublicCarwashDetail>(`/public/carwashes/${id}`);
  return res.data;
}
