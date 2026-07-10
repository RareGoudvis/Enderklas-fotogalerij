import { useState } from 'react';
import { SchoolHeader } from '../components/SchoolHeader';
import { AlbumsManager } from '../components/AlbumsManager';
import { CLASSES } from '../config/classes';
import { useAuth } from '../lib/auth';

// Leerkracht-view (/uploaden) — brief §4. Kies een eigen klas en beheer de
// albums erin. Mobile-first: klaspillen bovenaan, dan de albumlijst.
export default function ContributorView() {
  const { user, logout } = useAuth();
  const myClasses = user?.classes ?? [];
  const [active, setActive] = useState<string>(myClasses[0] ?? '');

  function label(id: string): string {
    return CLASSES.find((c) => c.id === id)?.label ?? id;
  }

  return (
    <div className="min-h-full">
      <SchoolHeader subtitle="Uploaden" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-ink/60">Aangemeld als {user?.username}</p>
          <button onClick={() => void logout()} className="text-sm text-accent underline">
            Afmelden
          </button>
        </div>

        {myClasses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-ink/50">
            Je bent nog aan geen enkele klas toegewezen. Vraag de beheerder om je te koppelen.
          </p>
        ) : (
          <>
            {myClasses.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {myClasses.map((id) => (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    className={[
                      'min-h-touch rounded-full border px-3 py-1.5 text-sm',
                      id === active
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-black/15 bg-white',
                    ].join(' ')}
                  >
                    {label(id)}
                  </button>
                ))}
              </div>
            )}
            {active && <AlbumsManager classId={active} />}
          </>
        )}
      </main>
    </div>
  );
}
