import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  Coins,
  ReceiptText,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSuperAdminDashboard } from '@/hooks/use-super-admin-dashboard';

/**
 * Super-admin platform dashboard (C2.1).
 *
 * Single backend rollup powers everything (`/super-admin/dashboard`).
 * Layout top → bottom:
 *   1. Title
 *   2. KPI strip — 6 cards (tenants by status + devices + tx month + MRR)
 *   3. 6-month tenant growth bar chart
 *   4. Two-column row: subscription watchlist + recent activity feed
 */
export function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSuperAdminDashboard();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.dashboard.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.dashboard.platformSubtitle')}</p>
      </header>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.dashboard.loadError')}</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label={t('superAdmin.dashboard.kpi.tenants')}
          value={data ? data.tenants.total.toString() : null}
          sub={
            data
              ? t('superAdmin.dashboard.kpi.tenantsSub', {
                  active: data.tenants.active,
                  suspended: data.tenants.suspended,
                })
              : null
          }
          loading={isLoading}
          icon={<Building2 className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.dashboard.kpi.devices')}
          value={data ? data.totalDevices.toString() : null}
          loading={isLoading}
          icon={<Wrench className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.dashboard.kpi.txToday')}
          value={data ? `${data.txToday.paidAmountAzn} ₼` : null}
          sub={data ? t('superAdmin.dashboard.kpi.txCount', { count: data.txToday.txCount }) : null}
          loading={isLoading}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.dashboard.kpi.txMonth')}
          value={data ? `${data.txMonth.paidAmountAzn} ₼` : null}
          sub={data ? t('superAdmin.dashboard.kpi.txCount', { count: data.txMonth.txCount }) : null}
          loading={isLoading}
          icon={<Coins className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.dashboard.kpi.mrr')}
          value={data ? `${data.mrr.amountAzn} ₼` : null}
          sub={
            data
              ? t('superAdmin.dashboard.kpi.mrrSub', { count: data.mrr.subscriptionCount })
              : null
          }
          loading={isLoading}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label={t('superAdmin.dashboard.kpi.pendingPlusHidden')}
          value={data ? (data.tenants.pending + data.tenants.hidden).toString() : null}
          sub={
            data
              ? t('superAdmin.dashboard.kpi.pendingHiddenSub', {
                  pending: data.tenants.pending,
                  hidden: data.tenants.hidden,
                })
              : null
          }
          loading={isLoading}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data && data.tenants.pending + data.tenants.hidden > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {/* 6-month tenant growth chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.dashboard.growth.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-56 flex items-center justify-center text-ink-400 text-sm">
              {t('superAdmin.dashboard.growth.loading')}
            </div>
          ) : data && data.tenantGrowth6mo.some((m) => m.count > 0) ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.tenantGrowth6mo.map((b) => ({
                    label: shortMonthLabel(b.month),
                    count: b.count,
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
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(14,122,231,0.06)' }}
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
            <div className="h-56 flex items-center justify-center text-ink-500 text-sm">
              {t('superAdmin.dashboard.growth.empty')}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription watchlist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.dashboard.watchlist.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={4} />
            ) : data && data.subscriptionWatchlist.length > 0 ? (
              <ul className="space-y-3">
                {data.subscriptionWatchlist.slice(0, 8).map((row) => (
                  <li
                    key={row.tenantId}
                    className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <CalendarClock className="h-4 w-4 text-ink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{row.brandName}</p>
                      <p className="text-xs text-ink-500 truncate">
                        {formatSubEnd(row.subscriptionEnd)} ·{' '}
                        {t(`superAdmin.dashboard.tenantStatus.${row.status}`)}
                      </p>
                    </div>
                    <DaysLeftPill days={row.daysLeft} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text={t('superAdmin.dashboard.watchlist.empty')} />
            )}
          </CardContent>
        </Card>

        {/* Recent activity feed (audit log) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.dashboard.activity.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={5} />
            ) : data && data.recentActivity.length > 0 ? (
              <ul className="space-y-3">
                {data.recentActivity.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <Activity className="h-4 w-4 text-ink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 truncate">
                        <span className="font-semibold">{row.action}</span>
                        <span className="text-ink-500"> · {row.resourceType}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {t(actorLabelKey(row.actorType))} · {formatActivityTime(row.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text={t('superAdmin.dashboard.activity.empty')} />
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
  sub,
  loading,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | null;
  sub?: string | null;
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
        {sub && !loading && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DaysLeftPill({ days }: { days: number }) {
  const { t } = useTranslation();
  let tone = 'bg-line-soft text-ink-700';
  let label: string;
  if (days < 0) {
    tone = 'bg-error-50 text-error';
    label = t('superAdmin.dashboard.watchlist.expiredAgo', {
      count: Math.abs(days),
      days: Math.abs(days),
    });
  } else if (days === 0) {
    tone = 'bg-amber-50 text-amber';
    label = t('superAdmin.dashboard.watchlist.today');
  } else if (days <= 7) {
    tone = 'bg-amber-50 text-amber';
    label = t('superAdmin.dashboard.watchlist.daysLeft', { count: days, days });
  } else {
    label = t('superAdmin.dashboard.watchlist.daysLeft', { count: days, days });
  }
  return (
    <span className={`text-[11px] font-semibold uppercase rounded-pill px-2 py-0.5 ${tone}`}>
      {label}
    </span>
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

// ─── Format helpers ─────────────────────────────────────────────────

/** "2026-03" → "Mar" (resolved language picks the locale on toLocaleString). */
function shortMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'short' });
}

function formatSubEnd(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function actorLabelKey(actorType: string): string {
  if (actorType === 'super_admin') return 'superAdmin.dashboard.activity.actor.superAdmin';
  if (actorType === 'tenant') return 'superAdmin.dashboard.activity.actor.tenant';
  if (actorType === 'system') return 'superAdmin.dashboard.activity.actor.system';
  return actorType;
}
