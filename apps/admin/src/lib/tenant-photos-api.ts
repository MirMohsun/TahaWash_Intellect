/**
 * Tenant photo gallery — typed wrappers over /tenant/me/photos endpoints.
 */
import { api } from './api';

export interface TenantPhoto {
  id: string;
  tenantId: string;
  url: string;
  sortOrder: number;
  isHero: boolean;
  createdAt: string;
}

export async function listTenantPhotos(): Promise<TenantPhoto[]> {
  const { data } = await api.get<TenantPhoto[]>('/tenant/me/photos');
  return data;
}

interface CreatePhotoInput {
  url: string;
  sortOrder?: number;
  isHero?: boolean;
}

export async function createTenantPhoto(input: CreatePhotoInput): Promise<TenantPhoto> {
  const { data } = await api.post<TenantPhoto>('/tenant/me/photos', input);
  return data;
}

interface PatchPhotoInput {
  sortOrder?: number;
  isHero?: boolean;
}

export async function patchTenantPhoto(id: string, input: PatchPhotoInput): Promise<TenantPhoto> {
  const { data } = await api.patch<TenantPhoto>(`/tenant/me/photos/${id}`, input);
  return data;
}

export async function deleteTenantPhoto(id: string): Promise<void> {
  await api.delete(`/tenant/me/photos/${id}`);
}
