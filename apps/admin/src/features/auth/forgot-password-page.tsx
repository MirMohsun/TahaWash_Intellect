import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LogoLockup } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenantForgotPassword } from '@/lib/tenant-api';

/**
 * Forgot-password (B1.2).
 *
 * Accepts username OR owner email. Backend always returns 204 so the UI
 * shows the same success state either way (no enumeration). The "did not
 * arrive" hint surfaces a few options to the user without re-running
 * the lookup (which could give a timing oracle if we round-tripped twice).
 */
const schema = z.object({
  usernameOrEmail: z.string().trim().min(3),
});

type Input = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { usernameOrEmail: '' },
  });

  const onSubmit = async (values: Input) => {
    setServerError(null);
    try {
      await tenantForgotPassword(values.usernameOrEmail);
      setSubmitted(true);
    } catch {
      // Backend treats all matches uniformly, but the network itself can fail.
      setServerError(t('tenantAdmin.forgot.errors.network'));
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
            <CardTitle className="text-2xl">{t('tenantAdmin.forgot.title')}</CardTitle>
            <CardDescription>{t('tenantAdmin.forgot.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <div
                  role="status"
                  className="rounded-card-sm bg-success/10 border border-success/20 px-3 py-3 text-sm text-ink-900"
                >
                  <p className="font-semibold mb-1">{t('tenantAdmin.forgot.sentTitle')}</p>
                  <p className="text-ink-700">{t('tenantAdmin.forgot.sentBody')}</p>
                </div>
                <p className="text-xs text-ink-500">{t('tenantAdmin.forgot.notArrivedHint')}</p>
                <Link to="/login" className="block">
                  <Button size="lg" variant="outline" className="w-full">
                    {t('tenantAdmin.forgot.backToLogin')}
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
                  <Label htmlFor="usernameOrEmail">{t('tenantAdmin.forgot.fieldLabel')}</Label>
                  <Input
                    id="usernameOrEmail"
                    autoFocus
                    autoComplete="username"
                    aria-invalid={!!errors.usernameOrEmail}
                    placeholder={t('tenantAdmin.forgot.fieldPlaceholder')}
                    {...register('usernameOrEmail')}
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
                  {isSubmitting
                    ? t('tenantAdmin.forgot.submitting')
                    : t('tenantAdmin.forgot.submit')}
                </Button>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('tenantAdmin.forgot.backToLogin')}
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
