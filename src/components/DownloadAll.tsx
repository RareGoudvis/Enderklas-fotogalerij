// Download-alles-knop met voortgang (R2-setup.md §4). Streamt een zip via
// client-zip; toont een hint dat het op mobiel even kan duren.

import { useState } from 'react';
import type { MediaItem } from '../lib/album-view';
import { downloadAlbumZip } from '../lib/download';

interface DownloadAllProps {
  albumName: string;
  items: MediaItem[];
}

export function DownloadAll({ albumName, items }: DownloadAllProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    setProgress({ done: 0, total: items.length });
    try {
      await downloadAlbumZip(albumName, items, (done, total) => setProgress({ done, total }));
    } catch (e) {
      // Afgebroken save-dialoog is geen echte fout.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErr(e instanceof Error ? e.message : 'Downloaden mislukt.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => void start()}
        disabled={busy}
        className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60"
      >
        {busy && progress
          ? `Bezig… ${progress.done}/${progress.total}`
          : `Download alle foto's (${items.length})`}
      </button>
      <p className="text-center text-xs text-ink/40">Dit kan even duren op mobiel.</p>
      {err ? <p className="text-center text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
