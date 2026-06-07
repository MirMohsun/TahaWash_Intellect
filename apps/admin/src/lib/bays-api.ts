/**
 * Tenant bays — typed wrappers around /tenant/locations/:locationId/bays
 * and /tenant/bays/:id.
 *
 * QR PDF endpoint needs the JWT (TenantAuthGuard). Browser <a href> can't
 * send auth headers, so we fetch the PDF blob through the api singleton
 * and trigger the download client-side (createObjectURL + temp <a>).
 * Side-benefit: same axios refresh-rotation safety applies — a token that
 * just expired auto-refreshes mid-download.
 */
import { api } from './api';

export type BayStatus = 'active' | 'disabled';

export interface TenantBay {
  id: string;
  locationId: string;
  tenantId: string;
  name: string;
  hardwareIdentifier: string | null;
  qrShortId: string;
  status: BayStatus;
  createdAt: string;
  updatedAt: string;
}

export async function fetchLocationBays(locationId: string): Promise<TenantBay[]> {
  const { data } = await api.get<TenantBay[]>(`/tenant/locations/${locationId}/bays`);
  return data;
}

export interface CreateBayInput {
  name: string;
  hardwareIdentifier?: string | null;
}

export async function createBay(locationId: string, input: CreateBayInput): Promise<TenantBay> {
  const { data } = await api.post<TenantBay>(`/tenant/locations/${locationId}/bays`, {
    name: input.name,
    hardwareIdentifier:
      input.hardwareIdentifier && input.hardwareIdentifier.trim().length > 0
        ? input.hardwareIdentifier.trim()
        : null,
  });
  return data;
}

export interface UpdateBayInput {
  name?: string;
  hardwareIdentifier?: string | null;
  status?: BayStatus;
}

export async function updateBay(id: string, input: UpdateBayInput): Promise<TenantBay> {
  const payload: UpdateBayInput = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.hardwareIdentifier !== undefined) {
    payload.hardwareIdentifier =
      input.hardwareIdentifier && input.hardwareIdentifier.trim().length > 0
        ? input.hardwareIdentifier.trim()
        : null;
  }
  if (input.status !== undefined) payload.status = input.status;
  const { data } = await api.patch<TenantBay>(`/tenant/bays/${id}`, payload);
  return data;
}

export async function regenerateBayQr(id: string): Promise<TenantBay> {
  const { data } = await api.post<TenantBay>(`/tenant/bays/${id}/regenerate-qr`);
  return data;
}

/**
 * Fetch the bay's printable QR PDF and trigger a browser download.
 *
 * Why client-side: the endpoint is JWT-guarded; a plain anchor tag can't
 * attach Authorization headers. responseType:'blob' tells axios not to
 * try and parse the bytes as JSON.
 */
export async function downloadBayQrPdf(bay: TenantBay): Promise<void> {
  const res = await api.get<Blob>(`/tenant/bays/${bay.id}/qr.pdf`, { responseType: 'blob' });
  const safeName = bay.name.replace(/[^a-zA-Z0-9-_]+/g, '-');
  triggerDownload(res.data, `tahawash-qr-${safeName}-${bay.qrShortId}.pdf`);
}

/**
 * Download a single PDF with one page per bay at the location.
 * Backend renders all bays in createdAt-asc order (matches the in-app list).
 */
export async function downloadLocationBulkQrPdf(
  locationId: string,
  locationName: string,
): Promise<void> {
  const res = await api.get<Blob>(`/tenant/locations/${locationId}/bays/qr.pdf`, {
    responseType: 'blob',
  });
  const safeLocation = locationName.replace(/[^a-zA-Z0-9-_]+/g, '-');
  triggerDownload(res.data, `tahawash-qr-all-${safeLocation}.pdf`);
}

/** Shared blob → temp anchor → click → revoke. Safari needs the URL to live a tick. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
