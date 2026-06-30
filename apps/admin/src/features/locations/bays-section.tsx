import { isAxiosError } from 'axios';
import { Download, FileDown, Pencil, Plus, RefreshCw, Wifi, WifiOff, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateBay,
  useLocationBays,
  useRegenerateBayQr,
  useToggleBayStatus,
  useUpdateBay,
} from '@/hooks/use-bays';
import { useHardwareStatus } from '@/hooks/use-hardware-status';
import { downloadBayQrPdf, downloadLocationBulkQrPdf, type TenantBay } from '@/lib/bays-api';
import { sendHardwareCredit } from '@/lib/hardware-api';

/**
 * Bays section embedded in the location edit form (Phase 3.7 / B3.3 + B4.1).
 *
 * Per-row affordances:
 *  - rename (inline, click pencil → input swap → Enter to save / Esc to cancel)
 *  - set hardware identifier (same inline pattern)
 *  - toggle status (active ↔ disabled)
 *  - regenerate QR (warns about reprinting the sticker)
 *  - download QR PDF (blob fetch + trigger client-side)
 *
 * Inline "Add bay" form at the bottom — name required + optional hardware ID.
 * Enter submits. After create, the form clears and the row appears at the
 * top (server orders by createdAt asc). Toast on every mutation success.
 *
 * No delete: bays are FK-restricted by transactions so the backend doesn't
 * expose a delete route. Disabling a bay is the way to retire it.
 */
export function BaysSection({
  locationId,
  locationName,
}: {
  locationId: string;
  locationName: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useLocationBays(locationId);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const onBulkDownload = async () => {
    setBulkDownloading(true);
    try {
      await downloadLocationBulkQrPdf(locationId, locationName);
      toast.success(t('tenantAdmin.bays.toastBulkReady'));
    } catch {
      toast.error(t('tenantAdmin.bays.errors.bulkFailed'));
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">{t('tenantAdmin.bays.title')}</CardTitle>
          {data && data.length > 0 && (
            <p className="mt-1 text-sm text-ink-500 tabular-nums">
              {t('tenantAdmin.bays.count', { count: data.length })}
            </p>
          )}
        </div>
        {data && data.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onBulkDownload()}
            disabled={bulkDownloading}
          >
            <FileDown className="h-4 w-4" />
            {bulkDownloading
              ? t('tenantAdmin.bays.bulkPreparing')
              : t('tenantAdmin.bays.printAllQr')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {isError ? (
          <div className="rounded-card-sm bg-error-50 border border-error/20 px-3 py-2 text-sm text-error flex items-center justify-between">
            <span>{t('tenantAdmin.bays.loadError')}</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('tenantAdmin.dashboard.retry')}
            </button>
          </div>
        ) : isLoading ? (
          <BaysSkeleton />
        ) : data && data.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {data.map((bay) => (
              <BayRow key={bay.id} bay={bay} locationId={locationId} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500 italic">{t('tenantAdmin.bays.empty')}</p>
        )}

        <div className="pt-5 border-t border-line">
          <AddBayForm locationId={locationId} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Row ────────────────────────────────────────────────────────────

function BayRow({ bay, locationId }: { bay: TenantBay; locationId: string }) {
  const { t } = useTranslation();
  const hardwareStatus = useHardwareStatus(bay.id, Boolean(bay.hardwareIdentifier));
  const updateMut = useUpdateBay(locationId);
  const toggleMut = useToggleBayStatus(locationId);
  const regenMut = useRegenerateBayQr(locationId);

  const [editing, setEditing] = useState<'none' | 'name' | 'hardware'>('none');
  const [name, setName] = useState(bay.name);
  const [hardware, setHardware] = useState(bay.hardwareIdentifier ?? '');
  const [downloading, setDownloading] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [crediting, setCrediting] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const busy = updateMut.isPending || toggleMut.isPending || regenMut.isPending || downloading;

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === bay.name) {
      setEditing('none');
      setName(bay.name);
      return;
    }
    try {
      await updateMut.mutateAsync({ id: bay.id, input: { name: trimmed } });
      toast.success(t('tenantAdmin.bays.toastRenamed'));
      setEditing('none');
    } catch (err) {
      toast.error(extractBayErr(err, t));
      setName(bay.name);
      setEditing('none');
    }
  };

  const saveHardware = async () => {
    const trimmed = hardware.trim();
    const same = trimmed === (bay.hardwareIdentifier ?? '');
    if (same) {
      setEditing('none');
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: bay.id,
        input: { hardwareIdentifier: trimmed.length > 0 ? trimmed : null },
      });
      toast.success(t('tenantAdmin.bays.toastHardwareUpdated'));
      setEditing('none');
    } catch (err) {
      toast.error(extractBayErr(err, t));
      setHardware(bay.hardwareIdentifier ?? '');
      setEditing('none');
    }
  };

  const onToggle = async () => {
    const next = bay.status === 'active' ? 'disabled' : 'active';
    try {
      await toggleMut.mutateAsync({ id: bay.id, status: next });
      toast.success(
        next === 'active'
          ? t('tenantAdmin.bays.toastActivated')
          : t('tenantAdmin.bays.toastDisabled'),
      );
    } catch (err) {
      toast.error(extractBayErr(err, t));
    }
  };

  const onRegen = async () => {
    setConfirmRegen(false);
    try {
      await regenMut.mutateAsync(bay.id);
      toast.success(t('tenantAdmin.bays.toastQrRegenerated'));
    } catch (err) {
      toast.error(extractBayErr(err, t));
    }
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadBayQrPdf(bay);
    } catch (err) {
      toast.error(extractBayErr(err, t));
    } finally {
      setDownloading(false);
    }
  };

  const onCredit = async (amount: number) => {
    setCrediting(amount);
    try {
      await sendHardwareCredit(bay.id, amount);
      toast.success(t('tenantAdmin.bays.toastCreditSent', { amount }));
    } catch (err) {
      toast.error(extractBayErr(err, t));
    } finally {
      setCrediting(null);
    }
  };

  const onCustomCredit = () => {
    const n = Number(customAmount);
    // Та же валидация, что в прошивке/бэкенде: целое 1..100 AZN.
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      toast.error(t('tenantAdmin.bays.creditInvalid'));
      return;
    }
    void onCredit(n);
    setCustomAmount('');
  };

  return (
    <li className="py-4 first:pt-0 last:pb-0 space-y-3">
      {/* Header row: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing === 'name' ? (
            <InlineEdit
              value={name}
              onChange={setName}
              onSave={() => void saveName()}
              onCancel={() => {
                setName(bay.name);
                setEditing('none');
              }}
              disabled={busy}
              placeholder={t('tenantAdmin.bays.namePlaceholder')}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing('name')}
              className="group inline-flex items-center gap-1.5 text-left"
            >
              <span className="font-semibold text-ink-900">{bay.name}</span>
              <Pencil className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-500" />
            </button>
          )}
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-ink-500 font-mono">QR · {bay.qrShortId}</p>
            {bay.hardwareIdentifier && (
              <HardwareOnlineBadge online={hardwareStatus.data?.online ?? null} />
            )}
          </div>
        </div>
        <BayStatusBadge status={bay.status} />
      </div>

      {/* Hardware identifier */}
      <div className="text-sm flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-ink-400" />
        {editing === 'hardware' ? (
          <InlineEdit
            value={hardware}
            onChange={setHardware}
            onSave={() => void saveHardware()}
            onCancel={() => {
              setHardware(bay.hardwareIdentifier ?? '');
              setEditing('none');
            }}
            disabled={busy}
            placeholder={t('tenantAdmin.bays.hardwarePlaceholder')}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('hardware')}
            className="group inline-flex items-center gap-1.5 text-left"
          >
            <span
              className={bay.hardwareIdentifier ? 'font-mono text-ink-700' : 'text-ink-400 italic'}
            >
              {bay.hardwareIdentifier ?? t('tenantAdmin.bays.hardwareUnset')}
            </span>
            <Pencil className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-500" />
          </button>
        )}
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onDownload()}
          disabled={busy}
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? t('tenantAdmin.bays.downloading') : t('tenantAdmin.bays.downloadPdf')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onToggle()}
          disabled={busy}
        >
          {bay.status === 'active' ? t('tenantAdmin.bays.disable') : t('tenantAdmin.bays.activate')}
        </Button>
        {confirmRegen ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-pill bg-amber-50 border border-amber/20">
            <span className="text-xs text-ink-900 font-semibold">
              {t('tenantAdmin.bays.regenConfirm')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void onRegen()}
              disabled={busy}
            >
              {t('tenantAdmin.bays.regenYes')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmRegen(false)}
              disabled={busy}
            >
              {t('tenantAdmin.locations.cancel')}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRegen(true)}
            disabled={busy}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('tenantAdmin.bays.regenerateQr')}
          </Button>
        )}
      </div>

      {/* Тестовое зачисление (имитация оплаты) — только при заданном hardware ID */}
      {bay.hardwareIdentifier && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-ink-500">{t('tenantAdmin.bays.testCreditLabel')}</span>
          {[1, 5].map((amt) => (
            <Button
              key={amt}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onCredit(amt)}
              disabled={busy || crediting !== null}
            >
              {crediting === amt ? '…' : `+${amt} AZN`}
            </Button>
          ))}
          <Input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCustomCredit();
              }
            }}
            placeholder="AZN"
            disabled={busy || crediting !== null}
            className="h-8 w-20"
          />
          <Button
            type="button"
            size="sm"
            onClick={onCustomCredit}
            disabled={busy || crediting !== null || customAmount.trim() === ''}
          >
            {crediting !== null && crediting === Number(customAmount)
              ? '…'
              : t('tenantAdmin.bays.creditSend')}
          </Button>
        </div>
      )}
    </li>
  );
}

// ─── Inline edit primitive ─────────────────────────────────────────

function InlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave();
          }
          if (e.key === 'Escape') onCancel();
        }}
        className="h-8 max-w-xs"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
      >
        OK
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="text-ink-400 hover:text-ink-700"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Hardware online badge ───────────────────────────────────────────

function HardwareOnlineBadge({ online }: { online: boolean | null }) {
  const { t } = useTranslation();
  if (online === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${online ? 'text-success' : 'text-ink-400'}`}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? t('tenantAdmin.bays.hardwareOnline') : t('tenantAdmin.bays.hardwareOffline')}
    </span>
  );
}

// ─── Status badge ───────────────────────────────────────────────────

function BayStatusBadge({ status }: { status: 'active' | 'disabled' }) {
  const { t } = useTranslation();
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-pill text-xs font-semibold ${
        status === 'active' ? 'bg-success/10 text-success' : 'bg-line-soft text-ink-500'
      }`}
    >
      {t(`tenantAdmin.bays.status.${status}`)}
    </span>
  );
}

// ─── Add bay form ───────────────────────────────────────────────────

function AddBayForm({ locationId }: { locationId: string }) {
  const { t } = useTranslation();
  const createMut = useCreateBay(locationId);
  const [name, setName] = useState('');
  const [hardware, setHardware] = useState('');

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMut.mutateAsync({
        name: trimmed,
        hardwareIdentifier: hardware.trim() || null,
      });
      toast.success(t('tenantAdmin.bays.toastCreated'));
      setName('');
      setHardware('');
    } catch (err) {
      toast.error(extractBayErr(err, t));
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p className="text-sm font-semibold text-ink-900">{t('tenantAdmin.bays.addTitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="new-bay-name" className="text-xs">
            {t('tenantAdmin.bays.fieldName')}
          </Label>
          <Input
            id="new-bay-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t('tenantAdmin.bays.namePlaceholder')}
            disabled={createMut.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-bay-hardware" className="text-xs">
            {t('tenantAdmin.bays.fieldHardware')}
          </Label>
          <Input
            id="new-bay-hardware"
            value={hardware}
            onChange={(e) => setHardware(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t('tenantAdmin.bays.hardwarePlaceholder')}
            disabled={createMut.isPending}
          />
        </div>
        <Button size="md" type="submit" disabled={createMut.isPending || !name.trim()}>
          <Plus className="h-4 w-4" />
          {createMut.isPending ? t('tenantAdmin.bays.adding') : t('tenantAdmin.bays.add')}
        </Button>
      </div>
    </form>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────

function BaysSkeleton() {
  return (
    <ul className="divide-y divide-line-soft">
      {Array.from({ length: 2 }, (_, i) => (
        <li key={i} className="py-4 space-y-2">
          <div className="h-4 w-1/3 bg-line-soft rounded" />
          <div className="h-3 w-1/4 bg-line-soft rounded" />
          <div className="flex gap-2 pt-1">
            <div className="h-7 w-20 bg-line-soft rounded-pill" />
            <div className="h-7 w-16 bg-line-soft rounded-pill" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Error helper ──────────────────────────────────────────────────

function extractBayErr(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'HARDWARE_IDENTIFIER_TAKEN') return t('tenantAdmin.bays.errors.hardwareTaken');
    if (code === 'BAY_NOT_FOUND') return t('tenantAdmin.bays.errors.notFound');
    if (code === 'LOCATION_NOT_FOUND') return t('tenantAdmin.locations.errors.notFound');
    if (!err.response) return t('tenantAdmin.locations.errors.network');
  }
  return t('tenantAdmin.locations.errors.generic');
}
