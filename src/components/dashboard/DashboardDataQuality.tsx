import { useMemo } from "react";
import { Database } from "lucide-react";

interface DataQualityCategory {
  label: string;
  total: number;
  filled: number;
  icon: React.ReactNode;
}

interface DashboardDataQualityProps {
  categories: DataQualityCategory[];
  isLoading: boolean;
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function badgeBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-500";
  if (pct >= 50) return "bg-amber-500/15 text-amber-500";
  return "bg-red-500/15 text-red-500";
}

export default function DashboardDataQuality({
  categories,
  isLoading,
}: DashboardDataQualityProps) {
  const overallPct = useMemo(() => {
    const totalFields = categories.reduce((s, c) => s + c.total, 0);
    const totalFilled = categories.reduce((s, c) => s + c.filled, 0);
    return totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
  }, [categories]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-4 w-48 bg-muted rounded animate-pulse mb-5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-3">
            <div className="h-2.5 w-28 bg-muted rounded animate-pulse mb-1.5" />
            <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-primary" aria-hidden="true" />
          Qualité des données
        </h3>
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucune donnée à analyser
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-2xl border border-border p-5 hover:border-gray-300 dark:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid"
      role="figure"
      aria-label="Qualité des données"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" aria-hidden="true" />
          Qualité des données
        </h3>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${badgeBg(overallPct)}`}>
          {overallPct}%
        </span>
      </div>

      <div className="space-y-3.5">
        {categories.map((cat, i) => {
          const pct = cat.total > 0 ? Math.round((cat.filled / cat.total) * 100) : 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center text-muted-foreground" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {cat.label}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {pct === 100 ? (
                    <span className="text-emerald-500 font-medium">Complet</span>
                  ) : (
                    `${cat.filled}/${cat.total}`
                  )}
                </span>
              </div>
              <div
                className="h-2 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.label} : ${pct}%`}
              >
                <div
                  className={`h-full rounded-full ${barColor(pct)} transition-all duration-1000 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
