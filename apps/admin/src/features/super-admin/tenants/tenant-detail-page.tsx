import { Link, useParams } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarClock,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  Undo,
  User,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useSuperAdminTenant,
  useSuperAdminTenantActivity,
  useUpdateSuperAdminTenant,
  useUpdateSuperAdminTenantStatus,
} from '@/hooks/use-super-admin-tenant';
import type {
  SuperAdminAuditLogRow,
  SuperAdminTenantDetail,
  TenantStatusKey,
  UpdateTenantInput,
} from '@/lib/super-admin-api';

/**
 * Super-admin tenant detail (C4.1).
 *
 * Replaces the Phase 4.3 placeholder. Layout decision (locked at 4.5):
 *   - SINGLE scrolling page with section cards, not sub-tabs. At ~7
 *     sections this scrolls fine and avoids context-switching the
 *     super-admin between tabs. If we ever cross ~10 sections, swap.
 *   - INLINE EDIT with diff-only PATCH (reuses Phase 3 branding-page
 *     pattern). Each editable card has Save + Reset buttons that appear
 *     when the form is dirty.
 *   - STATUS toggle uses inline two-step confirmation (Phase 3 §17).
 *     Transitions: pending/active/suspended/hidden — any → any.
 *
 * Backend: GET /super-admin/tenants/:id (Phase 1.4b) + PATCH /:id +
 * PATCH /:id/status. Activity feed reuses /super-admin/audit-logs
 * filtered to resourceType=tenant.
 */
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const AZ_PHONE_RE = /^\+994\d{9}$/;
const VOEN_RE = /^\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

const STATUSES: TenantStatusKey[] = ['pending', 'active', 'suspended', 'hidden'];

export function SuperAdminTenantDetailPage() {
  const { t } = useTranslation();
  const { tenantId } = useParams({ strict: false }) as { tenantId?: string };

  const { data: tenant, isLoading, isError, refetch } = useSuperAdminTenant(tenantId);

  if (!tenantId) return null;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.tenantDetail.loadError')}
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
      </div>
    );
  }

  return <DetailBody tenant={tenant} />;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/super-admin/tenants"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('superAdmin.tenantDetail.backToList')}
    </Link>
  );
}

// ─── DetailBody (the actual page once data is loaded) ───────────────

interface FormState {
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  themeColor: string;
  contactPhone: string;
  ePointMerchantId: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  minChargeAmount: string;
  chargeStep: string;
}

function initialForm(t: SuperAdminTenantDetail): FormState {
  return {
    brandName: t.brandName,
    legalName: t.legalName,
    voen: t.voen,
    ownerName: t.ownerName,
    ownerEmail: t.ownerEmail,
    ownerPhone: t.ownerPhone,
    themeColor: t.themeColor,
    contactPhone: t.contactPhone ?? '',
    ePointMerchantId: t.ePointMerchantId ?? '',
    subscriptionStart: t.subscriptionStart ? t.subscriptionStart.slice(0, 10) : '',
    subscriptionEnd: t.subscriptionEnd ? t.subscriptionEnd.slice(0, 10) : '',
    minChargeAmount: t.minChargeAmount,
    chargeStep: t.chargeStep,
  };
}

function DetailBody({ tenant }: { tenant: SuperAdminTenantDetail }) {
  const { t } = useTranslation();
  const update = useUpdateSuperAdminTenant(tenant.id);

  const [form, setForm] = useState<FormState>(() => initialForm(tenant));

  // When the underlying tenant updates (e.g. after a successful PATCH or
  // a status flip elsewhere), reset the form to match the new snapshot.
  useEffect(() => {
    setForm(initialForm(tenant));
  }, [tenant]);

  const patch = useMemo(() => diffPatch(form, tenant), [form, tenant]);
  const dirty = Object.keys(patch).length > 0;

  const onReset = () => setForm(initialForm(tenant));

  const onSave = async () => {
    const err = validate(form, t);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await update.mutateAsync(patch);
      toast.success(t('superAdmin.tenantDetail.toastSaved'));
    } catch (e) {
      toast.error(extractUpdateError(e, t));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <BackLink />

      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-10 w-10 rounded-full shrink-0 ring-1 ring-line"
            style={{ backgroundColor: tenant.themeColor }}
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 truncate">
              {tenant.brandName}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {tenant.legalName} · VÖEN {tenant.voen}
            </p>
          </div>
        </div>
        <StatusPill status={tenant.status} />
      </header>

      {/* Status section */}
      <StatusSection tenant={tenant} />

      {/* Identity */}
      <Section
        title={t('superAdmin.tenantDetail.identityTitle')}
        icon={<Building2 className="h-4 w-4" />}
      >
        <FormGrid>
          <Field id="brandName" label={t('superAdmin.tenantNew.brandName')}>
            <Input
              id="brandName"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </Field>
          <Field id="legalName" label={t('superAdmin.tenantNew.legalName')}>
            <Input
              id="legalName"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
          </Field>
          <Field id="voen" label={t('superAdmin.tenantNew.voen')}>
            <Input
              id="voen"
              inputMode="numeric"
              value={form.voen}
              onChange={(e) => setForm({ ...form, voen: e.target.value })}
            />
          </Field>
          <Field id="contactPhone" label={t('superAdmin.tenantNew.contactPhone')}>
            <Input
              id="contactPhone"
              inputMode="tel"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Section>

      {/* Owner */}
      <Section title={t('superAdmin.tenantDetail.ownerTitle')} icon={<User className="h-4 w-4" />}>
        <FormGrid>
          <Field id="ownerName" label={t('superAdmin.tenantNew.ownerName')}>
            <Input
              id="ownerName"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            />
          </Field>
          <Field
            id="ownerEmail"
            label={t('superAdmin.tenantNew.ownerEmail')}
            icon={<Mail className="h-3.5 w-3.5" />}
          >
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            />
          </Field>
          <Field
            id="ownerPhone"
            label={t('superAdmin.tenantNew.ownerPhone')}
            icon={<Phone className="h-3.5 w-3.5" />}
          >
            <Input
              id="ownerPhone"
              inputMode="tel"
              value={form.ownerPhone}
              onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Section>

      {/* Configuration */}
      <Section
        title={t('superAdmin.tenantDetail.configTitle')}
        icon={<CreditCard className="h-4 w-4" />}
      >
        <FormGrid>
          <Field id="themeColor" label={t('superAdmin.tenantNew.themeColor')}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.themeColor || '#0E7AE7'}
                onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                className="h-10 w-12 rounded-card-sm border border-line bg-bg-elev cursor-pointer"
              />
              <Input
                id="themeColor"
                className="flex-1"
                value={form.themeColor}
                onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                placeholder="#0E7AE7"
              />
            </div>
          </Field>
          <Field id="ePointMerchantId" label={t('superAdmin.tenantNew.ePointMerchantId')}>
            <Input
              id="ePointMerchantId"
              value={form.ePointMerchantId}
              onChange={(e) => setForm({ ...form, ePointMerchantId: e.target.value })}
              placeholder="—"
            />
          </Field>
          <Field id="minChargeAmount" label={t('superAdmin.tenantNew.minChargeAmount')}>
            <Input
              id="minChargeAmount"
              inputMode="decimal"
              value={form.minChargeAmount}
              onChange={(e) => setForm({ ...form, minChargeAmount: e.target.value })}
            />
          </Field>
          <Field id="chargeStep" label={t('superAdmin.tenantNew.chargeStep')}>
            <Input
              id="chargeStep"
              inputMode="decimal"
              value={form.chargeStep}
              onChange={(e) => setForm({ ...form, chargeStep: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Section>

      {/* Subscription */}
      <Section
        title={t('superAdmin.tenantDetail.subTitle')}
        icon={<CalendarClock className="h-4 w-4" />}
      >
        <FormGrid>
          <Field id="subscriptionStart" label={t('superAdmin.tenantNew.subStart')}>
            <Input
              id="subscriptionStart"
              type="date"
              value={form.subscriptionStart}
              onChange={(e) => setForm({ ...form, subscriptionStart: e.target.value })}
            />
          </Field>
          <Field id="subscriptionEnd" label={t('superAdmin.tenantNew.subEnd')}>
            <Input
              id="subscriptionEnd"
              type="date"
              value={form.subscriptionEnd}
              onChange={(e) => setForm({ ...form, subscriptionEnd: e.target.value })}
            />
          </Field>
        </FormGrid>
        {tenant.subscriptionEnd && (
          <p className="mt-3 text-xs text-ink-500">
            {t('superAdmin.tenantDetail.subHint')} ·{' '}
            <SubscriptionLifecycleHint endIso={tenant.subscriptionEnd} status={tenant.status} />
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <Link
            to="/super-admin/subscriptions/new"
            search={{ tenantId: tenant.id }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {t('superAdmin.tenantDetail.recordPayment')}
          </Link>
          <span className="text-ink-300">·</span>
          <Link
            to="/super-admin/subscriptions"
            search={{ tenantId: tenant.id }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {t('superAdmin.tenantDetail.viewSubscriptionLog')}
          </Link>
        </div>
      </Section>

      {/* Save bar — sticky-ish dirty indicator */}
      {dirty && (
        <Card className="border-brand-200 bg-brand-50">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink-900 font-medium">
              {t('superAdmin.tenantDetail.dirtyHint')}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" size="md" variant="outline" onClick={onReset}>
                <Undo className="h-4 w-4" />
                {t('superAdmin.tenantDetail.reset')}
              </Button>
              <Button
                type="button"
                size="md"
                onClick={() => void onSave()}
                disabled={update.isPending}
              >
                <Save className="h-4 w-4" />
                {update.isPending
                  ? t('superAdmin.tenantDetail.saving')
                  : t('superAdmin.tenantDetail.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footprint */}
      <Section
        title={t('superAdmin.tenantDetail.footprintTitle')}
        icon={<MapPin className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FootprintCard
            label={t('superAdmin.tenantDetail.counts.locations')}
            value={tenant.counts.locations}
            icon={<MapPin className="h-4 w-4" />}
          />
          <FootprintCard
            label={t('superAdmin.tenantDetail.counts.bays')}
            value={tenant.counts.bays}
            icon={<Wrench className="h-4 w-4" />}
          />
          <FootprintCard
            label={t('superAdmin.tenantDetail.counts.transactions')}
            value={tenant.counts.transactions}
            icon={<ReceiptText className="h-4 w-4" />}
          />
        </div>
      </Section>

      {/* Admin user */}
      <Section title={t('superAdmin.tenantDetail.userTitle')} icon={<User className="h-4 w-4" />}>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <KvRow label={t('superAdmin.tenantDetail.user.username')} value={tenant.user.username} />
          <KvRow
            label={t('superAdmin.tenantDetail.user.lastLogin')}
            value={
              tenant.user.lastLoginAt
                ? new Date(tenant.user.lastLoginAt).toLocaleString()
                : t('superAdmin.tenantDetail.user.neverLoggedIn')
            }
          />
          <KvRow
            label={t('superAdmin.tenantDetail.user.createdAt')}
            value={new Date(tenant.createdAt).toLocaleDateString()}
          />
        </dl>
      </Section>

      {/* Activity feed */}
      <ActivityFeed tenantId={tenant.id} />
    </div>
  );
}

// ─── StatusSection (toggle with inline confirm) ────────────────────

function StatusSection({ tenant }: { tenant: SuperAdminTenantDetail }) {
  const { t } = useTranslation();
  const mutation = useUpdateSuperAdminTenantStatus(tenant.id);
  const [pending, setPending] = useState<TenantStatusKey | null>(null);

  const confirm = async () => {
    if (!pending) return;
    try {
      await mutation.mutateAsync(pending);
      toast.success(t('superAdmin.tenantDetail.status.toastChanged'));
      setPending(null);
    } catch (e) {
      toast.error(extractUpdateError(e, t));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('superAdmin.tenantDetail.status.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-700">
          {t(`superAdmin.tenantDetail.status.desc.${tenant.status}`)}
        </p>
        {pending ? (
          <div className="rounded-card-sm bg-amber-50 border border-amber/20 p-3 space-y-3">
            <p className="text-sm text-ink-900 font-medium">
              {t(`superAdmin.tenantDetail.status.confirm.${pending}`)}
            </p>
            <p className="text-xs text-ink-700">
              {t(`superAdmin.tenantDetail.status.confirmBody.${pending}`)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={
                  pending === 'suspended' || pending === 'hidden' ? 'destructive' : 'primary'
                }
                onClick={() => void confirm()}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? t('superAdmin.tenantDetail.status.changing')
                  : t(`superAdmin.tenantDetail.status.confirmCta.${pending}`)}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPending(null)}>
                {t('superAdmin.tenantDetail.status.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const isCurrent = s === tenant.status;
              return (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={isCurrent ? 'primary' : 'outline'}
                  disabled={isCurrent}
                  onClick={() => setPending(s)}
                >
                  {t(`superAdmin.tenants.status.${s}`)}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ActivityFeed ──────────────────────────────────────────────────

function ActivityFeed({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSuperAdminTenantActivity(tenantId);

  const items = data?.items ?? [];

  return (
    <Section
      title={t('superAdmin.tenantDetail.activityTitle')}
      icon={<Activity className="h-4 w-4" />}
    >
      {isLoading ? (
        <ActivitySkeleton />
      ) : isError ? (
        <p className="text-sm text-error">{t('superAdmin.tenantDetail.activityError')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">{t('superAdmin.tenantDetail.activityEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ActivityRow({ row }: { row: SuperAdminAuditLogRow }) {
  return (
    <li className="flex items-start gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0">
      <Activity className="h-4 w-4 text-ink-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-900">
          <span className="font-semibold">{row.action}</span>
          <span className="text-ink-500"> · {row.actorType}</span>
        </p>
        <p className="text-xs text-ink-500 tabular-nums">
          {new Date(row.createdAt).toLocaleString()}
        </p>
      </div>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-start gap-3 border-b border-line-soft pb-3 last:border-0">
          <div className="h-4 w-4 rounded bg-line-soft mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 bg-line-soft rounded" />
            <div className="h-2.5 w-1/3 bg-line-soft rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Layout primitives ────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {icon && <span className="text-ink-400">{icon}</span>}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {icon && <span className="text-ink-400">{icon}</span>}
        {label}
      </Label>
      {children}
    </div>
  );
}

function FootprintCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between text-ink-500 text-xs font-semibold uppercase tracking-wider">
          <span>{label}</span>
          <span className="text-ink-400">{icon}</span>
        </div>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: TenantStatusKey }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span
      className={`inline-block px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider ${tone}`}
    >
      {t(`superAdmin.tenants.status.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<TenantStatusKey, string> = {
  pending: 'bg-line-soft text-ink-500',
  active: 'bg-success/10 text-success',
  suspended: 'bg-error-50 text-error',
  hidden: 'bg-line-soft text-ink-400',
};

function SubscriptionLifecycleHint({
  endIso,
  status,
}: {
  endIso: string;
  status: TenantStatusKey;
}) {
  const { t } = useTranslation();
  const days = diffBakuDays(new Date(), new Date(endIso));
  if (status === 'suspended') {
    return (
      <span className="text-error font-semibold">{t('superAdmin.tenants.sub.suspended')}</span>
    );
  }
  if (days < 0) {
    return (
      <span className="text-error font-semibold">
        {t('superAdmin.tenants.sub.expiredAgo', { count: Math.abs(days), days: Math.abs(days) })}
      </span>
    );
  }
  if (days === 0) {
    return <span className="text-amber font-semibold">{t('superAdmin.tenants.sub.today')}</span>;
  }
  if (days <= 7) {
    return (
      <span className="text-amber font-semibold">
        {t('superAdmin.tenants.sub.expiringIn', { count: days, days })}
      </span>
    );
  }
  return (
    <span className="text-ink-700">
      {t('superAdmin.tenants.sub.expiringIn', { count: days, days })}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function diffPatch(form: FormState, original: SuperAdminTenantDetail): UpdateTenantInput {
  const patch: UpdateTenantInput = {};

  if (form.brandName !== original.brandName) patch.brandName = form.brandName;
  if (form.legalName !== original.legalName) patch.legalName = form.legalName;
  if (form.voen !== original.voen) patch.voen = form.voen;
  if (form.ownerName !== original.ownerName) patch.ownerName = form.ownerName;
  if (form.ownerEmail !== original.ownerEmail) patch.ownerEmail = form.ownerEmail;
  if (form.ownerPhone !== original.ownerPhone) patch.ownerPhone = form.ownerPhone;
  if (form.themeColor !== original.themeColor) patch.themeColor = form.themeColor;

  const cp = form.contactPhone.trim() || null;
  if (cp !== (original.contactPhone ?? null)) patch.contactPhone = cp;

  const mid = form.ePointMerchantId.trim() || null;
  if (mid !== (original.ePointMerchantId ?? null)) patch.ePointMerchantId = mid;

  const origStart = original.subscriptionStart ? original.subscriptionStart.slice(0, 10) : '';
  if (form.subscriptionStart !== origStart) {
    patch.subscriptionStart = form.subscriptionStart || null;
  }
  const origEnd = original.subscriptionEnd ? original.subscriptionEnd.slice(0, 10) : '';
  if (form.subscriptionEnd !== origEnd) {
    patch.subscriptionEnd = form.subscriptionEnd || null;
  }

  if (form.minChargeAmount !== original.minChargeAmount) {
    patch.minChargeAmount = form.minChargeAmount;
  }
  if (form.chargeStep !== original.chargeStep) {
    patch.chargeStep = form.chargeStep;
  }

  return patch;
}

function validate(form: FormState, t: (k: string) => string): string | null {
  if (!form.brandName || form.brandName.length < 2)
    return t('superAdmin.tenantNew.errors.brandName');
  if (!form.legalName || form.legalName.length < 2)
    return t('superAdmin.tenantNew.errors.legalName');
  if (!VOEN_RE.test(form.voen)) return t('superAdmin.tenantNew.errors.voen');
  if (!form.ownerName || form.ownerName.length < 2)
    return t('superAdmin.tenantNew.errors.ownerName');
  if (!EMAIL_RE.test(form.ownerEmail)) return t('superAdmin.tenantNew.errors.ownerEmail');
  if (!AZ_PHONE_RE.test(form.ownerPhone)) return t('superAdmin.tenantNew.errors.ownerPhone');
  if (form.themeColor && !HEX_RE.test(form.themeColor))
    return t('superAdmin.tenantNew.errors.themeColor');
  if (form.minChargeAmount && !DECIMAL_RE.test(form.minChargeAmount))
    return t('superAdmin.tenantNew.errors.decimal');
  if (form.chargeStep && !DECIMAL_RE.test(form.chargeStep))
    return t('superAdmin.tenantNew.errors.decimal');
  return null;
}

function extractUpdateError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'UNIQUE_CONSTRAINT') return t('superAdmin.tenantDetail.errors.unique');
    if (code === 'TENANT_NOT_FOUND') return t('superAdmin.tenantDetail.errors.notFound');
    if (err.response?.status === 400) return t('superAdmin.tenantNew.errors.validation');
    if (!err.response) return t('superAdmin.tenantNew.errors.network');
  }
  return t('superAdmin.tenantNew.errors.generic');
}

/** Same Baku-day delta function used elsewhere (mobile + tenant notifications). */
function diffBakuDays(from: Date, to: Date): number {
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
