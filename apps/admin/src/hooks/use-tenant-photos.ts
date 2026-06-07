import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTenantPhoto,
  deleteTenantPhoto,
  listTenantPhotos,
  patchTenantPhoto,
  type TenantPhoto,
} from '@/lib/tenant-photos-api';

export const tenantPhotosKey = ['tenant-photos'] as const;

export function useTenantPhotos() {
  return useQuery<TenantPhoto[]>({
    queryKey: tenantPhotosKey,
    queryFn: listTenantPhotos,
  });
}

export function useCreateTenantPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTenantPhoto,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantPhotosKey });
    },
  });
}

export function usePatchTenantPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { sortOrder?: number; isHero?: boolean } }) =>
      patchTenantPhoto(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantPhotosKey });
    },
  });
}

export function useDeleteTenantPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTenantPhoto(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantPhotosKey });
    },
  });
}
