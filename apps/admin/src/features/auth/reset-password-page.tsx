import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LogoLockup } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenantResetPassword } from '@/lib/tenant-api';

/**
 * Reset password (B1.3).
 *
 * Reads `?token=...` from the URL. The token is opaque to the client —
 * backend hashes + matches it. Two visible fields (new + confirm) with
 * client-side equality check; minimum length 8 to match the DTO floor.
 *
 * On success → bounce to /login (existing sessions everywhere were already
 * revoked server-side, so a fresh login is the right move).
 */
const schema = z
  .object({
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type Input = z.infer<typeof schema>;

interface SearchParams {
  token?: string;
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchParams;
  const token = search.token ?? '';

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const tokenMissing = !token;

  const onSubmit = async (values: Input) => {
    if (tokenMissing) return;
    setServerError(null);
    try {
      await tenantResetPassword(token, values.newPassword);
      void navigate({ to: '/login', search: { reset: 'ok' } });
    } catch (err) {
      setServerError(mapResetError(err, t));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <LogoLockup size={40} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('tenantAdmin.reset.title')}</CardTitle>
            <CardDescription>{t('tenantAdmin.reset.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenMissing ? (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error"
                >
                  {t('tenantAdmin.reset.errors.missingToken')}
                </div>
                <Link to="/forgot-password" className="block">
                  <Button size="lg" className="w-full">
                    {t('tenantAdmin.reset.requestNew')}
                  </Button>
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                className="space-y-5"
                noValidate
              >
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">{t('tenantAdmin.reset.newPassword')}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoFocus
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p className="text-xs text-error">{t('tenantAdmin.reset.errors.tooShort')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">{t('tenantAdmin.reset.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-error">{t('tenantAdmin.reset.errors.mismatch')}</p>
                  )}
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
                  {isSubmitting ? t('tenantAdmin.reset.submitting') : t('tenantAdmin.reset.submit')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function mapResetError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'RESET_TOKEN_INVALID') return t('tenantAdmin.reset.errors.tokenInvalid');
    if (code === 'RESET_TOKEN_EXPIRED') return t('tenantAdmin.reset.errors.tokenExpired');
    if (code === 'TENANT_UNAVAILABLE') return t('tenantAdmin.reset.errors.tenantUnavailable');
    if (err.response?.status === 429) return t('tenantAdmin.reset.errors.rateLimited');
    if (!err.response) return t('tenantAdmin.reset.errors.network');
  }
  return t('tenantAdmin.reset.errors.generic');
}
