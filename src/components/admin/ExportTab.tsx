// Export-tab (brief §9): "Exporteer alles" → sequentiële per-klas streaming-zips
// (client-zip). Lege klassen worden overgeslagen; per klas voortgang + retry.

import { useState } from 'react';
import { CLASSES } from '../../config/classes';
import { adminApi } from '../../lib/admin';
import { ApiError } from '../../lib/api';
import { downloadClassExport } from '../../lib/download';

type Status = 'wachten' | 'bezig' | 'klaar' | 'leeg' | 'fout';

export function ExportTab() {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  function set(id: string, s: Status) {
    setStatus((cur) => ({ ...cur, [id]: s }));
  }

  async function exportClass(id: string) {
    set(id, 'bezig');
    try {
      const { albums } = await adminApi.getExport(id);
      if (albums.length === 0) {
        set(id, 'leeg');
        return;
      }
      await downloadClassExport(id, albums);
      set(id, 'klaar');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        set(id, 'wachten');
        return;
      }
      set(id, 'fout');
      if (!(e instanceof ApiError)) console.error(e);
    }
  }

  async function exportAll() {
    setRunning(true);
    for (const c of CLASSES) {
      // eslint-disable-next-line no-await-in-loop
      await exportClass(c.id);
    }
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Exporteert per klas een zip met alle foto's (albummappen, samengestelde
        bestandsnamen). Best op een computer met een stabiele verbinding.
      </p>
      <button
        onClick={() => void exportAll()}
        disabled={running}
        className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60"
      >
        {running ? 'Bezig met exporteren…' : 'Exporteer alles'}
      </button>

      <ul className="space-y-1 text-sm">
        {CLASSES.map((c) => {
          const s = status[c.id] ?? 'wachten';
          return (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2">
              <span>{c.label}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={s} />
                {s === 'fout' ? (
                  <button onClick={() => void exportClass(c.id)} className="text-accent underline">
                    opnieuw
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    wachten: 'text-ink/40',
    bezig: 'text-ink/60',
    klaar: 'text-green-600',
    leeg: 'text-ink/40',
    fout: 'text-red-600',
  };
  const text: Record<Status, string> = {
    wachten: '—',
    bezig: 'bezig…',
    klaar: 'klaar ✓',
    leeg: 'leeg',
    fout: 'fout',
  };
  return <span className={map[status]}>{text[status]}</span>;
}
