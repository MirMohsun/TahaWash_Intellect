import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSuperAdminTenant, type CreateTenantResponse } from '@/lib/super-admin-api';

/**
 * Super-admin: add new tenant (C3.2).
 *
 * Backend `POST /super-admin/tenants` creates the tenant + a single
 * TenantUser in one transaction and returns the auto-generated password
 * ONCE. We render a success card with copyable username + password +
 * a CTA to the tenant detail page. After leaving this screen the password
 * is permanently gone — the super-admin must hand it over via WhatsApp.
 *
 * Form uses RHF + zod (flat form, no nested working-hours-like state —
 * matches ADMIN_PATTERNS §12 rule of thumb).
 *
 * Backend validation mirrors here:
 *   brandName 2-80, legalName 2-120, voen exactly 10 digits,
 *   ownerName 2-120, ownerEmail email, ownerPhone +994XXXXXXXXX,
 *   username optional [a-z0-9_-]{3,40}, themeColor hex,
 *   minChargeAmount/chargeStep decimal strings.
 */

const AZ_PHONE = /^\+994\d{9}$/;
const VOEN_REGEX = /^\d{10}$/;
const USERNAME_REGEX = /^[a-z0-9_-]+$/;
const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const schema = z.object({
  brandName: z.string().trim().min(2).max(80),
  legalName: z.string().trim().min(2).max(120),
  voen: z.string().trim().regex(VOEN_REGEX, 'voen'),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email(),
  ownerPhone: z.string().trim().regex(AZ_PHONE, 'phone'),
  username: z
    .string()
    .trim()
    .regex(USERNAME_REGEX, 'username')
    .min(3)
    .max(40)
    .or(z.literal(''))
    .optional(),
  themeColor: z.string().trim().regex(HEX_REGEX, 'hex').or(z.literal('')).optional(),
  contactPhone: z.string().trim().optional(),
  ePointMerchantId: z.string().trim().optional(),
  subscriptionStart: z.string().optional(),
  subscriptionEnd: z.string().optional(),
  minChargeAmount: z.string().trim().regex(DECIMAL_REGEX, 'decimal').or(z.literal('')).optional(),
  chargeStep: z.string().trim().regex(DECIMAL_REGEX, 'decimal').or(z.literal('')).optional(),
});

type FormInput = z.infer<typeof schema>;

export function SuperAdminTenantFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTenantResponse | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      brandName: '',
      legalName: '',
      voen: '',
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '+994',
      username: '',
      themeColor: '#0E7AE7',
      contactPhone: '',
      ePointMerchantId: '',
      subscriptionStart: '',
      subscriptionEnd: '',
      minChargeAmount: '1.00',
      chargeStep: '0.50',
    },
  });

  const brandName = watch('brandName');
  const suggestedUsername = slugifyToUsername(brandName);

  const onSubmit = async (values: FormInput) => {
    setServerError(null);
    try {
      const res = await createSuperAdminTenant({
        brandName: values.brandName,
        legalName: values.legalName,
        voen: values.voen,
        ownerName: values.ownerName,
        ownerEmail: values.ownerEmail,
        ownerPhone: values.ownerPhone,
        username: values.username || undefined,
        themeColor: values.themeColor || undefined,
        contactPhone: values.contactPhone || undefined,
        ePointMerchantId: values.ePointMerchantId || undefined,
        subscriptionStart: values.subscriptionStart || undefined,
        subscriptionEnd: values.subscriptionEnd || undefined,
        minChargeAmount: values.minChargeAmount || undefined,
        chargeStep: values.chargeStep || undefined,
      });
      setCreated(res);
      toast.success(t('superAdmin.tenantNew.toastCreated', { brand: res.tenant.brandName }));
    } catch (err) {
      const mapped = mapCreateError(err, t);
      if (mapped.field) {
        setError(mapped.field as keyof FormInput, { message: mapped.message });
      } else {
        setServerError(mapped.message);
      }
    }
  };

  if (created) {
    return (
      <CreatedCard data={created} onDone={() => void navigate({ to: '/super-admin/tenants' })} />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/super-admin/tenants"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('superAdmin.tenantNew.backToList')}
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.tenantNew.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.tenantNew.subtitle')}</p>
      </header>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6" noValidate>
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.tenantNew.identityTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.tenantNew.identityBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="brandName"
              label={t('superAdmin.tenantNew.brandName')}
              error={errors.brandName && t('superAdmin.tenantNew.errors.brandName')}
            >
              <Input id="brandName" autoFocus {...register('brandName')} />
            </Field>
            <Field
              id="legalName"
              label={t('superAdmin.tenantNew.legalName')}
              error={errors.legalName && t('superAdmin.tenantNew.errors.legalName')}
            >
              <Input id="legalName" {...register('legalName')} />
            </Field>
            <Field
              id="voen"
              label={t('superAdmin.tenantNew.voen')}
              error={errors.voen && t('superAdmin.tenantNew.errors.voen')}
            >
              <Input id="voen" inputMode="numeric" placeholder="1234567891" {...register('voen')} />
            </Field>
            <Field
              id="username"
              label={t('superAdmin.tenantNew.username')}
              hint={
                suggestedUsername
                  ? t('superAdmin.tenantNew.usernameHint', { suggested: suggestedUsername })
                  : t('superAdmin.tenantNew.usernameHintEmpty')
              }
              error={errors.username && t('superAdmin.tenantNew.errors.username')}
            >
              <Input
                id="username"
                placeholder={suggestedUsername || 'yubox'}
                autoCapitalize="none"
                autoComplete="off"
                {...register('username')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.tenantNew.ownerTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.tenantNew.ownerBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="ownerName"
              label={t('superAdmin.tenantNew.ownerName')}
              error={errors.ownerName && t('superAdmin.tenantNew.errors.ownerName')}
            >
              <Input id="ownerName" {...register('ownerName')} />
            </Field>
            <Field
              id="ownerEmail"
              label={t('superAdmin.tenantNew.ownerEmail')}
              error={errors.ownerEmail && t('superAdmin.tenantNew.errors.ownerEmail')}
            >
              <Input
                id="ownerEmail"
                type="email"
                placeholder="owner@brand.az"
                {...register('ownerEmail')}
              />
            </Field>
            <Field
              id="ownerPhone"
              label={t('superAdmin.tenantNew.ownerPhone')}
              error={errors.ownerPhone && t('superAdmin.tenantNew.errors.ownerPhone')}
            >
              <Input
                id="ownerPhone"
                inputMode="tel"
                placeholder="+994501234567"
                {...register('ownerPhone')}
              />
            </Field>
            <Field
              id="contactPhone"
              label={t('superAdmin.tenantNew.contactPhone')}
              hint={t('superAdmin.tenantNew.contactPhoneHint')}
            >
              <Input
                id="contactPhone"
                inputMode="tel"
                placeholder="+994 12 555 88 44"
                {...register('contactPhone')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.tenantNew.configTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.tenantNew.configBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="themeColor"
              label={t('superAdmin.tenantNew.themeColor')}
              error={errors.themeColor && t('superAdmin.tenantNew.errors.themeColor')}
            >
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-12 rounded-card-sm border border-line bg-bg-elev cursor-pointer"
                  {...register('themeColor')}
                />
                <Input
                  id="themeColor"
                  className="flex-1"
                  placeholder="#0E7AE7"
                  {...register('themeColor')}
                />
              </div>
            </Field>
            <Field
              id="ePointMerchantId"
              label={t('superAdmin.tenantNew.ePointMerchantId')}
              hint={t('superAdmin.tenantNew.ePointMerchantIdHint')}
            >
              <Input id="ePointMerchantId" {...register('ePointMerchantId')} />
            </Field>
            <Field
              id="minChargeAmount"
              label={t('superAdmin.tenantNew.minChargeAmount')}
              error={errors.minChargeAmount && t('superAdmin.tenantNew.errors.decimal')}
            >
              <Input
                id="minChargeAmount"
                inputMode="decimal"
                placeholder="1.00"
                {...register('minChargeAmount')}
              />
            </Field>
            <Field
              id="chargeStep"
              label={t('superAdmin.tenantNew.chargeStep')}
              error={errors.chargeStep && t('superAdmin.tenantNew.errors.decimal')}
            >
              <Input
                id="chargeStep"
                inputMode="decimal"
                placeholder="0.50"
                {...register('chargeStep')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.tenantNew.subTitle')}</CardTitle>
            <CardDescription>{t('superAdmin.tenantNew.subBody')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="subscriptionStart" label={t('superAdmin.tenantNew.subStart')}>
              <Input id="subscriptionStart" type="date" {...register('subscriptionStart')} />
            </Field>
            <Field id="subscriptionEnd" label={t('superAdmin.tenantNew.subEnd')}>
              <Input id="subscriptionEnd" type="date" {...register('subscriptionEnd')} />
            </Field>
          </CardContent>
        </Card>

        {serverError && (
          <Card className="border-error/20 bg-error-50">
            <CardContent className="py-3">
              <p role="alert" className="text-sm text-error font-medium">
                {serverError}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('superAdmin.tenantNew.submitting') : t('superAdmin.tenantNew.submit')}
          </Button>
          <Link to="/super-admin/tenants">
            <Button size="lg" variant="outline" type="button">
              {t('superAdmin.tenantNew.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

// ─── CreatedCard (reveal-once credentials) ──────────────────────────

function CreatedCard({ data, onDone }: { data: CreateTenantResponse; onDone: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null);

  const copy = (text: string, key: 'user' | 'pass') => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success(t('superAdmin.tenantNew.copied'));
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const goToTenant = () =>
    void navigate({
      to: '/super-admin/tenants/$tenantId',
      params: { tenantId: data.tenant.id },
    });

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.tenantNew.successTitle', { brand: data.tenant.brandName })}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.tenantNew.successSubtitle')}</p>
      </header>

      <Card className="border-amber/30 bg-amber-50">
        <CardContent className="py-4 flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-amber shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-ink-900">{t('superAdmin.tenantNew.warningTitle')}</p>
            <p className="text-ink-700 mt-0.5">{t('superAdmin.tenantNew.warningBody')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.tenantNew.credentialsTitle')}</CardTitle>
          <CardDescription>{t('superAdmin.tenantNew.credentialsBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialRow
            label={t('superAdmin.tenantNew.username')}
            value={data.tenantUser.username}
            onCopy={() => copy(data.tenantUser.username, 'user')}
            copied={copied === 'user'}
          />
          <CredentialRow
            label={t('superAdmin.tenantNew.password')}
            value={data.generatedPassword}
            mono
            onCopy={() => copy(data.generatedPassword, 'pass')}
            copied={copied === 'pass'}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button size="lg" onClick={goToTenant}>
          {t('superAdmin.tenantNew.goToTenant')}
        </Button>
        <Button size="lg" variant="outline" onClick={onDone}>
          {t('superAdmin.tenantNew.backToList')}
        </Button>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 px-3 py-2 rounded-card-sm border border-line bg-bg text-sm text-ink-900 select-all ${
            mono ? 'font-mono tabular-nums' : ''
          }`}
        >
          {value}
        </code>
        <Button type="button" size="md" variant="outline" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function slugifyToUsername(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function mapCreateError(
  err: unknown,
  t: (k: string) => string,
): { field?: 'voen' | 'username'; message: string } {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'VOEN_TAKEN') {
      return { field: 'voen', message: t('superAdmin.tenantNew.errors.voenTaken') };
    }
    if (code === 'USERNAME_TAKEN') {
      return { field: 'username', message: t('superAdmin.tenantNew.errors.usernameTaken') };
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
