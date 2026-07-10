// Foto-beheer per album (staff, GDPR consent-fix). Thumbnailraster met een
// verwijderknop per foto. Draait enkel in het staff-gebied (achter login), dus
// geen impact op het ouderverkeer. Verwijderen gebruikt de sessiecookie; de
// server dwingt canManageAlbum af.

import { useCallback, useEffect, useState } from 'react';
import type { Album } from '../lib/albums';
import { deletePhoto } from '../lib/albums';
import type { MediaItem } from '../lib/album-view';
import { fetchAlbum } from '../lib/album-view';
import { ApiError } from '../lib/api';
import { Modal } from './Modal';

interface PhotoManagerProps {
  open: boolean;
  onClose: () => void;
  album: Album;
}

export function PhotoManager({ open, onClose, album }: PhotoManagerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [state, setState] = useState<'laden' | 'klaar' | 'fout'>('laden');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!album.token) return;
    setState('laden');
    try {
      const data = await fetchAlbum(album.token);
      setItems(data.items);
      setState('klaar');
    } catch {
      setState('fout');
    }
  }, [album.token]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function remove(item: MediaItem) {
    if (!confirm('Deze foto definitief verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
    setBusyId(item.id);
    try {
      await deletePhoto(album.id, item.id);
      setItems((cur) => cur.filter((i) => i.id !== item.id)); // optimistisch weg
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Verwijderen mislukt.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Foto's — ${album.name}`}>
      <div className="space-y-3">
        <p className="text-xs text-ink/50">
          Tik op het kruisje om een foto te verwijderen (bv. een kind zonder toestemming). De foto
          verdwijnt meteen uit de galerij.
        </p>

        {state === 'laden' ? (
          <p className="py-8 text-center text-ink/50">Laden…</p>
        ) : state === 'fout' ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Kon de foto's niet laden.
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/50">Dit album heeft nog geen foto's.</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="relative aspect-square overflow-hidden rounded-md bg-black/5">
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => void remove(item)}
                  disabled={busyId === item.id}
                  aria-label="Foto verwijderen"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-lg leading-none text-white disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
