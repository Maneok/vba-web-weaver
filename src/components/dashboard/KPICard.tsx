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
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border">
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

  return (
    <div
      className={`bg-card rounded-2xl p-5 border border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 hover:scale-105 hover:border-white/[0.12] transition-all duration-300 group cursor-pointer`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} />
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
