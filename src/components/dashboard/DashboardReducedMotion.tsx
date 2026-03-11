import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dashboard-refresh-interval";
const DEFAULT_INTERVAL = 60000;

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

export function useAutoRefreshInterval(): [number, (interval: number) => void] {
  const [interval, setIntervalState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_INTERVAL;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = Number(stored);
        if ([0, 30000, 60000, 120000, 300000].includes(parsed)) {
          return parsed;
        }
      }
    } catch {
      // localStorage unavailable
    }
    return DEFAULT_INTERVAL;
  });

  const setInterval = useCallback((newInterval: number) => {
    setIntervalState(newInterval);
    try {
      localStorage.setItem(STORAGE_KEY, String(newInterval));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return [interval, setInterval];
}
