// Deel-modal (brief §7/§9): wraps ShareCard in een bottom-sheet/modal en biedt
// intrekken (revoke) met tokenverversing.

import { useState } from 'react';
import type { Album } from '../lib/albums';
import { revokeAlbum } from '../lib/albums';
import { Modal } from './Modal';
import { ShareCard } from './ShareCard';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  album: Album;
  token: string;
  onTokenChange: (newToken: string) => void;
}

export function ShareModal({ open, onClose, album, token, onTokenChange }: ShareModalProps) {
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!confirm('Link intrekken? Alle eerder gedeelde links stoppen meteen met werken.')) return;
    setBusy(true);
    try {
      const res = await revokeAlbum(album.id);
      onTokenChange(res.token);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Delen — ${album.name}`}>
      <ShareCard albumName={album.name} token={token} onRevoke={revoke} revoking={busy} />
    </Modal>
  );
}
