import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Receipt,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantSubscriptions } from '@/hooks/use-subscriptions';
import { daysUntilBaku } from '@/lib/baku-day';
import type { TenantSubscriptionRow } from '@/lib/subscriptions-api';
import { useAuthStore } from '@/store/auth';

/**
 * Subscription page (B9.1).
 *
 * Active period info comes from /tenant/me (auth store snapshot) — the
 * historical payment log comes from /tenant/subscriptions (added in
 * this stage's backend commit).
 *
 * MVP doesn't have self-serve renewal — Tahawash records each
 * subscription manually after off-platform payment (bank transfer or
 * cash). So the "Renew" affordance is a "Message support" CTA with
 * WhatsApp + email contact info, not a checkout flow.
 *
 * Lifecycle banner is the prominent UX hook: T-7 / T-1 / T-0 / past
 * expiry get progressively stronger color + copy. Hidden when healthy
 * (Wolt-style).
 */
const SUPPORT_WHATSAPP_PHONE = '+994551234567'; // TODO Phase 6: replace with real support number
const SUPPORT_EMAIL = 'support@tahawash.az'; // TODO Phase 6: replace if different

export function SubscriptionPage() {
  const { t } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);
  const { data, isLoading, isError, refetch } = useTenantSubscriptions();

  if (!tenant) return null;

  const subscriptionEnd = tenant.subscriptionEnd;
  const daysLeft = subscriptionEnd ? daysUntilBaku(subscriptionEnd, new Date()) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.subscription.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('tenantAdmin.subscription.subtitle')}</p>
      </div>

      <LifecycleBanner
        status={tenant.status}
        daysLeft={daysLeft}
        subscriptionEnd={subscriptionEnd}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current period */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.subscription.currentTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PeriodRow
              icon={<CalendarCheck className="h-4 w-4" />}
              label={t('tenantAdmin.subscription.start')}
              value={
                tenant.subscriptionStart ? (
                  formatDate(tenant.subscriptionStart)
                ) : (
                  <span className="text-ink-400 italic">—</span>
                )
              }
            />
            <PeriodRow
              icon={<CalendarClock className="h-4 w-4" />}
              label={t('tenantAdmin.subscription.end')}
              value={
                subscriptionEnd ? (
                  <div>
                    <span>{formatDate(subscriptionEnd)}</span>
                    {daysLeft !== null && <DaysLeftBadge daysLeft={daysLeft} t={t} />}
                  </div>
                ) : (
                  <span className="text-ink-400 italic">—</span>
                )
              }
            />
            <PeriodRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.status')}
              value={
                <span
                  className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${
                    STATUS_TONES[tenant.status]
                  }`}
                >
                  {t(`tenantAdmin.status.${tenant.status}`)}
                </span>
              }
            />
          </CardContent>
        </Card>

        {/* Renew via support */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.subscription.renewTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-700">{t('tenantAdmin.subscription.renewBody')}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(
                  buildWhatsAppPrefill(tenant.brandName, tenant.voen, t),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button size="md">
                  <MessageCircle className="h-4 w-4" />
                  {t('tenantAdmin.subscription.contactWhatsApp')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-block">
                <Button size="md" variant="outline">
                  {t('tenantAdmin.subscription.contactEmail')}
                </Button>
              </a>
            </div>
            <p className="text-xs text-ink-500">{t('tenantAdmin.subscription.renewHint')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-ink-400" />
            {t('tenantAdmin.subscription.historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="px-5 py-4 bg-error-50 border-t border-error/20 flex items-center justify-between">
              <p className="text-sm text-error font-medium">
                {t('tenantAdmin.subscription.loadError')}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {t('tenantAdmin.dashboard.retry')}
              </button>
            </div>
          ) : isLoading ? (
            <HistorySkeleton />
          ) : data && data.length > 0 ? (
            <HistoryTable rows={data} />
          ) : (
            <p className="text-sm text-ink-500 italic px-5 py-8 text-center">
              {t('tenantAdmin.subscription.historyEmpty')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Lifecycle banner ─────────────────────────────────────────────

function LifecycleBanner({
  status,
  daysLeft,
  subscriptionEnd,
}: {
  status: 'pending' | 'active' | 'suspended' | 'hidden';
  daysLeft: number | null;
  subscriptionEnd: string | null;
}) {
  const { t } = useTranslation();

  if (status === 'suspended') {
    return (
      <BannerShell
        tone="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.subscription.bannerSuspendedTitle')}
        body={t('tenantAdmin.subscription.bannerSuspendedBody')}
      />
    );
  }
  if (!subscriptionEnd || daysLeft === null) return null;
  if (daysLeft > 7) return null;
  if (daysLeft < 0) {
    return (
      <BannerShell
        tone="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.subscription.bannerExpiredTitle')}
        body={t('tenantAdmin.subscription.bannerExpiredBody', { days: Math.abs(daysLeft) })}
      />
    );
  }
  if (daysLeft === 0) {
    return (
      <BannerShell
        tone="amber-strong"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.subscription.bannerTodayTitle')}
        body={t('tenantAdmin.subscription.bannerTodayBody')}
      />
    );
  }
  if (daysLeft === 1) {
    return (
      <BannerShell
        tone="amber"
        icon={<Bell className="h-5 w-5" />}
        title={t('tenantAdmin.subscription.bannerTomorrowTitle')}
        body={t('tenantAdmin.subscription.bannerTomorrowBody')}
      />
    );
  }
  return (
    <BannerShell
      tone="amber"
      icon={<Bell className="h-5 w-5" />}
      title={t('tenantAdmin.subscription.bannerSoonTitle', { days: daysLeft })}
      body={t('tenantAdmin.subscription.bannerSoonBody')}
    />
  );
}

function BannerShell({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'amber' | 'amber-strong' | 'error';
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const palette =
    tone === 'error'
      ? 'bg-error-50 border-error/20 text-error'
      : tone === 'amber-strong'
        ? 'bg-amber-50 border-amber/30 text-amber'
        : 'bg-amber-50 border-amber/20 text-amber';
  return (
    <div className={`rounded-card-sm border px-4 py-3 flex gap-3 items-start ${palette}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-ink-900 text-sm">{title}</p>
        <p className="mt-0.5 text-sm text-ink-700">{body}</p>
      </div>
    </div>
  );
}

// ─── Days-left badge ──────────────────────────────────────────────

function DaysLeftBadge({
  daysLeft,
  t,
}: {
  daysLeft: number;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (daysLeft < 0)
    return (
      <span className="ml-2 text-xs text-error font-semibold">
        {t('tenantAdmin.businessProfile.expiredAgo', { days: Math.abs(daysLeft) })}
      </span>
    );
  if (daysLeft <= 7)
    return (
      <span className="ml-2 text-xs text-amber font-semibold">
        {t('tenantAdmin.businessProfile.daysLeft', { days: daysLeft })}
      </span>
    );
  return (
    <span className="ml-2 text-xs text-ink-500">
      {t('tenantAdmin.businessProfile.daysLeft', { days: daysLeft })}
    </span>
  );
}

// ─── History table ────────────────────────────────────────────────

function HistoryTable({ rows }: { rows: TenantSubscriptionRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-400 border-b border-line">
          <tr>
            <th className="px-5 py-3 font-semibold">{t('tenantAdmin.subscription.colPaidAt')}</th>
            <th className="px-5 py-3 font-semibold text-right">
              {t('tenantAdmin.subscription.colAmount')}
            </th>
            <th className="px-5 py-3 font-semibold">{t('tenantAdmin.subscription.colPeriod')}</th>
            <th className="px-5 py-3 font-semibold">{t('tenantAdmin.subscription.colMethod')}</th>
            <th className="px-5 py-3 font-semibold">{t('tenantAdmin.subscription.colNotes')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line-soft last:border-0">
              <td className="px-5 py-3 text-ink-900 whitespace-nowrap">{formatDate(r.paidAt)}</td>
              <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                {r.amountAzn} ₼
              </td>
              <td className="px-5 py-3 text-ink-700 whitespace-nowrap">
                {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
              </td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700">
                  <CreditCard className="h-3.5 w-3.5 text-ink-400" />
                  {t(`tenantAdmin.subscription.method.${r.method}`, { defaultValue: r.method })}
                </span>
              </td>
              <td className="px-5 py-3 text-ink-500 text-xs max-w-xs truncate">{r.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="divide-y divide-line-soft">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="px-5 py-4 flex gap-3 items-center">
          <div className="h-3 w-20 bg-line-soft rounded" />
          <div className="h-3 w-16 bg-line-soft rounded" />
          <div className="h-3 w-32 bg-line-soft rounded" />
          <div className="h-3 w-20 bg-line-soft rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function PeriodRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-ink-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">{label}</p>
        <div className="mt-0.5 text-sm text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function buildWhatsAppPrefill(
  brandName: string,
  voen: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  return t('tenantAdmin.subscription.whatsAppPrefill', { brand: brandName, voen });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

const STATUS_TONES: Record<'pending' | 'active' | 'suspended' | 'hidden', string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-line-soft text-ink-500',
  suspended: 'bg-amber-50 text-amber',
  hidden: 'bg-error-50 text-error',
};
