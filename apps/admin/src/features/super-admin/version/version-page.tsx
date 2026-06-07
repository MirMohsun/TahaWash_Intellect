import { isAxiosError } from 'axios';
import { AlertTriangle, Save, Smartphone, Undo } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuperAdminVersions, useUpsertSuperAdminVersion } from '@/hooks/use-super-admin-version';
import type { AppPlatform, AppVersionRow } from '@/lib/super-admin-api';

/**
 * Super-admin app version targeting (C10.3 — force update).
 *
 * Backed by `AppVersion` table (one row per platform). Mobile reads
 * `GET /public/version?platform=...` on launch — apps below
 * `minimumVersion` are blocked with the force-update modal (per
 * spec round 5).
 *
 * Two independent cards (iOS / Android). Each card has its own dirty
 * state + Save button + toast — PUT is per-platform.
 *
 * Validation mirrors backend:
 *   - both versions must match `^\d+\.\d+\.\d+$`
 *   - `minimumVersion ≤ latestVersion` (semver compare)
 *   - releaseNotes ≤ 2000 chars, optional
 */
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const RELEASE_NOTES_MAX = 2000;
const PLATFORMS: AppPlatform[] = ['ios', 'android'];

export function SuperAdminVersionPage() {
  const { t } = useTranslation();
  const versionsQ = useSuperAdminVersions();

  if (versionsQ.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (versionsQ.isError || !versionsQ.data) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.version.errors.loadFailed')}
            </p>
            <button
              type="button"
              onClick={() => void versionsQ.refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data } = versionsQ;

  return (
    <div className="space-y-6 max-w-5xl">
      <Header />

      <Card className="border-amber/20 bg-amber-50">
        <CardContent className="py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber mt-0.5 shrink-0" />
          <p className="text-sm text-ink-900">{t('superAdmin.version.warning')}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PLATFORMS.map((platform) => (
          <PlatformCard key={platform} platform={platform} initial={data[platform]} />
        ))}
      </div>
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
        {t('superAdmin.version.title')}
      </h1>
      <p className="mt-1 text-ink-500">{t('superAdmin.version.subtitle')}</p>
    </header>
  );
}

interface FormState {
  latestVersion: string;
  minimumVersion: string;
  releaseNotes: string;
}

interface FieldErrors {
  latestVersion?: string;
  minimumVersion?: string;
  releaseNotes?: string;
}

function emptyForm(): FormState {
  return { latestVersion: '', minimumVersion: '', releaseNotes: '' };
}

function formFromRow(row: AppVersionRow | null): FormState {
  if (!row) return emptyForm();
  return {
    latestVersion: row.latestVersion,
    minimumVersion: row.minimumVersion,
    releaseNotes: row.releaseNotes ?? '',
  };
}

interface PlatformCardProps {
  platform: AppPlatform;
  initial: AppVersionRow | null;
}

function PlatformCard({ platform, initial }: PlatformCardProps) {
  const { t } = useTranslation();
  const upsert = useUpsertSuperAdminVersion(platform);

  const [form, setForm] = useState<FormState>(() => formFromRow(initial));
  const [errors, setErrors] = useState<FieldErrors>({});

  // Resync form when server snapshot changes (after a save or initial load).
  useEffect(() => {
    setForm(formFromRow(initial));
    setErrors({});
  }, [initial]);

  const original = useMemo(() => formFromRow(initial), [initial]);
  const dirty =
    form.latestVersion.trim() !== original.latestVersion ||
    form.minimumVersion.trim() !== original.minimumVersion ||
    form.releaseNotes !== original.releaseNotes;

  const onReset = () => {
    setForm(original);
    setErrors({});
  };

  const onSave = async () => {
    const validationErrors = validate(form, t);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    const trimmedNotes = form.releaseNotes.trim();
    try {
      await upsert.mutateAsync({
        latestVersion: form.latestVersion.trim(),
        minimumVersion: form.minimumVersion.trim(),
        releaseNotes: trimmedNotes === '' ? null : trimmedNotes,
      });
      toast.success(
        t('superAdmin.version.toastSaved', {
          platform: t(`superAdmin.version.platform.${platform}`),
        }),
      );
    } catch (err) {
      const mapped = mapServerError(err, t);
      if (mapped.field) {
        setErrors({ [mapped.field]: mapped.message } as FieldErrors);
      } else {
        toast.error(mapped.message);
      }
    }
  };

  const used = form.releaseNotes.length;
  const overLimit = used > RELEASE_NOTES_MAX;
  const platformLabel = t(`superAdmin.version.platform.${platform}`);
  const notConfigured = initial === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-brand-500" />
            {platformLabel}
          </div>
          {notConfigured && (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill bg-amber-50 text-amber">
              {t('superAdmin.version.notConfigured')}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {initial
            ? t('superAdmin.version.lastUpdated', {
                when: new Date(initial.updatedAt).toLocaleString(),
              })
            : t('superAdmin.version.neverConfigured')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${platform}-latest`}>{t('superAdmin.version.latestVersion')}</Label>
            <Input
              id={`${platform}-latest`}
              placeholder="1.2.0"
              value={form.latestVersion}
              onChange={(e) => setForm({ ...form, latestVersion: e.target.value })}
              aria-invalid={Boolean(errors.latestVersion)}
            />
            {errors.latestVersion ? (
              <p className="text-xs text-error font-medium">{errors.latestVersion}</p>
            ) : (
              <p className="text-xs text-ink-400">{t('superAdmin.version.latestHint')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${platform}-minimum`}>{t('superAdmin.version.minimumVersion')}</Label>
            <Input
              id={`${platform}-minimum`}
              placeholder="1.0.0"
              value={form.minimumVersion}
              onChange={(e) => setForm({ ...form, minimumVersion: e.target.value })}
              aria-invalid={Boolean(errors.minimumVersion)}
            />
            {errors.minimumVersion ? (
              <p className="text-xs text-error font-medium">{errors.minimumVersion}</p>
            ) : (
              <p className="text-xs text-ink-400">{t('superAdmin.version.minimumHint')}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`${platform}-notes`}>{t('superAdmin.version.releaseNotes')}</Label>
            <span className={`text-xs ${overLimit ? 'text-error font-medium' : 'text-ink-400'}`}>
              {t('superAdmin.version.charsUsage', { used, max: RELEASE_NOTES_MAX })}
            </span>
          </div>
          <textarea
            id={`${platform}-notes`}
            rows={5}
            className="w-full rounded-card-sm border border-line bg-bg-elev px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-y"
            placeholder={t('superAdmin.version.releaseNotesPlaceholder')}
            value={form.releaseNotes}
            onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
            aria-invalid={Boolean(errors.releaseNotes)}
          />
          {errors.releaseNotes && (
            <p className="text-xs text-error font-medium">{errors.releaseNotes}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            size="md"
            variant="outline"
            onClick={onReset}
            disabled={!dirty || upsert.isPending}
          >
            <Undo className="h-4 w-4" />
            {t('superAdmin.tenantDetail.reset')}
          </Button>
          <Button
            type="button"
            size="md"
            onClick={() => void onSave()}
            disabled={!dirty || upsert.isPending}
          >
            <Save className="h-4 w-4" />
            {upsert.isPending
              ? t('superAdmin.tenantDetail.saving')
              : t('superAdmin.tenantDetail.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseVersion(v: string): [number, number, number] | null {
  if (!VERSION_RE.test(v)) return null;
  const [a = '0', b = '0', c = '0'] = v.split('.');
  return [Number(a), Number(b), Number(c)];
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2] - pb[2];
}

function validate(form: FormState, t: (k: string) => string): FieldErrors {
  const errors: FieldErrors = {};
  const latest = form.latestVersion.trim();
  const minimum = form.minimumVersion.trim();

  if (!VERSION_RE.test(latest)) {
    errors.latestVersion = t('superAdmin.version.errors.badFormat');
  }
  if (!VERSION_RE.test(minimum)) {
    errors.minimumVersion = t('superAdmin.version.errors.badFormat');
  }
  if (!errors.latestVersion && !errors.minimumVersion && compareVersions(minimum, latest) > 0) {
    errors.minimumVersion = t('superAdmin.version.errors.minGreaterThanLatest');
  }
  if (form.releaseNotes.length > RELEASE_NOTES_MAX) {
    errors.releaseNotes = t('superAdmin.version.errors.notesTooLong');
  }
  return errors;
}

function mapServerError(
  err: unknown,
  t: (k: string) => string,
): { field?: keyof FieldErrors; message: string } {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'MIN_GREATER_THAN_LATEST') {
      return {
        field: 'minimumVersion',
        message: t('superAdmin.version.errors.minGreaterThanLatest'),
      };
    }
    if (err.response?.status === 400) {
      return { message: t('superAdmin.version.errors.validation') };
    }
    if (!err.response) {
      return { message: t('superAdmin.version.errors.network') };
    }
  }
  return { message: t('superAdmin.version.errors.saveFailed') };
}
