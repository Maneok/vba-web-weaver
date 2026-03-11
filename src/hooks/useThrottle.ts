import { useState, useEffect, useRef } from "react";

/**
 * Throttle a value — only updates at most once per interval.
 */
export function useThrottle<T>(value: T, intervalMs: number = 300): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastUpdate = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdate.current;

    if (elapsed >= intervalMs) {
      lastUpdate.current = now;
      setThrottled(value);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastUpdate.current = Date.now();
        setThrottled(value);
      }, intervalMs - elapsed);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, intervalMs]);

  return throttled;
}
