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
  if (pct >= 80) return "from-emerald-500 to-emerald-400";
  if (pct >= 50) return "from-orange-500 to-amber-400";
  return "from-red-500 to-red-400";
}

function textColor(pct: number): string {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-orange-500";
  return "text-red-500";
}

function badgeBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-500";
  if (pct >= 50) return "bg-orange-500/15 text-orange-500";
  return "bg-red-500/15 text-red-500";
}

export default function DashboardDataQuality({
  categories,
  isLoading,
}: DashboardDataQualityProps) {
  const { totalFields, totalFilled, overallPct } = useMemo(() => {
    const totalFields = categories.reduce((s, c) => s + c.total, 0);
    const totalFilled = categories.reduce((s, c) => s + c.filled, 0);
    const overallPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
    return { totalFields, totalFilled, overallPct };
  }, [categories]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="flex items-center justify-center mb-6">
          <div className="h-20 w-20 bg-muted rounded-full animate-pulse" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="h-3 w-36 bg-muted rounded animate-pulse mb-2" />
            <div className="h-2.5 w-full bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-6">
          <Database className="w-4 h-4 text-primary" aria-hidden="true" />
          Qualité des données
        </h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucune donnée à analyser
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid"
      role="figure"
      aria-label="Qualité des données"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" aria-hidden="true" />
          Qualité des données
        </h3>
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${badgeBg(overallPct)}`}>
          {overallPct}%
        </div>
      </div>

      {/* Circular percentage display */}
      <div className="flex flex-col items-center mb-6">
        <div
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${
            overallPct >= 80
              ? "border-emerald-500"
              : overallPct >= 50
              ? "border-orange-500"
              : "border-red-500"
          }`}
        >
          <span className={`text-2xl font-bold tabular-nums ${textColor(overallPct)}`}>
            {overallPct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {totalFilled} champs renseignés sur {totalFields}
        </p>
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        {categories.map((cat, i) => {
          const pct = cat.total > 0 ? Math.round((cat.filled / cat.total) * 100) : 0;
          return (
            <div key={i} className="group/cat">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center text-muted-foreground" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground group-hover/cat:text-foreground transition-colors">
                    {cat.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {cat.filled}/{cat.total}
                </span>
              </div>
              <div
                className="relative h-2.5 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.label} : ${cat.filled} sur ${cat.total} — ${pct}%`}
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barColor(pct)} transition-all duration-1000 ease-out`}
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
