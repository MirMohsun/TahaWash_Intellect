/**
 * Tenant transactions — typed wrappers around /tenant/transactions/*.
 *
 * Endpoints (Phase 3.12):
 *   GET /tenant/transactions             — list with filters + pagination
 *   GET /tenant/transactions/export.csv  — same filters, no pagination, 50K cap
 *   GET /tenant/transactions/:id         — detail (used by Phase 3.13)
 *
 * CSV download goes through axios w/ responseType: 'blob' for the same
 * reason as the QR PDFs (JWT-guarded endpoint, anchor tags can't set
 * Authorization).
 */
import { api } from './api';

export type TenantTransactionStatus =
  | 'pending'
  | 'paid_crediting'
  | 'paid_credited'
  | 'paid_hardware_error'
  | 'declined'
  | 'cancelled';

export interface TenantTransactionRow {
  id: string;
  amountAzn: string;
  status: TenantTransactionStatus;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  occurredAt: string;
  bay: { id: string; name: string };
  location: { id: string; name: string };
  customerPhoneMasked: string | null;
  customerAnonymized: boolean;
}

export interface TenantTransactionsListResponse {
  items: TenantTransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TenantTransactionsFilters {
  page?: number;
  pageSize?: number;
  status?: TenantTransactionStatus;
  locationId?: string;
  bayId?: string;
  from?: string; // YYYY-MM-DD Baku
  to?: string; // YYYY-MM-DD Baku
}

export async function fetchTenantTransactions(
  filters: TenantTransactionsFilters,
): Promise<TenantTransactionsListResponse> {
  const { data } = await api.get<TenantTransactionsListResponse>('/tenant/transactions', {
    params: cleanParams(filters),
  });
  return data;
}

export interface TenantTransactionDetail extends TenantTransactionRow {
  locationAddress: string;
  ePointReference: string | null;
  hardwareCreditedAt: string | null;
  errorReason: string | null;
}

export async function fetchTenantTransaction(id: string): Promise<TenantTransactionDetail> {
  const { data } = await api.get<TenantTransactionDetail>(`/tenant/transactions/${id}`);
  return data;
}

export async function downloadTenantTransactionsCsv(
  filters: TenantTransactionsFilters,
): Promise<{ capped: boolean; rowCount: number }> {
  const res = await api.get<Blob>('/tenant/transactions/export.csv', {
    responseType: 'blob',
    params: cleanParams(filters),
  });
  const capped = res.headers['x-capped'] === 'true';
  const rowCount = Number(res.headers['x-row-count'] ?? 0);
  const from = filters.from ?? 'all';
  const to = filters.to ?? 'now';
  const url = window.URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tahawash-transactions-${from}-to-${to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { capped, rowCount };
}

/** Strip empty / undefined / null params so axios doesn't send `status=` blanks. */
function cleanParams(filters: TenantTransactionsFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v as string | number;
  }
  return out;
}
