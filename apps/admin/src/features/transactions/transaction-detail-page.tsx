import { Link, useParams } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Hash,
  Phone,
  Receipt,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantTransaction } from '@/hooks/use-transaction';
import { formatActivityTime } from '@/lib/baku-day';
import type { TenantTransactionStatus } from '@/lib/transactions-api';

/**
 * Transaction detail (B5.2).
 *
 * Read-only by design — tenants can't modify a settled transaction. The
 * page surfaces everything Tahawash support would ask about during a
 * dispute: who paid, when, which bay, which card, the ePoint reference,
 * and (if relevant) the hardware error reason.
 *
 * Layout:
 *   - Back link → /transactions
 *   - Hero: big amount + status pill + Baku-relative time
 *   - When tx is paid_hardware_error: a prominent amber alert card with
 *     the errorReason — this is the #1 reason a tenant clicks into a tx
 *   - Bay + Location card
 *   - Customer card (masked phone, or "deleted account" indicator)
 *   - Payment card (method, card brand+lastFour, ePoint reference)
 *   - Hardware card (credited-at timestamp + errorReason if any)
 *
 * No row click on this page; admins go back via the explicit Link.
 */
export function TransactionDetailPage() {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { transactionId?: string };
  const id = params.transactionId ?? null;
  const { data, isLoading, isError } = useTenantTransaction(id);

  return (
    <div className="space-y-6">
      <Link
        to="/transactions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('tenantAdmin.transactions.backToList')}
      </Link>

      {isLoading ? (
        <DetailSkeleton />
      ) : isError || !data ? (
        <NotFound />
      ) : (
        <DetailContent tx={data} />
      )}
    </div>
  );
}

function DetailContent({
  tx,
}: {
  tx: NonNullable<ReturnType<typeof useTenantTransaction>['data']>;
}) {
  const { t } = useTranslation();
  const card = tx.cardBrand && tx.cardLastFour ? `${tx.cardBrand} ••${tx.cardLastFour}` : null;
  const isHwError = tx.status === 'paid_hardware_error';

  return (
    <>
      {/* Hero */}
      <Card>
        <CardContent className="py-7 px-6 space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-4xl font-extrabold text-ink-900 tabular-nums tracking-tight">
              {tx.amountAzn} ₼
            </p>
            <StatusPill status={tx.status} />
          </div>
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <Clock className="h-4 w-4 text-ink-400" />
            {formatActivityTime(tx.occurredAt, t, new Date())}
            <span className="text-ink-300">·</span>
            <span className="font-mono text-xs">{tx.id}</span>
          </p>
        </CardContent>
      </Card>

      {/* Hardware-error alert (prominent — the #1 reason to be here) */}
      {isHwError && (
        <Card className="border-amber/30 bg-amber-50">
          <CardContent className="py-4 px-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-ink-900">
                {t('tenantAdmin.transactions.detail.hwErrorTitle')}
              </p>
              <p className="text-sm text-ink-700">
                {tx.errorReason ?? t('tenantAdmin.transactions.detail.hwErrorUnknown')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bay + Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('tenantAdmin.transactions.detail.whereTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              icon={<Receipt className="h-4 w-4 text-ink-400" />}
              label={t('tenantAdmin.transactions.detail.bay')}
              value={tx.bay.name}
            />
            <DetailRow
              icon={<Building2 className="h-4 w-4 text-ink-400" />}
              label={t('tenantAdmin.transactions.detail.location')}
              value={tx.location.name}
              hint={tx.locationAddress}
            />
          </CardContent>
        </Card>

        {/* Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('tenantAdmin.transactions.detail.customerTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tx.customerAnonymized ? (
              <p className="text-sm text-ink-500 italic">
                {t('tenantAdmin.transactions.detail.customerAnonymizedBody')}
              </p>
            ) : (
              <DetailRow
                icon={<Phone className="h-4 w-4 text-ink-400" />}
                label={t('tenantAdmin.transactions.detail.phoneMasked')}
                value={<span className="tabular-nums">{tx.customerPhoneMasked}</span>}
                hint={t('tenantAdmin.transactions.detail.phoneMaskedHint')}
              />
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('tenantAdmin.transactions.detail.paymentTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              icon={<CreditCard className="h-4 w-4 text-ink-400" />}
              label={t('tenantAdmin.transactions.detail.method')}
              value={tx.paymentMethod ?? t('tenantAdmin.transactions.detail.methodUnknown')}
            />
            <DetailRow
              icon={<CreditCard className="h-4 w-4 text-ink-400" />}
              label={t('tenantAdmin.transactions.detail.card')}
              value={
                card ? (
                  <span className="tabular-nums">{card}</span>
                ) : (
                  <span className="text-ink-400 italic">
                    {t('tenantAdmin.transactions.noCard')}
                  </span>
                )
              }
            />
            <DetailRow
              icon={<Hash className="h-4 w-4 text-ink-400" />}
              label={t('tenantAdmin.transactions.detail.ePointReference')}
              value={
                tx.ePointReference ? (
                  <span className="font-mono text-xs">{tx.ePointReference}</span>
                ) : (
                  <span className="text-ink-400 italic">
                    {t('tenantAdmin.transactions.detail.pending')}
                  </span>
                )
              }
            />
          </CardContent>
        </Card>

        {/* Hardware */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('tenantAdmin.transactions.detail.hardwareTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              icon={
                tx.hardwareCreditedAt ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : isHwError ? (
                  <AlertTriangle className="h-4 w-4 text-amber" />
                ) : (
                  <Clock className="h-4 w-4 text-ink-400" />
                )
              }
              label={t('tenantAdmin.transactions.detail.creditedAt')}
              value={
                tx.hardwareCreditedAt ? (
                  formatActivityTime(tx.hardwareCreditedAt, t, new Date())
                ) : isHwError ? (
                  <span className="text-amber font-semibold">
                    {t('tenantAdmin.transactions.detail.neverCredited')}
                  </span>
                ) : (
                  <span className="text-ink-400 italic">
                    {t('tenantAdmin.transactions.detail.pending')}
                  </span>
                )
              }
            />
            {tx.errorReason && !isHwError && (
              <DetailRow
                icon={<AlertTriangle className="h-4 w-4 text-amber" />}
                label={t('tenantAdmin.transactions.detail.errorReason')}
                value={tx.errorReason}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusPill({ status }: { status: TenantTransactionStatus }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span className={`px-2.5 py-1 rounded-pill text-sm font-semibold ${tone}`}>
      {t(`tenantAdmin.dashboard.txStatus.${status}`)}
    </span>
  );
}

const STATUS_TONES: Record<TenantTransactionStatus, string> = {
  pending: 'bg-line-soft text-ink-500',
  paid_crediting: 'bg-line-soft text-ink-500',
  paid_credited: 'bg-success/10 text-success',
  paid_hardware_error: 'bg-amber-50 text-amber',
  declined: 'bg-error-50 text-error',
  cancelled: 'bg-line-soft text-ink-400',
};

function DetailRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <Card>
        <CardContent className="py-7 px-6 space-y-3">
          <div className="h-10 w-32 bg-line-soft rounded" />
          <div className="h-4 w-48 bg-line-soft rounded" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="py-6 space-y-3">
              <div className="h-3 w-24 bg-line-soft rounded" />
              <div className="h-3 w-3/4 bg-line-soft rounded" />
              <div className="h-3 w-1/2 bg-line-soft rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="py-14 flex flex-col items-center text-center">
        <p className="text-lg font-bold text-ink-900">
          {t('tenantAdmin.transactions.detail.notFoundTitle')}
        </p>
        <p className="mt-1 text-sm text-ink-500 max-w-md">
          {t('tenantAdmin.transactions.detail.notFoundBody')}
        </p>
        <Link to="/transactions" className="mt-5">
          <Button size="md" variant="outline">
            {t('tenantAdmin.transactions.backToList')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
