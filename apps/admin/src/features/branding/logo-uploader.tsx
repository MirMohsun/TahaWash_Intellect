import { Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UploadError, uploadFile } from '@/lib/uploads-api';

interface LogoUploaderProps {
  /** Current logoUrl on the tenant — null when not set. */
  value: string | null;
  /** Called with the new URL after a successful R2 upload. */
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * Single-file logo uploader with preview + remove.
 *
 * Two states:
 *   - Empty: file-input button.
 *   - Set:   preview thumb + "Replace" + "Remove" buttons.
 *
 * Upload flow:
 *   1. User picks a file.
 *   2. uploadFile('logo', file) → backend signs URL → browser PUTs to R2.
 *   3. onChange(publicUrl) updates the parent form's logoUrl field.
 *   4. The actual PATCH /tenant/me happens later when the user clicks
 *      Save on the branding page — so a half-uploaded file doesn't
 *      pollute the tenant record until the user commits.
 *
 * Errors are surfaced with toast.error so QA can confirm CORS / size /
 * type problems without digging through devtools.
 */
export function LogoUploader({ value, onChange, disabled }: LogoUploaderProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadFile('logo', file);
      onChange(url);
      toast.success(
        t('tenantAdmin.branding.logoUploadSuccess', { defaultValue: 'Logo uploaded.' }),
      );
    } catch (err) {
      if (err instanceof UploadError) {
        toast.error(
          err.code === 'UNSUPPORTED_TYPE'
            ? t('tenantAdmin.branding.logoUploadBadType', {
                defaultValue: 'Use a JPEG, PNG, or WebP image.',
              })
            : err.code === 'SIZE_LIMIT'
              ? t('tenantAdmin.branding.logoUploadTooLarge', {
                  defaultValue: 'File is larger than 8 MB.',
                })
              : err.message,
        );
      } else {
        toast.error(
          t('tenantAdmin.branding.logoUploadFailed', {
            defaultValue: 'Upload failed. Try again.',
          }),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || busy}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-card-sm border border-line bg-bg-elev p-2">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-card-sm border border-line bg-bg">
            {/* Logos can be transparent — the bg-bg backstop keeps PNG alpha
                readable rather than blending into white. */}
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pick} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t('tenantAdmin.branding.logoReplace', { defaultValue: 'Replace' })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5 text-error" />
              {t('tenantAdmin.branding.logoRemove', { defaultValue: 'Remove' })}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={pick}
          disabled={busy}
          className="w-full justify-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('tenantAdmin.branding.logoUpload', { defaultValue: 'Upload logo' })}
        </Button>
      )}
      <p className="text-xs text-ink-400">
        {t('tenantAdmin.branding.logoUploadHint', {
          defaultValue: 'JPEG, PNG, or WebP · up to 8 MB.',
        })}
      </p>
    </div>
  );
}
