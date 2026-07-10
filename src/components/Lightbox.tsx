// Lightbox met toetsenbord- en swipe-navigatie (brief §7). Toont het volledige
// beeld; downloadknop gebruikt de samengestelde bestandsnaam via ?dl=1.

import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../lib/album-view';

interface LightboxProps {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}

export function Lightbox({ items, index, onClose, onIndex }: LightboxProps) {
  const item = items[index];
  const touchStartX = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

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
          <a
            href={item.downloadUrl}
            className="min-h-touch rounded-lg bg-white/10 px-3 py-2 text-sm font-medium"
          >
            Download
          </a>
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
        {!loaded ? <span className="absolute text-white/40">Laden…</span> : null}
        <img
          src={item.fullUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          className="max-h-full max-w-full object-contain"
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
