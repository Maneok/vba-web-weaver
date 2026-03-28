import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (conformité LCB-FT)
const WARNING_MS = TIMEOUT_MS - 5 * 60 * 1000; // Avertissement 5 min avant
const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove", "click"] as const;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours absolute max

export function useSessionTimeout(onTimeout: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);
  const sessionStartRef = useRef(Date.now());
  const prevEnabledRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  // Reset session start when re-enabled (e.g., re-login without page reload)
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      sessionStartRef.current = Date.now();
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  const resetTimer = useCallback(() => {
    // Absolute session max (8 hours)
    const elapsed = Date.now() - sessionStartRef.current;
    if (elapsed >= MAX_SESSION_MS) {
      onTimeoutRef.current();
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warnedRef.current = false;

    // Cap inactivity timeout to remaining session time so it can't exceed absolute max
    const remaining = MAX_SESSION_MS - elapsed;
    const effectiveTimeout = Math.min(TIMEOUT_MS, remaining);
    const effectiveWarning = Math.min(WARNING_MS, remaining);

    if (effectiveWarning < remaining) {
      warningRef.current = setTimeout(() => {
        warnedRef.current = true;
        toast.warning("Votre session expire dans 5 minutes. Bougez la souris pour rester connecte.");
      }, effectiveWarning);
    }

    timerRef.current = setTimeout(() => onTimeoutRef.current(), effectiveTimeout);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Do NOT reset sessionStartRef here — it's only set on login (prevEnabled transition).
    // Resetting here would extend the 8h absolute max on every effect re-run.

    resetTimer();

    for (const event of EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      for (const event of EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [enabled, resetTimer]);
}
