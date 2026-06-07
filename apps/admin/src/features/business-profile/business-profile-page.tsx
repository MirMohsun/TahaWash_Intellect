import { Link } from '@tanstack/react-router';
import {
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  Fingerprint,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { daysUntilBaku } from '@/lib/baku-day';
import { useAuthStore } from '@/store/auth';

/**
 * Business profile (B8.1).
 *
 * Read-only summary of the tenant identity fields that the tenant CANNOT
 * change themselves (super-admin-managed at /super-admin/tenants/*).
 * These are system-of-record: legal name, VOEN, owner contacts, ePoint
 * merchant ID, subscription dates, status.
 *
 * The mutable fields (brand name, theme color, descriptions, contact
 * phone, min/step config) live on the Branding page — see 3.15/3.16.
 *
 * UX angle: the "if anything's wrong, message support" banner is
 * prominent. Tahawash doesn't give tenants self-service over their own
 * legal identity — that's intentional (KYC, payments, compliance).
 */
export function BusinessProfilePage() {
  const { t } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.businessProfile.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('tenantAdmin.businessProfile.subtitle')}</p>
      </div>

      {/* Support banner */}
      <Card className="border-brand-500/20 bg-brand-50">
        <CardContent className="py-4 px-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-ink-900">
              {t('tenantAdmin.businessProfile.supportTitle')}
            </p>
            <p className="text-sm text-ink-700">{t('tenantAdmin.businessProfile.supportBody')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.businessProfile.identityTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              icon={<Building2 className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.brandName')}
              value={tenant.brandName}
            />
            <Row
              icon={<Building2 className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.legalName')}
              value={tenant.legalName}
            />
            <Row
              icon={<Fingerprint className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.voen')}
              value={<span className="font-mono">{tenant.voen}</span>}
              hint={t('tenantAdmin.businessProfile.voenHint')}
            />
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.businessProfile.ownerTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              icon={<User className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.ownerName')}
              value={tenant.ownerName}
            />
            <Row
              icon={<Mail className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.ownerEmail')}
              value={
                <a
                  href={`mailto:${tenant.ownerEmail}`}
                  className="text-brand-600 hover:text-brand-700"
                >
                  {tenant.ownerEmail}
                </a>
              }
            />
            <Row
              icon={<Phone className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.ownerPhone')}
              value={<span className="tabular-nums">{tenant.ownerPhone}</span>}
            />
          </CardContent>
        </Card>

        {/* Payment integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.businessProfile.paymentsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              icon={<CreditCard className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.ePointMerchantId')}
              value={
                tenant.ePointMerchantId ? (
                  <span className="font-mono">{tenant.ePointMerchantId}</span>
                ) : (
                  <span className="text-amber italic">
                    {t('tenantAdmin.businessProfile.ePointNotConfigured')}
                  </span>
                )
              }
              hint={
                tenant.ePointMerchantId
                  ? t('tenantAdmin.businessProfile.ePointConfiguredHint')
                  : t('tenantAdmin.businessProfile.ePointNotConfiguredHint')
              }
            />
          </CardContent>
        </Card>

        {/* Subscription summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-ink-400" />
              {t('tenantAdmin.businessProfile.subscriptionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              icon={<Shield className="h-4 w-4" />}
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
            <Row
              icon={<Calendar className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.subStart')}
              value={
                tenant.subscriptionStart ? (
                  formatDate(tenant.subscriptionStart)
                ) : (
                  <span className="text-ink-400 italic">—</span>
                )
              }
            />
            <Row
              icon={<Calendar className="h-4 w-4" />}
              label={t('tenantAdmin.businessProfile.subEnd')}
              value={
                tenant.subscriptionEnd ? (
                  <SubEndValue iso={tenant.subscriptionEnd} t={t} />
                ) : (
                  <span className="text-ink-400 italic">—</span>
                )
              }
            />
            <div className="pt-2">
              <Link to="/subscription">
                <Button size="sm" variant="outline">
                  {t('tenantAdmin.businessProfile.manageSubscription')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-ink-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">{label}</p>
        <div className="mt-0.5 text-sm text-ink-900">{value}</div>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

function SubEndValue({
  iso,
  t,
}: {
  iso: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const daysLeft = daysUntilBaku(iso, new Date());
  const label = formatDate(iso);
  if (daysLeft < 0) {
    return (
      <div>
        <span>{label}</span>
        <span className="ml-2 text-xs text-error font-semibold">
          {t('tenantAdmin.businessProfile.expiredAgo', { days: Math.abs(daysLeft) })}
        </span>
      </div>
    );
  }
  if (daysLeft <= 7) {
    return (
      <div>
        <span>{label}</span>
        <span className="ml-2 text-xs text-amber font-semibold">
          {t('tenantAdmin.businessProfile.daysLeft', { days: daysLeft })}
        </span>
      </div>
    );
  }
  return (
    <div>
      <span>{label}</span>
      <span className="ml-2 text-xs text-ink-500">
        {t('tenantAdmin.businessProfile.daysLeft', { days: daysLeft })}
      </span>
    </div>
  );
}

const STATUS_TONES: Record<'pending' | 'active' | 'suspended' | 'hidden', string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-line-soft text-ink-500',
  suspended: 'bg-amber-50 text-amber',
  hidden: 'bg-error-50 text-error',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA'); // "YYYY-MM-DD"
}
