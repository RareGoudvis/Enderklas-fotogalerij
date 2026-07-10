import { useState } from 'react';
import { SchoolHeader } from '../components/SchoolHeader';
import { AlbumsManager } from '../components/AlbumsManager';
import { CLASSES, GROUP_LABELS } from '../config/classes';
import type { ClassGroup } from '../config/classes';
import { useAuth } from '../lib/auth';

// Beheerpaneel (/beheer) — brief §9. Sprint 3 levert het functionele Albums-tab
// (alle klassen); de overige tabs volgen in Sprint 6.
type Tab = 'albums' | 'leerkrachten' | 'beheerders' | 'opslag' | 'export' | 'opkuis';

const TABS: { id: Tab; label: string; ready: boolean }[] = [
  { id: 'albums', label: 'Albums', ready: true },
  { id: 'leerkrachten', label: 'Leerkrachten', ready: false },
  { id: 'beheerders', label: 'Beheerders', ready: false },
  { id: 'opslag', label: 'Opslag', ready: false },
  { id: 'export', label: 'Export', ready: false },
  { id: 'opkuis', label: 'Opkuis', ready: false },
];

const GROUP_ORDER: ClassGroup[] = ['kleuter', 'lager', 'school'];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('albums');
  const [classId, setClassId] = useState<string>(CLASSES[0].id);

  return (
    <div className="min-h-full">
      <SchoolHeader subtitle="Beheer" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-ink/60">Beheerder: {user?.username}</p>
          <button onClick={() => void logout()} className="text-sm text-accent underline">
            Afmelden
          </button>
        </div>

        {/* Tabbladen — horizontaal scrollbaar op mobiel. */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'min-h-touch shrink-0 rounded-lg px-3 py-2 text-sm font-medium',
                t.id === tab ? 'bg-accent text-accent-fg' : 'bg-black/5 text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'albums' ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Klas
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2 text-base"
              >
                {GROUP_ORDER.map((group) => (
                  <optgroup key={group} label={GROUP_LABELS[group]}>
                    {CLASSES.filter((c) => c.group === group).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <AlbumsManager classId={classId} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-ink/50">
            Dit tabblad ({TABS.find((t) => t.id === tab)?.label}) volgt in een latere sprint.
          </p>
        )}
      </main>
    </div>
  );
}
