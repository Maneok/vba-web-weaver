import React from "react";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

interface PageErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
  isChunkError?: boolean;
}

export default class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  PageErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    const msg = error.message || "";
    const isChunkError = msg.includes("dynamically imported module") || msg.includes("Loading chunk") || msg.includes("Failed to fetch");
    return { hasError: true, errorMessage: msg, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("[PageError]", error, errorInfo);
    // Auto-reload once on chunk load failure (stale deployment)
    const msg = error.message || "";
    const isChunkError = msg.includes("dynamically imported module") || msg.includes("Loading chunk") || msg.includes("Failed to fetch");
    if (isChunkError) {
      const key = "chunk-reload-" + window.location.pathname;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // OPT-26: role="alert" for screen reader announcement
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 animate-fade-in-up" role="alert">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Erreur sur cette page</h2>
          <p className="text-sm text-slate-400 text-center max-w-md">
            Une erreur est survenue lors de l'affichage. Les autres pages restent accessibles.
          </p>
          {this.state.errorMessage && (
            <details className="w-full max-w-lg">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                Voir les details de l'erreur
              </summary>
              <pre className="mt-2 text-xs bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto text-slate-300">
                {this.state.errorMessage}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: undefined })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              Reessayer
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="px-4 py-2 bg-white/5 text-slate-300 rounded-md text-sm hover:bg-white/10 transition-colors"
            >
              Retour au dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
