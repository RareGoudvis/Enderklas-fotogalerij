import { useEffect, useState } from 'react';
import { SchoolHeader } from '../components/SchoolHeader';
import { DownloadAll } from '../components/DownloadAll';
import { Lightbox } from '../components/Lightbox';
import { RETENTION_NOTICE } from '../config/constants';
import type { AlbumViewData } from '../lib/album-view';
import { fetchAlbum, tokenFromHash } from '../lib/album-view';
import { ApiError } from '../lib/api';

// Publieke albumweergave (/album#tok=…) — brief §7/§8. Geen aanmelding.
export default function AlbumView() {
  const [data, setData] = useState<AlbumViewData | null>(null);
  const [state, setState] = useState<'laden' | 'klaar' | 'fout'>('laden');
  const [errMsg, setErrMsg] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const token = tokenFromHash();
    if (!token) {
      setState('fout');
      setErrMsg('Geen geldige albumlink. Gebruik de link uit de nieuwsbrief.');
      return;
    }
    fetchAlbum(token)
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

  return (
    <div className="min-h-full">
      <SchoolHeader subtitle={data?.album.name} />

      {/* Verplichte, niet-wegklikbare retentiemelding (brief §7). */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {RETENTION_NOTICE}
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
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
          <div className="space-y-5">
            <DownloadAll albumName={data.album.name} items={data.items} />

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
          </div>
        ) : null}
      </main>

      {data && lightbox !== null ? (
        <Lightbox
          items={data.items}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      ) : null}
    </div>
  );
}
