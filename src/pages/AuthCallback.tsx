import { SchoolHeader } from '../components/SchoolHeader';

// OAuth-callback (/auth/callback) — enkel relevant in SSO-modus (brief §4).
// v1 draait op wachtwoord-auth; dit is de seam voor later (brief §14). Niet
// geïmplementeerd in v1.
export default function AuthCallback() {
  return (
    <div className="min-h-full">
      <SchoolHeader subtitle="Aanmelden" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink/70">SSO-aanmelding is niet actief in deze versie.</p>
      </main>
    </div>
  );
}
