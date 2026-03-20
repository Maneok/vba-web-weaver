import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { memo } from "react";

// OPT-TH1: Memoize ThemeToggle — only re-renders when theme changes
export const ThemeToggle = memo(function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      // OPT-TH2: Smooth icon transition on theme change
      className="w-8 h-8 p-0 rounded-full transition-transform duration-200 hover:scale-110 active:scale-95"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {isDark ? (
        <Moon className="w-4 h-4 text-slate-400 transition-transform duration-300 rotate-0" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 rotate-0" />
      )}
    </Button>
  );
});
