import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "grimy-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  });

  // OPT-TM1: Smooth transition when switching themes
  const setTheme = useCallback((newTheme: Theme) => {
    document.documentElement.classList.add("theme-transitioning");
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
    // Remove transition class after animation completes
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 250);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}

/** Call before React render to avoid flash */
export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const resolved = (stored === "light" || stored === "dark") ? stored : "dark";

  // Disable transitions during initial load to prevent flash
  document.documentElement.classList.add("no-transitions");

  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  // Re-enable transitions after initial paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  });
}
