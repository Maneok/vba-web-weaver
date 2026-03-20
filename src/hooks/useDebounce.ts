import { useState, useEffect, useRef } from "react";

/**
 * Debounce a value — useful for search inputs to avoid excessive API calls.
 * OPT-HK1: Added `leading` option — emit the first value immediately, then debounce.
 */
export function useDebounce<T>(value: T, delay = 300, leading = false): T {
  const [debounced, setDebounced] = useState(value);
  const isFirstRef = useRef(true);

  useEffect(() => {
    // OPT-HK1: Leading mode — emit first value immediately
    if (leading && isFirstRef.current) {
      isFirstRef.current = false;
      setDebounced(value);
      return;
    }
    isFirstRef.current = false;

    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, leading]);

  return debounced;
}
