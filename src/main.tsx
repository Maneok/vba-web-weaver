import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { initMonitoring } from "@/lib/vitals";
import { initTheme } from "@/lib/theme";
import { initErrorTracking } from "@/lib/errorTracking";
import "./index.css";

initTheme();
initMonitoring();
initErrorTracking();

// Handle stale chunk errors after new deployments
// Vite emits this event when a dynamic import fails (old chunks deleted by new build)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'chunk-reload-' + window.location.pathname;
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }
});

// OPT-50: Removed duplicate unhandledrejection listener — already handled by initMonitoring() in vitals.ts

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in document");
}

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
