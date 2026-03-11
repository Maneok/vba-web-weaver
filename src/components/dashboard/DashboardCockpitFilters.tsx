import { cn } from "@/lib/utils";

type SeverityFilter = "all" | "critique" | "warning" | "info";
type CategoryFilter = "all" | "revision" | "cni" | "scoring" | "kyc" | "formation" | "be" | "document" | "autre";

interface DashboardCockpitFiltersProps {
  activeSeverity: SeverityFilter;
  activeCategory: CategoryFilter;
  onSeverityChange: (severity: SeverityFilter) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  counts: {
    critique: number;
    warning: number;
    info: number;
  };
}

const severityOptions: { value: SeverityFilter; label: string; activeClass: string; inactiveClass: string }[] = [
  { value: "all", label: "Tout", activeClass: "bg-slate-700 text-white", inactiveClass: "border-slate-300 text-slate-600 hover:bg-slate-100" },
  { value: "critique", label: "Critique", activeClass: "bg-red-600 text-white", inactiveClass: "border-red-300 text-red-600 hover:bg-red-50" },
  { value: "warning", label: "Warning", activeClass: "bg-orange-500 text-white", inactiveClass: "border-orange-300 text-orange-600 hover:bg-orange-50" },
  { value: "info", label: "Info", activeClass: "bg-blue-500 text-white", inactiveClass: "border-blue-300 text-blue-600 hover:bg-blue-50" },
];

const categoryOptions: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "revision", label: "Révisions" },
  { value: "cni", label: "CNI" },
  { value: "scoring", label: "Scoring" },
  { value: "kyc", label: "KYC" },
  { value: "formation", label: "Formations" },
  { value: "be", label: "BE" },
  { value: "document", label: "Documents" },
  { value: "autre", label: "Autres" },
];

function getCountForSeverity(severity: SeverityFilter, counts: DashboardCockpitFiltersProps["counts"]): number | null {
  if (severity === "all") return null;
  return counts[severity];
}

export default function DashboardCockpitFilters({
  activeSeverity,
  activeCategory,
  onSeverityChange,
  onCategoryChange,
  counts,
}: DashboardCockpitFiltersProps) {
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Filtres de sévérité"
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {severityOptions.map((option) => {
          const isActive = activeSeverity === option.value;
          const count = getCountForSeverity(option.value, counts);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSeverityChange(option.value)}
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive ? option.activeClass : option.inactiveClass
              )}
            >
              {option.label}
              {count !== null && (
                <span className={cn(
                  "inline-flex items-center justify-center rounded-full px-1 min-w-[1.1rem] text-[10px] leading-none",
                  isActive ? "bg-white/20" : "bg-current/10"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Filtres par catégorie"
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {categoryOptions.map((option) => {
          const isActive = activeCategory === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onCategoryChange(option.value)}
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
