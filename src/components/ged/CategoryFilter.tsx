import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CategoryTab {
  key: string;
  label: string;
  count?: number;
  isMissing?: boolean;
}

interface CategoryFilterProps {
  tabs: CategoryTab[];
  active: string;
  onChange: (key: string) => void;
}

const REQUIRED_CATEGORIES = new Set(["kbis", "extrait_kbis", "cni_dirigeant", "rib"]);

export default function CategoryFilter({ tabs, active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const isMissing = tab.isMissing ?? (REQUIRED_CATEGORIES.has(tab.key) && (tab.count ?? 0) === 0);
        const showCount = tab.key !== "accueil" || (tab.count ?? 0) > 0;

        return (
          <Tooltip key={tab.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isMissing
                      ? "bg-red-500/10 text-red-500 border border-red-500/30 animate-pulse"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
                {showCount && tab.count !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold leading-none px-1 ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : isMissing
                          ? "bg-red-500/20 text-red-500"
                          : "bg-foreground/10 text-foreground/70"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {tab.count ?? 0} document{(tab.count ?? 0) !== 1 ? "s" : ""}
              {isMissing ? " — Document obligatoire manquant" : ""}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
