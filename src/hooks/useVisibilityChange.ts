import { useState, useEffect } from "react";

/**
 * OPT-HC1: Track document visibility — pause expensive operations when tab is hidden.
 * Returns true when the page is visible, false when hidden.
 */
export function useVisibilityChange(): boolean {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return isVisible;
}
