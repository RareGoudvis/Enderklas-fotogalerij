// Opslag-tab (brief §6/§9): gebruik per klas, cap-waarschuwing, vastgepinde
// preset, en de admin-only Noodupload-bypass (enkel zichtbaar bij bereikte cap).

import { useEffect, useState } from 'react';
import type { PresetName } from '../../config/compression';
import { CLASSES } from '../../config/classes';
import type { StorageOverview } from '../../lib/admin';
import { adminApi } from '../../lib/admin';
import { ApiError } from '../../lib/api';

function label(id: string): string {
  return CLASSES.find((c) => c.id === id)?.label ?? id;
}
function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function StorageTab() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [pinned, setPinned] = useState<PresetName | ''>('');
  const [err, setErr] = useState<string | null>(null);
  const [bypassUntil, setBypassUntil] = useState<number | null>(null);

  async function load() {
    try {
      const [s, settings] = await Promise.all([adminApi.getStorage(), adminApi.getSettings()]);
      setData(s);
      setPinned(settings.pinnedPreset ?? '');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Laden mislukt.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function savePinned(value: PresetName | '') {
    setPinned(value);
    try {
      await adminApi.setPinnedPreset(value === '' ? null : value);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Opslaan mislukt.');
    }
  }

  async function armBypass() {
    if (!data) return;
    const ok = confirm(
      `Noodupload aanzetten voor 60 minuten?\n\nHuidig gebruik: ${data.usedGb.toFixed(2)} GB (cap ${data.capGb} GB).\nExtra opslag kost ±€0,015/GB/maand. Dit geldt enkel voor jouw sessie en stopt vanzelf.`,
    );
    if (!ok) return;
    try {
      const res = await adminApi.armBypass();
      setBypassUntil(res.bypassUntil);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Mislukt.');
    }
  }

  if (err) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!data) return <p className="text-ink/50">Laden…</p>;

  return (
    <div className="space-y-5">
      {data.capReached ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Opslag vol ({data.usedGb.toFixed(2)} / {data.capGb} GB). Uploads worden geweigerd.
        </p>
      ) : data.warn ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Let op: {data.usedGb.toFixed(2)} GB gebruikt van {data.capGb} GB.
        </p>
      ) : (
        <p className="text-sm text-ink/60">
          Totaal gebruikt: {data.usedGb.toFixed(2)} GB van {data.capGb} GB.
        </p>
      )}

      <label className="block text-sm font-medium">
        Compressie-preset
        <select
          value={pinned}
          onChange={(e) => void savePinned(e.target.value as PresetName | '')}
          className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2"
        >
          <option value="">Automatisch (op basis van gebruik)</option>
          <option value="hoog">Vastgezet: hoog</option>
          <option value="normaal">Vastgezet: normaal</option>
          <option value="zuinig">Vastgezet: zuinig</option>
        </select>
      </label>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="py-1">Klas</th>
              <th className="py-1">Albums</th>
              <th className="py-1">Foto's</th>
              <th className="py-1">Grootte</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((c) => (
              <tr key={c.id} className="border-t border-black/5">
                <td className="py-1">{label(c.id)}</td>
                <td className="py-1">{c.albums}</td>
                <td className="py-1">{c.photos}</td>
                <td className="py-1">{mb(c.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.capReached ? (
        <div className="rounded-lg border border-red-200 p-3">
          <p className="mb-2 text-sm font-medium text-red-800">Noodupload</p>
          {bypassUntil ? (
            <p className="text-sm text-ink/70">
              Bypass actief tot {new Date(bypassUntil).toLocaleTimeString('nl-BE')}.
            </p>
          ) : (
            <button
              onClick={() => void armBypass()}
              className="min-h-touch rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              Noodupload aanzetten (60 min)
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
