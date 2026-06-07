import { ChevronDown, ChevronUp, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useCreateTenantPhoto,
  useDeleteTenantPhoto,
  usePatchTenantPhoto,
  useTenantPhotos,
} from '@/hooks/use-tenant-photos';
import type { TenantPhoto } from '@/lib/tenant-photos-api';
import { UploadError, uploadFile } from '@/lib/uploads-api';

/**
 * Photos / hero carousel manager.
 *
 * Upload flow per file:
 *   1. uploadFile('photo', f) → R2 direct PUT.
 *   2. createTenantPhoto({ url }) → DB row.
 * Server picks the next sortOrder when none is sent.
 *
 * Hero invariant: exactly zero-or-one photo has isHero=true. The server
 * handles the "demote others, promote this" flip atomically — the UI
 * just calls patch({isHero:true}).
 *
 * Reordering: arrows swap sortOrder with neighbour. Simpler than DnD and
 * works on mobile admin too.
 */
export function PhotosManager() {
  const { t } = useTranslation();
  const photosQuery = useTenantPhotos();
  const create = useCreateTenantPhoto();
  const patch = usePatchTenantPhoto();
  const del = useDeleteTenantPhoto();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const busy = uploadingCount > 0 || photosQuery.isLoading;

  const photos = photosQuery.data ?? [];

  const handleFiles = async (files: File[]) => {
    setUploadingCount(files.length);
    for (const file of files) {
      try {
        const url = await uploadFile('photo', file);
        await create.mutateAsync({ url });
      } catch (err) {
        const msg =
          err instanceof UploadError
            ? err.code === 'UNSUPPORTED_TYPE'
              ? t('tenantAdmin.branding.photoBadType', {
                  defaultValue: 'Use a JPEG, PNG, or WebP image.',
                })
              : err.code === 'SIZE_LIMIT'
                ? t('tenantAdmin.branding.photoTooLarge', {
                    defaultValue: 'File is larger than 8 MB.',
                  })
                : err.message
            : t('tenantAdmin.branding.photoUploadFailed', {
                defaultValue: 'Upload failed.',
              });
        toast.error(`${file.name}: ${msg}`);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Snapshot the File objects into a real array BEFORE resetting the
    // input. Reading e.target.files into a reference and THEN clearing
    // e.target.value empties that FileList in Chromium, so the upload
    // would silently no-op (this was the "pick a photo, nothing happens" bug).
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-picking the same file(s)
    if (picked.length === 0) return;
    void handleFiles(picked);
  };

  const swap = (idx: number, dir: -1 | 1) => {
    const a = photos[idx];
    const b = photos[idx + dir];
    if (!a || !b) return;
    // Two PATCH calls — react-query invalidates after both resolve.
    void Promise.all([
      patch.mutateAsync({ id: a.id, input: { sortOrder: b.sortOrder } }),
      patch.mutateAsync({ id: b.id, input: { sortOrder: a.sortOrder } }),
    ]);
  };

  const setHero = (id: string) => {
    void patch.mutate({ id, input: { isHero: true } });
  };

  const remove = (id: string) => {
    void del.mutate(id);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onPickFiles}
        disabled={busy}
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full justify-center"
      >
        {uploadingCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploadingCount > 0
          ? t('tenantAdmin.branding.photosUploading', {
              defaultValue: 'Uploading {{count}}…',
              count: uploadingCount,
            })
          : t('tenantAdmin.branding.photosAdd', { defaultValue: 'Add photos' })}
      </Button>
      <p className="text-xs text-ink-400">
        {t('tenantAdmin.branding.photosHint', {
          defaultValue:
            'Select one or more images. The hero photo appears on Main feed cards; the rest fill the tenant page carousel.',
        })}
      </p>

      {photos.length === 0 ? null : (
        <ul className="space-y-2">
          {photos.map((p, i) => (
            <PhotoRow
              key={p.id}
              photo={p}
              first={i === 0}
              last={i === photos.length - 1}
              onUp={() => swap(i, -1)}
              onDown={() => swap(i, 1)}
              onSetHero={() => setHero(p.id)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PhotoRowProps {
  photo: TenantPhoto;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onSetHero: () => void;
  onDelete: () => void;
}

function PhotoRow({ photo, first, last, onUp, onDown, onSetHero, onDelete }: PhotoRowProps) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 rounded-card-sm border border-line bg-bg-elev p-2">
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-card-sm border border-line bg-bg">
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 items-center gap-2">
        {photo.isHero ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            <Star className="h-3 w-3" />
            {t('tenantAdmin.branding.photoHeroBadge', { defaultValue: 'Hero' })}
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={onSetHero}>
            <Star className="h-3.5 w-3.5" />
            {t('tenantAdmin.branding.photoSetHero', { defaultValue: 'Set as hero' })}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onUp} disabled={first}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDown} disabled={last}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </li>
  );
}
