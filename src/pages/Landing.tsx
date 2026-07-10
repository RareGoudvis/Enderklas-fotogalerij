import { SchoolHeader } from '../components/SchoolHeader';

// Landing (/) — brief §4. Straks: leerkracht-login (per AUTH_MODE) + parent
// album-link invoer. Sprint 1 toont enkel de shell.
export default function Landing() {
  return (
    <div className="min-h-full">
      <SchoolHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink/70">
          Welkom bij de BASL-Fotogalerij. Leerkracht-login en album-links volgen in de
          volgende sprints.
        </p>
      </main>
    </div>
  );
}
