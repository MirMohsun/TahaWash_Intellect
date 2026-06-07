import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLocationPhoto,
  deleteLocationPhoto,
  listLocationPhotos,
  patchLocationPhoto,
  type LocationPhoto,
} from '@/lib/location-photos-api';

export const locationPhotosKey = (locationId: string) =>
  ['location-photos', locationId] as const;

export function useLocationPhotos(locationId: string) {
  return useQuery<LocationPhoto[]>({
    queryKey: locationPhotosKey(locationId),
    queryFn: () => listLocationPhotos(locationId),
  });
}

export function useCreateLocationPhoto(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; sortOrder?: number; isHero?: boolean }) =>
      createLocationPhoto(locationId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationPhotosKey(locationId) });
    },
  });
}

export function usePatchLocationPhoto(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { sortOrder?: number; isHero?: boolean } }) =>
      patchLocationPhoto(locationId, id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationPhotosKey(locationId) });
    },
  });
}

export function useDeleteLocationPhoto(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLocationPhoto(locationId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: locationPhotosKey(locationId) });
    },
  });
}
