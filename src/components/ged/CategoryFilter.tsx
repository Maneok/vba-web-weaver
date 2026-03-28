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

const REQUIRED_CATEGORIES = new Set(["kbis", "cni_dirigeant", "rib", "statuts"]);

export default function CategoryFilter({ tabs, active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const isMissing = tab.isMissing ?? (REQUIRED_CATEGORIES.has(tab.key) && (tab.count ?? 0) === 0);
        const count = tab.count ?? 0;

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition whitespace-nowrap ${
              isActive
                ? "bg-primary text-primary-foreground"
                : isMissing
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
            {tab.key !== "accueil" && count > 0 && (
              <span className="ml-1 opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
