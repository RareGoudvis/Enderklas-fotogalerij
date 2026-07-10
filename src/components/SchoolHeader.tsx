// Schoolheader met het officiële logo (wordmark: embleem + "BASL Fotogalerij",
// schoolcyaan #00aad3 + ink). Mobile-first (brief §0).

import logoUrl from '../assets/logo.svg';

interface SchoolHeaderProps {
  /** Optionele subtitel/pagina-naam onder het logo. */
  subtitle?: string;
}

export function SchoolHeader({ subtitle }: SchoolHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <img
          src={logoUrl}
          alt="BASL-Fotogalerij"
          className="h-8 w-auto max-w-[70vw] object-contain sm:h-9"
        />
        {subtitle ? (
          <span className="ml-auto rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-ink/60">
            {subtitle}
          </span>
        ) : null}
      </div>
    </header>
  );
}
