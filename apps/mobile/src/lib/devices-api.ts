import { api } from './api';

/**
 * QR scan lookup against `GET /public/devices/:qrShortId` (Phase 1.6).
 *
 * Response shape mirrors what the backend returns on success.
 * Failures arrive as Axios errors with response.data.code matching the
 * spec'd error codes — caller maps them to UI states (A6.3–A6.6).
 */

export interface DeviceLookupResponse {
  bay: {
    id: string;
    name: string;
    qrShortId: string;
  };
  location: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  tenant: {
    id: string;
    brandName: string;
    themeColor: string;
    logoUrl: string | null;
    contactPhone: string | null;
    minChargeAmount: string;
    chargeStep: string;
  };
}

export type DeviceLookupErrorCode =
  | 'UNKNOWN_DEVICE'
  | 'DEVICE_DELETED'
  | 'DEVICE_DISABLED'
  | 'TENANT_SUSPENDED';

/** Throws AxiosError on failure; success returns the device payload. */
export async function lookupDevice(qrShortId: string): Promise<DeviceLookupResponse> {
  const res = await api.get<DeviceLookupResponse>(`/public/devices/${qrShortId}`);
  return res.data;
}

/**
 * Pull the spec'd error code out of an Axios error response (or return
 * null if the error wasn't a structured backend response — e.g. network).
 */
export function extractLookupErrorCode(err: unknown): DeviceLookupErrorCode | null {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
  if (
    code === 'UNKNOWN_DEVICE' ||
    code === 'DEVICE_DELETED' ||
    code === 'DEVICE_DISABLED' ||
    code === 'TENANT_SUSPENDED'
  ) {
    return code;
  }
  return null;
}
