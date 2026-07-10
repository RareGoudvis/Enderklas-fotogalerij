// Opkuis-tab (brief §10): jaarlijkse wipe. Vereist het typen van "WISSEN".
// Verwijdert alle foto's + reset manifests; behoudt beheerders en leerkrachten.

import { useState } from 'react';
import { adminApi } from '../../lib/admin';
import { ApiError } from '../../lib/api';

export function WipeTab() {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function wipe() {
    if (!window.confirm('Definitief alle foto\'s van dit schooljaar wissen? Dit kan niet ongedaan gemaakt worden.')) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await adminApi.wipe(confirm);
      setResult(`${res.deletedObjects} objecten verwijderd (${(res.freedBytes / 1_000_000).toFixed(1)} MB vrijgemaakt).`);
      setConfirm('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Wissen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Jaarlijkse opkuis</p>
        <p className="mt-1">
          Verwijdert álle albums en foto's. Beheerders en leerkrachten (met hun klassen) blijven
          behouden voor volgend schooljaar. Typ <strong>WISSEN</strong> om te bevestigen.
        </p>
      </div>

      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="WISSEN"
        className="min-h-touch w-full rounded-lg border border-black/15 px-3 py-2 text-center font-medium tracking-widest"
      />
      <button
        onClick={() => void wipe()}
        disabled={busy || confirm !== 'WISSEN'}
        className="min-h-touch w-full rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        {busy ? 'Bezig…' : 'Alles wissen'}
      </button>

      {result ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{result}</p> : null}
      {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}
    </div>
  );
}
