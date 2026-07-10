// Globale error boundary (brief §12): vangt render-fouten op en toont een nette
// Nederlandse melding i.p.v. een wit scherm.

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Onverwachte fout:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-sm px-4 py-16 text-center">
          <p className="mb-3 text-lg font-semibold">Er ging iets mis</p>
          <p className="mb-6 text-sm text-ink/60">
            Herlaad de pagina. Blijft het fout gaan, verwittig dan de beheerder.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-touch rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg"
          >
            Herladen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
