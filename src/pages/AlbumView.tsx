import { useCallback, useEffect, useState } from 'react';
import { SchoolHeader } from '../components/SchoolHeader';
import { Lightbox } from '../components/Lightbox';
import { UploadZone } from '../components/UploadZone';
import { RETENTION_NOTICE } from '../config/constants';
import type { AlbumViewData } from '../lib/album-view';
import { fetchAlbum, tokenFromHash } from '../lib/album-view';
import { ApiError } from '../lib/api';

// Publieke albumweergave (/album#tok=… of #gtok=…) — brief §7/§8. Geen aanmelding.
// Bij een gast-token (#gtok=) mag de bezoeker ook foto's toevoegen.
export default function AlbumView() {
  const [data, setData] = useState<AlbumViewData | null>(null);
  const [state, setState] = useState<'laden' | 'klaar' | 'fout'>('laden');
  const [errMsg, setErrMsg] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const load = useCallback((tok: string) => {
    fetchAlbum(tok)
      .then((d) => {
        setData(d);
        setState('klaar');
      })
      .catch((e) => {
        setState('fout');
        setErrMsg(
          e instanceof ApiError && e.status === 401
            ? 'Deze link is ongeldig of ingetrokken.'
            : 'Kon het album niet laden.',
        );
      });
  }, []);

  useEffect(() => {
    const parsed = tokenFromHash();
    if (!parsed) {
      setState('fout');
      setErrMsg('Geen geldige albumlink. Gebruik de link uit de nieuwsbrief.');
      return;
    }
    setToken(parsed.token);
    setIsGuest(parsed.kind === 'guest');
    load(parsed.token);
  }, [load]);

  // Gast mag uploaden als de server dat bevestigt (canUpload) — server-autoritair.
  const canUpload = isGuest && data?.album.canUpload === true;

  return (
    <div className="min-h-full">
      <SchoolHeader subtitle={data?.album.name} homeLink={false} />

      {/* Verplichte, niet-wegklikbare retentiemelding (brief §7). */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {RETENTION_NOTICE}
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {canUpload ? (
          <button
            onClick={() => setUploadOpen(true)}
            className="mb-5 min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg"
          >
            + Foto's toevoegen
          </button>
        ) : null}

        {state === 'laden' ? (
          <p className="py-12 text-center text-ink/50">Album laden…</p>
        ) : state === 'fout' ? (
          <p className="rounded-lg bg-red-50 px-4 py-8 text-center text-sm text-red-700">
            {errMsg}
          </p>
        ) : data && data.items.length === 0 ? (
          <p className="py-12 text-center text-ink/50">
            Dit album is nog leeg. Kom later terug — de foto's worden nog toegevoegd.
          </p>
        ) : data ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {data.items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setLightbox(i)}
                className="aspect-square overflow-hidden rounded-md bg-black/5"
              >
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </main>

      {data && lightbox !== null ? (
        <Lightbox
          items={data.items}
          index={lightbox}
          albumName={data.album.name}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      ) : null}

      {canUpload && token && data ? (
        <UploadZone
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          album={{ id: data.album.id, name: data.album.name }}
          authToken={token}
          onUploaded={() => load(token)}
        />
      ) : null}
    </div>
  );
}
