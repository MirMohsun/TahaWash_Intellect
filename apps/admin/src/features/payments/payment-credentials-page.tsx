import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  Link2,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDeletePaymentCredentials,
  usePaymentCredentials,
  useSavePaymentCredentials,
} from '@/hooks/use-payment-credentials';
import { useAuthStore } from '@/store/auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Tenant-admin: connect this carwash's ePoint merchant account.
 *
 * The private key is sent once and stored encrypted on the server; it is never
 * returned, so the UI shows only a "connected" state + the public merchant id.
 * Also surfaces the exact callback URL the tenant must paste into their ePoint
 * panel so payments get confirmed.
 */
export function PaymentCredentialsPage() {
  const { t } = useTranslation();
  const tenant = useAuthStore((s) => s.tenant);
  const status = usePaymentCredentials();
  const save = useSavePaymentCredentials();
  const remove = useDeletePaymentCredentials();

  const configured = status.data?.configured ?? false;
  const [editing, setEditing] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const showForm = !status.isLoading && (!configured || editing);
  const callbackUrl = tenant ? `${API_URL}/webhooks/epoint/${tenant.id}` : '';

  const onSave = async () => {
    if (merchantId.trim().length < 3 || privateKey.trim().length < 8) {
      toast.error(
        t('tenantAdmin.payments.errInvalid', {
          defaultValue: 'Enter a valid merchant id and private key.',
        }),
      );
      return;
    }
    try {
      await save.mutateAsync({ merchantId: merchantId.trim(), privateKey: privateKey.trim() });
      setMerchantId('');
      setPrivateKey('');
      setEditing(false);
      toast.success(t('tenantAdmin.payments.saved', { defaultValue: 'Payment credentials saved.' }));
    } catch (err) {
      toast.error(errMsg(err, t));
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      toast.success(
        t('tenantAdmin.payments.removed', { defaultValue: 'Payment credentials removed.' }),
      );
    } catch (err) {
      toast.error(errMsg(err, t));
    }
  };

  const onCopy = () => {
    void navigator.clipboard?.writeText(callbackUrl);
    toast.success(t('common.copied', { defaultValue: 'Copied' }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('tenantAdmin.payments.title', { defaultValue: 'Payments (ePoint)' })}
        </h1>
        <p className="mt-1 text-ink-500">
          {t('tenantAdmin.payments.subtitle', {
            defaultValue:
              'Connect your ePoint merchant account so customers can pay at your bays. Payments go directly to your account.',
          })}
        </p>
      </div>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-ink-400" />
            {t('tenantAdmin.payments.cardTitle', { defaultValue: 'ePoint credentials' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.isLoading ? (
            <p className="text-sm text-ink-400">{t('common.loading', { defaultValue: 'Loading…' })}</p>
          ) : configured && !editing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">
                  {t('tenantAdmin.payments.connected', { defaultValue: 'Connected' })}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t('tenantAdmin.payments.merchantId', { defaultValue: 'Merchant ID (public key)' })}
                </Label>
                <code className="block px-3 py-2 rounded-card-sm border border-line bg-bg text-sm font-mono text-ink-900 select-all">
                  {status.data?.merchantId}
                </code>
              </div>
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <ShieldCheck className="h-4 w-4 text-ink-400 shrink-0" />
                {t('tenantAdmin.payments.keyStored', {
                  defaultValue:
                    'Private key stored encrypted. For security it is never shown again — to change it, replace the credentials.',
                })}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <Button type="button" size="md" variant="outline" onClick={() => setEditing(true)}>
                  {t('tenantAdmin.payments.replace', { defaultValue: 'Replace credentials' })}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="destructive"
                  onClick={() => void onRemove()}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('tenantAdmin.payments.remove', { defaultValue: 'Remove' })}
                </Button>
              </div>
            </div>
          ) : null}

          {showForm && (
            <div className="space-y-4">
              {!configured && (
                <p className="flex items-center gap-2 text-sm text-amber">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('tenantAdmin.payments.notConnected', {
                    defaultValue:
                      "Not connected yet — customers can't pay at your bays until you add your ePoint credentials.",
                  })}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="merchantId">
                  {t('tenantAdmin.payments.merchantId', { defaultValue: 'Merchant ID (public key)' })}
                </Label>
                <Input
                  id="merchantId"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="i000000001"
                  autoComplete="off"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="privateKey">
                  {t('tenantAdmin.payments.privateKey', { defaultValue: 'Private key (secret)' })}
                </Label>
                <Input
                  id="privateKey"
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  autoComplete="off"
                  className="font-mono"
                />
                <p className="text-xs text-ink-400">
                  {t('tenantAdmin.payments.privateKeyHint', {
                    defaultValue: 'Stored encrypted. Get both keys from your ePoint merchant account.',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                {configured && (
                  <Button
                    type="button"
                    size="md"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setMerchantId('');
                      setPrivateKey('');
                    }}
                  >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                  </Button>
                )}
                <Button type="button" size="md" onClick={() => void onSave()} disabled={save.isPending}>
                  <Save className="h-4 w-4" />
                  {save.isPending
                    ? t('common.saving', { defaultValue: 'Saving…' })
                    : t('tenantAdmin.payments.save', { defaultValue: 'Save credentials' })}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Callback URL the tenant must configure in ePoint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-4 w-4 text-ink-400" />
            {t('tenantAdmin.payments.callbackTitle', { defaultValue: 'Callback URL for ePoint' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-ink-500">
            {t('tenantAdmin.payments.callbackHelp', {
              defaultValue:
                'In your ePoint merchant panel, set the result/callback URL to this address so payments are confirmed:',
            })}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-card-sm border border-line bg-bg text-sm font-mono text-ink-900 select-all break-all">
              {callbackUrl}
            </code>
            <Button type="button" size="md" variant="outline" onClick={onCopy}>
              <Copy className="h-4 w-4" />
              {t('common.copy', { defaultValue: 'Copy' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function errMsg(err: unknown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (isAxiosError(err)) {
    if (!err.response) {
      return t('common.networkError', { defaultValue: 'Network error. Please try again.' });
    }
    const code = (err.response.data as { code?: string } | undefined)?.code;
    if (code === 'PAYMENT_ENCRYPTION_KEY_MISSING') {
      return t('tenantAdmin.payments.errServer', {
        defaultValue: 'Payments are not enabled on the server yet. Please contact support.',
      });
    }
  }
  return t('common.genericError', { defaultValue: 'Something went wrong. Please try again.' });
}
