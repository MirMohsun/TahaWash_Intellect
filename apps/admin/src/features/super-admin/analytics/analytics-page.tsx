import { Link } from '@tanstack/react-router';
import { Building2, Coins, ReceiptText, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
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
import { useSuperAdminAnalytics } from '@/hooks/use-super-admin-analytics';

/**
 * Super-admin platform analytics (C6.1).
 *
 * Layout:
 *   - Date range bar (from/to, default last 90 Baku days)
 *   - 4 KPI cards (total revenue · total tx · new tenants in range ·
 *     MRR in range)
 *   - Daily revenue chart (LineChart, range)
 *   - Two columns: tenant growth (12mo BarChart) · MRR by month (12mo
 *     BarChart)
 *   - Top tenants leaderboard (top 10 by revenue, horizontal bars
 *     with share-of-total)
 *
 * Top cities deferred — Location schema has only `address`, no city
 * column. Customer.city would surface a different signal. Pick the
 * right interpretation once the user has feedback.
 *
 * Same date-range pattern as Phase 3.14 financials: defaults 90 days,
 * 365-day cap surfaces via the error card if the user picks beyond.
 */
const INITIAL_DAYS_BACK = 90;

export function SuperAdminAnalyticsPage() {
  const { t } = useTranslation();
  const today = todayIso();
  const [from, setFrom] = useState(initialFrom());
  const [to, setTo] = useState(today);

  const { data, isLoading, isError, refetch } = useSuperAdminAnalytics({ from, to });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.analytics.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.analytics.subtitle')}</p>
      </header>

      {/* Date range */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="an-from" className="text-xs">
                {t('superAdmin.subscriptions.filterFrom')}
              </Label>
              <Input
                id="an-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="an-to" className="text-xs">
                {t('superAdmin.subscriptions.filterTo')}
              </Label>
              <Input id="an-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {data && (
              <p className="text-sm text-ink-500 self-end pb-2.5 tabular-nums">
                {t('superAdmin.analytics.rangeSpan', { days: spanDays(from, to) })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.analytics.loadError')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('superAdmin.analytics.kpi.totalRevenue')}
          value={data ? `${data.revenue.total} ₼` : null}
          loading={isLoading}
          icon={<Coins className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.analytics.kpi.totalTx')}
          value={data ? data.revenue.txCount.toString() : null}
          loading={isLoading}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.analytics.kpi.newTenants')}
          value={data ? data.kpis.newTenantsInRange.toString() : null}
          loading={isLoading}
          icon={<Building2 className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.analytics.kpi.mrr')}
          value={data ? `${data.kpis.mrrInRange} ₼` : null}
          sub={
            data
              ? t('superAdmin.dashboard.kpi.mrrSub', { count: data.kpis.mrrSubscriptionsInRange })
              : null
          }
          loading={isLoading}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Daily revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.analytics.dailyRevenue.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartPlaceholder text={t('superAdmin.dashboard.growth.loading')} />
          ) : data && data.revenue.daily.some((d) => d.txCount > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.revenue.daily.map((d) => ({
                    label: shortDayLabel(d.date),
                    revenue: Number(d.paidAmountAzn),
                    txCount: d.txCount,
                  }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--ink-400)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--ink-400)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      `${value.toFixed(2)} ₼`,
                      t('superAdmin.analytics.dailyRevenue.legend'),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand-500)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartPlaceholder text={t('superAdmin.analytics.dailyRevenue.empty')} />
          )}
        </CardContent>
      </Card>

      {/* Growth charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('superAdmin.analytics.tenantGrowth.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartPlaceholder text={t('superAdmin.dashboard.growth.loading')} />
            ) : data && data.growth.newTenants.some((m) => m.count > 0) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.growth.newTenants.map((b) => ({
                      label: shortMonthLabel(b.month),
                      count: b.count,
                    }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--ink-400)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--ink-400)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--line)',
                        fontSize: 13,
                      }}
                      formatter={(value: number) => [
                        value.toString(),
                        t('superAdmin.dashboard.growth.tenants'),
                      ]}
                    />
                    <Bar dataKey="count" fill="var(--brand-500)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder text={t('superAdmin.dashboard.growth.empty')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.analytics.mrr.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartPlaceholder text={t('superAdmin.dashboard.growth.loading')} />
            ) : data && data.growth.mrrByMonth.some((m) => m.subscriptionCount > 0) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.growth.mrrByMonth.map((b) => ({
                      label: shortMonthLabel(b.month),
                      amount: Number(b.amountAzn),
                      count: b.subscriptionCount,
                    }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--ink-400)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--ink-400)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--line)',
                        fontSize: 13,
                      }}
                      formatter={(value: number) => [
                        `${value.toFixed(2)} ₼`,
                        t('superAdmin.analytics.mrr.legend'),
                      ]}
                    />
                    <Bar dataKey="amount" fill="var(--brand-500)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder text={t('superAdmin.analytics.mrr.empty')} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.analytics.topTenants.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : data && data.topTenants.length > 0 ? (
            <ul className="space-y-3">
              {data.topTenants.map((row, idx) => {
                const share =
                  Number(data.revenue.total) > 0
                    ? (Number(row.paidAmountAzn) / Number(data.revenue.total)) * 100
                    : 0;
                return (
                  <li
                    key={row.tenantId}
                    className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/super-admin/tenants/$tenantId"
                        params={{ tenantId: row.tenantId }}
                        className="font-semibold text-ink-900 hover:text-brand-600 truncate inline-block max-w-full"
                      >
                        {row.brandName}
                      </Link>
                      <div className="mt-1 h-1.5 rounded-pill bg-line-soft overflow-hidden">
                        <div
                          className="h-full bg-brand-500"
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                        {row.paidAmountAzn} ₼
                      </p>
                      <p className="text-xs text-ink-500 tabular-nums">
                        {t('superAdmin.dashboard.kpi.txCount', { count: row.txCount })} ·{' '}
                        {share.toFixed(1)}%
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-500 py-2">
              {t('superAdmin.analytics.topTenants.empty')}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-ink-400">{t('superAdmin.analytics.note')}</p>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  loading,
  icon,
}: {
  label: string;
  value: string | null;
  sub?: string | null;
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
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 tabular-nums">
          {loading ? '—' : (value ?? '—')}
        </p>
        {sub && !loading && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartPlaceholder({ text }: { text: string }) {
  return (
    <div className="h-56 flex items-center justify-center text-ink-500 text-sm">
      <Users className="h-4 w-4 mr-2 text-ink-400" />
      {text}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0"
        >
          <div className="h-7 w-7 rounded-full bg-line-soft" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 bg-line-soft rounded" />
            <div className="h-1.5 w-full bg-line-soft rounded-pill" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - (INITIAL_DAYS_BACK - 1));
  return d.toISOString().slice(0, 10);
}

function spanDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function shortDayLabel(yyyymmdd: string): string {
  const d = new Date(yyyymmdd);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function shortMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'short' });
}
