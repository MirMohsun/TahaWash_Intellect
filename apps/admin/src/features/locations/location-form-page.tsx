import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateLocation,
  useDeleteLocation,
  useTenantLocation,
  useUpdateLocation,
  useUpdateLocationStatus,
} from '@/hooks/use-location';
import type { LocationInput, LocationStatus, WorkingHours } from '@/lib/locations-api';
import { BaysSection } from './bays-section';
import { LocationMapPicker } from './location-map-picker';
import { LocationPhotosManager } from './location-photos-manager';
import { defaultWorkingHours, WorkingHoursEditor } from './working-hours-editor';

/**
 * Add/edit location (B3.2).
 *
 * One component, two modes:
 *  - 'create' (/locations/new)         — empty defaults, submit POSTs
 *  - 'edit'   (/locations/$locationId) — fetches via /tenant/locations/:id,
 *    reset()s the form, submit PATCHes, plus status toggle + delete
 *
 * Map picker decision: locked stack is mapbox-gl + click-to-drop pin.
 * Until VITE_MAPBOX_TOKEN is wired (same deferral as 2.5b mobile + 3.5
 * locations list), we ask for lat/lng as numeric inputs with a tip
 * pointing at Google Maps + a "preview on map" link that opens
 * Google Maps to the entered coordinates. The picker swaps in mechanically
 * once mapbox-gl lands.
 */
export function LocationFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { locationId?: string };
  const locationId = mode === 'edit' ? (params.locationId ?? null) : null;

  const existing = useTenantLocation(locationId);
  const createMut = useCreateLocation();
  const updateMut = useUpdateLocation(locationId ?? '');
  const statusMut = useUpdateLocationStatus(locationId ?? '');
  const deleteMut = useDeleteLocation(locationId ?? '');

  // Hand-managed form state — react-hook-form's nested controllers would be
  // overkill for a 6-field flat form + a complex nested working-hours value.
  const [form, setForm] = useState<LocationInput>({
    name: '',
    address: '',
    latitude: 40.3796, // Baku center as a sensible starting point
    longitude: 49.8485,
    contactPhone: '',
    is24_7: false,
    workingHours: defaultWorkingHours(),
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof LocationInput | 'workingHours', string>>
  >({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Hydrate form from server data once it arrives (edit mode).
  useEffect(() => {
    if (mode === 'edit' && existing.data) {
      setForm({
        name: existing.data.name,
        address: existing.data.address,
        latitude: existing.data.latitude,
        longitude: existing.data.longitude,
        contactPhone: existing.data.contactPhone ?? '',
        is24_7: existing.data.is24_7,
        workingHours: existing.data.workingHours ?? defaultWorkingHours(),
      });
    }
  }, [mode, existing.data]);

  const isEdit = mode === 'edit';
  const isPending = isEdit ? updateMut.isPending : createMut.isPending;
  const isBusy = isPending || statusMut.isPending || deleteMut.isPending;
  const titleKey = isEdit ? 'tenantAdmin.locations.editTitle' : 'tenantAdmin.locations.addTitle';

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'too-short';
    if (!form.address.trim() || form.address.trim().length < 2) next.address = 'too-short';
    if (form.latitude < -90 || form.latitude > 90) next.latitude = 'out-of-range';
    if (form.longitude < -180 || form.longitude > 180) next.longitude = 'out-of-range';
    if (form.contactPhone && form.contactPhone.trim().length > 0) {
      const normalized = form.contactPhone.replace(/\s/g, '');
      if (!/^\+994\d{9}$/.test(normalized)) next.contactPhone = 'bad-format';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    const payload: LocationInput = {
      ...form,
      contactPhone: form.contactPhone ? form.contactPhone.replace(/\s/g, '') : null,
    };
    try {
      if (isEdit && locationId) {
        await updateMut.mutateAsync(payload);
        toast.success(t('tenantAdmin.locations.toastUpdated'));
      } else {
        await createMut.mutateAsync(payload);
        toast.success(t('tenantAdmin.locations.toastCreated'));
      }
      void navigate({ to: '/locations' });
    } catch (err) {
      setServerError(extractServerError(err, t));
    }
  };

  const onToggleStatus = async () => {
    if (!isEdit || !locationId || !existing.data) return;
    const next: LocationStatus = existing.data.status === 'active' ? 'disabled' : 'active';
    setServerError(null);
    try {
      await statusMut.mutateAsync(next);
      toast.success(
        next === 'active'
          ? t('tenantAdmin.locations.toastActivated')
          : t('tenantAdmin.locations.toastDisabled'),
      );
    } catch (err) {
      setServerError(extractServerError(err, t));
    }
  };

  const onDelete = async () => {
    if (!isEdit || !locationId) return;
    setServerError(null);
    try {
      await deleteMut.mutateAsync();
      toast.success(t('tenantAdmin.locations.toastDeleted'));
      void navigate({ to: '/locations' });
    } catch (err) {
      setServerError(extractServerError(err, t));
    }
  };

  // Edit mode: show a spinner while initial data loads.
  if (isEdit && existing.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (isEdit && existing.isError) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardContent className="py-10 text-center">
          <p className="text-error font-medium">{t('tenantAdmin.locations.notFound')}</p>
          <Link to="/locations" className="inline-block mt-4">
            <Button size="md" variant="outline">
              {t('tenantAdmin.locations.backToList')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/locations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('tenantAdmin.locations.backToList')}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{t(titleKey)}</h1>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6" noValidate>
        {/* Basics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.locations.sectionBasics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('tenantAdmin.locations.fieldName')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="YuBox · Bakı 28 May"
                aria-invalid={!!errors.name}
                disabled={isBusy}
              />
              {errors.name && <ErrorRow keyId={errors.name} prefix="name" t={t} />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">{t('tenantAdmin.locations.fieldAddress')}</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="28 May küç., Nəsimi r-nu, Bakı"
                aria-invalid={!!errors.address}
                disabled={isBusy}
              />
              {errors.address && <ErrorRow keyId={errors.address} prefix="address" t={t} />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">{t('tenantAdmin.locations.fieldContactPhone')}</Label>
              <Input
                id="contactPhone"
                value={form.contactPhone ?? ''}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="+994 12 555 88 44"
                aria-invalid={!!errors.contactPhone}
                disabled={isBusy}
              />
              <p className="text-xs text-ink-400">
                {t('tenantAdmin.locations.fieldContactPhoneHint')}
              </p>
              {errors.contactPhone && (
                <ErrorRow keyId={errors.contactPhone} prefix="contactPhone" t={t} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coordinates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.locations.sectionLocation')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">{t('tenantAdmin.locations.fieldLatitude')}</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) || 0 })}
                  aria-invalid={!!errors.latitude}
                  disabled={isBusy}
                />
                {errors.latitude && <ErrorRow keyId={errors.latitude} prefix="latitude" t={t} />}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">{t('tenantAdmin.locations.fieldLongitude')}</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) || 0 })}
                  aria-invalid={!!errors.longitude}
                  disabled={isBusy}
                />
                {errors.longitude && <ErrorRow keyId={errors.longitude} prefix="longitude" t={t} />}
              </div>
            </div>
            <p className="text-xs text-ink-500">{t('tenantAdmin.locations.coordsHint')}</p>

            {/* Interactive Mapbox picker — click to drop, drag to fine-tune.
                Renders nothing when VITE_MAPBOX_TOKEN is unset; the number
                inputs above + "preview on Google Maps" link below keep the
                form usable without a token. */}
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) =>
                setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
              }
              disabled={isBusy}
            />

            <a
              href={`https://www.google.com/maps/@${form.latitude},${form.longitude},17z`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('tenantAdmin.locations.previewOnMap')}
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        {/* Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenantAdmin.locations.sectionHours')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is24_7}
                onChange={(e) => setForm({ ...form, is24_7: e.target.checked })}
                disabled={isBusy}
                className="h-4 w-4 rounded border-line"
              />
              <span className="text-sm font-semibold text-ink-900">
                {t('tenantAdmin.locations.alwaysOpenToggle')}
              </span>
            </label>

            {!form.is24_7 && (
              <WorkingHoursEditor
                value={form.workingHours ?? defaultWorkingHours()}
                onChange={(next: WorkingHours) => setForm({ ...form, workingHours: next })}
                disabled={isBusy}
              />
            )}
          </CardContent>
        </Card>

        {/* Photos — edit-only: needs an existing location id to attach to */}
        {isEdit && locationId && existing.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t('tenantAdmin.locations.photosTitle', { defaultValue: 'Photos' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationPhotosManager locationId={locationId} />
            </CardContent>
          </Card>
        )}

        {/* Server error */}
        {serverError && (
          <div
            role="alert"
            className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error"
          >
            {serverError}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <Link to="/locations">
            <Button size="md" variant="outline" type="button" disabled={isBusy}>
              {t('tenantAdmin.locations.cancel')}
            </Button>
          </Link>
          <Button size="md" type="submit" disabled={isBusy}>
            {isPending
              ? t('tenantAdmin.locations.saving')
              : isEdit
                ? t('tenantAdmin.locations.saveChanges')
                : t('tenantAdmin.locations.create')}
          </Button>
        </div>

        {/* Edit-only: bays inline */}
        {isEdit && locationId && existing.data && (
          <BaysSection locationId={locationId} locationName={existing.data.name} />
        )}

        {/* Edit-only: status + delete */}
        {isEdit && existing.data && (
          <Card className="border-line">
            <CardHeader>
              <CardTitle className="text-lg">{t('tenantAdmin.locations.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink-900">
                    {existing.data.status === 'active'
                      ? t('tenantAdmin.locations.statusActiveTitle')
                      : t('tenantAdmin.locations.statusDisabledTitle')}
                  </p>
                  <p className="text-sm text-ink-500">
                    {existing.data.status === 'active'
                      ? t('tenantAdmin.locations.statusActiveBody')
                      : t('tenantAdmin.locations.statusDisabledBody')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  onClick={() => void onToggleStatus()}
                  disabled={isBusy}
                >
                  {existing.data.status === 'active'
                    ? t('tenantAdmin.locations.disable')
                    : t('tenantAdmin.locations.activate')}
                </Button>
              </div>

              <div className="pt-5 border-t border-line-soft">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-error hover:text-error/80"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('tenantAdmin.locations.deleteLocation')}
                  </button>
                ) : (
                  <div className="space-y-3 rounded-card-sm bg-error-50 border border-error/20 px-4 py-3">
                    <p className="text-sm text-ink-900 font-semibold">
                      {t('tenantAdmin.locations.deleteConfirmTitle')}
                    </p>
                    <p className="text-sm text-ink-700">
                      {t('tenantAdmin.locations.deleteConfirmBody')}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="md"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isBusy}
                      >
                        {t('tenantAdmin.locations.cancel')}
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        variant="destructive"
                        onClick={() => void onDelete()}
                        disabled={isBusy}
                      >
                        {deleteMut.isPending
                          ? t('tenantAdmin.locations.deleting')
                          : t('tenantAdmin.locations.deleteConfirm')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}

function ErrorRow({
  keyId,
  prefix,
  t,
}: {
  keyId: string;
  prefix: string;
  t: (k: string) => string;
}) {
  return (
    <p className="text-xs text-error">{t(`tenantAdmin.locations.errors.${prefix}.${keyId}`)}</p>
  );
}

function extractServerError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'LOCATION_NOT_FOUND') return t('tenantAdmin.locations.errors.notFound');
    if (!err.response) return t('tenantAdmin.locations.errors.network');
    if (err.response.status === 400) return t('tenantAdmin.locations.errors.validation');
  }
  return t('tenantAdmin.locations.errors.generic');
}
