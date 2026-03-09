import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { initMonitoring } from "@/lib/vitals";
import "./index.css";

initMonitoring();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
