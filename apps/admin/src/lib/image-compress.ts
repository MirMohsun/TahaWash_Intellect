/**
 * Client-side image downscale + re-compress, run just before upload.
 *
 * Why client-side: uploads go browser → R2 directly (presigned PUT), so the
 * backend never holds the bytes and can't resize them. Doing it in the
 * browser caps the real upload size, speeds the PUT, and keeps R2 storage
 * small — without any server image-processing infra.
 *
 * Behaviour:
 *   - Scales the longest edge down to `maxDim` (no upscaling).
 *   - Re-encodes at `quality` for lossy formats (jpeg/webp). PNG stays PNG
 *     and lossless so logo transparency is preserved.
 *   - Keeps the original MIME type, so the backend content-type allowlist
 *     and the signed Content-Type still match.
 *   - Returns the original file untouched if it's already small enough, if
 *     the format can't be processed, or if anything throws — compression is
 *     an optimization, never a hard dependency.
 */
export interface CompressOptions {
  /** Longest-edge cap in px. Default 1600 — plenty for logos + gallery. */
  maxDim?: number;
  /** Quality 0..1 for lossy re-encode. Default 0.85. */
  quality?: number;
  /** Skip work entirely for files already under this many bytes. Default 256 KB. */
  skipUnderBytes?: number;
}

const PROCESSABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.85;
  const skipUnderBytes = opts.skipUnderBytes ?? 256 * 1024;

  if (!PROCESSABLE.has(file.type)) return file;
  if (file.size <= skipUnderBytes) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    // Nothing to gain: already within bounds and re-encoding may not shrink it.
    if (scale === 1 && file.type === 'image/png') {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, quality),
    );
    if (!blob || blob.size >= file.size) return file; // never make it bigger

    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
