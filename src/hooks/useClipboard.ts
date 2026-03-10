import { useState, useCallback, useRef } from "react";

/**
 * Copy text to clipboard with feedback state.
 */
export function useClipboard(options?: { resetAfterMs?: number }): {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  error: string | null;
} {
  const { resetAfterMs = 2000 } = options ?? {};
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);
        timeoutRef.current = setTimeout(() => setCopied(false), resetAfterMs);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Echec de la copie";
        setError(message);
        setCopied(false);
        return false;
      }
    },
    [resetAfterMs]
  );

  return { copy, copied, error };
}
