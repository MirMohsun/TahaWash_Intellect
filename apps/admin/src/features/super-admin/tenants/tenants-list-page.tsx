import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Filter, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuperAdminTenants } from '@/hooks/use-super-admin-tenants';
import type {
  SuperAdminTenantListItem,
  TenantListSortKey,
  TenantListStatusKey,
} from '@/lib/super-admin-api';

/**
 * Super-admin tenants list (C3.1).
 *
 * Layout: search + filter bar above a paginated, sortable table. Tenants
 * row → /super-admin/tenants/$tenantId (placeholder; real detail lands in 4.5).
 *
 * Filters (synthetic): status enum + Expired (subscriptionEnd < now). Sort
 * by createdAt | brandName | subscriptionEnd asc/desc.
 *
 * No city filter at this layer — tenants aren't tied to a single city
 * (multi-location). Surface city via the Location sub-section in tenant
 * detail (Phase 4.5).
 *
 * Pagination: 20 per page (matches backend default). `keepPreviousData`
 * keeps rows visible during page / filter / search transitions.
 */
const PAGE_SIZE = 20;
const STATUSES: TenantListStatusKey[] = ['active', 'pending', 'suspended', 'hidden', 'expired'];
const SORTS: TenantListSortKey[] = [
  'createdAt:desc',
  'createdAt:asc',
  'brandName:asc',
  'brandName:desc',
  'subscriptionEnd:asc',
  'subscriptionEnd:desc',
];

export function SuperAdminTenantsListPage() {
  const { t } = useTranslation();

  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [status, setStatus] = useState<TenantListStatusKey | ''>('');
  const [sort, setSort] = useState<TenantListSortKey>('createdAt:desc');
  const [page, setPage] = useState(1);

  // Debounce search by 300ms so we don't refetch per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchRaw.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchRaw]);

  const { data, isLoading, isFetching, isError, refetch } = useSuperAdminTenants({
    q: search || undefined,
    status: status || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;
  const hasFilter = !!(search || status);

  const resetFilters = () => {
    setSearchRaw('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const onChangePage = (next: number) => setPage(Math.max(1, Math.min(next, totalPages)));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('superAdmin.tenants.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('superAdmin.tenants.subtitle')}</p>
        </div>
        <Link to="/super-admin/tenants/new">
          <Button type="button" size="md">
            <Plus className="h-4 w-4" />
            {t('superAdmin.tenants.addNew')}
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="search" className="text-xs">
                {t('superAdmin.tenants.search')}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                <Input
                  id="search"
                  placeholder={t('superAdmin.tenants.searchPlaceholder')}
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs">
                {t('superAdmin.tenants.filterStatus')}
              </Label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as TenantListStatusKey | '');
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('superAdmin.tenants.allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`superAdmin.tenants.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sort" className="text-xs">
                {t('superAdmin.tenants.sortLabel')}
              </Label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as TenantListSortKey);
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`superAdmin.tenants.sort.${s.replace(':', '_')}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilter && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-ink-500 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {t('superAdmin.tenants.filteredCount', { count: total })}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
              >
                <X className="h-3.5 w-3.5" />
                {t('superAdmin.tenants.clearFilters')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.tenants.loadError')}</p>
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
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.tenants.col.brand')}</th>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.tenants.col.status')}</th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('superAdmin.tenants.col.devices')}
                  </th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('superAdmin.tenants.col.monthRevenue')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.tenants.col.subscription')}
                  </th>
                </tr>
              </thead>
              <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
                {isLoading ? (
                  <RowSkeleton />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-ink-500">
                      {hasFilter
                        ? t('superAdmin.tenants.emptyFiltered')
                        : t('superAdmin.tenants.empty')}
                    </td>
                  </tr>
                ) : (
                  items.map((tenant) => <Row key={tenant.id} tenant={tenant} />)
                )}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              <p className="text-ink-500 tabular-nums">
                {t('superAdmin.tenants.pageOf', { page, totalPages, total })}
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
                  {t('superAdmin.tenants.prev')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChangePage(page + 1)}
                  disabled={page >= totalPages || isFetching}
                >
                  {t('superAdmin.tenants.next')}
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

// ─── Row + StatusPill + SubscriptionPill ─────────────────────────────

function Row({ tenant }: { tenant: SuperAdminTenantListItem }) {
  const navigate = useNavigate();
  const go = () =>
    void navigate({ to: '/super-admin/tenants/$tenantId', params: { tenantId: tenant.id } });

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-line-soft/40 transition-colors focus:outline-none focus:bg-line-soft/60"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <ColorDot color={tenant.themeColor} />
          <div className="min-w-0">
            <p className="font-semibold text-ink-900 truncate">{tenant.brandName}</p>
            <p className="text-xs text-ink-500 truncate">{tenant.voen}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={tenant.status} />
      </td>
      <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums">
        {tenant.devicesCount}
      </td>
      <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
        {tenant.monthRevenueAzn} ₼
      </td>
      <td className="px-5 py-3">
        <SubscriptionPill end={tenant.subscriptionEnd} status={tenant.status} />
      </td>
    </tr>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-6 w-6 rounded-full shrink-0 ring-1 ring-line"
      style={{ backgroundColor: color }}
    />
  );
}

function StatusPill({ status }: { status: SuperAdminTenantListItem['status'] }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-pill text-xs font-semibold ${tone}`}>
      {t(`superAdmin.tenants.status.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<SuperAdminTenantListItem['status'], string> = {
  pending: 'bg-line-soft text-ink-500',
  active: 'bg-success/10 text-success',
  suspended: 'bg-error-50 text-error',
  hidden: 'bg-line-soft text-ink-400',
};

function SubscriptionPill({
  end,
  status,
}: {
  end: string | null;
  status: SuperAdminTenantListItem['status'];
}) {
  const { t } = useTranslation();

  if (status === 'suspended') {
    return (
      <span className="text-xs font-semibold text-error">
        {t('superAdmin.tenants.sub.suspended')}
      </span>
    );
  }
  if (!end) {
    return <span className="text-xs text-ink-400 italic">{t('superAdmin.tenants.sub.none')}</span>;
  }
  const days = diffDays(new Date(), new Date(end));
  if (days < 0) {
    return (
      <span className="text-xs font-semibold text-error">
        {t('superAdmin.tenants.sub.expiredAgo', { count: Math.abs(days), days: Math.abs(days) })}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="text-xs font-semibold text-amber">{t('superAdmin.tenants.sub.today')}</span>
    );
  }
  if (days <= 7) {
    return (
      <span className="text-xs font-semibold text-amber">
        {t('superAdmin.tenants.sub.expiringIn', { count: days, days })}
      </span>
    );
  }
  return (
    <span className="text-xs text-ink-700 tabular-nums">
      {t('superAdmin.tenants.sub.endsOn', { date: formatDate(end) })}
    </span>
  );
}

function diffDays(from: Date, to: Date): number {
  const fromKey = new Date(from.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toKey = new Date(to.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const a = Date.UTC(
    Number(fromKey.slice(0, 4)),
    Number(fromKey.slice(5, 7)) - 1,
    Number(fromKey.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toKey.slice(0, 4)),
    Number(toKey.slice(5, 7)) - 1,
    Number(toKey.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
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
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-line-soft">
          <td className="px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-line-soft" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 bg-line-soft rounded" />
                <div className="h-2.5 w-24 bg-line-soft rounded" />
              </div>
            </div>
          </td>
          <td className="px-5 py-3">
            <div className="h-5 w-16 bg-line-soft rounded-pill" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-8 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-16 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-24 bg-line-soft rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}
