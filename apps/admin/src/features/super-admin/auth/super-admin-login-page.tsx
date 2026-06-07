import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LogoLockup } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuperAdminAuthStore } from '@/store/super-admin-auth';

/**
 * Super-admin login (C1.1).
 *
 * UX:
 *  - Tahawash-branded shell (NO per-tenant theming — super-admin is brand-locked)
 *  - Username + password (single super-admin user per environment; no self-signup)
 *  - Server-side errors map to friendly messages keyed off backend's `code`
 *  - No "forgot password" — single-user surface; password reset is a backend op
 */
const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

type LoginInput = z.infer<typeof loginSchema>;

export function SuperAdminLoginPage() {
  const { t, i18n } = useTranslation();
  const status = useSuperAdminAuthStore((s) => s.status);
  const login = useSuperAdminAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    if (status === 'authed') {
      void navigate({ to: '/super-admin/dashboard' });
    }
  }, [status, navigate]);

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      await login(values.username, values.password);
    } catch (err) {
      setServerError(mapLoginError(err, t));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <LogoLockup size={40} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 rounded-pill px-3 py-1">
            {t('superAdmin.login.badge')}
          </span>
          <p className="text-sm text-ink-500">{t('superAdmin.login.tagline')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('superAdmin.login.title')}</CardTitle>
            <CardDescription>{t('superAdmin.login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="su-username">{t('superAdmin.login.username')}</Label>
                <Input
                  id="su-username"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!errors.username}
                  {...register('username')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">{t('superAdmin.login.password')}</Label>
                <Input
                  id="su-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error"
                >
                  {serverError}
                </div>
              )}

              <Button size="lg" className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('superAdmin.login.signingIn') : t('superAdmin.login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-ink-400">{t('superAdmin.login.languageLabel')}</span>
          {(['az', 'ru', 'en'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => void i18n.changeLanguage(lng)}
              className={
                i18n.resolvedLanguage === lng
                  ? 'font-bold text-brand-600 uppercase'
                  : 'text-ink-500 uppercase hover:text-ink-700'
              }
            >
              {lng}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-ink-400">{t('superAdmin.login.footer')}</p>
      </div>
    </div>
  );
}

function mapLoginError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (status === 401 && code === 'LOGIN_INVALID') {
      return t('superAdmin.login.errors.invalid');
    }
    if (status === 429) {
      return t('superAdmin.login.errors.rateLimited');
    }
    if (!err.response) {
      return t('superAdmin.login.errors.network');
    }
  }
  return t('superAdmin.login.errors.generic');
}
