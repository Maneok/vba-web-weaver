import { useState, useCallback, useRef } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Manage async actions with loading/error state tracking.
 */
export function useAsyncAction<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>
): {
  execute: (...args: Args) => Promise<T | null>;
  data: T | null;
  error: string | null;
  isLoading: boolean;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const mountedRef = useRef(true);

  // Track if component is mounted
  const setMounted = useCallback(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Use layout-safe approach
  useState(setMounted);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const result = await asyncFn(...args);
        if (mountedRef.current) {
          setState({ data: result, error: null, isLoading: false });
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (mountedRef.current) {
          setState({ data: null, error: message, isLoading: false });
        }
        return null;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { execute, ...state, reset };
}
