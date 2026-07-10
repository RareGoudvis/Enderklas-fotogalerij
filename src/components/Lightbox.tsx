// Lightbox met toetsenbord- en swipe-navigatie (brief §7). Blur-up: eerst de
// (gecachete) thumbnail wazig, dan het volledige beeld dat inloopt. Download
// gebeurt via fetch→blob zodat het ook op mobiel echt opslaat (een gewone link
// wordt daar als frame-navigatie afgebroken).

import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../lib/album-view';
import { composedFilename } from '../lib/album-view';

interface LightboxProps {
  items: MediaItem[];
  index: number;
  albumName: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}

export function Lightbox({ items, index, albumName, onClose, onIndex }: LightboxProps) {
  const item = items[index];
  const touchStartX = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);

  useEffect(() => {
    setLoaded(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
    touchStartX.current = null;
  }

  // Echte download: haal de bytes op en bied ze als bestand aan (werkt op mobiel).
  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(item.downloadUrl);
      if (!res.ok) throw new Error('download mislukt');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = composedFilename(albumName, item.id);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open het beeld zodat long-press/rechtsklik-opslaan nog kan.
      window.open(item.fullUrl, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  }

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm text-white/70">
          {index + 1} / {items.length}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => void download()}
            disabled={downloading}
            className="min-h-touch rounded-lg bg-white/10 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {downloading ? 'Bezig…' : 'Download'}
          </button>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="min-h-touch min-w-touch rounded-lg bg-white/10 px-3 text-2xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Blur-up placeholder: de al gecachete thumbnail, wazig, tot het volle beeld er is. */}
        <img
          key={`thumb-${item.id}`}
          src={item.thumbnailUrl}
          alt=""
          aria-hidden="true"
          className={`absolute max-h-full max-w-full scale-105 object-contain blur-xl transition-opacity duration-300 ${
            loaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <img
          key={`full-${item.id}`}
          src={item.fullUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Grote onzichtbare tik-zones links/rechts voor navigatie (desktop). */}
        <button
          onClick={prev}
          aria-label="Vorige"
          className="absolute left-0 top-0 hidden h-full w-1/4 cursor-w-resize sm:block"
        />
        <button
          onClick={next}
          aria-label="Volgende"
          className="absolute right-0 top-0 hidden h-full w-1/4 cursor-e-resize sm:block"
        />
      </div>
    </div>
  );
}
