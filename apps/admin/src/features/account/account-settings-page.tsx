import { isAxiosError } from 'axios';
import { Globe, Lock, LogOut, Save } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeTenantPassword, logoutEverywhere } from '@/lib/tenant-update-api';
import { useAuthStore } from '@/store/auth';

/**
 * Account settings (B10.1).
 *
 * Tenant tunes their own login + UI preferences. Three independent cards:
 *
 *  1. Change password
 *     POST /auth/tenant/change-password — backend verifies current pw,
 *     bcrypts new, revokes ALL refresh tokens. UI clears local tokens
 *     and routes to /login w/ success copy ("Password updated. Sign in
 *     with your new password.").
 *
 *  2. Language preference
 *     i18next-browser-languagedetector already persists to
 *     localStorage.tahawash.admin.lang. UI just exposes a picker; no
 *     backend hop. Customer-side push notifications honor the
 *     server-stored tenant language for outbound emails; ops UI follows
 *     this preference on this device only.
 *
 *  3. Sign out everywhere
 *     POST /auth/tenant/logout-everywhere — revokes all refresh tokens.
 *     We pair it with a local logout() so this device is signed out too.
 *     Other devices get kicked next time their access token expires
 *     (max 15 minutes).
 */
const LANGS = ['az', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

export function AccountSettingsPage() {
  const { t, i18n } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useAuthStore((s) => s.logout);

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.account.title')}
        </h1>
        <p className="mt-1 text-ink-500">
          {t('tenantAdmin.account.subtitle', { username: tenant.id })}
        </p>
      </div>

      <ChangePasswordCard onSuccess={() => void logout()} />
      <LanguageCard
        current={(i18n.resolvedLanguage as Lang) ?? 'az'}
        onChange={(lng) => void i18n.changeLanguage(lng)}
      />
      <SignOutEverywhereCard onConfirm={() => void logout()} />
    </div>
  );
}

// ─── Change password ──────────────────────────────────────────────

function ChangePasswordCard({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t('tenantAdmin.account.errors.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('tenantAdmin.account.errors.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await changeTenantPassword(currentPassword, newPassword);
      toast.success(t('tenantAdmin.account.toastPasswordChanged'));
      // Backend revoked all refresh tokens; kick locally too so the user
      // signs in fresh with the new password.
      onSuccess();
    } catch (err) {
      setError(extractPasswordError(err, t));
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="h-4 w-4 text-ink-400" />
          {t('tenantAdmin.account.passwordTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 max-w-md" noValidate>
          <PasswordField
            id="currentPassword"
            label={t('tenantAdmin.account.currentPassword')}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
          <PasswordField
            id="newPassword"
            label={t('tenantAdmin.account.newPassword')}
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            autoComplete="new-password"
            hint={t('tenantAdmin.account.newPasswordHint')}
          />
          <PasswordField
            id="confirmPassword"
            label={t('tenantAdmin.account.confirmPassword')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            autoComplete="new-password"
          />

          {error && (
            <div
              role="alert"
              className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error"
            >
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-card-sm bg-brand-50 px-3 py-2 text-xs text-ink-700">
            <Lock className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
            <span>{t('tenantAdmin.account.revokeNotice')}</span>
          </div>

          <Button type="submit" size="md" disabled={submitting}>
            <Save className="h-4 w-4" />
            {submitting ? t('tenantAdmin.account.saving') : t('tenantAdmin.account.savePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
  hint?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-16"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          {show ? t('tenantAdmin.account.hide') : t('tenantAdmin.account.show')}
        </button>
      </div>
      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

// ─── Language ─────────────────────────────────────────────────────

function LanguageCard({ current, onChange }: { current: Lang; onChange: (lng: Lang) => void }) {
  const { t } = useTranslation();
  const labels: Record<Lang, string> = {
    az: 'Azərbaycan',
    ru: 'Русский',
    en: 'English',
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-4 w-4 text-ink-400" />
          {t('tenantAdmin.account.languageTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-500 mb-3">{t('tenantAdmin.account.languageBody')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-md">
          {LANGS.map((lng) => {
            const isActive = current === lng;
            return (
              <button
                key={lng}
                type="button"
                onClick={() => onChange(lng)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-card-sm border text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line bg-bg-elev text-ink-700 hover:border-ink-300'
                }`}
              >
                <span>{labels[lng]}</span>
                <span
                  className={`text-xs uppercase ${isActive ? 'text-brand-600' : 'text-ink-400'}`}
                >
                  {lng}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sign out everywhere ──────────────────────────────────────────

function SignOutEverywhereCard({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onClick = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    try {
      await logoutEverywhere();
      toast.success(t('tenantAdmin.account.toastSignedOut'));
      onConfirm();
    } catch {
      toast.error(t('tenantAdmin.account.errors.signOutFailed'));
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <LogOut className="h-4 w-4 text-ink-400" />
          {t('tenantAdmin.account.signOutTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-700">{t('tenantAdmin.account.signOutBody')}</p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card-sm bg-error-50 border border-error/20 px-4 py-3">
            <p className="text-sm text-ink-900 font-semibold">
              {t('tenantAdmin.account.signOutConfirm')}
            </p>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                {t('tenantAdmin.locations.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void onClick()}
                disabled={submitting}
              >
                {submitting
                  ? t('tenantAdmin.account.signingOut')
                  : t('tenantAdmin.account.signOutYes')}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="md" variant="outline" onClick={() => void onClick()}>
            <LogOut className="h-4 w-4" />
            {t('tenantAdmin.account.signOutButton')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Error helper ─────────────────────────────────────────────────

function extractPasswordError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'PASSWORD_INVALID') return t('tenantAdmin.account.errors.wrongCurrent');
    if (err.response?.status === 429) return t('tenantAdmin.account.errors.rateLimited');
    if (!err.response) return t('tenantAdmin.locations.errors.network');
  }
  return t('tenantAdmin.locations.errors.generic');
}
