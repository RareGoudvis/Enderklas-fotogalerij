// Albumbeheer voor één klas: lijst + aanmaken (wizard) + delen (modal) +
// verwijderen. Gedeeld door de leerkracht-view en het beheerpaneel.

import { useCallback, useEffect, useState } from 'react';
import { CLASSES } from '../config/classes';
import type { Album } from '../lib/albums';
import { buildShareLink, deleteAlbum, listAlbums } from '../lib/albums';
import { ApiError } from '../lib/api';
import { CreateAlbumWizard } from './CreateAlbumWizard';
import { GuestInviteModal } from './GuestInviteModal';
import { ShareModal } from './ShareModal';
import { UploadZone } from './UploadZone';

interface AlbumsManagerProps {
  classId: string;
}

function classLabel(id: string): string {
  return CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function AlbumsManager({ classId }: AlbumsManagerProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Album | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Album | null>(null);
  const [guestTarget, setGuestTarget] = useState<Album | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listAlbums(classId);
      setAlbums(res.albums);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Kon albums niet laden.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(album: Album) {
    if (!confirm(`Album "${album.name}" definitief verwijderen? Alle foto's gaan verloren.`)) return;
    try {
      await deleteAlbum(album.id);
      setAlbums((cur) => cur.filter((a) => a.id !== album.id));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Verwijderen mislukt.');
    }
  }

  function onTokenChange(albumId: string, token: string) {
    setAlbums((cur) => cur.map((a) => (a.id === albumId ? { ...a, token } : a)));
    setShareTarget((cur) => (cur && cur.id === albumId ? { ...cur, token } : cur));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Albums — {classLabel(classId)}</h3>
        <button
          onClick={() => setWizardOpen(true)}
          className="min-h-touch rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
        >
          + Nieuw album
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Laden…</p>
      ) : err ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      ) : albums.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-ink/50">
          Nog geen albums in deze klas. Maak er één aan om te beginnen.
        </p>
      ) : (
        <ul className="space-y-2">
          {albums.map((album) => (
            <li
              key={album.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{album.name}</p>
                <p className="truncate text-xs text-ink/50">
                  {album.classes.map(classLabel).join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  onClick={() => album.token && window.open(buildShareLink(album.token), '_blank', 'noopener')}
                  className="min-h-touch rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium"
                >
                  Bekijken
                </button>
                <button
                  onClick={() => setUploadTarget(album)}
                  className="min-h-touch rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
                >
                  Upload
                </button>
                <button
                  onClick={() => setShareTarget(album)}
                  className="min-h-touch rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium"
                >
                  Delen
                </button>
                <button
                  onClick={() => setGuestTarget(album)}
                  className="min-h-touch rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium"
                >
                  Gast
                </button>
                <button
                  onClick={() => onDelete(album)}
                  aria-label={`Verwijder ${album.name}`}
                  className="min-h-touch rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700"
                >
                  Verwijder
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAlbumWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        homeClassId={classId}
        onCreated={() => void load()}
      />

      {shareTarget && shareTarget.token ? (
        <ShareModal
          open={true}
          onClose={() => setShareTarget(null)}
          album={shareTarget}
          token={shareTarget.token}
          onTokenChange={(t) => onTokenChange(shareTarget.id, t)}
        />
      ) : null}

      {uploadTarget ? (
        <UploadZone
          open={true}
          onClose={() => setUploadTarget(null)}
          album={uploadTarget}
          onUploaded={() => void load()}
        />
      ) : null}

      {guestTarget ? (
        <GuestInviteModal
          open={true}
          onClose={() => setGuestTarget(null)}
          album={guestTarget}
        />
      ) : null}
    </div>
  );
}
