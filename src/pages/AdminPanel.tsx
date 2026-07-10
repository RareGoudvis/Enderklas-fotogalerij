import { SchoolHeader } from '../components/SchoolHeader';

// Beheerpaneel (/beheer) — brief §9. Tabs (Albums, Leerkrachten, Beheerders,
// Opslag, Export, Opkuis) volgen in Sprint 3 en 6.
export default function AdminPanel() {
  return (
    <div className="min-h-full">
      <SchoolHeader subtitle="Beheer" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink/70">Beheerpaneel — nog in opbouw.</p>
      </main>
    </div>
  );
}
