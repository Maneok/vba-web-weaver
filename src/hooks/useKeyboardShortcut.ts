import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Register a keyboard shortcut. Ignores when focus is on input/textarea/contenteditable.
 */
export function useKeyboardShortcut(
  shortcut: ShortcutConfig,
  callback: () => void,
  enabled: boolean = true
): void {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const matchKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const matchCtrl = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
      const matchShift = !!shortcut.shift === e.shiftKey;
      const matchAlt = !!shortcut.alt === e.altKey;

      if (matchKey && matchCtrl && matchShift && matchAlt) {
        e.preventDefault();
        callback();
      }
    },
    [shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt, callback, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler, enabled]);
}
