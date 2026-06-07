import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBay,
  fetchLocationBays,
  regenerateBayQr,
  updateBay,
  type BayStatus,
  type CreateBayInput,
  type TenantBay,
  type UpdateBayInput,
} from '@/lib/bays-api';

export const locationBaysKey = (locationId: string) => ['location-bays', locationId] as const;

export function useLocationBays(locationId: string | null) {
  return useQuery<TenantBay[]>({
    queryKey: locationId ? locationBaysKey(locationId) : ['location-bays', '__none__'],
    queryFn: () => fetchLocationBays(locationId!),
    enabled: !!locationId,
  });
}

export function useCreateBay(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBayInput) => createBay(locationId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationBaysKey(locationId) });
    },
  });
}

export function useUpdateBay(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBayInput }) => updateBay(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationBaysKey(locationId) });
    },
  });
}

export function useToggleBayStatus(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BayStatus }) => updateBay(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationBaysKey(locationId) });
    },
  });
}

export function useRegenerateBayQr(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => regenerateBayQr(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationBaysKey(locationId) });
    },
  });
}
