import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSuperAdminPromos } from '@/hooks/use-super-admin-promos';
import type { PromoStatusKey, SuperAdminPromoRow } from '@/lib/super-admin-api';

/**
 * Super-admin promos list (C8.1).
 *
 * Paginated table of every banner. Status filter chips at top.
 * Row click → /super-admin/promos/$promoId (form in edit mode).
 *
 * No bulk actions in this stage — status changes happen on the
 * detail page via inline two-step confirmation (§17).
 */
const PAGE_SIZE = 20;
const STATUSES: PromoStatusKey[] = ['draft', 'scheduled', 'active', 'expired'];

export function SuperAdminPromosListPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PromoStatusKey | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useSuperAdminPromos({
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('superAdmin.promos.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('superAdmin.promos.subtitle')}</p>
        </div>
        <Link to="/super-admin/promos/new">
          <Button type="button" size="md">
            <Plus className="h-4 w-4" />
            {t('superAdmin.promos.create')}
          </Button>
        </Link>
      </div>

      {/* Status filter pills */}
      <Card>
        <CardContent className="py-4">
          <Label className="text-xs">{t('superAdmin.promos.filterStatus')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
              className={pillClass(status === '')}
            >
              {t('superAdmin.promos.allStatuses')}
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={pillClass(status === s)}
              >
                {t(`superAdmin.promos.status.${s}`)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.promos.loadError')}</p>
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

      <Card>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.promos.col.preview')}</th>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.promos.col.title')}</th>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.promos.col.status')}</th>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.promos.col.window')}</th>
                  <th className="px-5 py-3 font-semibold">{t('superAdmin.promos.col.cta')}</th>
                </tr>
              </thead>
              <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
                {isLoading ? (
                  <RowSkeleton />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-ink-500">
                      <ImageIcon className="h-6 w-6 mx-auto mb-2 text-ink-300" />
                      {status ? t('superAdmin.promos.emptyFiltered') : t('superAdmin.promos.empty')}
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
                {t('superAdmin.promos.pageOf', { page, totalPages, total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('superAdmin.subscriptions.prev')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
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

function Row({ row }: { row: SuperAdminPromoRow }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const go = () =>
    void navigate({ to: '/super-admin/promos/$promoId', params: { promoId: row.id } });

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
        <div className="h-12 w-20 rounded-card-sm bg-line-soft overflow-hidden ring-1 ring-line">
          {row.imageUrl ? (
            <img
              src={row.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-ink-400">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>
      </td>
      <td className="px-5 py-3 max-w-[40ch]">
        <p className="font-semibold text-ink-900 truncate">
          <span className="text-ink-400 tabular-nums mr-1.5">#{row.sortOrder}</span>
          {row.titleAz}
        </p>
        <p className="text-xs text-ink-500 truncate">{row.bodyAz}</p>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="px-5 py-3 text-ink-700 whitespace-nowrap tabular-nums">
        {formatDate(row.startAt)} → {formatDate(row.endAt)}
      </td>
      <td className="px-5 py-3 text-ink-700">
        {row.ctaTargetType ? (
          <span className="text-xs">
            {t(`superAdmin.promoForm.ctaTarget.${row.ctaTargetType}`)}
          </span>
        ) : (
          <span className="text-xs text-ink-400 italic">
            {t('superAdmin.promoForm.ctaTarget.none')}
          </span>
        )}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: PromoStatusKey }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_TONES[status]}`}
    >
      {t(`superAdmin.promos.status.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<PromoStatusKey, string> = {
  draft: 'bg-line-soft text-ink-500',
  scheduled: 'bg-amber-50 text-amber',
  active: 'bg-success/10 text-success',
  expired: 'bg-line-soft text-ink-400',
};

function pillClass(selected: boolean): string {
  return `px-3 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
    selected ? 'bg-brand-500 text-white' : 'bg-line-soft text-ink-700 hover:bg-line'
  }`;
}

function RowSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className="border-b border-line-soft">
          <td className="px-5 py-3">
            <div className="h-12 w-20 rounded-card-sm bg-line-soft" />
          </td>
          <td className="px-5 py-3 space-y-1.5">
            <div className="h-3 w-3/4 bg-line-soft rounded" />
            <div className="h-2.5 w-1/2 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-5 w-16 bg-line-soft rounded-pill" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-32 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-20 bg-line-soft rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
