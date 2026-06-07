import { useQuery } from '@tanstack/react-query';
import { fetchTenantLocations, type TenantLocation } from '@/lib/locations-api';

export const TENANT_LOCATIONS_KEY = ['tenant-locations'] as const;

export function useTenantLocations() {
  return useQuery<TenantLocation[]>({
    queryKey: TENANT_LOCATIONS_KEY,
    queryFn: fetchTenantLocations,
  });
}
