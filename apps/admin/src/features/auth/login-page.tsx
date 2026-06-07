import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
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
import { useAuthStore } from '@/store/auth';

/**
 * Tenant-admin login (B1.1).
 *
 * UX:
 *  - Tahawash-branded shell (generic — same look for every tenant)
 *  - Username + password (admin creates the credentials; no self-signup)
 *  - Server-side errors surface inline with a friendly message keyed off
 *    the backend's structured error `code` ({LOGIN_INVALID / TENANT_DELETED /
 *    TENANT_HIDDEN / TENANT_UNAVAILABLE / generic network})
 *  - Forgot-password is a stub for now (B1.2 ships with Resend email)
 *
 * Per-tenant theming: handled AFTER login by TenantThemeProvider, which
 * reads /tenant/me's themeColor and re-paints --brand-500/600/700.
 */
const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

type LoginInput = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { reset?: 'ok' };
  const justReset = search.reset === 'ok';
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  // If we boot already-authed (or finish login below), bounce to dashboard.
  useEffect(() => {
    if (status === 'authed') {
      void navigate({ to: '/dashboard' });
    }
  }, [status, navigate]);

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      await login(values.username, values.password);
      // Navigation handled by the useEffect above once status flips to 'authed'.
    } catch (err) {
      setServerError(mapLoginError(err, t));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <LogoLockup size={40} />
          <p className="text-sm text-ink-500">{t('tenantAdmin.login.tagline')}</p>
        </div>

        {justReset && (
          <div
            role="status"
            className="rounded-card-sm bg-success/10 border border-success/20 px-3 py-2.5 text-sm text-ink-900"
          >
            {t('tenantAdmin.login.justReset')}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('tenantAdmin.login.title')}</CardTitle>
            <CardDescription>{t('tenantAdmin.login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="username">{t('tenantAdmin.login.username')}</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!errors.username}
                  {...register('username')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('tenantAdmin.login.password')}</Label>
                <Input
                  id="password"
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
                {isSubmitting ? t('tenantAdmin.login.signingIn') : t('tenantAdmin.login.submit')}
              </Button>

              <Link
                to="/forgot-password"
                className="inline-block text-sm text-brand-600 font-semibold hover:text-brand-700 transition-colors"
              >
                {t('tenantAdmin.login.forgotPassword')}
              </Link>
            </form>
          </CardContent>
        </Card>

        {/* Language switcher */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-ink-400">{t('tenantAdmin.login.languageLabel')}</span>
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

        <p className="text-center text-xs text-ink-400">{t('tenantAdmin.login.footer')}</p>
      </div>
    </div>
  );
}

/** Map a backend error response to a user-facing string. */
function mapLoginError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (status === 401 && code === 'LOGIN_INVALID') {
      return t('tenantAdmin.login.errors.invalid');
    }
    if (status === 401 && (code === 'TENANT_HIDDEN' || code === 'TENANT_DELETED')) {
      return t('tenantAdmin.login.errors.unavailable');
    }
    if (status === 429) {
      return t('tenantAdmin.login.errors.rateLimited');
    }
    if (!err.response) {
      return t('tenantAdmin.login.errors.network');
    }
  }
  return t('tenantAdmin.login.errors.generic');
}
