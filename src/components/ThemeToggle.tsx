import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-8 h-8 p-0 rounded-full"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {isDark ? (
        <Moon className="w-4 h-4 text-slate-400 dark:text-slate-400" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500" />
      )}
    </Button>
  );
}
