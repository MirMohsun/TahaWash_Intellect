import { LifeBuoy, Palette, Save, Undo } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useSuperAdminSettings,
  useUpdateSuperAdminSettings,
} from '@/hooks/use-super-admin-settings';
import type {
  PlatformSettingKey,
  PlatformSettingsMap,
  UpdatePlatformSettingsInput,
} from '@/lib/super-admin-api';

/**
 * Super-admin platform settings (C10.1 + C10.2).
 *
 * Backed by PlatformSetting key-value table. Diff-only PATCH —
 * unchanged keys aren't sent. Empty input clears the value (row
 * deleted server-side).
 *
 * 2 sections:
 *   Tahawash branding   logoUrl + brandColor
 *   Support config      whatsappNumber + email + hours
 *
 * The support contacts here replace the hardcoded constants from
 * Phase 3.18 SubscriptionPage. Wiring those reads to settings is a
 * follow-up — for now the contacts are SETTABLE; consumer migration
 * happens separately.
 */
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const PHONE_RE = /^\+994\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = Record<PlatformSettingKey, string>;

function emptyForm(): Form {
  return {
    'tahawash.logoUrl': '',
    'tahawash.brandColor': '',
    'support.whatsappNumber': '',
    'support.email': '',
    'support.hours': '',
  };
}

function formFromMap(map: PlatformSettingsMap): Form {
  return {
    'tahawash.logoUrl': map['tahawash.logoUrl'] ?? '',
    'tahawash.brandColor': map['tahawash.brandColor'] ?? '',
    'support.whatsappNumber': map['support.whatsappNumber'] ?? '',
    'support.email': map['support.email'] ?? '',
    'support.hours': map['support.hours'] ?? '',
  };
}

export function SuperAdminSettingsPage() {
  const { t } = useTranslation();
  const settingsQ = useSuperAdminSettings();
  const update = useUpdateSuperAdminSettings();

  const [form, setForm] = useState<Form>(() => emptyForm());

  // Sync from server snapshot once data lands or after a save.
  useEffect(() => {
    if (settingsQ.data) {
      setForm(formFromMap(settingsQ.data));
    }
  }, [settingsQ.data]);

  const original = useMemo(() => formFromMap(settingsQ.data ?? {}), [settingsQ.data]);
  const diff = useMemo(() => buildDiff(form, original), [form, original]);
  const dirty = diff.items.length > 0;

  const onReset = () => setForm(original);

  const onSave = async () => {
    const err = validate(form, t);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await update.mutateAsync(diff);
      toast.success(t('superAdmin.settings.toastSaved'));
    } catch {
      toast.error(t('superAdmin.settings.errors.saveFailed'));
    }
  };

  if (settingsQ.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (settingsQ.isError) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('superAdmin.settings.title')}
          </h1>
        </header>
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.settings.errors.loadFailed')}
            </p>
            <button
              type="button"
              onClick={() => void settingsQ.refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.settings.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.settings.subtitle')}</p>
      </header>

      {/* Tahawash branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-500" />
            {t('superAdmin.settings.brandingTitle')}
          </CardTitle>
          <CardDescription>{t('superAdmin.settings.brandingBody')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="logoUrl">{t('superAdmin.settings.logoUrl')}</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://cdn.tahawash.az/brand/logo.png"
              value={form['tahawash.logoUrl']}
              onChange={(e) => setForm({ ...form, 'tahawash.logoUrl': e.target.value })}
            />
            <p className="text-xs text-ink-400">{t('superAdmin.settings.logoUrlHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brandColor">{t('superAdmin.settings.brandColor')}</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form['tahawash.brandColor'] || '#0E7AE7'}
                onChange={(e) =>
                  setForm({ ...form, 'tahawash.brandColor': e.target.value.toUpperCase() })
                }
                className="h-10 w-12 rounded-card-sm border border-line bg-bg-elev cursor-pointer"
              />
              <Input
                id="brandColor"
                className="flex-1"
                placeholder="#0E7AE7"
                value={form['tahawash.brandColor']}
                onChange={(e) => setForm({ ...form, 'tahawash.brandColor': e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-brand-500" />
            {t('superAdmin.settings.supportTitle')}
          </CardTitle>
          <CardDescription>{t('superAdmin.settings.supportBody')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">{t('superAdmin.settings.whatsapp')}</Label>
            <Input
              id="whatsapp"
              inputMode="tel"
              placeholder="+994501234567"
              value={form['support.whatsappNumber']}
              onChange={(e) => setForm({ ...form, 'support.whatsappNumber': e.target.value })}
            />
            <p className="text-xs text-ink-400">{t('superAdmin.settings.whatsappHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('superAdmin.settings.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="support@tahawash.az"
              value={form['support.email']}
              onChange={(e) => setForm({ ...form, 'support.email': e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="hours">{t('superAdmin.settings.hours')}</Label>
            <Input
              id="hours"
              placeholder={t('superAdmin.settings.hoursPlaceholder')}
              value={form['support.hours']}
              onChange={(e) => setForm({ ...form, 'support.hours': e.target.value })}
            />
            <p className="text-xs text-ink-400">{t('superAdmin.settings.hoursHint')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      {dirty && (
        <Card className="border-brand-200 bg-brand-50">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink-900 font-medium">{t('superAdmin.settings.dirtyHint')}</p>
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

      <p className="text-xs text-ink-400">{t('superAdmin.settings.consumerNote')}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildDiff(form: Form, original: Form): UpdatePlatformSettingsInput {
  const items: UpdatePlatformSettingsInput['items'] = [];
  (Object.keys(form) as PlatformSettingKey[]).forEach((key) => {
    const fv = form[key].trim();
    const ov = (original[key] ?? '').trim();
    if (fv !== ov) {
      items.push({ key, value: fv });
    }
  });
  return { items };
}

function validate(form: Form, t: (k: string) => string): string | null {
  const color = form['tahawash.brandColor'].trim();
  if (color && !HEX_RE.test(color)) {
    return t('superAdmin.settings.errors.badHex');
  }
  const phone = form['support.whatsappNumber'].trim();
  if (phone && !PHONE_RE.test(phone)) {
    return t('superAdmin.settings.errors.badPhone');
  }
  const email = form['support.email'].trim();
  if (email && !EMAIL_RE.test(email)) {
    return t('superAdmin.settings.errors.badEmail');
  }
  return null;
}
