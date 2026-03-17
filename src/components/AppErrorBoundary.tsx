import React from "react";
import { logger } from "@/lib/logger";
import { AlertOctagon } from "lucide-react";

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary", "Application render error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // OPT-27: role="alert" for screen reader announcement
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6" role="alert">
          <div className="max-w-xl text-center space-y-4">
            {/* OPT-15: Error icon for visual hierarchy */}
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Erreur d&apos;affichage</h1>
            <p className="text-slate-400 text-sm">
              Une erreur inattendue est survenue. Veuillez recharger la page avec Ctrl+Maj+R (ou Cmd+Maj+R sur Mac).
            </p>
            {this.state.errorMessage ? (
              <details className="w-full max-w-lg">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                  Voir les details techniques
                </summary>
                <pre className="mt-2 text-xs text-left bg-black/30 border border-white/10 rounded p-3 overflow-auto text-slate-300">
                  {this.state.errorMessage}
                </pre>
              </details>
            ) : null}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
