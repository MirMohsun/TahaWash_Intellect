import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Bell, Calendar, CheckCircle2, Send, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSuperAdminPushDetail } from '@/hooks/use-super-admin-push';
import type { PushStatus, SuperAdminPushRow } from '@/lib/super-admin-api';

/**
 * Super-admin push detail (read-only, part of C7.2).
 *
 * Shows the full campaign: AZ/RU/EN content + target details +
 * schedule + delivery counts. Refetches every 30s while the campaign
 * is in flight so the super-admin sees delivery progress without a
 * manual reload.
 */
const LANGS = ['az', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

export function SuperAdminPushDetailPage() {
  const { t } = useTranslation();
  const { pushId } = useParams({ strict: false }) as { pushId?: string };
  const { data, isLoading, isError, refetch } = useSuperAdminPushDetail(pushId);
  const [activeLang, setActiveLang] = useState<Lang>('az');

  if (!pushId) return null;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.pushDetail.loadError')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = pickTitle(data, activeLang);
  const body = pickBody(data, activeLang);
  const rate =
    data.status === 'sent' && data.recipientsCount > 0
      ? (data.deliveredCount / data.recipientsCount) * 100
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink />

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-card-sm bg-brand-500 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
              {t('superAdmin.pushDetail.title')}
            </h1>
            <p className="mt-0.5 text-xs text-ink-500 tabular-nums">{data.id}</p>
          </div>
        </div>
        <StatusPill status={data.status} />
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label={t('superAdmin.pushHistory.col.recipients')}
          value={data.status === 'sent' ? data.recipientsCount.toString() : '—'}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label={t('superAdmin.pushDetail.delivered')}
          value={data.status === 'sent' ? data.deliveredCount.toString() : '—'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label={t('superAdmin.pushHistory.col.deliveryRate')}
          value={rate === null ? '—' : `${rate.toFixed(1)}%`}
          icon={<Send className="h-4 w-4" />}
        />
        <Stat
          label={t('superAdmin.pushDetail.created')}
          value={formatDate(data.createdAt)}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.push.contentTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {LANGS.map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setActiveLang(lng)}
                className={`px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeLang === lng
                    ? 'bg-brand-500 text-white'
                    : 'bg-line-soft text-ink-500 hover:text-ink-900'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
              {t('superAdmin.push.titleLabel', { lng: activeLang.toUpperCase() })}
            </p>
            <p className="text-ink-900 font-semibold">{title}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
              {t('superAdmin.push.bodyLabel', { lng: activeLang.toUpperCase() })}
            </p>
            <p className="text-ink-900 whitespace-pre-wrap">{body}</p>
          </div>
        </CardContent>
      </Card>

      {/* Targeting + schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.pushDetail.targetingTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Kv
              label={t('superAdmin.push.targetTitle')}
              value={t(`superAdmin.push.target.${data.targetType}`)}
            />
            {data.targetValues.length > 0 && (
              <Kv
                label={t('superAdmin.pushDetail.targetValues')}
                value={data.targetValues.join(', ')}
              />
            )}
            <Kv
              label={t('superAdmin.pushDetail.scheduledForLabel')}
              value={
                data.scheduledFor
                  ? formatDateTime(data.scheduledFor)
                  : t('superAdmin.pushDetail.sentImmediately')
              }
            />
            <Kv
              label={t('superAdmin.pushDetail.sentAtLabel')}
              value={data.sentAt ? formatDateTime(data.sentAt) : t('superAdmin.pushDetail.notSent')}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/super-admin/push"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('superAdmin.push.backToHistory')}
    </Link>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between text-ink-500 text-xs">
          <span className="font-semibold uppercase tracking-wider">{label}</span>
          <span className="text-ink-400">{icon}</span>
        </div>
        <p className="mt-1.5 text-xl font-extrabold tabular-nums text-ink-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </div>
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
    <span
      className={`inline-block px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider ${tone}`}
    >
      {t(`superAdmin.pushHistory.status.${status}`)}
    </span>
  );
}

function pickTitle(row: SuperAdminPushRow, lang: Lang): string {
  if (lang === 'az') return row.titleAz;
  if (lang === 'ru') return row.titleRu;
  return row.titleEn;
}
function pickBody(row: SuperAdminPushRow, lang: Lang): string {
  if (lang === 'az') return row.bodyAz;
  if (lang === 'ru') return row.bodyRu;
  return row.bodyEn;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
