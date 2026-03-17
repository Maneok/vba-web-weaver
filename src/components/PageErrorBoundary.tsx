import React from "react";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

// OPT: Shared chunk error detection — avoids duplication
function isChunkLoadError(msg: string): boolean {
  return msg.includes("dynamically imported module") || msg.includes("Loading chunk") || msg.includes("Failed to fetch");
}

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
    return { hasError: true, errorMessage: msg, isChunkError: isChunkLoadError(msg) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("[PageError]", error, errorInfo);
    // Auto-reload once on chunk load failure (stale deployment)
    if (isChunkLoadError(error.message || "")) {
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
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Reessayer
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="px-5 py-2.5 bg-white/[0.06] text-slate-300 rounded-lg text-sm font-medium hover:bg-white/[0.1] transition-colors border border-white/[0.08]"
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
