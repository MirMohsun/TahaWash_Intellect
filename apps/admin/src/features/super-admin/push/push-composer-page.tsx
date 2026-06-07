import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeft, Bell, Send, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateSuperAdminPush, useSuperAdminPushCities } from '@/hooks/use-super-admin-push';
import type { CreatePushInput, PushTargetType } from '@/lib/super-admin-api';

/**
 * Super-admin bulk push composer (C7.1).
 *
 * All three locale titles + bodies are required. Target picker = all /
 * city (multi-select) / language (multi-select). Schedule = send now
 * vs schedule-for (datetime-local input, must be future).
 *
 * Preview pane shows iOS/Android side-by-side rectangles in the
 * currently active locale tab so the super-admin sees what the push
 * actually looks like before sending.
 */
const LANGS = ['az', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

const schema = z.object({
  titleAz: z.string().trim().min(1).max(80),
  titleRu: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().min(1).max(80),
  bodyAz: z.string().trim().min(1).max(240),
  bodyRu: z.string().trim().min(1).max(240),
  bodyEn: z.string().trim().min(1).max(240),
  targetType: z.enum(['all', 'city', 'language']),
  cityValues: z.array(z.string()).default([]),
  languageValues: z.array(z.enum(['az', 'ru', 'en'])).default([]),
  scheduleMode: z.enum(['now', 'later']),
  scheduledFor: z.string().default(''),
});

type FormInput = z.infer<typeof schema>;

export function SuperAdminPushComposerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const citiesQ = useSuperAdminPushCities();
  const create = useCreateSuperAdminPush();

  const [activeLang, setActiveLang] = useState<Lang>('az');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      titleAz: '',
      titleRu: '',
      titleEn: '',
      bodyAz: '',
      bodyRu: '',
      bodyEn: '',
      targetType: 'all',
      cityValues: [],
      languageValues: [],
      scheduleMode: 'now',
      scheduledFor: '',
    },
  });

  const targetType = watch('targetType');
  const scheduleMode = watch('scheduleMode');
  const cityValues = watch('cityValues');
  const languageValues = watch('languageValues');
  const titles = {
    az: watch('titleAz'),
    ru: watch('titleRu'),
    en: watch('titleEn'),
  };
  const bodies = {
    az: watch('bodyAz'),
    ru: watch('bodyRu'),
    en: watch('bodyEn'),
  };

  // Surfaces validation failures (otherwise the form silently does nothing):
  // jump to the first language tab with a missing title/body + toast.
  const onInvalid = (formErrors: typeof errors) => {
    const firstBadLang = LANGS.find(
      (lng) =>
        formErrors[`title${capitalize(lng)}` as keyof FormInput] ||
        formErrors[`body${capitalize(lng)}` as keyof FormInput],
    );
    if (firstBadLang) setActiveLang(firstBadLang);
    toast.error(
      t('superAdmin.push.errors.fillAllLanguages', {
        defaultValue: 'Add a title and body in all 3 languages (AZ, RU, EN).',
      }),
    );
  };

  const onSubmit = async (values: FormInput) => {
    // Cross-field validation
    if (values.targetType === 'city' && values.cityValues.length === 0) {
      toast.error(t('superAdmin.push.errors.cityRequired'));
      return;
    }
    if (values.targetType === 'language' && values.languageValues.length === 0) {
      toast.error(t('superAdmin.push.errors.languageRequired'));
      return;
    }
    if (values.scheduleMode === 'later') {
      if (!values.scheduledFor) {
        toast.error(t('superAdmin.push.errors.scheduleRequired'));
        return;
      }
      if (new Date(values.scheduledFor).getTime() <= Date.now()) {
        toast.error(t('superAdmin.push.errors.scheduleInPast'));
        return;
      }
    }

    const payload: CreatePushInput = {
      titleAz: values.titleAz.trim(),
      titleRu: values.titleRu.trim(),
      titleEn: values.titleEn.trim(),
      bodyAz: values.bodyAz.trim(),
      bodyRu: values.bodyRu.trim(),
      bodyEn: values.bodyEn.trim(),
      targetType: values.targetType,
      targetValues:
        values.targetType === 'city'
          ? values.cityValues
          : values.targetType === 'language'
            ? values.languageValues
            : undefined,
      scheduledFor:
        values.scheduleMode === 'later' ? new Date(values.scheduledFor).toISOString() : undefined,
    };

    try {
      const res = await create.mutateAsync(payload);
      toast.success(
        res.status === 'scheduled'
          ? t('superAdmin.push.toastScheduled')
          : t('superAdmin.push.toastSent'),
      );
      void navigate({ to: '/super-admin/push' });
    } catch (err) {
      toast.error(mapError(err, t));
    }
  };

  const toggleCity = (city: string) => {
    setValue(
      'cityValues',
      cityValues.includes(city) ? cityValues.filter((c) => c !== city) : [...cityValues, city],
    );
  };
  const toggleLanguage = (lang: 'az' | 'ru' | 'en') => {
    setValue(
      'languageValues',
      languageValues.includes(lang)
        ? languageValues.filter((l) => l !== lang)
        : [...languageValues, lang],
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/super-admin/push"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('superAdmin.push.backToHistory')}
      </Link>

      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.push.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.push.subtitle')}</p>
      </header>

      <form onSubmit={(e) => void handleSubmit(onSubmit, onInvalid)(e)} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Left column: form */}
          <div className="space-y-6 min-w-0">
            {/* Content (multi-lang) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.push.contentTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.push.contentBody')}</CardDescription>
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
                    {t('superAdmin.push.titleLabel', { lng: activeLang.toUpperCase() })}
                  </Label>
                  <Input
                    id={`title-${activeLang}`}
                    maxLength={80}
                    {...register(`title${capitalize(activeLang)}` as keyof FormInput)}
                  />
                  <CharCount value={titles[activeLang]} max={80} />
                  {errors[`title${capitalize(activeLang)}` as keyof FormInput] && (
                    <p role="alert" className="text-xs text-error">
                      {t('superAdmin.push.errors.titleRequired')}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`body-${activeLang}`}>
                    {t('superAdmin.push.bodyLabel', { lng: activeLang.toUpperCase() })}
                  </Label>
                  <textarea
                    id={`body-${activeLang}`}
                    rows={3}
                    maxLength={240}
                    className="w-full px-3 py-2 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-none"
                    {...register(`body${capitalize(activeLang)}` as keyof FormInput)}
                  />
                  <CharCount value={bodies[activeLang]} max={240} />
                  {errors[`body${capitalize(activeLang)}` as keyof FormInput] && (
                    <p role="alert" className="text-xs text-error">
                      {t('superAdmin.push.errors.bodyRequired')}
                    </p>
                  )}
                </div>

                <p className="text-xs text-ink-500">{t('superAdmin.push.allLangsRequired')}</p>
              </CardContent>
            </Card>

            {/* Target */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.push.targetTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.push.targetBody')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(['all', 'city', 'language'] as PushTargetType[]).map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => setValue('targetType', tt)}
                      className={`px-3 py-2 rounded-card-sm text-sm font-semibold transition-colors ${
                        targetType === tt
                          ? 'bg-brand-50 text-brand-600 border border-brand-200'
                          : 'bg-bg-elev text-ink-700 border border-line hover:bg-line-soft'
                      }`}
                    >
                      {t(`superAdmin.push.target.${tt}`)}
                    </button>
                  ))}
                </div>

                {targetType === 'city' && (
                  <div className="space-y-2">
                    {citiesQ.isLoading ? (
                      <p className="text-sm text-ink-500">{t('superAdmin.push.citiesLoading')}</p>
                    ) : (citiesQ.data?.items ?? []).length === 0 ? (
                      <p className="text-sm text-ink-500">{t('superAdmin.push.noCities')}</p>
                    ) : (
                      <>
                        <p className="text-xs text-ink-500">{t('superAdmin.push.cityHint')}</p>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                          {(citiesQ.data?.items ?? []).map((c) => {
                            const selected = cityValues.includes(c.city);
                            return (
                              <button
                                key={c.city}
                                type="button"
                                onClick={() => toggleCity(c.city)}
                                className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
                                  selected
                                    ? 'bg-brand-500 text-white'
                                    : 'bg-line-soft text-ink-700 hover:bg-line'
                                }`}
                              >
                                {c.city}
                                <span className="ml-1.5 opacity-70 tabular-nums">
                                  {c.customerCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {targetType === 'language' && (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-500">{t('superAdmin.push.languageHint')}</p>
                    <div className="flex flex-wrap gap-2">
                      {(['az', 'ru', 'en'] as const).map((lng) => {
                        const selected = languageValues.includes(lng);
                        return (
                          <button
                            key={lng}
                            type="button"
                            onClick={() => toggleLanguage(lng)}
                            className={`px-3 py-1.5 rounded-pill text-xs font-bold uppercase tracking-wider transition-colors ${
                              selected
                                ? 'bg-brand-500 text-white'
                                : 'bg-line-soft text-ink-700 hover:bg-line'
                            }`}
                          >
                            {lng}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {targetType === 'all' && (
                  <p className="text-xs text-ink-500">{t('superAdmin.push.allHint')}</p>
                )}
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.push.scheduleTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(['now', 'later'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setValue('scheduleMode', m)}
                      className={`px-3 py-2 rounded-card-sm text-sm font-semibold transition-colors ${
                        scheduleMode === m
                          ? 'bg-brand-50 text-brand-600 border border-brand-200'
                          : 'bg-bg-elev text-ink-700 border border-line hover:bg-line-soft'
                      }`}
                    >
                      {t(`superAdmin.push.schedule.${m}`)}
                    </button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="scheduledFor">{t('superAdmin.push.scheduledFor')}</Label>
                    <Input id="scheduledFor" type="datetime-local" {...register('scheduledFor')} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button size="lg" type="submit" disabled={isSubmitting || create.isPending}>
                <Send className="h-4 w-4" />
                {create.isPending
                  ? t('superAdmin.push.sending')
                  : scheduleMode === 'later'
                    ? t('superAdmin.push.schedulePush')
                    : t('superAdmin.push.sendNow')}
              </Button>
              <Link to="/super-admin/push">
                <Button size="lg" variant="outline" type="button">
                  {t('superAdmin.tenantNew.cancel')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right column: preview */}
          <aside className="space-y-3 lg:sticky lg:top-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <Smartphone className="h-3.5 w-3.5" />
              {t('superAdmin.push.previewTitle', { lng: activeLang.toUpperCase() })}
            </div>
            <NotificationPreview title={titles[activeLang]} body={bodies[activeLang]} />
            <p className="text-xs text-ink-400">{t('superAdmin.push.previewHint')}</p>
          </aside>
        </div>
      </form>
    </div>
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

function NotificationPreview({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation();
  const displayTitle = title.trim() || t('superAdmin.push.previewPlaceholderTitle');
  const displayBody = body.trim() || t('superAdmin.push.previewPlaceholderBody');

  return (
    <div className="rounded-card-sm border border-line bg-bg-elev shadow-sm overflow-hidden">
      <div className="bg-line-soft px-3 py-2 flex items-center justify-between text-xs text-ink-500">
        <span className="font-semibold uppercase tracking-wider">
          {t('superAdmin.push.previewApp')}
        </span>
        <span>now</span>
      </div>
      <div className="p-3 flex items-start gap-3">
        <div className="h-9 w-9 rounded-card-sm bg-brand-500 flex items-center justify-center shrink-0">
          <Bell className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900 text-sm truncate">{displayTitle}</p>
          <p className="text-xs text-ink-700 mt-0.5 line-clamp-3">{displayBody}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function capitalize(s: string): 'Az' | 'Ru' | 'En' {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as 'Az' | 'Ru' | 'En';
}

function mapError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'SCHEDULED_FOR_IN_PAST') return t('superAdmin.push.errors.scheduleInPast');
    if (code === 'INVALID_TARGET_LANGUAGE') return t('superAdmin.push.errors.languageInvalid');
    if (err.response?.status === 400) return t('superAdmin.push.errors.validation');
    if (!err.response) return t('superAdmin.push.errors.network');
  }
  return t('superAdmin.push.errors.generic');
}
