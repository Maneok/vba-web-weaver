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
    try {
      logger.error("Unhandled", "Promise rejection:", event.reason);
    } catch {
      // Prevent monitoring from causing additional failures
    }
  });

  // Capture global errors
  window.addEventListener("error", (event) => {
    try {
      logger.error("Global", "Error:", event.message, event.filename, event.lineno);
    } catch {
      // Prevent monitoring from causing additional failures
    }
  });

  // Report basic performance metrics when available
  if ("PerformanceObserver" in window) {
    try {
      const paintObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            logger.debug("Perf", `${entry.name}: ${Math.round(entry.startTime)}ms`);
          }
        } catch {
          // Ignore reporting errors
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });

      const lcpObserver = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            logger.debug("Perf", `LCP: ${Math.round(last.startTime)}ms`);
          }
        } catch {
          // Ignore reporting errors
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Observer not supported
    }
  }
}
