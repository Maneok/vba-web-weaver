import { type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useId } from "react";

interface KPICardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  color: string;
  trendPercent?: number;
  trendUp?: boolean;
  sparklineData?: { v: number }[];
  onClick?: () => void;
  loading?: boolean;
  /** Label shown when value is 0 — use "|" to split text from CTA label */
  emptyLabel?: string;
  /** Callback for the empty-state CTA */
  emptyAction?: () => void;
}

function Sparkline({ data, color, width = 64, height = 28 }: {
  data: { v: number }[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, "_");

  if (!data || data.length < 2) return null;

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function KPICard({
  icon: Icon,
  title,
  value,
  color,
  trendPercent,
  trendUp = true,
  sparklineData,
  onClick,
  loading = false,
  emptyLabel,
  emptyAction,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-muted" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="flex items-end justify-between">
          <div className="h-8 w-16 bg-muted rounded" />
          <div className="h-7 w-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Detect empty state: numeric 0, "0", "0%", "0k€"
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  const isEmpty = numericValue === 0 || isNaN(numericValue);

  // Sparkline: only show when meaningful data exists (5+ points, not all zero)
  const allZero = sparklineData?.every(p => p.v === 0) ?? true;
  const showSparkline = !isEmpty && sparklineData && sparklineData.length >= 5 && !allZero;

  // Trend: never show when value is 0
  const showTrend = trendPercent !== undefined && trendPercent !== 0 && !isEmpty;

  // Parse empty label: "Aucun client|Ajouter un client"
  const [emptyText, emptyCta] = (emptyLabel || "").split("|").map(s => s.trim());

  return (
    <div
      className={`bg-card rounded-2xl p-5 border border-border hover:shadow-lg transition-all group ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: isEmpty ? "hsl(var(--muted))" : `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: isEmpty ? "hsl(var(--muted-foreground))" : color }} />
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </span>
        </div>
        {showTrend && (
          <Badge
            variant={trendUp ? "default" : "destructive"}
            className="text-xs px-1.5 py-0.5"
          >
            {trendUp ? "\u2191" : "\u2193"} {Math.abs(trendPercent!)}%
          </Badge>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-3xl font-bold">{value}</span>
          {isEmpty && emptyText && (
            <p className="text-xs text-muted-foreground mt-1">
              {emptyText}
              {emptyCta && emptyAction && (
                <>
                  {" — "}
                  <button
                    onClick={(e) => { e.stopPropagation(); emptyAction(); }}
                    className="text-primary hover:underline font-medium"
                  >
                    {emptyCta}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        {showSparkline && (
          <Sparkline data={sparklineData!} color={color} />
        )}
      </div>
    </div>
  );
}
