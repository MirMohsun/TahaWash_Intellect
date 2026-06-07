import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateSuperAdminSubscription } from '@/hooks/use-create-super-admin-subscription';
import { useSuperAdminTenant } from '@/hooks/use-super-admin-tenant';
import { useSuperAdminTenants } from '@/hooks/use-super-admin-tenants';
import type { SubscriptionMethodKey } from '@/lib/super-admin-api';

/**
 * Super-admin: record a subscription payment (C5.2).
 *
 * If `?tenantId=X` is in the URL, the form starts with that tenant
 * selected and uses its current `subscriptionEnd` to auto-suggest
 * periodStart = max(currentEnd + 1d, today), periodEnd = +30d.
 *
 * Backend `POST /super-admin/tenants/:tenantId/subscriptions` creates
 * the row, bumps the tenant's subscriptionEnd if periodEnd is later,
 * and writes an audit-log entry (super_admin · subscription.create).
 */
const DECIMAL_POSITIVE = /^(?!0(\.0+)?$)\d+(\.\d{1,2})?$/;
const METHODS: SubscriptionMethodKey[] = ['bank_transfer', 'cash', 'other'];

const schema = z
  .object({
    tenantId: z.string().min(1, 'tenantRequired'),
    amountAzn: z.string().trim().regex(DECIMAL_POSITIVE, 'amount'),
    paidAt: z.string().min(1, 'paidAtRequired'),
    periodStart: z.string().min(1, 'periodStartRequired'),
    periodEnd: z.string().min(1, 'periodEndRequired'),
    method: z.enum(['bank_transfer', 'cash', 'other']),
    notes: z.string().max(500).optional().or(z.literal('')),
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: 'periodOrder',
    path: ['periodEnd'],
  });

type FormInput = z.infer<typeof schema>;

export function SuperAdminSubscriptionFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tenantId?: string };

  const initialTenantId = search.tenantId ?? '';

  const tenantsQ = useSuperAdminTenants({
    sort: 'brandName:asc',
    page: 1,
    limit: 100,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: initialTenantId,
      amountAzn: '',
      paidAt: todayIsoDate(),
      periodStart: '',
      periodEnd: '',
      method: 'bank_transfer',
      notes: '',
    },
  });

  const selectedTenantId = watch('tenantId');
  const tenantDetailQ = useSuperAdminTenant(selectedTenantId || undefined);
  const mutate = useCreateSuperAdminSubscription(selectedTenantId);

  // When the selected tenant changes, auto-fill periodStart/periodEnd.
  // Triggers ONLY on tenant change, not on every keystroke — user-edited
  // dates stick across other field edits.
  useEffect(() => {
    if (!tenantDetailQ.data) return;
    const { periodStart, periodEnd } = suggestedDates(tenantDetailQ.data.subscriptionEnd);
    setValue('periodStart', periodStart, { shouldValidate: false });
    setValue('periodEnd', periodEnd, { shouldValidate: false });
    // Intentionally narrow deps — we want this to fire when the tenant snapshot
    // arrives or the selected tenant changes, not on form keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantDetailQ.data?.id, tenantDetailQ.data?.subscriptionEnd]);

  const onSubmit = async (values: FormInput) => {
    try {
      const res = await mutate.mutateAsync({
        amountAzn: values.amountAzn,
        paidAt: new Date(values.paidAt).toISOString(),
        periodStart: new Date(values.periodStart).toISOString(),
        periodEnd: new Date(values.periodEnd).toISOString(),
        method: values.method,
        notes: values.notes || undefined,
      });
      toast.success(
        res.tenant.bumped
          ? t('superAdmin.subscriptionNew.toastRenewed', {
              brand: res.subscription.tenantBrandName,
            })
          : t('superAdmin.subscriptionNew.toastRecorded', {
              brand: res.subscription.tenantBrandName,
            }),
      );
      void navigate({
        to: '/super-admin/subscriptions',
        search: { tenantId: res.subscription.tenantId },
      });
    } catch (err) {
      const mapped = mapCreateError(err, t);
      if (mapped.field) {
        setError(mapped.field as keyof FormInput, { message: mapped.message });
      } else {
        toast.error(mapped.message);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/super-admin/subscriptions"
        search={initialTenantId ? { tenantId: initialTenantId } : {}}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('superAdmin.subscriptionNew.backToList')}
      </Link>

      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.subscriptionNew.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.subscriptionNew.subtitle')}</p>
      </header>

      {tenantDetailQ.data?.subscriptionEnd && (
        <Card className="border-brand-200 bg-brand-50">
          <CardContent className="py-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
            <p className="text-sm text-ink-900">
              {t('superAdmin.subscriptionNew.chainHint', {
                brand: tenantDetailQ.data.brandName,
                end: formatDate(tenantDetailQ.data.subscriptionEnd),
              })}
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.subscriptionNew.tenantTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.subscriptionNew.tenantBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              id="tenantId"
              label={t('superAdmin.subscriptions.filterTenant')}
              error={
                errors.tenantId && t(`superAdmin.subscriptionNew.errors.${errors.tenantId.message}`)
              }
            >
              <select
                id="tenantId"
                {...register('tenantId')}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="">{t('superAdmin.subscriptionNew.pickTenant')}</option>
                {(tenantsQ.data?.items ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.brandName}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('superAdmin.subscriptionNew.paymentTitle')}
            </CardTitle>
            <CardDescription>{t('superAdmin.subscriptionNew.paymentBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="amountAzn"
              label={t('superAdmin.subscriptionNew.amountAzn')}
              error={
                errors.amountAzn &&
                t(`superAdmin.subscriptionNew.errors.${errors.amountAzn.message}`)
              }
            >
              <Input
                id="amountAzn"
                inputMode="decimal"
                placeholder="120.00"
                {...register('amountAzn')}
              />
            </Field>
            <Field
              id="paidAt"
              label={t('superAdmin.subscriptionNew.paidAt')}
              error={
                errors.paidAt && t(`superAdmin.subscriptionNew.errors.${errors.paidAt.message}`)
              }
            >
              <Input id="paidAt" type="date" {...register('paidAt')} />
            </Field>
            <Field id="method" label={t('superAdmin.subscriptions.filterMethod')}>
              <select
                id="method"
                {...register('method')}
                className="h-10 w-full px-2.5 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`superAdmin.subscriptions.methods.${m}`)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field id="notes" label={t('superAdmin.subscriptionNew.notes')}>
                <Input
                  id="notes"
                  placeholder={t('superAdmin.subscriptionNew.notesPlaceholder')}
                  {...register('notes')}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.subscriptionNew.periodTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.subscriptionNew.periodBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="periodStart"
              label={t('superAdmin.tenantNew.subStart')}
              error={
                errors.periodStart &&
                t(`superAdmin.subscriptionNew.errors.${errors.periodStart.message}`)
              }
            >
              <Input id="periodStart" type="date" {...register('periodStart')} />
            </Field>
            <Field
              id="periodEnd"
              label={t('superAdmin.tenantNew.subEnd')}
              error={
                errors.periodEnd &&
                t(`superAdmin.subscriptionNew.errors.${errors.periodEnd.message}`)
              }
            >
              <Input id="periodEnd" type="date" {...register('periodEnd')} />
            </Field>
          </CardContent>
        </Card>

        {tenantDetailQ.data?.status === 'suspended' && (
          <Card className="border-amber/30 bg-amber-50">
            <CardContent className="py-3 flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-amber shrink-0 mt-0.5" />
              <p className="text-sm text-ink-900">
                {t('superAdmin.subscriptionNew.suspendedHint')}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('superAdmin.subscriptionNew.submitting')
              : t('superAdmin.subscriptionNew.submit')}
          </Button>
          <Link
            to="/super-admin/subscriptions"
            search={initialTenantId ? { tenantId: initialTenantId } : {}}
          >
            <Button size="lg" variant="outline" type="button">
              {t('superAdmin.tenantNew.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function suggestedDates(currentSubEnd: string | null) {
  const today = new Date();
  let start: Date;
  if (currentSubEnd) {
    const end = new Date(currentSubEnd);
    const dayAfter = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    start = dayAfter > today ? dayAfter : today;
  } else {
    start = today;
  }
  const periodEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}

function mapCreateError(
  err: unknown,
  t: (k: string) => string,
): { field?: 'periodEnd'; message: string } {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'PERIOD_INVALID') {
      return { field: 'periodEnd', message: t('superAdmin.subscriptionNew.errors.periodOrder') };
    }
    if (code === 'TENANT_NOT_FOUND') {
      return { message: t('superAdmin.tenantDetail.errors.notFound') };
    }
    if (err.response?.status === 400) {
      return { message: t('superAdmin.tenantNew.errors.validation') };
    }
    if (!err.response) {
      return { message: t('superAdmin.tenantNew.errors.network') };
    }
  }
  return { message: t('superAdmin.tenantNew.errors.generic') };
}
