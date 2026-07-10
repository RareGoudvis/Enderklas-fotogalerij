// Client-side compressie-pijplijn (R2-setup.md §3). Alle beeldbewerking gebeurt
// in de browser vóór upload. Uitvoer: WebP-hoofdbeeld + kleine WebP-thumbnail.

import type { Preset } from '../config/compression';
import { THUMB } from '../config/compression';

export interface CompressResult {
  main: Blob;
  thumb: Blob;
}

/** Video's worden op deze backend niet ondersteund (R2-setup.md §3). */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Decodeer een bestand naar een ImageBitmap. HEIC (iPhone) faalt buiten Safari
 * op createImageBitmap → val terug op een lazy-geladen heic2any (±300 KB, enkel
 * dan geladen). Safari decodeert HEIC native, dus de fallback vuurt daar zelden.
 */
async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return await createImageBitmap(blob);
  }
}

/** Schaal een bitmap naar maxDim (langste zijde, nooit opschalen) → WebP-blob. */
async function scaleToWebp(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas niet beschikbaar');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/webp', quality });
}

/**
 * Comprimeer één afbeelding volgens de gegeven preset.
 * - createImageBitmap handelt EXIF-oriëntatie native af.
 * - Skip-regel (brief §3): is het beeld al kleiner dan de thumbnailmaat, dan
 *   dient het hoofdbeeld meteen als thumbnail (geen aparte tweede pass).
 */
export async function compressImage(file: File, preset: Preset): Promise<CompressResult> {
  const bitmap = await decodeToBitmap(file);
  try {
    const main = await scaleToWebp(bitmap, preset.maxDim, preset.quality);
    const alreadyTiny = Math.max(bitmap.width, bitmap.height) <= THUMB.maxDim;
    const thumb = alreadyTiny ? main : await scaleToWebp(bitmap, THUMB.maxDim, THUMB.quality);
    return { main, thumb };
  } finally {
    bitmap.close();
  }
}
