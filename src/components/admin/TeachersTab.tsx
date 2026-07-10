// Leerkrachten-tab (brief §9): CRUD op teachers.json incl. credential-beheer
// (4-letter gebruikersnaam + admin-getypt wachtwoord) en "Alle wachtwoorden wissen".

import { useEffect, useState } from 'react';
import type { TeacherRow } from '../../lib/admin';
import { adminApi } from '../../lib/admin';
import { ApiError } from '../../lib/api';
import { CLASSES } from '../../config/classes';
import { ClassPicker } from '../ClassPicker';

function label(id: string): string {
  return CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function TeachersTab() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows((await adminApi.getTeachers()).teachers);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Laden mislukt.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function edit(t: TeacherRow) {
    setUsername(t.username);
    setEmail(t.email);
    setClasses(t.classes);
    setPassword('');
  }
  function reset() {
    setUsername('');
    setEmail('');
    setClasses([]);
    setPassword('');
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await adminApi.upsertTeacher({ username, email, classes, password: password || undefined });
      reset();
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: string) {
    if (!confirm(`Leerkracht "${u}" verwijderen?`)) return;
    try {
      await adminApi.deleteTeacher(u);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Verwijderen mislukt.');
    }
  }

  async function clearAll() {
    if (!confirm('Alle wachtwoorden wissen (behalve de hoofdbeheerder)? Leerkrachten kunnen dan niet meer inloggen tot je nieuwe zet.')) return;
    try {
      const res = await adminApi.clearPasswords();
      alert(`${res.cleared} wachtwoord(en) gewist.`);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Wissen mislukt.');
    }
  }

  return (
    <div className="space-y-5">
      {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

      <div className="space-y-3 rounded-lg border border-black/10 p-4">
        <h3 className="font-semibold">Leerkracht toevoegen / bewerken</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Gebruikersnaam (4 letters)
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            E-mail
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
        </div>
        <label className="text-sm">
          Wachtwoord {username ? '(leeg = onveranderd)' : ''}
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="typ een wachtwoord om te (her)zetten"
            className="mt-1 min-h-touch w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-medium">Klassen</p>
          <ClassPicker
            selected={classes}
            onToggle={(id) =>
              setClasses((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]))
            }
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void save()}
            disabled={busy || !username || !email}
            className="min-h-touch rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
          >
            {busy ? 'Bezig…' : 'Opslaan'}
          </button>
          <button onClick={reset} className="min-h-touch rounded-lg border border-black/15 px-4 py-2">
            Leegmaken
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.username} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {t.username} · {t.email}{' '}
                {t.hasPassword ? (
                  <span className="text-xs text-green-600">wachtwoord ✓</span>
                ) : (
                  <span className="text-xs text-amber-700">geen wachtwoord</span>
                )}
              </p>
              <p className="truncate text-xs text-ink/50">{t.classes.map(label).join(', ') || '—'}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => edit(t)} className="min-h-touch rounded-lg border border-black/15 px-3 py-1.5 text-sm">
                Bewerk
              </button>
              <button onClick={() => void remove(t.username)} className="min-h-touch rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">
                Verwijder
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={() => void clearAll()}
        className="min-h-touch w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
      >
        Alle wachtwoorden wissen (nieuw schooljaar)
      </button>
    </div>
  );
}
