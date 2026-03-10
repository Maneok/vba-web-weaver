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
  /** Accessible description for screen readers */
  ariaLabel?: string;
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
    <div className="print:hidden" aria-hidden="true">
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
    </div>
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
  ariaLabel,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-muted skeleton-shimmer" />
          <div className="h-3 w-20 bg-muted rounded skeleton-shimmer" />
        </div>
        <div className="flex items-end justify-between">
          <div className="h-8 w-16 bg-muted rounded skeleton-shimmer" />
          <div className="h-7 w-16 bg-muted rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const isClickable = !!onClick;
  const computedAriaLabel = ariaLabel || `${title} : ${value}`;

  return (
    <div
      className={`bg-card rounded-2xl p-5 border border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/[0.12] transition-all duration-300 group print:break-inside-avoid print:shadow-none print:hover:scale-100 print:hover:translate-y-0 ${isClickable ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={computedAriaLabel}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} aria-hidden="true" />
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </span>
        </div>
        {trendPercent !== undefined && (
          <Badge
            variant={trendUp ? "default" : "destructive"}
            className="text-xs px-1.5 py-0.5"
          >
            {trendUp ? "\u2191" : "\u2193"} {Math.abs(trendPercent)}%
          </Badge>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold tabular-nums tracking-tight">{value}</span>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={color} />
        )}
      </div>
    </div>
  );
}
