import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeft, Image as ImageIcon, Loader2, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateSuperAdminPromo,
  useDeleteSuperAdminPromo,
  useSuperAdminPromo,
  useUpdateSuperAdminPromo,
  useUpdateSuperAdminPromoStatus,
} from '@/hooks/use-super-admin-promos';
import type {
  CreatePromoInput,
  PromoCtaTargetType,
  PromoStatusKey,
  PromoThemeKey,
  SuperAdminPromoRow,
  UpdatePromoInput,
} from '@/lib/super-admin-api';
import { UploadError, uploadPromoImage } from '@/lib/uploads-api';

/**
 * Super-admin promo form (C8.2).
 *
 * Shared create/edit page. Mode is derived from the URL: `/new`
 * creates, `/$promoId` edits.
 *
 * Hand-managed FormState + diffPatch on edit (matches BrandingPage
 * pattern from Phase 3.15). Multi-lang fields are flat for now —
 * AZ/RU/EN tabs scope which one is being edited but state holds all
 * three (no nested object).
 *
 * Image upload goes to R2 via uploadPromoImage(): pick a file → browser
 * compresses + PUTs to a presigned URL → the returned public URL is stored
 * in form.imageUrl. The field value remains a plain URL, so the
 * create/update payloads are unchanged.
 */

const LANGS = ['az', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

const CREATE_STATUSES: ('draft' | 'scheduled' | 'active')[] = ['draft', 'scheduled', 'active'];
const EDIT_STATUSES: PromoStatusKey[] = ['draft', 'scheduled', 'active', 'expired'];

interface FormState {
  imageUrl: string;
  theme: '' | PromoThemeKey;
  sortOrder: number;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  ctaTextAz: string;
  ctaTextRu: string;
  ctaTextEn: string;
  ctaTargetType: '' | PromoCtaTargetType;
  ctaTargetValue: string;
  startAt: string; // yyyy-MM-dd
  endAt: string;
  status: PromoStatusKey;
}

interface FormProps {
  mode: 'create' | 'edit';
}

export function SuperAdminPromoFormPage({ mode }: FormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { promoId } = useParams({ strict: false }) as { promoId?: string };

  const promoQ = useSuperAdminPromo(mode === 'edit' ? promoId : undefined);
  const create = useCreateSuperAdminPromo();
  const update = useUpdateSuperAdminPromo(promoId ?? '');
  const updateStatus = useUpdateSuperAdminPromoStatus(promoId ?? '');
  const deletePromo = useDeleteSuperAdminPromo(promoId ?? '');

  const [activeLang, setActiveLang] = useState<Lang>('az');
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PromoStatusKey | null>(null);

  // Sync form from server data once it lands (edit mode only).
  useEffect(() => {
    if (mode === 'edit' && promoQ.data) {
      setForm(formFromPromo(promoQ.data));
    }
  }, [mode, promoQ.data]);

  if (mode === 'edit' && promoQ.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (mode === 'edit' && (promoQ.isError || !promoQ.data)) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.promoForm.loadError')}</p>
            <button
              type="button"
              onClick={() => void promoQ.refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const promo = mode === 'edit' ? promoQ.data : null;
  const patch = mode === 'edit' && promo ? diffPatch(form, promo) : ({} as UpdatePromoInput);
  const dirty = Object.keys(patch).length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(form, t);
    if (err) {
      toast.error(err);
      return;
    }

    if (mode === 'create') {
      try {
        const payload = buildCreatePayload(form);
        const created = await create.mutateAsync(payload);
        toast.success(t('superAdmin.promoForm.toastCreated'));
        void navigate({
          to: '/super-admin/promos/$promoId',
          params: { promoId: created.id },
        });
      } catch (mutateErr) {
        toast.error(mapError(mutateErr, t));
      }
      return;
    }

    if (!promo) return;
    try {
      await update.mutateAsync(patch);
      toast.success(t('superAdmin.promoForm.toastSaved'));
    } catch (mutateErr) {
      toast.error(mapError(mutateErr, t));
    }
  };

  const onChangeStatus = async () => {
    if (!pendingStatus) return;
    try {
      await updateStatus.mutateAsync(pendingStatus);
      setPendingStatus(null);
      toast.success(t('superAdmin.promoForm.toastStatusChanged'));
    } catch (mutateErr) {
      toast.error(mapError(mutateErr, t));
    }
  };

  const onDelete = async () => {
    try {
      await deletePromo.mutateAsync();
      toast.success(t('superAdmin.promoForm.toastDeleted'));
      void navigate({ to: '/super-admin/promos' });
    } catch (mutateErr) {
      toast.error(mapError(mutateErr, t));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <BackLink />

      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {mode === 'create'
            ? t('superAdmin.promoForm.titleCreate')
            : t('superAdmin.promoForm.titleEdit')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.promoForm.subtitle')}</p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Left column */}
          <div className="space-y-6 min-w-0">
            {/* Image */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.promoForm.imageTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.promoForm.imageBody')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <PromoImageUploader
                  value={form.imageUrl}
                  onChange={(next) => setForm({ ...form, imageUrl: next })}
                />
                <p className="text-xs text-ink-400">{t('superAdmin.promoForm.imageHint')}</p>
                <div className="pt-2 border-t border-line">
                  <ThemePicker
                    value={form.theme}
                    onChange={(theme) => setForm({ ...form, theme })}
                  />
                </div>
                <div className="pt-3 border-t border-line">
                  <Label htmlFor="promo-order">
                    {t('superAdmin.promoForm.orderLabel', { defaultValue: 'Display order' })}
                  </Label>
                  <Input
                    id="promo-order"
                    type="number"
                    min={0}
                    value={String(form.sortOrder)}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                    className="mt-1 w-32"
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    {t('superAdmin.promoForm.orderHint', {
                      defaultValue:
                        'Position in the app carousel — lower shows first (1 before 2 before 3…).',
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Content (multi-lang) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.promoForm.contentTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.promoForm.contentBody')}</CardDescription>
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

                <div className="space-y-1.5">
                  <Label htmlFor={`title-${activeLang}`}>
                    {t('superAdmin.promoForm.titleLabel', { lng: activeLang.toUpperCase() })}
                  </Label>
                  <Input
                    id={`title-${activeLang}`}
                    maxLength={80}
                    value={form[`title${capitalize(activeLang)}` as keyof FormState] as string}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [`title${capitalize(activeLang)}`]: e.target.value,
                      })
                    }
                  />
                  <CharCount
                    value={form[`title${capitalize(activeLang)}` as keyof FormState] as string}
                    max={80}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`body-${activeLang}`}>
                    {t('superAdmin.promoForm.bodyLabel', { lng: activeLang.toUpperCase() })}
                  </Label>
                  <textarea
                    id={`body-${activeLang}`}
                    rows={4}
                    maxLength={400}
                    value={form[`body${capitalize(activeLang)}` as keyof FormState] as string}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [`body${capitalize(activeLang)}`]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-none"
                  />
                  <CharCount
                    value={form[`body${capitalize(activeLang)}` as keyof FormState] as string}
                    max={400}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`cta-${activeLang}`}>
                    {t('superAdmin.promoForm.ctaTextLabel', { lng: activeLang.toUpperCase() })}
                  </Label>
                  <Input
                    id={`cta-${activeLang}`}
                    maxLength={40}
                    value={form[`ctaText${capitalize(activeLang)}` as keyof FormState] as string}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [`ctaText${capitalize(activeLang)}`]: e.target.value,
                      })
                    }
                    placeholder={t('superAdmin.promoForm.ctaTextPlaceholder')}
                  />
                  <CharCount
                    value={form[`ctaText${capitalize(activeLang)}` as keyof FormState] as string}
                    max={40}
                  />
                </div>

                <p className="text-xs text-ink-500">{t('superAdmin.promoForm.allLangsRequired')}</p>
              </CardContent>
            </Card>

            {/* CTA target */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('superAdmin.promoForm.ctaTargetTitle')}
                </CardTitle>
                <CardDescription>{t('superAdmin.promoForm.ctaTargetBody')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(['', 'tenant', 'external_url'] as const).map((tt) => (
                    <button
                      key={tt || 'none'}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          ctaTargetType: tt,
                          ctaTargetValue: tt === '' ? '' : form.ctaTargetValue,
                        })
                      }
                      className={`px-3 py-2 rounded-card-sm text-sm font-semibold transition-colors ${
                        form.ctaTargetType === tt
                          ? 'bg-brand-50 text-brand-600 border border-brand-200'
                          : 'bg-bg-elev text-ink-700 border border-line hover:bg-line-soft'
                      }`}
                    >
                      {t(`superAdmin.promoForm.ctaTarget.${tt || 'none'}`)}
                    </button>
                  ))}
                </div>

                {form.ctaTargetType && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ctaTargetValue">
                      {form.ctaTargetType === 'tenant'
                        ? t('superAdmin.promoForm.tenantIdLabel')
                        : t('superAdmin.promoForm.externalUrlLabel')}
                    </Label>
                    <Input
                      id="ctaTargetValue"
                      value={form.ctaTargetValue}
                      onChange={(e) => setForm({ ...form, ctaTargetValue: e.target.value })}
                      placeholder={
                        form.ctaTargetType === 'tenant' ? 'clx123...' : 'https://example.com'
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Display window */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.promoForm.windowTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.promoForm.windowBody')}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startAt">{t('superAdmin.promoForm.startAt')}</Label>
                  <Input
                    id="startAt"
                    type="date"
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endAt">{t('superAdmin.promoForm.endAt')}</Label>
                  <Input
                    id="endAt"
                    type="date"
                    value={form.endAt}
                    onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Initial status — create-only */}
            {mode === 'create' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t('superAdmin.promoForm.initialStatusTitle')}
                  </CardTitle>
                  <CardDescription>{t('superAdmin.promoForm.initialStatusBody')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {CREATE_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, status: s })}
                        className={`px-3 py-2 rounded-card-sm text-sm font-semibold transition-colors ${
                          form.status === s
                            ? 'bg-brand-50 text-brand-600 border border-brand-200'
                            : 'bg-bg-elev text-ink-700 border border-line hover:bg-line-soft'
                        }`}
                      >
                        {t(`superAdmin.promos.status.${s}`)}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status & actions — edit-only */}
            {mode === 'edit' && promo && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('superAdmin.promoForm.statusTitle')}</CardTitle>
                  <CardDescription>{t('superAdmin.promoForm.statusBody')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingStatus ? (
                    <div className="rounded-card-sm bg-amber-50 border border-amber/20 p-3 space-y-3">
                      <p className="text-sm font-medium text-ink-900">
                        {t('superAdmin.promoForm.confirmStatus', {
                          status: t(`superAdmin.promos.status.${pendingStatus}`),
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onChangeStatus()}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending
                            ? t('superAdmin.promoForm.changingStatus')
                            : t('superAdmin.promoForm.confirmStatusCta')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingStatus(null)}
                        >
                          {t('superAdmin.tenantNew.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {EDIT_STATUSES.map((s) => {
                        const isCurrent = s === promo.status;
                        return (
                          <Button
                            key={s}
                            type="button"
                            size="sm"
                            variant={isCurrent ? 'primary' : 'outline'}
                            disabled={isCurrent}
                            onClick={() => setPendingStatus(s)}
                          >
                            {t(`superAdmin.promos.status.${s}`)}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Save bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                type="submit"
                disabled={create.isPending || update.isPending || (mode === 'edit' && !dirty)}
              >
                <Save className="h-4 w-4" />
                {mode === 'create'
                  ? create.isPending
                    ? t('superAdmin.promoForm.creating')
                    : t('superAdmin.promoForm.createSubmit')
                  : update.isPending
                    ? t('superAdmin.tenantDetail.saving')
                    : t('superAdmin.promoForm.saveSubmit')}
              </Button>
              <Link to="/super-admin/promos">
                <Button size="lg" variant="outline" type="button">
                  {t('superAdmin.tenantNew.cancel')}
                </Button>
              </Link>
              {mode === 'edit' && promo && (
                <div className="ml-auto">
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="md"
                        variant="destructive"
                        onClick={() => void onDelete()}
                        disabled={deletePromo.isPending}
                      >
                        {deletePromo.isPending
                          ? t('superAdmin.promoForm.deleting')
                          : t('superAdmin.promoForm.deleteConfirm')}
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        variant="outline"
                        onClick={() => setConfirmDelete(false)}
                      >
                        {t('superAdmin.tenantNew.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="md"
                      variant="outline"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('superAdmin.promoForm.delete')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right column: preview */}
          <aside className="space-y-3 lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {t('superAdmin.promoForm.previewTitle', { lng: activeLang.toUpperCase() })}
            </p>
            <PromoPreview
              imageUrl={form.imageUrl}
              theme={form.theme}
              title={form[`title${capitalize(activeLang)}` as keyof FormState] as string}
              body={form[`body${capitalize(activeLang)}` as keyof FormState] as string}
              ctaText={form[`ctaText${capitalize(activeLang)}` as keyof FormState] as string}
            />
            <p className="text-xs text-ink-400">{t('superAdmin.promoForm.previewHint')}</p>
          </aside>
        </div>
      </form>
    </div>
  );
}

// ─── Banner color theme picker ────────────────────────────────────

const THEME_SWATCHES: { key: PromoThemeKey; css: string }[] = [
  { key: 'blue', css: 'linear-gradient(135deg, #2276D6, #0E7AE7, #4692E3)' },
  { key: 'violet', css: 'linear-gradient(135deg, #7C3AED, #6D28D9, #9333EA)' },
  { key: 'teal', css: 'linear-gradient(135deg, #0E9488, #0F766E, #14B8A6)' },
  { key: 'amber', css: 'linear-gradient(135deg, #EA580C, #F97316, #FB923C)' },
];

function themeCss(theme: PromoThemeKey): string {
  return (
    THEME_SWATCHES.find((s) => s.key === theme)?.css ??
    'linear-gradient(135deg, #2276D6, #0E7AE7, #4692E3)'
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: '' | PromoThemeKey;
  onChange: (next: '' | PromoThemeKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label>{t('superAdmin.promoForm.colorLabel', { defaultValue: 'Banner color' })}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {THEME_SWATCHES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(value === s.key ? '' : s.key)}
            aria-label={s.key}
            className={`h-9 w-9 rounded-full border-2 transition ${
              value === s.key ? 'border-ink-900 ring-2 ring-brand-300' : 'border-line'
            }`}
            style={{ backgroundImage: s.css }}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange('')}
          className={`h-9 px-3 rounded-pill border text-xs font-medium transition ${
            value === '' ? 'border-ink-900 text-ink-900' : 'border-line text-ink-500'
          }`}
        >
          {t('superAdmin.promoForm.colorAuto', { defaultValue: 'Auto' })}
        </button>
      </div>
      <p className="text-xs text-ink-400">
        {t('superAdmin.promoForm.colorHint', {
          defaultValue: 'Used when there is no image. "Auto" picks a color by position.',
        })}
      </p>
    </div>
  );
}

// ─── Preview card (Wolt-style inset) ──────────────────────────────

function PromoPreview({
  imageUrl,
  theme,
  title,
  body,
  ctaText,
}: {
  imageUrl: string;
  theme: '' | PromoThemeKey;
  title: string;
  body: string;
  ctaText: string;
}) {
  const { t } = useTranslation();
  const displayTitle = title.trim() || t('superAdmin.promoForm.previewTitlePlaceholder');
  const displayBody = body.trim() || t('superAdmin.promoForm.previewBodyPlaceholder');
  const gradientCss = themeCss(theme || 'blue');

  return (
    <div className="rounded-card border border-line bg-bg-elev overflow-hidden shadow-sm">
      <div className="aspect-[16/9] bg-line-soft relative" style={{ backgroundImage: gradientCss }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
        {!imageUrl && !theme && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <p className="font-bold text-ink-900 line-clamp-2">{displayTitle}</p>
        <p className="text-sm text-ink-700 line-clamp-3">{displayBody}</p>
        {ctaText.trim() && (
          <button
            type="button"
            disabled
            className="mt-2 px-4 py-2 rounded-pill bg-brand-500 text-white text-sm font-semibold w-full"
          >
            {ctaText.trim()}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Image uploader (R2 presigned PUT) ────────────────────────────

/**
 * Promo image uploader — picks a file, runs uploadPromoImage() (compress →
 * sign → PUT to R2), and reports the public URL back to the form via
 * onChange. Mirrors the empty/set two-state look of the branding
 * LogoUploader. Remove sets the URL back to ''.
 */
function PromoImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadPromoImage(file);
      onChange(url);
      toast.success(
        t('superAdmin.promoForm.imageUploadSuccess', { defaultValue: 'Image uploaded.' }),
      );
    } catch (err) {
      if (err instanceof UploadError) {
        toast.error(
          err.code === 'UNSUPPORTED_TYPE'
            ? t('superAdmin.promoForm.imageBadType', {
                defaultValue: 'Use a JPEG, PNG, or WebP image.',
              })
            : err.code === 'SIZE_LIMIT'
              ? t('superAdmin.promoForm.imageTooLarge', {
                  defaultValue: 'File is larger than 8 MB.',
                })
              : err.message,
        );
      } else {
        toast.error(
          t('superAdmin.promoForm.imageUploadFailed', {
            defaultValue: 'Upload failed. Try again.',
          }),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
        disabled={busy}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-card-sm border border-line bg-bg-elev p-2">
          <div className="h-16 w-28 shrink-0 overflow-hidden rounded-card-sm border border-line bg-bg">
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pick} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t('superAdmin.promoForm.imageReplace', { defaultValue: 'Replace' })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5 text-error" />
              {t('superAdmin.promoForm.imageRemove', { defaultValue: 'Remove' })}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={pick}
          disabled={busy}
          className="w-full justify-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('superAdmin.promoForm.imageUpload', { defaultValue: 'Upload image' })}
        </Button>
      )}
      <p className="text-xs text-ink-400">
        {t('superAdmin.promoForm.imageUploadHint', {
          defaultValue: 'JPEG, PNG, or WebP · up to 8 MB.',
        })}
      </p>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/super-admin/promos"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('superAdmin.promoForm.backToList')}
    </Link>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = (value ?? '').length;
  const warn = len > max * 0.9;
  return (
    <p className={`text-xs tabular-nums text-right ${warn ? 'text-amber' : 'text-ink-400'}`}>
      {len} / {max}
    </p>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function emptyForm(): FormState {
  return {
    imageUrl: '',
    theme: '',
    sortOrder: 0,
    titleAz: '',
    titleRu: '',
    titleEn: '',
    bodyAz: '',
    bodyRu: '',
    bodyEn: '',
    ctaTextAz: '',
    ctaTextRu: '',
    ctaTextEn: '',
    ctaTargetType: '',
    ctaTargetValue: '',
    startAt: todayIso(),
    endAt: futureIso(30),
    status: 'draft',
  };
}

function formFromPromo(p: SuperAdminPromoRow): FormState {
  return {
    imageUrl: p.imageUrl ?? '',
    theme: (p.theme ?? '') as '' | PromoThemeKey,
    sortOrder: p.sortOrder,
    titleAz: p.titleAz,
    titleRu: p.titleRu,
    titleEn: p.titleEn,
    bodyAz: p.bodyAz,
    bodyRu: p.bodyRu,
    bodyEn: p.bodyEn,
    ctaTextAz: p.ctaTextAz ?? '',
    ctaTextRu: p.ctaTextRu ?? '',
    ctaTextEn: p.ctaTextEn ?? '',
    ctaTargetType: p.ctaTargetType ?? '',
    ctaTargetValue: p.ctaTargetValue ?? '',
    startAt: p.startAt.slice(0, 10),
    endAt: p.endAt.slice(0, 10),
    status: p.status,
  };
}

function diffPatch(form: FormState, original: SuperAdminPromoRow): UpdatePromoInput {
  const patch: UpdatePromoInput = {};

  const img = form.imageUrl.trim() || null;
  if (img !== (original.imageUrl ?? null)) patch.imageUrl = img;
  const theme = form.theme || null;
  if (theme !== (original.theme ?? null)) patch.theme = theme;
  if (form.sortOrder !== original.sortOrder) patch.sortOrder = form.sortOrder;
  if (form.titleAz !== original.titleAz) patch.titleAz = form.titleAz.trim();
  if (form.titleRu !== original.titleRu) patch.titleRu = form.titleRu.trim();
  if (form.titleEn !== original.titleEn) patch.titleEn = form.titleEn.trim();
  if (form.bodyAz !== original.bodyAz) patch.bodyAz = form.bodyAz.trim();
  if (form.bodyRu !== original.bodyRu) patch.bodyRu = form.bodyRu.trim();
  if (form.bodyEn !== original.bodyEn) patch.bodyEn = form.bodyEn.trim();

  const ctaAz = form.ctaTextAz.trim() || null;
  if (ctaAz !== (original.ctaTextAz ?? null)) patch.ctaTextAz = ctaAz;
  const ctaRu = form.ctaTextRu.trim() || null;
  if (ctaRu !== (original.ctaTextRu ?? null)) patch.ctaTextRu = ctaRu;
  const ctaEn = form.ctaTextEn.trim() || null;
  if (ctaEn !== (original.ctaTextEn ?? null)) patch.ctaTextEn = ctaEn;

  const tt = form.ctaTargetType === '' ? null : form.ctaTargetType;
  if (tt !== (original.ctaTargetType ?? null)) patch.ctaTargetType = tt;
  const tv = tt === null ? null : form.ctaTargetValue.trim() || null;
  if (tv !== (original.ctaTargetValue ?? null)) patch.ctaTargetValue = tv;

  const origStart = original.startAt.slice(0, 10);
  if (form.startAt !== origStart) patch.startAt = new Date(form.startAt).toISOString();
  const origEnd = original.endAt.slice(0, 10);
  if (form.endAt !== origEnd) patch.endAt = new Date(form.endAt).toISOString();

  return patch;
}

function buildCreatePayload(form: FormState): CreatePromoInput {
  return {
    imageUrl: form.imageUrl.trim() || null,
    theme: form.theme || null,
    sortOrder: form.sortOrder,
    titleAz: form.titleAz.trim(),
    titleRu: form.titleRu.trim(),
    titleEn: form.titleEn.trim(),
    bodyAz: form.bodyAz.trim(),
    bodyRu: form.bodyRu.trim(),
    bodyEn: form.bodyEn.trim(),
    ctaTextAz: form.ctaTextAz.trim() || undefined,
    ctaTextRu: form.ctaTextRu.trim() || undefined,
    ctaTextEn: form.ctaTextEn.trim() || undefined,
    ctaTargetType: form.ctaTargetType === '' ? undefined : form.ctaTargetType,
    ctaTargetValue: form.ctaTargetType === '' ? undefined : form.ctaTargetValue.trim() || undefined,
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    status: form.status === 'expired' ? 'draft' : form.status,
  };
}

function validate(form: FormState, t: (k: string) => string): string | null {
  // Image is optional now — a promo can be a colored gradient banner.
  for (const lng of LANGS) {
    const title = form[`title${capitalize(lng)}` as keyof FormState] as string;
    const body = form[`body${capitalize(lng)}` as keyof FormState] as string;
    if (!title.trim()) return t('superAdmin.promoForm.errors.titleRequired');
    if (!body.trim()) return t('superAdmin.promoForm.errors.bodyRequired');
  }
  if (form.ctaTargetType && !form.ctaTargetValue.trim()) {
    return t('superAdmin.promoForm.errors.ctaTargetValueRequired');
  }
  if (!form.startAt || !form.endAt) return t('superAdmin.promoForm.errors.datesRequired');
  if (new Date(form.startAt).getTime() >= new Date(form.endAt).getTime()) {
    return t('superAdmin.promoForm.errors.dateOrder');
  }
  return null;
}

function capitalize(s: string): 'Az' | 'Ru' | 'En' {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as 'Az' | 'Ru' | 'En';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function mapError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'INVALID_DATE_RANGE') return t('superAdmin.promoForm.errors.dateOrder');
    if (code === 'CTA_TARGET_VALUE_REQUIRED')
      return t('superAdmin.promoForm.errors.ctaTargetValueRequired');
    if (code === 'PROMO_NOT_FOUND') return t('superAdmin.promoForm.errors.notFound');
    if (err.response?.status === 400) return t('superAdmin.tenantNew.errors.validation');
    if (!err.response) return t('superAdmin.tenantNew.errors.network');
  }
  return t('superAdmin.tenantNew.errors.generic');
}
