import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SchoolHeader } from '../components/SchoolHeader';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Landing (/) — brief §4: leerkracht-login (wachtwoord-modus) + (later) parent
// album-link invoer. Mobile-first: één kolom, grote touch targets.
export default function Landing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Bestemming volgens rol: admin → beheer, contributor → uploaden.
  function destFor(role: 'admin' | 'contributor'): string {
    return role === 'admin' ? '/beheer' : '/uploaden';
  }

  // Al aangemeld (bv. terugkerend bezoek aan /)? Meteen doorsturen.
  useEffect(() => {
    if (user) navigate(destFor(user.role), { replace: true });
  }, [user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const me = await login(username, password);
      navigate(destFor(me.role), { replace: true }); // rol bepaalt de bestemming
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Aanmelden mislukt. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full">
      <SchoolHeader />
      <main className="mx-auto max-w-sm px-4 py-8">
        <h2 className="mb-1 text-xl font-semibold">Aanmelden als leerkracht</h2>
        <p className="mb-6 text-sm text-ink/60">
          Gebruik je 4-letterige gebruikersnaam en het wachtwoord dat de beheerder je gaf.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Gebruikersnaam
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-h-touch w-full rounded-lg border border-black/15 px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-touch w-full rounded-lg border border-black/15 px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              required
            />
          </div>

          {err ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="min-h-touch w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition disabled:opacity-50"
          >
            {busy ? 'Bezig…' : 'Aanmelden'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-ink/40">
          Ouders openen hun album via de link of QR-code uit de nieuwsbrief — geen aanmelding nodig.
        </p>
      </main>
    </div>
  );
}
