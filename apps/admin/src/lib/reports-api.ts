/**
 * Hardware reports — typed wrappers around /tenant/reports/*.
 *
 *  - GET  /tenant/reports/daily?date=&bayId?   — ежедневный отчёт из БД
 *      (без bayId → срез по тенанту с разбивкой по боксам;
 *       с bayId   → срез по боксу + список событий)
 *  - POST /tenant/reports/bays/:bayId/snapshot — текущий срез: запрос к Pico,
 *      backend СИНХРОННО ждёт ответ (до ~6с) и возвращает агрегат + список.
 */
import { api } from './api';

export interface ReportTotals {
  revenueAzn: string;
  cashAzn: string;
  onlineAzn: string;
  eventCount: number;
  byType: Record<string, number>;
  byProgram: Array<{ programName: string; count: number; amountAzn: string }>;
}

export interface ReportEvent {
  eventType: string;
  amountAzn: string | null;
  pulses: number | null;
  txId: string | null;
  programName: string | null;
  durationSeconds: number | null;
  relayCombo: string[];
  rawTs: string;
}

export interface TenantDailyReport {
  from: string;
  to: string;
  scope: 'tenant';
  totals: ReportTotals;
  byBay: Array<{
    bayId: string;
    bayName: string;
    locationName: string;
    revenueAzn: string;
    eventCount: number;
  }>;
}

export interface BayDailyReport {
  from: string;
  to: string;
  scope: 'bay';
  bay: { id: string; name: string; locationName: string };
  totals: ReportTotals;
  events: ReportEvent[];
}

export type DailyReport = TenantDailyReport | BayDailyReport;

export interface SnapshotReport {
  capturedAt: string;
  bay: { id: string; name: string; locationName: string };
  totals: ReportTotals;
  events: ReportEvent[];
}

export async function fetchDailyReport(params: {
  from: string;
  to: string;
  bayId?: string;
}): Promise<DailyReport> {
  const query: Record<string, string> = { from: params.from, to: params.to };
  if (params.bayId) query.bayId = params.bayId;
  const { data } = await api.get<DailyReport>('/tenant/reports/daily', { params: query });
  return data;
}

export async function requestBaySnapshot(bayId: string): Promise<SnapshotReport> {
  const { data } = await api.post<SnapshotReport>(`/tenant/reports/bays/${bayId}/snapshot`);
  return data;
}
