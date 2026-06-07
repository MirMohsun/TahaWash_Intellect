/**
 * Tenant locations — typed wrappers around /tenant/locations/*.
 *
 * Endpoints shipped in Phase 1.5. The list endpoint also includes
 * `bayCount` (computed via Prisma `_count` on the relation).
 *
 * `workingHours` is JSON — schema is `{ mon: {open, close}|null, tue: ..., ... }`
 * or `null` (when hours haven't been set yet). 24/7 locations carry
 * `is24_7=true` and the hours field is ignored for display.
 */
import { api } from './api';

export type LocationStatus = 'active' | 'disabled';

export interface WorkingHoursWindow {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export type WorkingHours = {
  mon: WorkingHoursWindow | null;
  tue: WorkingHoursWindow | null;
  wed: WorkingHoursWindow | null;
  thu: WorkingHoursWindow | null;
  fri: WorkingHoursWindow | null;
  sat: WorkingHoursWindow | null;
  sun: WorkingHoursWindow | null;
};

export interface TenantLocation {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  workingHours: WorkingHours | null;
  is24_7: boolean;
  status: LocationStatus;
  bayCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function fetchTenantLocations(): Promise<TenantLocation[]> {
  const { data } = await api.get<TenantLocation[]>('/tenant/locations');
  return data;
}

export async function fetchTenantLocation(id: string): Promise<TenantLocation> {
  const { data } = await api.get<TenantLocation>(`/tenant/locations/${id}`);
  return data;
}

/** Input shape for both create + update — server treats `undefined` as "leave unchanged". */
export interface LocationInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  is24_7: boolean;
  workingHours: WorkingHours | null;
}

export async function createTenantLocation(input: LocationInput): Promise<TenantLocation> {
  const { data } = await api.post<TenantLocation>('/tenant/locations', toPayload(input));
  return data;
}

export async function updateTenantLocation(
  id: string,
  input: LocationInput,
): Promise<TenantLocation> {
  const { data } = await api.patch<TenantLocation>(`/tenant/locations/${id}`, toPayload(input));
  return data;
}

export async function updateTenantLocationStatus(
  id: string,
  status: LocationStatus,
): Promise<TenantLocation> {
  const { data } = await api.patch<TenantLocation>(`/tenant/locations/${id}/status`, { status });
  return data;
}

export async function deleteTenantLocation(id: string): Promise<void> {
  await api.delete(`/tenant/locations/${id}`);
}

/**
 * Backend rejects empty-string contactPhone (regex requires +994XXXXXXXXX),
 * so we send null instead. When is24_7 is true we still send workingHours
 * (or null) — the backend ignores it but accepting it keeps the round-trip
 * idempotent.
 */
function toPayload(input: LocationInput) {
  return {
    name: input.name,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    contactPhone: input.contactPhone && input.contactPhone.length > 0 ? input.contactPhone : null,
    is24_7: input.is24_7,
    workingHours: input.is24_7 ? null : input.workingHours,
  };
}
