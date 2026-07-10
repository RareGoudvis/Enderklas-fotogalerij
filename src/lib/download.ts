// Download-alles via client-zip streaming (R2-setup.md §4). Geen server-side zip
// op R2. We halen elke foto sequentieel op en pipen ze in een zip-stream, zodat
// het geheugen vlak blijft — ook voor grote albums op een telefoon.
//
// Waar beschikbaar streamen we rechtstreeks naar schijf via de File System
// Access API (showSaveFilePicker); anders vallen we terug op een blob-download.

import { downloadZip } from 'client-zip';
import type { MediaItem } from './album-view';
import { composedFilename, zipFilename } from './album-view';

interface SaveFilePicker {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

export async function downloadAlbumZip(
  albumName: string,
  items: MediaItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  let done = 0;

  // Async generator: haalt elke foto pas op wanneer de zip-stream ze vraagt.
  async function* files() {
    for (const item of items) {
      const res = await fetch(item.fullUrl);
      if (!res.ok) throw new Error(`Foto ${item.id} kon niet geladen worden.`);
      yield {
        name: composedFilename(albumName, item.id),
        input: res,
      };
      done += 1;
      onProgress?.(done, total);
    }
  }

  const zipResponse = downloadZip(files());
  const suggestedName = zipFilename(albumName);

  const picker = window as unknown as SaveFilePicker;
  if (picker.showSaveFilePicker) {
    // Modern pad: stream rechtstreeks naar schijf (vlak geheugen).
    const handle = await picker.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'ZIP-archief', accept: { 'application/zip': ['.zip'] } }],
    });
    const writable = await handle.createWritable();
    await zipResponse.body!.pipeTo(writable);
    return;
  }

  // Fallback: blob-download (houdt de zip in het geheugen — enkel oudere browsers).
  const blob = await zipResponse.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}
