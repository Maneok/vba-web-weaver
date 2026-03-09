import React from "react";
import { logger } from "@/lib/logger";

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
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-xl text-center space-y-3">
            <h1 className="text-2xl font-semibold text-white">Erreur d&apos;affichage</h1>
            <p className="text-slate-300">
              L&apos;application a rencontre une erreur. Recharge la page (Ctrl/Cmd + Shift + R).
            </p>
            {this.state.errorMessage ? (
              <pre className="text-xs text-left bg-black/30 border border-white/10 rounded p-3 overflow-auto text-slate-300">
                {this.state.errorMessage}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
