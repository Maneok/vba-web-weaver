import { ShieldCheck } from "lucide-react";

interface GaugeItem {
  label: string;
  value: number; // 0-100
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

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-6">
        <ShieldCheck className="w-4 h-4 text-primary" />
        Indicateurs de conformite
      </h3>

      <div className="space-y-5">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-bold ${textColor(item.value)}`}>
                {item.value}%
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barColor(item.value)} transition-all duration-700`}
                style={{ width: `${Math.max(0, Math.min(item.value, 100))}%` }}
              />
            </div>
            {item.description && (
              <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
