/**
 * Web Vitals & error monitoring.
 * Reports performance metrics and unhandled errors.
 * Can be extended to send to an analytics endpoint.
 */
import { logger } from "./logger";

let _initialized = false;
export function initMonitoring() {
  if (_initialized) return;
  _initialized = true;
  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    logger.error("Unhandled", "Promise rejection:", event.reason);
  });

  // Capture global errors
  window.addEventListener("error", (event) => {
    logger.error("Global", "Error:", event.message, event.filename, event.lineno);
  });

  // Report basic performance metrics when available
  if ("PerformanceObserver" in window) {
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.debug("Perf", `${entry.name}: ${Math.round(entry.startTime)}ms`);
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          logger.debug("Perf", `LCP: ${Math.round(last.startTime)}ms`);
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Observer not supported
    }
  }
}
