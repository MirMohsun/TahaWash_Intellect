import { ArrowLeft, Coins, CreditCard, Hash, RefreshCw, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBaySnapshot, useDailyReport } from '@/hooks/use-reports';
import type { ReportEvent, ReportSession, ReportTotals, SnapshotReport } from '@/lib/reports-api';
import { bakuDateString } from '@/lib/baku-day';

/**
 * Hardware reports page.
 *
 *  - Tenant view: дата + итоги по всем боксам + разбивка по боксам (клик → drill-down).
 *  - Bay drill-down: итоги бокса за дату + список событий + кнопка «текущий срез»
 *    (синхронный snapshot с Pico).
 */
const INITIAL_DAYS_BACK = 7;

export function ReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(initialFrom());
  const [to, setTo] = useState(bakuDateString(new Date()));
  const [bayId, setBayId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useDailyReport(from, to, bayId ?? undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('tenantAdmin.reports.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('tenantAdmin.reports.subtitle')}</p>
        </div>
      </div>

      {/* Date range */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="rep-from" className="text-xs">
                {t('tenantAdmin.reports.from')}
              </Label>
              <Input
                id="rep-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-to" className="text-xs">
                {t('tenantAdmin.reports.to')}
              </Label>
              <Input
                id="rep-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('tenantAdmin.reports.loadError')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('tenantAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      )}

      {bayId && data && data.scope === 'bay' ? (
        <BayReport
          report={data}
          onBack={() => setBayId(null)}
        />
      ) : data && data.scope === 'tenant' ? (
        <>
          <TotalsStrip totals={data.totals} loading={isLoading} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProgramBreakdown totals={data.totals} />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('tenantAdmin.reports.byBay')}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byBay.length === 0 ? (
                  <p className="text-sm text-ink-500 italic">{t('tenantAdmin.reports.empty')}</p>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {data.byBay.map((b) => (
                      <li key={b.bayId}>
                        <button
                          type="button"
                          onClick={() => setBayId(b.bayId)}
                          className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-line-soft/40 px-1 rounded"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900 truncate">{b.bayName}</p>
                            <p className="text-xs text-ink-500 truncate">
                              {b.locationName} ·{' '}
                              {t('tenantAdmin.reports.eventCount', { count: b.eventCount })}
                            </p>
                          </div>
                          <p className="font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                            {b.revenueAzn} ₼
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <TotalsStrip totals={null} loading />
      )}
    </div>
  );
}

// ─── Bay drill-down ──────────────────────────────────────────────────

function BayReport({
  report,
  onBack,
}: {
  report: {
    bay: { name: string; locationName: string; id: string };
    totals: ReportTotals;
    sessions: ReportSession[];
    events: ReportEvent[];
  };
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const snapshot = useBaySnapshot();
  const [live, setLive] = useState<SnapshotReport | null>(null);

  const onSnapshot = () => {
    snapshot.mutate(report.bay.id, {
      onSuccess: (res) => {
        setLive(res);
        toast.success(t('tenantAdmin.reports.snapshotReady'));
      },
      onError: () => toast.error(t('tenantAdmin.reports.snapshotError')),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('tenantAdmin.reports.backToAll')}
        </button>
        <Button type="button" size="sm" onClick={onSnapshot} disabled={snapshot.isPending}>
          <RefreshCw className={`h-4 w-4 ${snapshot.isPending ? 'animate-spin' : ''}`} />
          {snapshot.isPending
            ? t('tenantAdmin.reports.snapshotLoading')
            : t('tenantAdmin.reports.requestSnapshot')}
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-ink-900">{report.bay.name}</h2>
        <p className="text-sm text-ink-500">{report.bay.locationName}</p>
      </div>

      {/* Live snapshot (текущий срез) */}
      {live && (
        <Card className="border-brand-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t('tenantAdmin.reports.currentSnapshot')}
              <span className="text-xs font-normal text-ink-400">
                {hhmm(live.capturedAt)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TotalsStrip totals={live.totals} loading={false} />
            <SessionsList sessions={live.sessions} />
            <EventsTable events={live.events} />
          </CardContent>
        </Card>
      )}

      {/* Daily (из БД) */}
      <TotalsStrip totals={report.totals} loading={false} />
      <SessionsCard sessions={report.sessions} />
      <ProgramBreakdown totals={report.totals} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tenantAdmin.reports.events')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventsTable events={report.events} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared pieces ───────────────────────────────────────────────────

function TotalsStrip({ totals, loading }: { totals: ReportTotals | null; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        label={t('tenantAdmin.reports.kpi.revenue')}
        value={totals ? `${totals.revenueAzn} ₼` : null}
        loading={loading}
        icon={<Coins className="h-4 w-4" />}
      />
      <Kpi
        label={t('tenantAdmin.reports.kpi.cash')}
        value={totals ? `${totals.cashAzn} ₼` : null}
        loading={loading}
        icon={<Wallet className="h-4 w-4" />}
      />
      <Kpi
        label={t('tenantAdmin.reports.kpi.online')}
        value={totals ? `${totals.onlineAzn} ₼` : null}
        loading={loading}
        icon={<CreditCard className="h-4 w-4" />}
      />
      <Kpi
        label={t('tenantAdmin.reports.kpi.events')}
        value={totals ? totals.eventCount.toLocaleString() : null}
        loading={loading}
        icon={<Hash className="h-4 w-4" />}
      />
    </div>
  );
}

function ProgramBreakdown({ totals }: { totals: ReportTotals }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tenantAdmin.reports.byProgram')}</CardTitle>
      </CardHeader>
      <CardContent>
        {totals.byProgram.length === 0 ? (
          <p className="text-sm text-ink-500 italic">{t('tenantAdmin.reports.empty')}</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {totals.byProgram.map((p) => (
              <li key={p.programName} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-ink-900">{p.programName}</span>
                <span className="text-sm text-ink-500 tabular-nums">
                  {t('tenantAdmin.reports.eventCount', { count: p.count })} · {p.amountAzn} ₼
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsCard({ sessions }: { sessions: ReportSession[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tenantAdmin.reports.sessions')}</CardTitle>
      </CardHeader>
      <CardContent>
        <SessionsList sessions={sessions} />
      </CardContent>
    </Card>
  );
}

function SessionsList({ sessions }: { sessions: ReportSession[] }) {
  const { t } = useTranslation();
  if (sessions.length === 0) {
    return <p className="text-sm text-ink-500 italic">{t('tenantAdmin.reports.noSessions')}</p>;
  }
  return (
    <ul className="divide-y divide-line-soft">
      {sessions.map((s, i) => (
        <li key={`${s.startedAt}-${i}`} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-ink-500 tabular-nums whitespace-nowrap">
            {dateLabel(s.startedAt)} {hhmm(s.startedAt)}
          </span>
          {s.paymentType ? (
            <span className="font-semibold text-ink-900">
              {t(`tenantAdmin.reports.eventType.${s.paymentType}`)}
              {s.amountAzn ? ` · ${s.amountAzn} ₼` : ''}
              {s.program ? ` · ${s.program}` : ''}
            </span>
          ) : (
            <span className="text-ink-500 italic">{t('tenantAdmin.reports.noPayment')}</span>
          )}
          {s.functions.length > 0 && (
            <span className="inline-flex items-center gap-1 text-ink-700">
              <span className="text-ink-400">→</span>
              {s.functions.map((f) => f.name).join(', ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function EventsTable({ events }: { events: ReportEvent[] }) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return <p className="text-sm text-ink-500 italic">{t('tenantAdmin.reports.noEvents')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
            <th className="py-2 pr-3 font-semibold">{t('tenantAdmin.reports.col.date')}</th>
            <th className="py-2 pr-3 font-semibold">{t('tenantAdmin.reports.col.time')}</th>
            <th className="py-2 pr-3 font-semibold">{t('tenantAdmin.reports.col.type')}</th>
            <th className="py-2 pr-3 font-semibold">{t('tenantAdmin.reports.col.program')}</th>
            <th className="py-2 pl-3 font-semibold text-right">
              {t('tenantAdmin.reports.col.amount')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {events.map((e, i) => (
            <tr key={`${e.rawTs}-${i}`}>
              <td className="py-2 pr-3 tabular-nums text-ink-600 whitespace-nowrap">
                {dateLabel(e.rawTs)}
              </td>
              <td className="py-2 pr-3 tabular-nums text-ink-600 whitespace-nowrap">
                {hhmm(e.rawTs)}
              </td>
              <td className="py-2 pr-3">{t(`tenantAdmin.reports.eventType.${e.eventType}`)}</td>
              <td className="py-2 pr-3 text-ink-700">{e.programName ?? '—'}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-ink-900">
                {e.amountAzn ? `${e.amountAzn} ₼` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: string | null;
  loading: boolean;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between text-ink-500">
          <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
          <span className="text-ink-400">{icon}</span>
        </div>
        <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-ink-900">
          {loading ? '—' : (value ?? '—')}
        </p>
      </CardContent>
    </Card>
  );
}

/** "HH:MM" из ISO-таймстампа Pico (уже в Asia/Baku, со смещением +04:00). */
function hhmm(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/** "DD.MM.YYYY" из ISO-таймстампа — чтобы в диапазоне было видно число оплаты. */
function dateLabel(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso;
}

/** Дефолтное начало диапазона — последняя неделя (сегодня минус 6 дней). */
function initialFrom(): string {
  const start = new Date(Date.now() - (INITIAL_DAYS_BACK - 1) * 86_400_000);
  return bakuDateString(start);
}
