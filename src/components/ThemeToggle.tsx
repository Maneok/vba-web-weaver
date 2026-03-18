import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 rounded-full"
          aria-label="Changer de theme"
        >
          {isDark ? (
            <Moon className="w-4 h-4 text-slate-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="end">
        <button
          onClick={() => setTheme("light")}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            theme === "light" ? "bg-blue-500/10 text-blue-500" : "hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-400"
          }`}
        >
          <Sun className="w-3.5 h-3.5" /> Clair
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            theme === "dark" ? "bg-blue-500/10 text-blue-500" : "hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-400"
          }`}
        >
          <Moon className="w-3.5 h-3.5" /> Sombre
        </button>
        <button
          onClick={() => setTheme("system")}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            theme === "system" ? "bg-blue-500/10 text-blue-500" : "hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-400"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" /> Systeme
        </button>
      </PopoverContent>
    </Popover>
  );
}
