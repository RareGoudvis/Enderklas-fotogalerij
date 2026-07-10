import { useState } from 'react';
import { SchoolHeader } from '../components/SchoolHeader';
import { AlbumsManager } from '../components/AlbumsManager';
import { AdminsTab } from '../components/admin/AdminsTab';
import { ExportTab } from '../components/admin/ExportTab';
import { StorageTab } from '../components/admin/StorageTab';
import { TeachersTab } from '../components/admin/TeachersTab';
import { WipeTab } from '../components/admin/WipeTab';
import { CLASSES, GROUP_LABELS } from '../config/classes';
import type { ClassGroup } from '../config/classes';
import { useAuth } from '../lib/auth';

// Beheerpaneel (/beheer) — brief §9. Alle tabbladen functioneel.
type Tab = 'albums' | 'leerkrachten' | 'beheerders' | 'opslag' | 'export' | 'opkuis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'albums', label: 'Albums' },
  { id: 'leerkrachten', label: 'Leerkrachten' },
  { id: 'beheerders', label: 'Beheerders' },
  { id: 'opslag', label: 'Opslag' },
  { id: 'export', label: 'Export' },
  { id: 'opkuis', label: 'Opkuis' },
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

        {tab === 'albums' && (
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
        )}
        {tab === 'leerkrachten' && <TeachersTab />}
        {tab === 'beheerders' && <AdminsTab />}
        {tab === 'opslag' && <StorageTab />}
        {tab === 'export' && <ExportTab />}
        {tab === 'opkuis' && <WipeTab />}
      </main>
    </div>
  );
}
