// Schoolheader met embleem — mobile-first (brief §0).
//
// PLACEHOLDER-EMBLEEM: de echte schoolmark is een circulaire SVG (3 paths,
// fill=currentColor, viewBox 0 0 292.89 292.89). Tot Ruben die paths aanlevert
// tonen we een simpele cirkel in de accentkleur. Vervang <PlaceholderEmblem/>
// door de echte paths zonder de rest te wijzigen.

interface SchoolHeaderProps {
  /** Optionele subtitel/pagina-naam rechts van de titel. */
  subtitle?: string;
}

function PlaceholderEmblem() {
  return (
    <svg
      viewBox="0 0 292.89 292.89"
      className="h-8 w-8 text-accent"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="146.445" cy="146.445" r="140" fill="none" stroke="currentColor" strokeWidth="12" />
      <circle cx="146.445" cy="146.445" r="70" />
    </svg>
  );
}

export function SchoolHeader({ subtitle }: SchoolHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <PlaceholderEmblem />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight">BASL-Fotogalerij</h1>
          {subtitle ? <p className="truncate text-sm text-ink/60">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}
