import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Activer le mode sombre" : "Activer le mode clair"}
      className="relative inline-flex h-8 w-14 items-center rounded-full border border-border bg-card px-1 text-xs shadow-sm transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`absolute inset-y-1 w-6 rounded-full bg-primary shadow-sm transition-transform duration-200 ${
          isLight ? "translate-x-0" : "translate-x-6"
        }`}
      />
      <span className="relative flex w-full items-center justify-between text-[10px] font-medium">
        <span className={isLight ? "text-primary-foreground" : "text-muted-foreground"}>
          <Sun className="h-3 w-3" />
        </span>
        <span className={!isLight ? "text-primary-foreground" : "text-muted-foreground"}>
          <Moon className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

