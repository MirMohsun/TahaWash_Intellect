import { isAxiosError } from 'axios';
import { Coins, ExternalLink, ImageIcon, Images, Palette, Save, Undo } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateTenantMe } from '@/hooks/use-update-tenant';
import type { TenantSelfPatch } from '@/lib/tenant-update-api';
import { useAuthStore } from '@/store/auth';
import { LogoUploader } from './logo-uploader';
import { PhotosManager } from './photos-manager';

/**
 * Branding editor (B7.1).
 *
 * Tenant edits how they appear to customers + (in the preview panel) sees
 * what the change will look like before they save. PATCH /tenant/me only
 * gets the diff so a casual "change just the color" doesn't accidentally
 * wipe other fields.
 *
 * After save, the auth store's refreshTenant() re-pulls /tenant/me so the
 * TenantThemeProvider picks up the new color globally — sidebar nav
 * highlights, dashboard cards, all the bg-brand-500 usages flip on the
 * spot without a page reload.
 *
 * Logo upload deferral: R2 isn't wired (Phase 0.10 / 1.7 deferred), so the
 * logo field is a plain URL input today. Tenants paste a public URL; when
 * R2 lands we add an upload button next to the field that swaps the value
 * for the resulting CDN URL.
 */
const LANGS = ['az', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const AZ_PHONE_RE = /^\+994\d{9}$/;
const CHARGE_MIN_FLOOR = 0.01;
const CHARGE_CAP = 100; // sane upper bound — no carwash charges >100 AZN per credit

export function BrandingPage() {
  const { t } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);
  const update = useUpdateTenantMe();

  // Form state, initialized from the auth store's tenant snapshot.
  const [form, setForm] = useState(() => initialForm(tenant));
  const [activeLang, setActiveLang] = useState<Lang>('az');
  const [colorErr, setColorErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [chargeErr, setChargeErr] = useState<string | null>(null);

  if (!tenant) return null;

  const patch = useMemo(() => diffPatch(form, tenant), [form, tenant]);
  const dirty = Object.keys(patch).length > 0;
  const desc = descriptionFor(form, activeLang);

  const onSave = async () => {
    // Client-side validation that mirrors the backend DTO.
    if (form.themeColor && !HEX_RE.test(form.themeColor)) {
      setColorErr(t('tenantAdmin.branding.errors.badHex'));
      return;
    }
    setColorErr(null);
    if (form.contactPhone) {
      const normalized = form.contactPhone.replace(/\s/g, '');
      if (!AZ_PHONE_RE.test(normalized)) {
        setPhoneErr(t('tenantAdmin.locations.errors.contactPhone.bad-format'));
        return;
      }
    }
    setPhoneErr(null);

    // Charge config validation
    const min = Number(form.minChargeAmount);
    const step = Number(form.chargeStep);
    if (!isFinite(min) || min < CHARGE_MIN_FLOOR || min > CHARGE_CAP) {
      setChargeErr(t('tenantAdmin.branding.errors.minOutOfRange'));
      return;
    }
    if (!isFinite(step) || step < CHARGE_MIN_FLOOR || step > CHARGE_CAP) {
      setChargeErr(t('tenantAdmin.branding.errors.stepOutOfRange'));
      return;
    }
    if (step > min) {
      setChargeErr(t('tenantAdmin.branding.errors.stepGreaterThanMin'));
      return;
    }
    setChargeErr(null);

    try {
      const sanitized: TenantSelfPatch = { ...patch };
      if (sanitized.contactPhone)
        sanitized.contactPhone = sanitized.contactPhone.replace(/\s/g, '');
      await update.mutateAsync(sanitized);
      toast.success(t('tenantAdmin.branding.toastSaved'));
    } catch (err) {
      toast.error(extractError(err, t));
    }
  };

  const onReset = () => {
    setForm(initialForm(tenant));
    setColorErr(null);
    setPhoneErr(null);
    setChargeErr(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.branding.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('tenantAdmin.branding.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] gap-6 items-start">
        {/* Form */}
        <div className="space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-4 w-4 text-ink-400" />
                {t('tenantAdmin.branding.sectionIdentity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brandName">{t('tenantAdmin.branding.brandName')}</Label>
                <Input
                  id="brandName"
                  value={form.brandName}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                />
                <p className="text-xs text-ink-400">{t('tenantAdmin.branding.brandNameHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="themeColor">{t('tenantAdmin.branding.themeColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={HEX_RE.test(form.themeColor) ? form.themeColor : '#0E7AE7'}
                    onChange={(e) => setForm({ ...form, themeColor: e.target.value.toUpperCase() })}
                    className="h-10 w-12 cursor-pointer rounded-card-sm border border-line bg-bg-elev"
                    aria-label={t('tenantAdmin.branding.themeColorPicker')}
                  />
                  <Input
                    id="themeColor"
                    value={form.themeColor}
                    onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                    placeholder="#0E7AE7"
                    aria-invalid={!!colorErr}
                    className="font-mono uppercase max-w-[180px]"
                  />
                </div>
                {colorErr && <p className="text-xs text-error">{colorErr}</p>}
                <p className="text-xs text-ink-400">{t('tenantAdmin.branding.themeColorHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('tenantAdmin.branding.logoUrl')}</Label>
                {/* Logo via direct-to-R2 upload (presigned PUT). The
                    LogoUploader stages the URL into form.logoUrl; the
                    PATCH /tenant/me happens when the user clicks Save
                    on this page, alongside any other branding edits. */}
                <LogoUploader
                  value={form.logoUrl ?? null}
                  onChange={(next) => setForm({ ...form, logoUrl: next })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos / hero carousel — independent of the Save button: each
              photo is persisted as its own TenantPhoto row immediately on
              upload, so the user sees their changes without committing the
              whole branding form. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Images className="h-4 w-4 text-ink-500" />
                {t('tenantAdmin.branding.sectionPhotos', { defaultValue: 'Photos & hero carousel' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PhotosManager />
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('tenantAdmin.branding.sectionContact')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="contactPhone">{t('tenantAdmin.branding.contactPhone')}</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone ?? ''}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+994 12 555 88 44"
                  aria-invalid={!!phoneErr}
                />
                <p className="text-xs text-ink-400">
                  {t('tenantAdmin.locations.fieldContactPhoneHint')}
                </p>
                {phoneErr && <p className="text-xs text-error">{phoneErr}</p>}
              </div>
            </CardContent>
          </Card>

          {/* About — multilingual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('tenantAdmin.branding.sectionAbout')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Language tabs */}
              <div className="inline-flex rounded-pill bg-line-soft p-1 text-sm">
                {LANGS.map((lng) => (
                  <button
                    type="button"
                    key={lng}
                    onClick={() => setActiveLang(lng)}
                    className={`px-3 py-1.5 rounded-pill font-semibold uppercase transition-colors ${
                      activeLang === lng
                        ? 'bg-bg-elev text-ink-900 shadow-sm'
                        : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>

              <textarea
                value={desc}
                maxLength={2000}
                onChange={(e) => setDescription(form, activeLang, e.target.value, setForm)}
                placeholder={t('tenantAdmin.branding.descPlaceholder')}
                className="min-h-[140px] w-full rounded-card-sm border border-line bg-bg-elev px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-vertical"
              />
              <div className="flex items-center justify-between text-xs text-ink-400">
                <span>{t('tenantAdmin.branding.descHint')}</span>
                <span className="tabular-nums">{desc.length} / 2000</span>
              </div>
            </CardContent>
          </Card>

          {/* Charge configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-4 w-4 text-ink-400" />
                {t('tenantAdmin.branding.sectionCharge')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-500">{t('tenantAdmin.branding.chargeIntro')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="minCharge">{t('tenantAdmin.branding.minCharge')}</Label>
                  <div className="relative">
                    <Input
                      id="minCharge"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={CHARGE_MIN_FLOOR}
                      max={CHARGE_CAP}
                      value={form.minChargeAmount}
                      onChange={(e) => setForm({ ...form, minChargeAmount: e.target.value })}
                      className="pr-10 tabular-nums"
                      aria-invalid={!!chargeErr}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                      ₼
                    </span>
                  </div>
                  <p className="text-xs text-ink-400">{t('tenantAdmin.branding.minChargeHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chargeStep">{t('tenantAdmin.branding.chargeStep')}</Label>
                  <div className="relative">
                    <Input
                      id="chargeStep"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={CHARGE_MIN_FLOOR}
                      max={CHARGE_CAP}
                      value={form.chargeStep}
                      onChange={(e) => setForm({ ...form, chargeStep: e.target.value })}
                      className="pr-10 tabular-nums"
                      aria-invalid={!!chargeErr}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                      ₼
                    </span>
                  </div>
                  <p className="text-xs text-ink-400">{t('tenantAdmin.branding.chargeStepHint')}</p>
                </div>
              </div>

              {chargeErr && (
                <div
                  role="alert"
                  className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error"
                >
                  {chargeErr}
                </div>
              )}

              {/* Inline preview of the customer-side counter */}
              <ChargePreview min={form.minChargeAmount} step={form.chargeStep} />
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={onReset}
              disabled={!dirty || update.isPending}
            >
              <Undo className="h-4 w-4" />
              {t('tenantAdmin.branding.discard')}
            </Button>
            <Button
              type="button"
              size="md"
              onClick={() => void onSave()}
              disabled={!dirty || update.isPending}
            >
              <Save className="h-4 w-4" />
              {update.isPending ? t('tenantAdmin.branding.saving') : t('tenantAdmin.branding.save')}
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6">
          <LivePreview
            brandName={form.brandName}
            themeColor={HEX_RE.test(form.themeColor) ? form.themeColor : tenant.themeColor}
            logoUrl={form.logoUrl ?? null}
            description={desc}
            descriptionLang={activeLang}
            contactPhone={form.contactPhone ?? null}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Live preview ──────────────────────────────────────────────────

function LivePreview(props: {
  brandName: string;
  themeColor: string;
  logoUrl: string | null;
  description: string;
  descriptionLang: Lang;
  contactPhone: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm text-ink-500 uppercase tracking-wider">
          {t('tenantAdmin.branding.previewTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Brand-tinted hero */}
        <div
          className="px-5 py-5 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${props.themeColor}26, transparent)` }}
        >
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-bg-elev border border-line"
            style={{ boxShadow: `0 4px 16px ${props.themeColor}33` }}
          >
            {props.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.logoUrl}
                alt={props.brandName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-ink-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
              {t('tenantAdmin.branding.previewBrand')}
            </p>
            <p className="text-lg font-extrabold text-ink-900 truncate">{props.brandName || '—'}</p>
          </div>
        </div>

        {/* Description */}
        <div className="px-5 py-4 border-t border-line space-y-3">
          <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
            {t('tenantAdmin.branding.previewAbout', { lang: props.descriptionLang.toUpperCase() })}
          </p>
          {props.description ? (
            <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
              {props.description}
            </p>
          ) : (
            <p className="text-sm text-ink-400 italic">
              {t('tenantAdmin.branding.previewNoDescription')}
            </p>
          )}
        </div>

        {/* Contact */}
        {props.contactPhone && (
          <div className="px-5 py-3 border-t border-line">
            <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
              {t('tenantAdmin.branding.previewContact')}
            </p>
            <p className="mt-1 text-sm text-ink-900 tabular-nums">{props.contactPhone}</p>
          </div>
        )}

        {/* Mock charge button — primary CTA on the customer app */}
        <div className="px-5 py-5 border-t border-line space-y-3">
          <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
            {t('tenantAdmin.branding.previewCta')}
          </p>
          <button
            type="button"
            disabled
            className="w-full h-12 rounded-pill font-semibold text-white"
            style={{
              backgroundColor: props.themeColor,
              boxShadow: `0 8px 24px ${props.themeColor}55, 0 4px 8px ${props.themeColor}33`,
            }}
          >
            {t('tenantAdmin.branding.previewCtaLabel')}
          </button>
          <p className="text-xs text-ink-400 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {t('tenantAdmin.branding.previewNote')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Charge preview ────────────────────────────────────────────────

/**
 * Visualizes a strip of the customer-side ± counter so the tenant can
 * tell at a glance whether their numbers feel right. Renders the first
 * five increments: min, min+step, min+2step, min+3step, min+4step.
 */
function ChargePreview({ min, step }: { min: string; step: string }) {
  const { t } = useTranslation();
  const minNum = Number(min);
  const stepNum = Number(step);
  if (!isFinite(minNum) || !isFinite(stepNum) || stepNum <= 0 || minNum <= 0) {
    return null;
  }
  const ticks = Array.from({ length: 5 }, (_, i) => (minNum + i * stepNum).toFixed(2));
  return (
    <div className="rounded-card-sm bg-line-soft/60 px-4 py-3 space-y-2">
      <p className="text-xs uppercase tracking-wider font-semibold text-ink-500">
        {t('tenantAdmin.branding.chargePreviewTitle')}
      </p>
      <p className="text-sm text-ink-700">
        {t('tenantAdmin.branding.chargePreviewBody', {
          min: minNum.toFixed(2),
          step: stepNum.toFixed(2),
        })}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {ticks.map((v, i) => (
          <span
            key={v}
            className={`px-2.5 py-1 rounded-pill text-sm font-semibold tabular-nums ${
              i === 0 ? 'bg-brand-500 text-white' : 'bg-bg-elev border border-line text-ink-900'
            }`}
          >
            {v} ₼
          </span>
        ))}
        <span className="px-2.5 py-1 rounded-pill text-sm text-ink-400">…</span>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

interface FormState {
  brandName: string;
  themeColor: string;
  logoUrl: string | null;
  contactPhone: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  minChargeAmount: string;
  chargeStep: string;
}

function initialForm(tenant: ReturnType<typeof useAuthStore.getState>['tenant']): FormState {
  return {
    brandName: tenant?.brandName ?? '',
    themeColor: (tenant?.themeColor ?? '#0E7AE7').toUpperCase(),
    logoUrl: tenant?.logoUrl ?? '',
    contactPhone: tenant?.contactPhone ?? '',
    descriptionAz: tenant?.descriptionAz ?? '',
    descriptionRu: tenant?.descriptionRu ?? '',
    descriptionEn: tenant?.descriptionEn ?? '',
    minChargeAmount: tenant?.minChargeAmount ?? '1.00',
    chargeStep: tenant?.chargeStep ?? '0.50',
  };
}

/** Build the smallest PATCH body — only fields actually changed. */
function diffPatch(
  form: FormState,
  tenant: NonNullable<ReturnType<typeof useAuthStore.getState>['tenant']>,
): TenantSelfPatch {
  const patch: TenantSelfPatch = {};
  if (form.brandName !== tenant.brandName) patch.brandName = form.brandName;
  if (form.themeColor.toUpperCase() !== tenant.themeColor.toUpperCase())
    patch.themeColor = form.themeColor;
  if ((form.logoUrl ?? '') !== (tenant.logoUrl ?? ''))
    patch.logoUrl = form.logoUrl && form.logoUrl.length > 0 ? form.logoUrl : null;
  if ((form.contactPhone ?? '') !== (tenant.contactPhone ?? ''))
    patch.contactPhone =
      form.contactPhone && form.contactPhone.length > 0 ? form.contactPhone : null;
  if ((form.descriptionAz ?? '') !== (tenant.descriptionAz ?? ''))
    patch.descriptionAz =
      form.descriptionAz && form.descriptionAz.length > 0 ? form.descriptionAz : null;
  if ((form.descriptionRu ?? '') !== (tenant.descriptionRu ?? ''))
    patch.descriptionRu =
      form.descriptionRu && form.descriptionRu.length > 0 ? form.descriptionRu : null;
  if ((form.descriptionEn ?? '') !== (tenant.descriptionEn ?? ''))
    patch.descriptionEn =
      form.descriptionEn && form.descriptionEn.length > 0 ? form.descriptionEn : null;
  if (normalizeAmount(form.minChargeAmount) !== normalizeAmount(tenant.minChargeAmount))
    patch.minChargeAmount = normalizeAmount(form.minChargeAmount);
  if (normalizeAmount(form.chargeStep) !== normalizeAmount(tenant.chargeStep))
    patch.chargeStep = normalizeAmount(form.chargeStep);
  return patch;
}

/** Round to two decimals as a string ("1.5" → "1.50") to match backend regex. */
function normalizeAmount(raw: string): string {
  const n = Number(raw);
  if (!isFinite(n) || n < 0) return raw;
  return n.toFixed(2);
}

function descriptionFor(form: FormState, lang: Lang): string {
  if (lang === 'az') return form.descriptionAz ?? '';
  if (lang === 'ru') return form.descriptionRu ?? '';
  return form.descriptionEn ?? '';
}

function setDescription(
  form: FormState,
  lang: Lang,
  value: string,
  setForm: (next: FormState) => void,
): void {
  if (lang === 'az') setForm({ ...form, descriptionAz: value });
  else if (lang === 'ru') setForm({ ...form, descriptionRu: value });
  else setForm({ ...form, descriptionEn: value });
}

function extractError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    if (!err.response) return t('tenantAdmin.locations.errors.network');
    if (err.response.status === 400) return t('tenantAdmin.locations.errors.validation');
  }
  return t('tenantAdmin.locations.errors.generic');
}
