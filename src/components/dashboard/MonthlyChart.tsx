import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthlyDataPoint {
  month: string;
  simplifiee: number;
  standard: number;
  renforcee: number;
}

interface MonthlyChartProps {
  data: MonthlyDataPoint[];
  loading?: boolean;
}

const COLORS = {
  simplifiee: "#22c55e",
  standard: "#f59e0b",
  renforcee: "#ef4444",
};

export function MonthlyChart({ data, loading = false }: MonthlyChartProps) {
  const [mode, setMode] = useState<"mensuel" | "trimestriel">("mensuel");

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-52 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // Aggregate quarterly if needed
  const chartData = mode === "trimestriel"
    ? data.reduce<MonthlyDataPoint[]>((acc, d, i) => {
        const qi = Math.floor(i / 3);
        if (!acc[qi]) {
          acc[qi] = { month: `T${qi + 1}`, simplifiee: 0, standard: 0, renforcee: 0 };
        }
        acc[qi].simplifiee += d.simplifiee;
        acc[qi].standard += d.standard;
        acc[qi].renforcee += d.renforcee;
        return acc;
      }, [])
    : data;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evolution du portefeuille
        </h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "mensuel" ? "default" : "ghost"}
            className="text-xs h-7 px-2.5"
            onClick={() => setMode("mensuel")}
          >
            Mensuel
          </Button>
          <Button
            size="sm"
            variant={mode === "trimestriel" ? "default" : "ghost"}
            className="text-xs h-7 px-2.5"
            onClick={() => setMode("trimestriel")}
          >
            Trimestriel
          </Button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">Aucune donnee</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradSimp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.simplifiee} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.simplifiee} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradStd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.standard} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.standard} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRenf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.renforcee} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.renforcee} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
              />
              <Area
                type="monotone"
                dataKey="simplifiee"
                name="Simplifiee"
                stroke={COLORS.simplifiee}
                strokeWidth={2}
                fill="url(#gradSimp)"
              />
              <Area
                type="monotone"
                dataKey="standard"
                name="Standard"
                stroke={COLORS.standard}
                strokeWidth={2}
                fill="url(#gradStd)"
              />
              <Area
                type="monotone"
                dataKey="renforcee"
                name="Renforcee"
                stroke={COLORS.renforcee}
                strokeWidth={2}
                fill="url(#gradRenf)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
