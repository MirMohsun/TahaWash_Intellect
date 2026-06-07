import { api } from './api';

export interface FeaturedTenantItem {
  tenantId: string;
  sortOrder: number;
  tenant: {
    id: string;
    brandName: string;
    themeColor: string;
    logoUrl: string | null;
    heroPhotoUrl: string | null;
    firstLocation: {
      id: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    } | null;
  };
}

export async function listFeatured(): Promise<FeaturedTenantItem[]> {
  const res = await api.get<FeaturedTenantItem[]>('/public/featured');
  return res.data;
}
