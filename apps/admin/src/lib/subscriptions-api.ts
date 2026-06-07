/**
 * Tenant subscription payment history — typed wrapper around
 * GET /tenant/subscriptions (Phase 3.18 backend).
 *
 * The active period (start/end + status) still lives on TenantMe in
 * the auth store — this endpoint returns the historical payment LOG
 * that super-admin records when a tenant pays.
 */
import { api } from './api';

export type SubscriptionMethod = 'bank_transfer' | 'cash' | 'other' | string;

export interface TenantSubscriptionRow {
  id: string;
  amountAzn: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  method: SubscriptionMethod;
  notes: string | null;
  createdAt: string;
}

export async function fetchTenantSubscriptions(): Promise<TenantSubscriptionRow[]> {
  const { data } = await api.get<TenantSubscriptionRow[]>('/tenant/subscriptions');
  return data;
}
