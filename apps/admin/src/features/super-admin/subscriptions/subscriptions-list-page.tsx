import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Filter, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuperAdminSubscriptions } from '@/hooks/use-super-admin-subscriptions';
import { useSuperAdminTenants } from '@/hooks/use-super-admin-tenants';
import type { SubscriptionMethodKey, SuperAdminSubscriptionRow } from '@/lib/super-admin-api';

/**
 * Super-admin subscription log (C5.1).
 *
 * Cross-tenant payment history backed by `GET /super-admin/subscriptions`.
 * Filter bar: tenant (dropdown sourced from /super-admin/tenants), method,
 * date range. Paginated 50/page with `keepPreviousData` so changing filters
 * doesn't flash the table.
 *
 * Tenant filter sourcing decision: for MVP scale (<100 tenants) we fetch
 * the whole list once (limit=100) into a <select>. When the platform
 * grows past ~100 tenants this should graduate to an autocomplete
 * (search-as-you-type w/ debounce), reusing the q= param on the existing
 * tenants endpoint.
 *
 * CSV export: deferred for this stage. Subscription rows are written
 * manually by the super-admin so volume stays low (probably <1000/year
 * total across the platform at MVP). Add the Phase 3.12 cap+header
 * pattern when the user actually needs to spreadsheet-pivot the log.
 *
 * Initial filter from URL: ?tenantId=X navigates directly to a tenant's
 * subscriptions (linked from the tenant detail page at 4.5).
 */
const PAGE_SIZE = 50;
const METHODS: SubscriptionMethodKey[] = ['bank_transfer', 'cash', 'other'];

interface SearchParams {
  tenantId?: string;
}

export function SuperAdminSubscriptionsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchParams;

  const [tenantId, setTenantId] = useState(search.tenantId ?? '');
  const [method, setMethod] = useState<SubscriptionMethodKey | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Tenants dropdown source — sorted A→Z so the user can find by brand quickly.
  const tenantsQ = useSuperAdminTenants({
    sort: 'brandName:asc',
    page: 1,
    limit: 100,
  });

  const filters = {
    tenantId: tenantId || undefined,
    method: method || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, isFetching, isError, refetch } = useSuperAdminSubscriptions(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
  const hasFilter = !!(tenantId || method || from || to);

  const resetFilters = () => {
    setTenantId('');
    setMethod('');
    setFrom('');
    setTo('');
    setPage(1);
    // Drop the ?tenantId search param if it's still in the URL.
    void navigate({ to: '/super-admin/subscriptions', search: {} });
  };

  const onChangePage = (next: number) => setPage(Math.max(1, Math.min(next, totalPages)));

  // If the URL says tenantId=X, surface a "filtered to <brand>" chip.
  const activeTenant = tenantsQ.data?.items.find((t) => t.id === tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('superAdmin.subscriptions.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('superAdmin.subscriptions.subtitle')}</p>
        </div>
        <Link to="/super-admin/subscriptions/new" search={tenantId ? { tenantId } : {}}>
          <Button type="button" size="md">
            <Plus className="h-4 w-4" />
            {t('superAdmin.subscriptions.recordPayment')}
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tenantId" className="text-xs">
                {t('superAdmin.subscriptions.filterTenant')}
              </Label>
              <select
                id="tenantId"
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('superAdmin.subscriptions.allTenants')}</option>
                {(tenantsQ.data?.items ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.brandName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method" className="text-xs">
                {t('superAdmin.subscriptions.filterMethod')}
              </Label>
              <select
                id="method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as SubscriptionMethodKey | '');
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('superAdmin.subscriptions.allMethods')}</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`superAdmin.subscriptions.methods.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">
                {t('superAdmin.subscriptions.filterFrom')}
              </Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">
                {t('superAdmin.subscriptions.filterTo')}
              </Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {(hasFilter || activeTenant) && (
            <div className="mt-4 flex items-center justify-between text-sm flex-wrap gap-2">
              <p className="text-ink-500 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {activeTenant
                  ? t('superAdmin.subscriptions.filteredForTenant', {
                      brand: activeTenant.brandName,
                      count: total,
                    })
                  : t('superAdmin.subscriptions.filteredCount', { count: total })}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
              >
                <X className="h-3.5 w-3.5" />
                {t('superAdmin.subscriptions.clearFilters')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.subscriptions.loadError')}
            </p>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.subscriptions.col.tenant')}
                  </th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('superAdmin.subscriptions.col.amount')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.subscriptions.col.paidAt')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.subscriptions.col.period')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.subscriptions.col.method')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.subscriptions.col.notes')}
                  </th>
                </tr>
              </thead>
              <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
                {isLoading ? (
                  <RowSkeleton />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-ink-500">
                      {hasFilter
                        ? t('superAdmin.subscriptions.emptyFiltered')
                        : t('superAdmin.subscriptions.empty')}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => <Row key={row.id} row={row} />)
                )}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              <p className="text-ink-500 tabular-nums">
                {t('superAdmin.subscriptions.pageOf', { page, totalPages, total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChangePage(page - 1)}
                  disabled={page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('superAdmin.subscriptions.prev')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChangePage(page + 1)}
                  disabled={page >= totalPages || isFetching}
                >
                  {t('superAdmin.subscriptions.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ row }: { row: SuperAdminSubscriptionRow }) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-line-soft last:border-0 hover:bg-line-soft/40 transition-colors">
      <td className="px-5 py-3">
        <Link
          to="/super-admin/tenants/$tenantId"
          params={{ tenantId: row.tenantId }}
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          {row.tenantBrandName}
        </Link>
      </td>
      <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
        {row.amountAzn} ₼
      </td>
      <td className="px-5 py-3 text-ink-900 whitespace-nowrap tabular-nums">
        {formatDate(row.paidAt)}
      </td>
      <td className="px-5 py-3 text-ink-700 tabular-nums whitespace-nowrap">
        {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
      </td>
      <td className="px-5 py-3 text-ink-700 whitespace-nowrap">
        {t(`superAdmin.subscriptions.methods.${row.method as SubscriptionMethodKey}`, {
          defaultValue: row.method,
        })}
      </td>
      <td className="px-5 py-3 text-ink-700 max-w-[20ch]">
        {row.notes ? (
          <span className="line-clamp-1" title={row.notes}>
            {row.notes}
          </span>
        ) : (
          <span className="text-ink-400 italic">—</span>
        )}
      </td>
    </tr>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function RowSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className="border-b border-line-soft">
          <td className="px-5 py-3">
            <div className="h-3 w-32 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-16 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-24 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-40 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-20 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-28 bg-line-soft rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}
