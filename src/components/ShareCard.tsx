// Herbruikbare deel-inhoud: QR + link + kopieer/download, optioneel intrekken.
// Gebruikt door de ShareModal én het successcherm van de aanmaakwizard.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildShareLink, buildShareText } from '../lib/albums';

interface ShareCardProps {
  albumName: string;
  token: string;
  /** Optionele intrek-actie (niet getoond in de aanmaakwizard). */
  onRevoke?: () => void | Promise<void>;
  revoking?: boolean;
}

export function ShareCard({ albumName, token, onRevoke, revoking }: ShareCardProps) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const link = buildShareLink(token);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { width: 512, margin: 2 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(''));
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy() {
    await navigator.clipboard.writeText(buildShareText(albumName, token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `qr-${albumName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {qr ? (
        <img
          src={qr}
          alt="QR-code naar het album"
          className="mx-auto h-48 w-48 rounded-lg border border-black/10"
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center text-sm text-ink/40">
          QR laden…
        </div>
      )}

      <div className="break-all rounded-lg bg-black/5 px-3 py-2 text-sm">{link}</div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copy}
          className="min-h-touch rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
        >
          {copied ? 'Gekopieerd ✓' : 'Kopieer link'}
        </button>
        <button
          onClick={downloadQr}
          className="min-h-touch rounded-lg border border-black/15 px-3 py-2 text-sm font-medium"
        >
          Download QR (PNG)
        </button>
      </div>

      {onRevoke ? (
        <button
          onClick={() => void onRevoke()}
          disabled={revoking}
          className="min-h-touch w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          {revoking ? 'Bezig…' : 'Link intrekken'}
        </button>
      ) : null}

      <p className="text-xs text-ink/50">
        De retentiemelding wordt automatisch aan de gekopieerde tekst toegevoegd, zodat ze mee in de
        nieuwsbrief belandt.
      </p>
    </div>
  );
}
