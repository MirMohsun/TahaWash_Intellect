import { AlertTriangle, Coins, Receipt, TrendingUp, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenantFinancials } from '@/hooks/use-financials';
import { bakuDateString, shortDayLabel } from '@/lib/baku-day';

/**
 * Financials page (B6.1).
 *
 * Sits one click deeper than the dashboard:
 *   - Dashboard = today + last 7 days; quick operations snapshot
 *   - Financials = configurable longer range with breakdowns;
 *                  reconciliation / planning surface
 *
 * Default range: last 30 Baku days. User picks via the same from/to date
 * inputs as the transactions log. Range hard-capped at 365 days
 * server-side; the UI doesn't prevent picking beyond — backend returns
 * a friendly error which we surface in the error card.
 */
const INITIAL_DAYS_BACK = 30;

export function FinancialsPage() {
  const { t } = useTranslation();
  const todayBaku = bakuDateString(new Date());
  const [from, setFrom] = useState(initialFrom());
  const [to, setTo] = useState(todayBaku);

  const { data, isLoading, isError, refetch } = useTenantFinancials({ from, to });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.financials.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('tenantAdmin.financials.subtitle')}</p>
      </div>

      {/* Date range */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="fin-from" className="text-xs">
                {t('tenantAdmin.transactions.filterFrom')}
              </Label>
              <Input
                id="fin-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-to" className="text-xs">
                {t('tenantAdmin.transactions.filterTo')}
              </Label>
              <Input id="fin-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {data && (
              <p className="text-sm text-ink-500 self-end pb-2.5 tabular-nums">
                {t('tenantAdmin.financials.rangeSpan', { days: data.range.days })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('tenantAdmin.financials.loadError')}
            </p>
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

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label={t('tenantAdmin.financials.kpi.revenue')}
          value={data ? `${data.totals.paidAmountAzn} ₼` : null}
          loading={isLoading}
          icon={<Coins className="h-4 w-4" />}
        />
        <Kpi
          label={t('tenantAdmin.financials.kpi.txCount')}
          value={data ? data.totals.txCount.toLocaleString() : null}
          loading={isLoading}
          icon={<Receipt className="h-4 w-4" />}
        />
        <Kpi
          label={t('tenantAdmin.financials.kpi.avgSale')}
          value={data ? `${data.totals.averageSaleAzn} ₼` : null}
          loading={isLoading}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Kpi
          label={t('tenantAdmin.financials.kpi.hardwareErrors')}
          value={data ? data.totals.hardwareErrorCount.toLocaleString() : null}
          loading={isLoading}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data && data.totals.hardwareErrorCount > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {/* Decline + cancel sub-line (secondary signals) */}
      {data && (data.totals.declinedCount > 0 || data.totals.cancelledCount > 0) && (
        <Card>
          <CardContent className="py-4 px-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-700">
            {data.totals.declinedCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-error" />
                <span className="font-semibold tabular-nums">{data.totals.declinedCount}</span>
                <span className="text-ink-500">{t('tenantAdmin.financials.declined')}</span>
              </span>
            )}
            {data.totals.cancelledCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-ink-400" />
                <span className="font-semibold tabular-nums">{data.totals.cancelledCount}</span>
                <span className="text-ink-500">{t('tenantAdmin.financials.cancelled')}</span>
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revenue line chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tenantAdmin.financials.revenueTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <div className="h-64 flex items-center justify-center text-ink-400 text-sm">
              {t('tenantAdmin.dashboard.chartLoading')}
            </div>
          ) : data.dailyRevenue.some((d) => d.txCount > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.dailyRevenue.map((d) => ({
                    label: shortDayLabel(d.date),
                    revenue: Number(d.paidAmountAzn),
                    tx: d.txCount,
                  }))}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--ink-400)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    stroke="var(--ink-400)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--brand-500)', strokeOpacity: 0.2 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      `${value.toFixed(2)} ₼`,
                      t('tenantAdmin.dashboard.revenue'),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand-500)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: 'var(--brand-600)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-ink-500 text-sm">
              {t('tenantAdmin.financials.chartEmpty')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-up: by-location + by-bay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.financials.byLocation')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Leaderboard
              loading={isLoading || !data}
              items={
                data?.byLocation.map((l) => ({
                  key: l.locationId,
                  title: l.locationName,
                  subtitle: t('tenantAdmin.dashboard.txCount', { count: l.txCount }),
                  amount: l.paidAmountAzn,
                })) ?? []
              }
              total={data?.totals.paidAmountAzn ?? '0'}
              emptyKey="tenantAdmin.financials.byLocationEmpty"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.financials.byBay')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Leaderboard
              loading={isLoading || !data}
              items={
                data?.byBay.map((b) => ({
                  key: b.bayId,
                  title: b.bayName,
                  subtitle: `${b.locationName} · ${t('tenantAdmin.dashboard.txCount', { count: b.txCount })}`,
                  amount: b.paidAmountAzn,
                })) ?? []
              }
              total={data?.totals.paidAmountAzn ?? '0'}
              emptyKey="tenantAdmin.financials.byBayEmpty"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────

function Leaderboard({
  items,
  total,
  loading,
  emptyKey,
}: {
  items: Array<{ key: string; title: string; subtitle: string; amount: string }>;
  total: string;
  loading: boolean;
  emptyKey: string;
}) {
  const { t } = useTranslation();
  const totalNum = Number(total) || 0;

  if (loading) {
    return (
      <ul className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-1/3 bg-line-soft rounded" />
              <div className="h-3 w-16 bg-line-soft rounded" />
            </div>
            <div className="h-2 w-full bg-line-soft rounded-pill" />
          </li>
        ))}
      </ul>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-ink-500 italic">{t(emptyKey)}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const pct = totalNum > 0 ? Math.min(100, (Number(it.amount) / totalNum) * 100) : 0;
        return (
          <li key={it.key} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 truncate">{it.title}</p>
                <p className="text-xs text-ink-500 truncate">{it.subtitle}</p>
              </div>
              <p className="font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                {it.amount} ₼
              </p>
            </div>
            <div className="h-1.5 rounded-pill bg-line-soft overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-pill transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  loading,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | null;
  loading: boolean;
  icon: ReactNode;
  tone?: 'neutral' | 'amber';
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between text-ink-500">
          <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
          <span className={tone === 'amber' ? 'text-amber' : 'text-ink-400'}>{icon}</span>
        </div>
        <p
          className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${
            tone === 'amber' ? 'text-amber' : 'text-ink-900'
          }`}
        >
          {loading ? '—' : (value ?? '—')}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function initialFrom(): string {
  const now = new Date();
  const start = new Date(now.getTime() - (INITIAL_DAYS_BACK - 1) * 86_400_000);
  return bakuDateString(start);
}
