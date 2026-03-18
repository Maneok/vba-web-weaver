import { ShieldCheck } from "lucide-react";

interface GaugeItem {
  label: string;
  value: number; // 0-100
  target?: number; // 0-100, optional compliance target
  description?: string;
}

interface ComplianceGaugeProps {
  items: GaugeItem[];
  loading?: boolean;
}

function barColor(value: number): string {
  if (value >= 80) return "from-emerald-500 to-emerald-400";
  if (value >= 50) return "from-orange-500 to-amber-400";
  return "from-red-500 to-red-400";
}

function textColor(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 50) return "text-orange-500";
  return "text-red-500";
}

function statusLabel(value: number): string {
  if (value >= 80) return "Conforme";
  if (value >= 50) return "À améliorer";
  return "Non conforme";
}

export function ComplianceGauge({ items, loading = false }: ComplianceGaugeProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-44 bg-muted rounded animate-pulse mb-6" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="h-3 w-40 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-full bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const avgCompliance = items.length > 0
    ? Math.round(items.reduce((s, i) => s + i.value, 0) / items.length)
    : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-gray-300 dark:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid" role="figure" aria-label="Indicateurs de conformité">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          Indicateurs de conformité
        </h3>
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${avgCompliance >= 80 ? "bg-emerald-500/15 text-emerald-500" : avgCompliance >= 50 ? "bg-orange-500/15 text-orange-500" : "bg-red-500/15 text-red-500"}`}>
          Moyenne : {avgCompliance}%
        </div>
      </div>

      <div className="space-y-5">
        {items.map((item, i) => {
          const clampedValue = Math.max(0, Math.min(100, item.value));
          return (
            <div key={i} className="group/gauge">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground group-hover/gauge:text-foreground transition-colors">{item.label}</span>
                  <span className={`text-[10px] ${textColor(clampedValue)} opacity-60 hidden sm:inline`}>
                    {statusLabel(clampedValue)}
                  </span>
                </div>
                <span className={`text-sm font-bold tabular-nums ${textColor(clampedValue)}`}>
                  {clampedValue}%
                </span>
              </div>
              <div
                className="relative h-2.5 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={clampedValue}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.label} : ${clampedValue}%${item.target ? ` (objectif : ${item.target}%)` : ""} — ${statusLabel(clampedValue)}`}
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barColor(clampedValue)} transition-all duration-1000 ease-out`}
                  style={{ width: `${clampedValue}%` }}
                />
                {item.target != null && item.target > 0 && item.target <= 100 && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-foreground/40"
                    style={{ left: `${item.target}%` }}
                    title={`Objectif : ${item.target}%`}
                    aria-hidden="true"
                  />
                )}
              </div>
              {(item.description || item.target != null) && (
                <div className="flex items-center justify-between mt-1">
                  {item.description && (
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                  )}
                  {item.target != null && item.target > 0 && (
                    <span className={`text-[10px] font-medium ${clampedValue >= item.target ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {clampedValue >= item.target ? "✓ Objectif atteint" : `Objectif : ${item.target}%`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
