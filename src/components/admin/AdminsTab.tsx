// Beheerders-tab (brief §9): admins.json beheren. Bootstrap-admin wordt getoond
// maar is niet verwijderbaar.

import { useEffect, useState } from 'react';
import type { AdminRow } from '../../lib/admin';
import { adminApi } from '../../lib/admin';
import { ApiError } from '../../lib/api';

export function AdminsTab() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setRows((await adminApi.getAdmins()).admins);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Laden mislukt.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setErr(null);
    try {
      await adminApi.addAdmin(email);
      setEmail('');
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Toevoegen mislukt.');
    }
  }
  async function remove(e: string) {
    if (!confirm(`Beheerder "${e}" verwijderen?`)) return;
    try {
      await adminApi.deleteAdmin(e);
      await load();
    } catch (err2) {
      alert(err2 instanceof ApiError ? err2.message : 'Verwijderen mislukt.');
    }
  }

  return (
    <div className="space-y-4">
      {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nieuwe-beheerder@broeders.be"
          className="min-h-touch flex-1 rounded-lg border border-black/15 px-3 py-2"
        />
        <button
          onClick={() => void add()}
          disabled={!email.includes('@')}
          className="min-h-touch rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
        >
          Toevoegen
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.email} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-3">
            <span className="truncate">
              {a.email}{' '}
              {a.bootstrap ? <span className="text-xs text-ink/50">(hoofdbeheerder)</span> : null}
            </span>
            {!a.bootstrap ? (
              <button onClick={() => void remove(a.email)} className="min-h-touch rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">
                Verwijder
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
