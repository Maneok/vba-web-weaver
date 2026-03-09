import React from "react";
import { AlertTriangle } from "lucide-react";

interface PageErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
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
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[PageError]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Erreur sur cette page</h2>
          <p className="text-sm text-slate-400 text-center max-w-md">
            Une erreur est survenue lors de l'affichage. Les autres pages restent accessibles.
          </p>
          {this.state.errorMessage && (
            <pre className="text-xs bg-black/30 border border-white/10 rounded p-3 overflow-auto text-slate-300 max-w-lg">
              {this.state.errorMessage}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            Reessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
