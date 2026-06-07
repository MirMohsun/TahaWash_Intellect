/**
 * Tenant financials — typed wrapper around GET /tenant/financials.
 *
 * Shape mirrors what TenantFinancialsService returns. Money fields stay
 * as strings (precision-preserving). The line chart converts to Number()
 * only at render — two-decimal precision is irrelevant for visual scale.
 */
import { api } from './api';

export interface FinancialsData {
  range: { from: string; to: string; days: number };
  totals: {
    paidAmountAzn: string;
    txCount: number;
    hardwareErrorCount: number;
    declinedCount: number;
    cancelledCount: number;
    averageSaleAzn: string;
  };
  dailyRevenue: Array<{
    date: string;
    paidAmountAzn: string;
    txCount: number;
  }>;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    paidAmountAzn: string;
    txCount: number;
  }>;
  byBay: Array<{
    bayId: string;
    bayName: string;
    locationName: string;
    paidAmountAzn: string;
    txCount: number;
  }>;
}

export interface FinancialsFilters {
  from?: string; // YYYY-MM-DD Baku
  to?: string; // YYYY-MM-DD Baku
}

export async function fetchTenantFinancials(filters: FinancialsFilters): Promise<FinancialsData> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  const { data } = await api.get<FinancialsData>('/tenant/financials', { params });
  return data;
}
