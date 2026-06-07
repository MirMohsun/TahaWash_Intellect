/**
 * Location photo gallery — typed wrappers over
 * /tenant/locations/:locationId/photos endpoints.
 */
import { api } from './api';

export interface LocationPhoto {
  id: string;
  locationId: string;
  url: string;
  sortOrder: number;
  isHero: boolean;
  createdAt: string;
}

export async function listLocationPhotos(locationId: string): Promise<LocationPhoto[]> {
  const { data } = await api.get<LocationPhoto[]>(`/tenant/locations/${locationId}/photos`);
  return data;
}

interface CreatePhotoInput {
  url: string;
  sortOrder?: number;
  isHero?: boolean;
}

export async function createLocationPhoto(
  locationId: string,
  input: CreatePhotoInput,
): Promise<LocationPhoto> {
  const { data } = await api.post<LocationPhoto>(`/tenant/locations/${locationId}/photos`, input);
  return data;
}

interface PatchPhotoInput {
  sortOrder?: number;
  isHero?: boolean;
}

export async function patchLocationPhoto(
  locationId: string,
  id: string,
  input: PatchPhotoInput,
): Promise<LocationPhoto> {
  const { data } = await api.patch<LocationPhoto>(
    `/tenant/locations/${locationId}/photos/${id}`,
    input,
  );
  return data;
}

export async function deleteLocationPhoto(locationId: string, id: string): Promise<void> {
  await api.delete(`/tenant/locations/${locationId}/photos/${id}`);
}
