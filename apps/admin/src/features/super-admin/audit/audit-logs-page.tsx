import { ChevronDown, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuperAdminAuditLogs } from '@/hooks/use-super-admin-audit-logs';
import type { ListAuditLogsParams, SuperAdminAuditLogRow } from '@/lib/super-admin-api';

/**
 * Super-admin audit log viewer (Phase 4.17 — last stage of Phase 4).
 *
 * Open-ended query over /super-admin/audit-logs. Distinct from the
 * per-tenant Activity feed on TenantDetailPage (which calls the same
 * endpoint with resourceType='tenant' + resourceId pre-set + pageSize=10).
 *
 * Layout:
 *   - Header
 *   - Filter bar: actorType dropdown + 4 text fields (debounced) + date range
 *   - Result summary + reset link
 *   - Paginated table (50/page): time · actor · action · resource · chevron
 *   - Row click → inline expansion: full changes JSON + ip/userAgent
 *   - Pager
 *
 * The action column gets a namespace-colored pill so e.g. "subscription.*"
 * jumps out vs "tenant.*" vs "legal_document.*". Helps scan-ability when
 * the table is full of system cron rows.
 */
const PAGE_SIZE = 50;
const ACTOR_TYPES = ['super_admin', 'tenant', 'system'] as const;

type ActorTypeFilter = (typeof ACTOR_TYPES)[number] | '';

interface FilterState {
  actorType: ActorTypeFilter;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

const EMPTY_FILTERS: FilterState = {
  actorType: '',
  action: '',
  resourceType: '',
  resourceId: '',
  actorId: '',
  from: '',
  to: '',
};

export function SuperAdminAuditLogsPage() {
  const { t } = useTranslation();

  const [rawFilters, setRawFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS); // debounced
  const [page, setPage] = useState(1);

  // Debounce text inputs by 300ms; selects + dates apply immediately.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => {
        const next: FilterState = {
          ...prev,
          action: rawFilters.action.trim(),
          resourceType: rawFilters.resourceType.trim(),
          resourceId: rawFilters.resourceId.trim(),
          actorId: rawFilters.actorId.trim(),
        };
        if (filtersEqual(prev, next)) return prev;
        return next;
      });
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [rawFilters.action, rawFilters.resourceType, rawFilters.resourceId, rawFilters.actorId]);

  const queryParams = useMemo<ListAuditLogsParams>(
    () => ({
      actorType: filters.actorType || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      resourceId: filters.resourceId || undefined,
      actorId: filters.actorId || undefined,
      from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
      to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filters, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useSuperAdminAuditLogs(queryParams);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !filtersEqual(filters, EMPTY_FILTERS);

  const updateRaw = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setRawFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateImmediate = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setRawFilters((prev) => ({ ...prev, [key]: value }));
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setRawFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const onChangePage = (next: number) => setPage(Math.max(1, Math.min(next, totalPages)));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.audit.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.audit.subtitle')}</p>
      </header>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="actorType" className="text-xs">
                {t('superAdmin.audit.filter.actorType')}
              </Label>
              <select
                id="actorType"
                value={rawFilters.actorType}
                onChange={(e) => updateImmediate('actorType', e.target.value as ActorTypeFilter)}
                className="w-full h-10 rounded-card-sm border border-line bg-bg-elev px-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('superAdmin.audit.filter.actorTypeAll')}</option>
                {ACTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`superAdmin.audit.actorType.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="action" className="text-xs">
                {t('superAdmin.audit.filter.action')}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                <Input
                  id="action"
                  placeholder={t('superAdmin.audit.filter.actionPlaceholder')}
                  value={rawFilters.action}
                  onChange={(e) => updateRaw('action', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resourceType" className="text-xs">
                {t('superAdmin.audit.filter.resourceType')}
              </Label>
              <Input
                id="resourceType"
                placeholder={t('superAdmin.audit.filter.resourceTypePlaceholder')}
                value={rawFilters.resourceType}
                onChange={(e) => updateRaw('resourceType', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resourceId" className="text-xs">
                {t('superAdmin.audit.filter.resourceId')}
              </Label>
              <Input
                id="resourceId"
                placeholder={t('superAdmin.audit.filter.resourceIdPlaceholder')}
                value={rawFilters.resourceId}
                onChange={(e) => updateRaw('resourceId', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actorId" className="text-xs">
                {t('superAdmin.audit.filter.actorId')}
              </Label>
              <Input
                id="actorId"
                placeholder={t('superAdmin.audit.filter.actorIdPlaceholder')}
                value={rawFilters.actorId}
                onChange={(e) => updateRaw('actorId', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">
                {t('superAdmin.audit.filter.from')}
              </Label>
              <Input
                id="from"
                type="date"
                value={rawFilters.from}
                onChange={(e) => updateImmediate('from', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">
                {t('superAdmin.audit.filter.to')}
              </Label>
              <Input
                id="to"
                type="date"
                value={rawFilters.to}
                onChange={(e) => updateImmediate('to', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <p className="text-xs text-ink-500">
              {isLoading
                ? t('superAdmin.audit.loading')
                : t('superAdmin.audit.matchCount', { count: total })}
            </p>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                  <X className="h-4 w-4" />
                  {t('superAdmin.audit.clearFilters')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                {t('superAdmin.audit.refresh')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isError ? (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.audit.errors.loadFailed')}
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
      ) : isLoading && items.length === 0 ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-ink-500 italic">{t('superAdmin.audit.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-line-soft/50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">{t('superAdmin.audit.col.when')}</th>
                  <th className="px-4 py-3">{t('superAdmin.audit.col.actor')}</th>
                  <th className="px-4 py-3">{t('superAdmin.audit.col.action')}</th>
                  <th className="px-4 py-3">{t('superAdmin.audit.col.resource')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <AuditRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pager */}
      {items.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-ink-500">
            {t('superAdmin.audit.pageOf', { page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChangePage(page - 1)}
              disabled={page <= 1 || isFetching}
            >
              {t('superAdmin.audit.previous')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChangePage(page + 1)}
              disabled={page >= totalPages || isFetching}
            >
              {t('superAdmin.audit.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AuditRowProps {
  row: SuperAdminAuditLogRow;
}

function AuditRow({ row }: AuditRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const namespace = actionNamespace(row.action);
  const changesJson = useMemo(() => safeStringify(row.changes), [row.changes]);

  return (
    <>
      <tr
        onClick={() => setExpanded((p) => !p)}
        className="border-b border-line cursor-pointer hover:bg-line-soft/30 transition-colors"
      >
        <td className="px-4 py-3 align-top">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-ink-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-400" />
          )}
        </td>
        <td className="px-4 py-3 align-top whitespace-nowrap">
          <span className="text-ink-900">{new Date(row.createdAt).toLocaleString()}</span>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              {t(`superAdmin.audit.actorType.${row.actorType}`, {
                defaultValue: row.actorType,
              })}
            </span>
            <span className="text-xs text-ink-700 font-mono break-all">{row.actorId ?? '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill ${namespaceTone(namespace)}`}
            >
              {namespace || '·'}
            </span>
            <code className="text-xs text-ink-900 font-mono">{row.action}</code>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col">
            <span className="text-xs text-ink-700">{row.resourceType}</span>
            <span className="text-xs text-ink-500 font-mono break-all">
              {row.resourceId ?? '—'}
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-line-soft/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                  {t('superAdmin.audit.expand.changes')}
                </p>
                {changesJson === null ? (
                  <p className="text-xs text-ink-400 italic">
                    {t('superAdmin.audit.expand.noChanges')}
                  </p>
                ) : (
                  <pre className="text-xs text-ink-900 font-mono bg-bg-elev border border-line rounded-card-sm p-3 overflow-x-auto whitespace-pre-wrap break-words">
                    {changesJson}
                  </pre>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                    {t('superAdmin.audit.expand.ipAddress')}
                  </p>
                  <p className="text-xs text-ink-700 font-mono">{row.ipAddress ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                    {t('superAdmin.audit.expand.userAgent')}
                  </p>
                  <p className="text-xs text-ink-700 break-all">{row.userAgent ?? '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                  {t('superAdmin.audit.expand.id')}
                </p>
                <p className="text-xs text-ink-700 font-mono break-all">{row.id}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function filtersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.actorType === b.actorType &&
    a.action === b.action &&
    a.resourceType === b.resourceType &&
    a.resourceId === b.resourceId &&
    a.actorId === b.actorId &&
    a.from === b.from &&
    a.to === b.to
  );
}

function actionNamespace(action: string): string {
  const idx = action.indexOf('.');
  return idx === -1 ? action : action.slice(0, idx);
}

/** Color the namespace pill by which subsystem the action belongs to. */
function namespaceTone(ns: string): string {
  switch (ns) {
    case 'tenant':
      return 'bg-brand-50 text-brand-600';
    case 'subscription':
      return 'bg-success-50 text-success';
    case 'promo':
      return 'bg-amber-50 text-amber';
    case 'push':
      return 'bg-line-soft text-ink-700';
    case 'legal_document':
      return 'bg-line-soft text-ink-700';
    case 'system':
      return 'bg-line-soft text-ink-500';
    default:
      return 'bg-line-soft text-ink-500';
  }
}

function safeStringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
