import { SchoolHeader } from '../components/SchoolHeader';

// Publieke albumweergave (/album#tok=…) — brief §7/§8. Token in de URL-hash,
// retentiebanner, galerij, lightbox, downloads. Volgt in Sprint 5.
export default function AlbumView() {
  return (
    <div className="min-h-full">
      <SchoolHeader subtitle="Album" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink/70">Albumweergave — nog in opbouw.</p>
      </main>
    </div>
  );
}
