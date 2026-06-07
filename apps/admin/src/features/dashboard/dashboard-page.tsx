import { AlertTriangle, CheckCircle2, Clock, ReceiptText, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantDashboard } from '@/hooks/use-tenant-dashboard';
import { formatActivityTime, shortDayLabel } from '@/lib/baku-day';
import type { TenantTransactionStatus } from '@/lib/dashboard-api';
import { useAuthStore } from '@/store/auth';
import { SubscriptionBanner } from './subscription-banner';

/**
 * Tenant admin dashboard (B2.1).
 *
 * Layout (top → bottom):
 *   1. Greeting header
 *   2. SubscriptionBanner (hidden unless within 7 days / past)
 *   3. KPI strip — 4 cards: today's revenue / today's tx / hardware errors / open bays
 *   4. 7-day revenue chart (recharts)
 *   5. Top 5 bays this month
 *   6. Recent activity feed (last 10 transactions)
 *
 * Single backend call powers everything except the subscription banner
 * (which reads from the auth store's tenant snapshot). See
 * use-tenant-dashboard.ts.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);
  const { data, isLoading, isError, refetch } = useTenantDashboard();

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.dashboard.greeting', { tenant: tenant.brandName })}
        </h1>
        <p className="mt-1 text-ink-500">{t('tenantAdmin.dashboard.subtitle')}</p>
      </header>

      <SubscriptionBanner status={tenant.status} subscriptionEnd={tenant.subscriptionEnd} />

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('tenantAdmin.dashboard.loadError')}</p>
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
        <KpiCard
          label={t('tenantAdmin.dashboard.kpi.todayRevenue')}
          value={data ? `${data.today.paidAmountAzn} ₼` : null}
          loading={isLoading}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <KpiCard
          label={t('tenantAdmin.dashboard.kpi.todayTx')}
          value={data ? data.today.txCount.toString() : null}
          loading={isLoading}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KpiCard
          label={t('tenantAdmin.dashboard.kpi.hardwareErrors')}
          value={data ? data.today.hardwareErrorCount.toString() : null}
          loading={isLoading}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data && data.today.hardwareErrorCount > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          label={t('tenantAdmin.dashboard.kpi.openBays')}
          value={data ? `${data.bayStats.active} / ${data.bayStats.total}` : null}
          loading={isLoading}
          icon={<Wrench className="h-4 w-4" />}
        />
      </div>

      {/* 7-day revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tenantAdmin.dashboard.last7Days')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-56 flex items-center justify-center text-ink-400 text-sm">
              {t('tenantAdmin.dashboard.chartLoading')}
            </div>
          ) : data && data.dailyRevenue7d.some((d) => d.txCount > 0) ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.dailyRevenue7d.map((d) => ({
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
                  />
                  <YAxis
                    stroke="var(--ink-400)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(14,122,231,0.06)' }}
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
                  <Bar dataKey="revenue" fill="var(--brand-500)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-ink-500 text-sm">
              {t('tenantAdmin.dashboard.chartEmpty')}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top bays this month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.dashboard.topBays')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={3} />
            ) : data && data.topBaysThisMonth.length > 0 ? (
              <ul className="space-y-3">
                {data.topBaysThisMonth.map((bay, idx) => (
                  <li
                    key={bay.bayId}
                    className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{bay.bayName}</p>
                      <p className="text-xs text-ink-500 truncate">{bay.locationName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink-900 tabular-nums">
                        {bay.paidAmountAzn} ₼
                      </p>
                      <p className="text-xs text-ink-500">
                        {t('tenantAdmin.dashboard.txCount', { count: bay.txCount })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text={t('tenantAdmin.dashboard.topBaysEmpty')} />
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={5} />
            ) : data && data.recentTransactions.length > 0 ? (
              <ul className="space-y-3">
                {data.recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <Clock className="h-4 w-4 text-ink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 truncate">
                        <span className="font-semibold">{tx.bayName}</span>
                        <span className="text-ink-500"> · {tx.locationName}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatActivityTime(tx.occurredAt, t, new Date())}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink-900 tabular-nums">{tx.amountAzn} ₼</p>
                      <StatusBadge status={tx.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text={t('tenantAdmin.dashboard.activityEmpty')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  loading,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | null;
  loading: boolean;
  icon: React.ReactNode;
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
            <div className="h-2.5 w-1/2 bg-line-soft rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-ink-500 py-2">{text}</p>;
}

function StatusBadge({ status }: { status: TenantTransactionStatus }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span className={`text-[11px] font-semibold ${tone}`}>
      {t(`tenantAdmin.dashboard.txStatus.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<TenantTransactionStatus, string> = {
  pending: 'text-ink-500',
  paid_crediting: 'text-ink-500',
  paid_credited: 'text-success',
  paid_hardware_error: 'text-amber',
  declined: 'text-error',
  cancelled: 'text-ink-400',
};
