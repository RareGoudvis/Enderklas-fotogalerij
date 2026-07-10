// Aanmaakwizard in 3 stappen (brief §9): titel → klas-tags → bevestigen, met
// een successcherm dat meteen de sharelink + QR toont (natuurlijke flow:
// aanmaken → kopiëren → in de nieuwsbrief plakken). Bottom sheet op mobiel.

import { useState } from 'react';
import { CLASSES } from '../config/classes';
import type { Album } from '../lib/albums';
import { createAlbum } from '../lib/albums';
import { ApiError } from '../lib/api';
import { ClassPicker } from './ClassPicker';
import { Modal } from './Modal';
import { ShareCard } from './ShareCard';

interface CreateAlbumWizardProps {
  open: boolean;
  onClose: () => void;
  /** Home-klas van het nieuwe album (altijd getagd). */
  homeClassId: string;
  /** Aangeroepen na succesvolle aanmaak, zodat de lijst kan verversen. */
  onCreated: (album: Album) => void;
}

type Step = 1 | 2 | 3 | 'done';

function classLabel(id: string): string {
  return CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function CreateAlbumWizard({ open, onClose, homeClassId, onCreated }: CreateAlbumWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [classes, setClasses] = useState<string[]>([homeClassId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ album: Album; token: string } | null>(null);

  function reset() {
    setStep(1);
    setName('');
    setClasses([homeClassId]);
    setErr(null);
    setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  function toggle(classId: string) {
    if (classId === homeClassId) return; // home is verplicht
    setClasses((cur) =>
      cur.includes(classId) ? cur.filter((c) => c !== classId) : [...cur, classId],
    );
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await createAlbum(homeClassId, name.trim(), classes);
      setResult(res);
      setStep('done');
      onCreated(res.album);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Aanmaken mislukt. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === 'done' ? 'Album aangemaakt' : `Nieuw album — stap ${step} van 3`;

  return (
    <Modal open={open} onClose={close} title={title}>
      {step === 1 && (
        <div className="space-y-4">
          <label htmlFor="album-name" className="block text-sm font-medium">
            Titel van het album
          </label>
          <input
            id="album-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="bv. Schoolreis Hidrodoe"
            className="min-h-touch w-full rounded-lg border border-black/15 px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
          <button
            disabled={!name.trim()}
            onClick={() => setStep(2)}
            className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
          >
            Volgende
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-ink/60">
            Kies de klassen. De eigen klas ({classLabel(homeClassId)}) staat vast; extra klassen
            geven die leerkrachten ook toegang (bv. een graad-album).
          </p>
          <ClassPicker selected={classes} onToggle={toggle} lockedClassId={homeClassId} />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep(1)}
              className="min-h-touch rounded-lg border border-black/15 px-4 py-2 font-medium"
            >
              Terug
            </button>
            <button
              onClick={() => setStep(3)}
              className="min-h-touch rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg"
            >
              Volgende
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Titel</p>
            <p className="text-base">{name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Klassen</p>
            <p className="text-base">{classes.map(classLabel).join(', ')}</p>
          </div>
          {err ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep(2)}
              className="min-h-touch rounded-lg border border-black/15 px-4 py-2 font-medium"
            >
              Terug
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="min-h-touch rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
            >
              {busy ? 'Bezig…' : 'Album aanmaken'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <p className="text-sm text-ink/60">
            Klaar! Deel de link of QR-code — plak ze in de nieuwsbrief.
          </p>
          <ShareCard albumName={result.album.name} token={result.token} />
          <button
            onClick={close}
            className="min-h-touch w-full rounded-lg border border-black/15 px-4 py-2 font-medium"
          >
            Klaar
          </button>
        </div>
      )}
    </Modal>
  );
}
