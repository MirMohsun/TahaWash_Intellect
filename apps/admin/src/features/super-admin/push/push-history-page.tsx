import { Link, useNavigate } from '@tanstack/react-router';
import { Bell, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSuperAdminPushHistory } from '@/hooks/use-super-admin-push';
import type { PushStatus, SuperAdminPushRow } from '@/lib/super-admin-api';

/**
 * Super-admin push history (C7.2).
 *
 * Paginated table of past + scheduled + in-flight campaigns. Status
 * derived server-side (queued/scheduled/sent). Click row → detail.
 * Delivery rate column renders only after the campaign is sent — for
 * queued/scheduled it shows "—".
 *
 * Composer entry point sits in the header.
 */
const PAGE_SIZE = 20;

export function SuperAdminPushHistoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useSuperAdminPushHistory({
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
            {t('superAdmin.pushHistory.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('superAdmin.pushHistory.subtitle')}</p>
        </div>
        <Link to="/super-admin/push/new">
          <Button type="button" size="md">
            <Plus className="h-4 w-4" />
            {t('superAdmin.pushHistory.compose')}
          </Button>
        </Link>
      </div>

      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.pushHistory.loadError')}
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

      <Card>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.pushHistory.col.title')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.pushHistory.col.target')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.pushHistory.col.status')}
                  </th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('superAdmin.pushHistory.col.recipients')}
                  </th>
                  <th className="px-5 py-3 font-semibold text-right">
                    {t('superAdmin.pushHistory.col.deliveryRate')}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t('superAdmin.pushHistory.col.when')}
                  </th>
                </tr>
              </thead>
              <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
                {isLoading ? (
                  <RowSkeleton />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-ink-500">
                      <Bell className="h-6 w-6 mx-auto mb-2 text-ink-300" />
                      {t('superAdmin.pushHistory.empty')}
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
                {t('superAdmin.pushHistory.pageOf', { page, totalPages, total })}
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

function Row({ row }: { row: SuperAdminPushRow }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const go = () => void navigate({ to: '/super-admin/push/$pushId', params: { pushId: row.id } });

  const rate =
    row.status === 'sent' && row.recipientsCount > 0
      ? (row.deliveredCount / row.recipientsCount) * 100
      : null;

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
      <td className="px-5 py-3 max-w-[40ch]">
        <p className="font-semibold text-ink-900 truncate">{row.titleAz}</p>
        <p className="text-xs text-ink-500 truncate">{row.bodyAz}</p>
      </td>
      <td className="px-5 py-3 text-ink-700 whitespace-nowrap">
        <TargetLabel row={row} />
      </td>
      <td className="px-5 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
        {row.status === 'sent' ? row.recipientsCount : '—'}
      </td>
      <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap text-ink-700">
        {rate === null ? '—' : `${rate.toFixed(1)}%`}
      </td>
      <td className="px-5 py-3 text-ink-700 tabular-nums whitespace-nowrap">
        {row.sentAt
          ? formatDateTime(row.sentAt)
          : row.scheduledFor
            ? t('superAdmin.pushHistory.scheduledOn', { date: formatDateTime(row.scheduledFor) })
            : formatDateTime(row.createdAt)}
      </td>
    </tr>
  );
}

function TargetLabel({ row }: { row: SuperAdminPushRow }) {
  const { t } = useTranslation();
  if (row.targetType === 'all') return <>{t('superAdmin.push.target.all')}</>;
  if (row.targetType === 'city')
    return (
      <span title={row.targetValues.join(', ')}>
        {t('superAdmin.push.target.city')} · {row.targetValues.length}
      </span>
    );
  return (
    <span>
      {t('superAdmin.push.target.language')} ·{' '}
      <span className="uppercase tabular-nums">{row.targetValues.join('/')}</span>
    </span>
  );
}

function StatusPill({ status }: { status: PushStatus }) {
  const { t } = useTranslation();
  const tone =
    status === 'sent'
      ? 'bg-success/10 text-success'
      : status === 'scheduled'
        ? 'bg-amber-50 text-amber'
        : 'bg-line-soft text-ink-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-pill text-xs font-semibold ${tone}`}>
      {t(`superAdmin.pushHistory.status.${status}`)}
    </span>
  );
}

function RowSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className="border-b border-line-soft">
          <td className="px-5 py-3 space-y-1.5">
            <div className="h-3 w-3/4 bg-line-soft rounded" />
            <div className="h-2.5 w-1/2 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-20 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-5 w-16 bg-line-soft rounded-pill" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-12 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-3 w-12 bg-line-soft rounded" />
          </td>
          <td className="px-5 py-3">
            <div className="h-3 w-24 bg-line-soft rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
