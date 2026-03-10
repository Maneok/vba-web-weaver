import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (conformité LCB-FT)
const WARNING_MS = TIMEOUT_MS - 2 * 60 * 1000; // Avertissement 2 min avant
const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours absolute max

export function useSessionTimeout(onTimeout: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);
  const sessionStartRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    // Absolute session max (8 hours)
    if (Date.now() - sessionStartRef.current >= MAX_SESSION_MS) {
      onTimeout();
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warnedRef.current = false;

    warningRef.current = setTimeout(() => {
      warnedRef.current = true;
      toast.warning("Votre session expire dans 2 minutes. Bougez la souris pour rester connecte.");
    }, WARNING_MS);

    timerRef.current = setTimeout(onTimeout, TIMEOUT_MS);
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

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
