import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Download, Filter, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenantLocations } from '@/hooks/use-tenant-locations';
import { useTenantTransactions } from '@/hooks/use-transactions';
import { bakuDateString, formatActivityTime } from '@/lib/baku-day';
import {
  downloadTenantTransactionsCsv,
  type TenantTransactionRow,
  type TenantTransactionStatus,
  type TenantTransactionsFilters,
} from '@/lib/transactions-api';

/**
 * Transactions log (B5.1).
 *
 * Default view: last 30 days, all statuses, 50 rows / page, newest first.
 *
 * Filters layout decision: inline above the table rather than a slide-out
 * sheet. Tenants will filter often — by location to debug a single
 * branch, by status to find hardware errors. Always-visible filters mean
 * one click to narrow vs. two for a drawer.
 *
 * Row click → /transactions/:id (Phase 3.13). For now rows are non-
 * interactive aside from copy-text.
 */
const DEFAULT_PAGE_SIZE = 50;
const STATUSES: TenantTransactionStatus[] = [
  'paid_credited',
  'paid_crediting',
  'paid_hardware_error',
  'declined',
  'cancelled',
  'pending',
];

export function TransactionsPage() {
  const { t } = useTranslation();
  const locationsQ = useTenantLocations();

  // Filters are local state; query is derived from them.
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TenantTransactionStatus | ''>('');
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState(initialFrom());
  const [to, setTo] = useState(bakuDateString(new Date()));
  const [downloading, setDownloading] = useState(false);

  const filters: TenantTransactionsFilters = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    status: status || undefined,
    locationId: locationId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading, isError, isFetching, refetch } = useTenantTransactions(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / DEFAULT_PAGE_SIZE) : 1;
  const hasFilter = !!(status || locationId || from || to);

  const resetFilters = () => {
    setStatus('');
    setLocationId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const onChangePage = (next: number) => setPage(Math.max(1, Math.min(next, totalPages)));

  const onDownloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await downloadTenantTransactionsCsv(filters);
      if (res.capped) {
        toast.warning(t('tenantAdmin.transactions.toastCapped'));
      } else {
        toast.success(t('tenantAdmin.transactions.toastExported', { count: res.rowCount }));
      }
    } catch {
      toast.error(t('tenantAdmin.transactions.errors.exportFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('tenantAdmin.transactions.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('tenantAdmin.transactions.subtitle')}</p>
        </div>
        <Button
          type="button"
          size="md"
          variant="outline"
          onClick={() => void onDownloadCsv()}
          disabled={downloading || isLoading}
        >
          <Download className="h-4 w-4" />
          {downloading
            ? t('tenantAdmin.transactions.exporting')
            : t('tenantAdmin.transactions.exportCsv')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">
                {t('tenantAdmin.transactions.filterFrom')}
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
                {t('tenantAdmin.transactions.filterTo')}
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
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs">
                {t('tenantAdmin.transactions.filterStatus')}
              </Label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as TenantTransactionStatus | '');
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('tenantAdmin.transactions.allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`tenantAdmin.dashboard.txStatus.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs">
                {t('tenantAdmin.transactions.filterLocation')}
              </Label>
              <select
                id="location"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('tenantAdmin.transactions.allLocations')}</option>
                {(locationsQ.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilter && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-ink-500 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {t('tenantAdmin.transactions.filteredCount', { count: total })}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
              >
                <X className="h-3.5 w-3.5" />
                {t('tenantAdmin.transactions.clearFilters')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('tenantAdmin.transactions.loadError')}
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    {t('tenantAdmin.transactions.colWhen')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('tenantAdmin.transactions.colBay')}
                  </th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('tenantAdmin.transactions.colAmount')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('tenantAdmin.transactions.colStatus')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('tenantAdmin.transactions.colPayment')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('tenantAdmin.transactions.colCustomer')}
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
                        ? t('tenantAdmin.transactions.emptyFiltered')
                        : t('tenantAdmin.transactions.empty')}
                    </td>
                  </tr>
                ) : (
                  items.map((tx) => <Row key={tx.id} tx={tx} />)
                )}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              <p className="text-ink-500 tabular-nums">
                {t('tenantAdmin.transactions.pageOf', {
                  page,
                  totalPages,
                  total,
                })}
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
                  {t('tenantAdmin.transactions.prev')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChangePage(page + 1)}
                  disabled={page >= totalPages || isFetching}
                >
                  {t('tenantAdmin.transactions.next')}
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

// ─── Row ────────────────────────────────────────────────────────────

function Row({ tx }: { tx: TenantTransactionRow }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const card = tx.cardBrand && tx.cardLastFour ? `${tx.cardBrand} ••${tx.cardLastFour}` : null;

  // Use onClick + cursor instead of wrapping <tr> in <a> (HTML doesn't allow
  // anchors as table-row parents). Keyboard a11y via tabIndex+Enter.
  const go = () =>
    void navigate({ to: '/transactions/$transactionId', params: { transactionId: tx.id } });

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
      <td className="px-5 py-3 text-ink-900 whitespace-nowrap">
        {formatActivityTime(tx.occurredAt, t, new Date())}
      </td>
      <td className="px-5 py-3 text-ink-900">
        <p className="font-semibold">{tx.bay.name}</p>
        <p className="text-xs text-ink-500">{tx.location.name}</p>
      </td>
      <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
        {tx.amountAzn} ₼
      </td>
      <td className="px-5 py-3">
        <StatusPill status={tx.status} />
      </td>
      <td className="px-5 py-3 text-ink-700">
        {card ? (
          <span className="tabular-nums">{card}</span>
        ) : (
          <span className="text-ink-400 italic">{t('tenantAdmin.transactions.noCard')}</span>
        )}
      </td>
      <td className="px-5 py-3 text-ink-700">
        {tx.customerAnonymized ? (
          <span className="text-ink-400 italic">
            {t('tenantAdmin.transactions.customerAnonymized')}
          </span>
        ) : (
          <span className="tabular-nums">{tx.customerPhoneMasked}</span>
        )}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: TenantTransactionStatus }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-pill text-xs font-semibold ${tone}`}>
      {t(`tenantAdmin.dashboard.txStatus.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<TenantTransactionStatus, string> = {
  pending: 'bg-line-soft text-ink-500',
  paid_crediting: 'bg-line-soft text-ink-500',
  paid_credited: 'bg-success/10 text-success',
  paid_hardware_error: 'bg-amber-50 text-amber',
  declined: 'bg-error-50 text-error',
  cancelled: 'bg-line-soft text-ink-400',
};

function RowSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-line-soft">
          <td className="px-5 py-3">
            <div className="h-3 w-24 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3 space-y-1.5">
            <div className="h-3 w-32 bg-line-soft rounded" />
            <div className="h-2.5 w-24 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-12 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-5 w-16 bg-line-soft rounded-pill" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-20 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-32 bg-line-soft rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}

/** Default "from" = 30 days ago in Baku. Tenants want recent ops by default. */
function initialFrom(): string {
  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return bakuDateString(thirtyAgo);
}
