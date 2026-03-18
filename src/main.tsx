import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { initMonitoring } from "@/lib/vitals";
import { initTheme } from "@/lib/theme";
import "./index.css";

initTheme();
initMonitoring();

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
