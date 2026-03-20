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

      // OPT-24: Track CLS (Cumulative Layout Shift) for UX quality
      const clsObserver = new PerformanceObserver((list) => {
        try {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
              clsValue += (entry as PerformanceEntry & { value?: number }).value ?? 0;
            }
          }
          if (clsValue > 0.1) {
            logger.warn("Perf", `CLS: ${clsValue.toFixed(3)} (above threshold)`);
          }
        } catch {
          // Ignore reporting errors
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      // OPT-M1: Track FID (First Input Delay) for interactivity
      const fidObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            const fid = (entry as PerformanceEntry & { processingStart?: number }).processingStart
              ? (entry as PerformanceEntry & { processingStart: number }).processingStart - entry.startTime
              : 0;
            if (fid > 100) {
              logger.warn("Perf", `FID: ${Math.round(fid)}ms (above 100ms threshold)`);
            }
          }
        } catch {
          // Ignore reporting errors
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });

      // OPT-M2: Track long tasks (>50ms) that block the main thread
      const longTaskObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              logger.warn("Perf", `Long task: ${Math.round(entry.duration)}ms`);
            }
          }
        } catch {
          // Ignore reporting errors
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      // Observer not supported
    }
  }
}
