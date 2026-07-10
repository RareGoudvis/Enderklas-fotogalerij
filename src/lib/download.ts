// Download-alles via client-zip streaming (R2-setup.md §4). Geen server-side zip
// op R2. We halen elke foto sequentieel op en pipen ze in een zip-stream, zodat
// het geheugen vlak blijft — ook voor grote albums op een telefoon.
//
// Waar beschikbaar streamen we rechtstreeks naar schijf via de File System
// Access API (showSaveFilePicker); anders vallen we terug op een blob-download.

import { downloadZip } from 'client-zip';
import { SCHOOLJAAR } from '../config/constants';
import type { MediaItem } from './album-view';
import { composedFilename, slugify, zipFilename } from './album-view';

interface SaveFilePicker {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

// Sla een zip-Response op: stream naar schijf waar mogelijk, anders blob-fallback.
async function saveZip(zipResponse: Response, suggestedName: string): Promise<void> {
  const picker = window as unknown as SaveFilePicker;
  if (picker.showSaveFilePicker) {
    const handle = await picker.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'ZIP-archief', accept: { 'application/zip': ['.zip'] } }],
    });
    const writable = await handle.createWritable();
    await zipResponse.body!.pipeTo(writable);
    return;
  }
  const blob = await zipResponse.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

interface ExportAlbum {
  name: string;
  items: { id: string; url: string }[];
}

/**
 * Per-klas export-zip (brief §9): albummappen met samengestelde bestandsnamen,
 * sequentieel gestreamd. Lege albums zijn er serverkant al uit gefilterd.
 */
export async function downloadClassExport(
  classId: string,
  albums: ExportAlbum[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = albums.reduce((s, a) => s + a.items.length, 0);
  let done = 0;
  async function* files() {
    for (const album of albums) {
      const folder = slugify(album.name);
      for (const item of album.items) {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`Foto ${item.id} kon niet geladen worden.`);
        yield { name: `${folder}/${composedFilename(album.name, item.id)}`, input: res };
        done += 1;
        onProgress?.(done, total);
      }
    }
  }
  await saveZip(downloadZip(files()), `basl-export-${SCHOOLJAAR}-${classId}.zip`);
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

  await saveZip(downloadZip(files()), zipFilename(albumName));
}
