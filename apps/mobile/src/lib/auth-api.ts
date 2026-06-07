import type { Customer } from '@tahawash/shared-types';
import { api } from './api';

/**
 * Typed wrappers over the customer auth endpoints (Phase 1.2).
 *
 * Layer kept thin — these are call-and-return functions, no caching, no
 * state. Zustand store in src/store/auth.ts owns the state machine and
 * calls these to talk to the backend.
 */

/** POST /auth/customer/request-otp */
export async function requestOtp(phone: string): Promise<{ phone: string }> {
  const res = await api.post<{ phone: string }>('/auth/customer/request-otp', { phone });
  return res.data;
}

interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  customer: Customer;
}

/** POST /auth/customer/verify-otp */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
  const res = await api.post<VerifyOtpResponse>('/auth/customer/verify-otp', { phone, code });
  return res.data;
}

/** POST /auth/customer/logout */
export async function logoutOnServer(refreshToken: string): Promise<void> {
  await api.post('/auth/customer/logout', { refreshToken });
}
