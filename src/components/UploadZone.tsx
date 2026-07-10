// UploadZone (R2-setup.md §3, brief §6). Kiezen uit de camera-roll is
// eerste-klas op mobiel. Per bestand: comprimeren (WebP + thumb) → uploaden,
// met voortgang en per-bestand retry; een mislukt bestand stopt de batch niet.
// Registratie bij het manifest is gedebouncet (≈1× per 10 + aan het einde).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PRESETS } from '../config/compression';
import type { PresetName } from '../config/compression';
import { getStorageStatus, registerUpload, uploadPhoto } from '../lib/albums';
import { compressImage, isVideoFile } from '../lib/compress';
import { ApiError } from '../lib/api';
import { runPool } from '../lib/pool';
import { Modal } from './Modal';

interface UploadZoneProps {
  open: boolean;
  onClose: () => void;
  /** Minimale albumvorm — werkt voor staff (Album) én gast (AlbumMeta). */
  album: { id: string; name: string };
  /** Gast-uploadtoken; afwezig = staff-sessie (cookie). */
  authToken?: string;
  onUploaded: () => void;
}

type ItemState = 'wachten' | 'comprimeren' | 'uploaden' | 'klaar' | 'fout' | 'video';

interface Item {
  id: string;
  file: File;
  name: string;
  state: ItemState;
  progress: number; // 0..1 tijdens uploaden
  error?: string;
}

const COMPRESS_CONCURRENCY = 3; // pool van 3 houdt de UI vlot (R2-setup.md §3)
const REGISTER_EVERY = 10; // debounce: registreer ~1× per 10 bestanden

let counter = 0;
const nextId = () => `f${counter++}`;

export function UploadZone({ open, onClose, album, authToken, onUploaded }: UploadZoneProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [preset, setPreset] = useState<PresetName | null>(null);
  const [capReached, setCapReached] = useState(false);
  const [running, setRunning] = useState(false);
  const doneSinceRegister = useRef(0);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    getStorageStatus(authToken)
      .then((s) => {
        setPreset(s.preset);
        setCapReached(s.capReached);
      })
      .catch(() => setPreset('hoog'));
  }, [open, authToken]);

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Verwerk één bestand: comprimeren → uploaden. Gooit bij falen.
  const processItem = useCallback(
    async (item: Item, presetName: PresetName) => {
      update(item.id, { state: 'comprimeren', error: undefined });
      const { main, thumb } = await compressImage(item.file, PRESETS[presetName]);
      update(item.id, { state: 'uploaden', progress: 0 });
      await uploadPhoto(album.id, main, thumb, (f) => update(item.id, { progress: f }), authToken);
      update(item.id, { state: 'klaar', progress: 1 });

      // Gedebouncede registratie.
      doneSinceRegister.current += 1;
      if (doneSinceRegister.current >= REGISTER_EVERY) {
        doneSinceRegister.current = 0;
        await registerUpload(album.id, authToken).catch(() => {});
      }
    },
    [album.id, authToken, update],
  );

  const runBatch = useCallback(
    async (queue: Item[], presetName: PresetName) => {
      setRunning(true);
      await runPool(queue, COMPRESS_CONCURRENCY, async (item) => {
        try {
          await processItem(item, presetName);
        } catch (e) {
          update(item.id, {
            state: 'fout',
            error: e instanceof ApiError ? e.message : 'Mislukt',
          });
        }
      });
      // Slotregistratie zodat de laatste bestanden zeker meetellen.
      await registerUpload(album.id, authToken).catch(() => {});
      doneSinceRegister.current = 0;
      setRunning(false);
      onUploaded();
    },
    [album.id, authToken, onUploaded, processItem, update],
  );

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // toestaan om dezelfde bestanden opnieuw te kiezen
    if (files.length === 0 || !preset) return;

    const newItems: Item[] = files.map((file) => ({
      id: nextId(),
      file,
      name: file.name,
      state: isVideoFile(file) ? 'video' : 'wachten',
      progress: 0,
    }));
    setItems((cur) => [...cur, ...newItems]);

    const toProcess = newItems.filter((it) => it.state !== 'video');
    if (toProcess.length) void runBatch(toProcess, preset);
  }

  async function retry(item: Item) {
    if (!preset) return;
    try {
      await processItem(item, preset);
    } catch (e) {
      update(item.id, { state: 'fout', error: e instanceof ApiError ? e.message : 'Mislukt' });
    }
  }

  const videoRejected = items.some((it) => it.state === 'video');

  return (
    <Modal open={open} onClose={onClose} title={`Uploaden — ${album.name}`}>
      <div className="space-y-4">
        {capReached ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Opslag vol — verwittig de beheerder. Uploaden is tijdelijk niet mogelijk.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="sr-only">Foto's kiezen</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onPick}
                disabled={!preset || running}
                className="block w-full text-sm file:mr-3 file:min-h-touch file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-medium file:text-accent-fg"
              />
            </label>
            <p className="text-xs text-ink/50">
              Kwaliteit: {preset ?? '…'} · Kies foto's uit je camera-roll of galerij. Video's worden
              niet ondersteund.
            </p>
          </>
        )}

        {videoRejected ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Video's worden in deze versie nog niet ondersteund — enkel foto's.
          </p>
        ) : null}

        {items.length > 0 ? (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <ItemBadge item={it} onRetry={() => void retry(it)} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}

function ItemBadge({ item, onRetry }: { item: Item; onRetry: () => void }) {
  switch (item.state) {
    case 'klaar':
      return <span className="text-green-600">✓</span>;
    case 'uploaden':
      return <span className="text-ink/60">{Math.round(item.progress * 100)}%</span>;
    case 'comprimeren':
      return <span className="text-ink/50">comprimeren…</span>;
    case 'wachten':
      return <span className="text-ink/40">wachten…</span>;
    case 'video':
      return <span className="text-amber-700">video ✗</span>;
    case 'fout':
      return (
        <button onClick={onRetry} className="text-red-700 underline" title={item.error}>
          opnieuw
        </button>
      );
  }
}
