// Gast-uitnodiging (album-gescopede upload-zonder-account). Kies geldigheid,
// mint een link (#gtok=), toon QR + kopieer, en trek alle gastlinks in.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ApiError } from '../lib/api';
import { buildGuestLink, createGuestInvite, revokeGuestInvite } from '../lib/albums';
import { Modal } from './Modal';

interface GuestInviteModalProps {
  open: boolean;
  onClose: () => void;
  album: { id: string; name: string };
}

const DAY_OPTIONS = [1, 7, 14, 30];

export function GuestInviteModal({ open, onClose, album }: GuestInviteModalProps) {
  const [days, setDays] = useState(14);
  const [invite, setInvite] = useState<{ token: string; expiresAt: number } | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset bij (her)openen.
  useEffect(() => {
    if (open) {
      setInvite(null);
      setQr('');
      setErr(null);
      setDays(14);
    }
  }, [open]);

  const link = invite ? buildGuestLink(invite.token) : '';

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 512, margin: 2 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(''));
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function mint() {
    setBusy(true);
    setErr(null);
    try {
      const res = await createGuestInvite(album.id, days);
      setInvite({ token: res.token, expiresAt: res.expiresAt });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Aanmaken mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(
      `Upload- en kijklink voor "${album.name}" (geldig tot ${new Date(
        invite!.expiresAt,
      ).toLocaleDateString('nl-BE')}):\n${link}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revoke() {
    if (!confirm('Alle gastlinks intrekken? Uitstaande links stoppen meteen met werken.')) return;
    setBusy(true);
    try {
      await revokeGuestInvite(album.id);
      setInvite(null);
      setQr('');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Intrekken mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Gast uitnodigen — ${album.name}`}>
      <div className="space-y-4">
        {err ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
        ) : null}

        {!invite ? (
          <>
            <p className="text-sm text-ink/60">
              Een gast kan met deze link foto's aan dit album toevoegen én het album bekijken — zonder
              account. De link vervalt vanzelf.
            </p>
            <label className="block text-sm font-medium">
              Geldig voor
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2"
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? 'dag' : 'dagen'}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => void mint()}
              disabled={busy}
              className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
            >
              {busy ? 'Bezig…' : 'Gastlink aanmaken'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/60">
              Geldig tot {new Date(invite.expiresAt).toLocaleDateString('nl-BE')}. Deel de link of QR
              met de gast.
            </p>
            {qr ? (
              <img
                src={qr}
                alt="QR-code naar de gastlink"
                className="mx-auto h-44 w-44 rounded-lg border border-black/10"
              />
            ) : null}
            <div className="break-all rounded-lg bg-black/5 px-3 py-2 text-sm">{link}</div>
            <button
              onClick={() => void copy()}
              className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
            >
              {copied ? 'Gekopieerd ✓' : 'Kopieer link'}
            </button>
          </>
        )}

        <button
          onClick={() => void revoke()}
          disabled={busy}
          className="min-h-touch w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Alle gasttoegang intrekken
        </button>
      </div>
    </Modal>
  );
}
