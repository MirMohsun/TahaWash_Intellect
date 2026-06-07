import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTenantLocation,
  deleteTenantLocation,
  fetchTenantLocation,
  updateTenantLocation,
  updateTenantLocationStatus,
  type LocationInput,
  type LocationStatus,
  type TenantLocation,
} from '@/lib/locations-api';
import { TENANT_LOCATIONS_KEY } from './use-tenant-locations';

const locationKey = (id: string) => ['tenant-location', id] as const;

export function useTenantLocation(id: string | null) {
  return useQuery<TenantLocation>({
    queryKey: id ? locationKey(id) : ['tenant-location', '__none__'],
    queryFn: () => fetchTenantLocation(id!),
    enabled: !!id,
  });
}

/**
 * Mutations share an invalidation policy: any write invalidates the list
 * query so the /locations page re-fetches. The single-location query is
 * also invalidated on update/status so back-navigation shows fresh data.
 */
export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) => createTenantLocation(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TENANT_LOCATIONS_KEY });
    },
  });
}

export function useUpdateLocation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) => updateTenantLocation(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TENANT_LOCATIONS_KEY });
      void qc.invalidateQueries({ queryKey: locationKey(id) });
    },
  });
}

export function useUpdateLocationStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: LocationStatus) => updateTenantLocationStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TENANT_LOCATIONS_KEY });
      void qc.invalidateQueries({ queryKey: locationKey(id) });
    },
  });
}

export function useDeleteLocation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTenantLocation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TENANT_LOCATIONS_KEY });
    },
  });
}
