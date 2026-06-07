import { AlertTriangle, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { daysUntilBaku } from '@/lib/baku-day';

/**
 * Subscription banner.
 *
 * Shows ONLY when the subscription is "in the danger zone" — within 7 days
 * of expiry, or already past. Hidden otherwise (Wolt-style hide-if-empty).
 *
 * Tone:
 *   - >= 8 days remaining   → hidden
 *   - 2–7 days              → amber, "X days left" (T-7 / T-6 / … window)
 *   - 1 day                 → amber, "tomorrow"
 *   - 0 days                → amber-strong, "today"
 *   - past expiry           → error, "expired N days ago" (T+7 means auto-suspended)
 *   - tenant.status='suspended' → error, "suspended" (regardless of dates)
 *
 * The full Subscription page (Phase 3.18 / B9.1) lives behind a CTA on the
 * banner — payment + invoice history land then. For now the CTA mailtos
 * Tahawash support.
 */
export function SubscriptionBanner({
  status,
  subscriptionEnd,
}: {
  status: 'pending' | 'active' | 'suspended' | 'hidden';
  subscriptionEnd: string | null;
}) {
  const { t } = useTranslation();
  const now = new Date();

  // Suspended trumps any date math — admin needs to know payments are off.
  if (status === 'suspended') {
    return (
      <BannerShell
        tone="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.dashboard.subSuspendedTitle')}
        body={t('tenantAdmin.dashboard.subSuspendedBody')}
      />
    );
  }

  if (!subscriptionEnd) return null;
  const daysLeft = daysUntilBaku(subscriptionEnd, now);

  if (daysLeft > 7) return null; // healthy — hide

  // Past expiry — frame as "ended N days ago"
  if (daysLeft < 0) {
    return (
      <BannerShell
        tone="error"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.dashboard.subExpiredTitle')}
        body={t('tenantAdmin.dashboard.subExpiredBody', { days: Math.abs(daysLeft) })}
      />
    );
  }

  // 0 — today
  if (daysLeft === 0) {
    return (
      <BannerShell
        tone="amber-strong"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t('tenantAdmin.dashboard.subTodayTitle')}
        body={t('tenantAdmin.dashboard.subTodayBody')}
      />
    );
  }

  // 1 — tomorrow
  if (daysLeft === 1) {
    return (
      <BannerShell
        tone="amber"
        icon={<Bell className="h-5 w-5" />}
        title={t('tenantAdmin.dashboard.subTomorrowTitle')}
        body={t('tenantAdmin.dashboard.subTomorrowBody')}
      />
    );
  }

  // 2–7 days — soft amber
  return (
    <BannerShell
      tone="amber"
      icon={<Bell className="h-5 w-5" />}
      title={t('tenantAdmin.dashboard.subSoonTitle', { days: daysLeft })}
      body={t('tenantAdmin.dashboard.subSoonBody')}
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
  icon: React.ReactNode;
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
