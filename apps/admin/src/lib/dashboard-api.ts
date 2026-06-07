/**
 * Tenant dashboard rollup — typed wrapper around GET /tenant/dashboard.
 *
 * Mirrors the shape returned by TenantDashboardService server-side.
 * Decimal money fields are strings (precision-preserving — frontend never
 * does arithmetic on them, only displays / sums via Number() for the chart
 * y-axis where two-decimal precision is irrelevant for visual scale).
 */
import { api } from './api';

export type TenantTransactionStatus =
  | 'pending'
  | 'paid_crediting'
  | 'paid_credited'
  | 'paid_hardware_error'
  | 'declined'
  | 'cancelled';

export interface TenantDashboardData {
  today: {
    date: string;
    paidAmountAzn: string;
    txCount: number;
    hardwareErrorCount: number;
  };
  dailyRevenue7d: Array<{
    date: string;
    paidAmountAzn: string;
    txCount: number;
  }>;
  bayStats: {
    total: number;
    active: number;
  };
  topBaysThisMonth: Array<{
    bayId: string;
    bayName: string;
    locationName: string;
    txCount: number;
    paidAmountAzn: string;
  }>;
  recentTransactions: Array<{
    id: string;
    amountAzn: string;
    status: TenantTransactionStatus;
    bayName: string;
    locationName: string;
    occurredAt: string;
  }>;
}

export async function fetchTenantDashboard(): Promise<TenantDashboardData> {
  const { data } = await api.get<TenantDashboardData>('/tenant/dashboard');
  return data;
}
