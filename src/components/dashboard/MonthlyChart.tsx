import { useState, useMemo, useId } from "react";
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

const CHART_MODE_KEY = "dashboard-chart-mode";

function loadChartMode(): "mensuel" | "trimestriel" {
  try {
    const v = localStorage.getItem(CHART_MODE_KEY);
    if (v === "trimestriel") return "trimestriel";
  } catch { /* ignore */ }
  return "mensuel";
}

export function MonthlyChart({ data, loading = false }: MonthlyChartProps) {
  const [mode, setMode] = useState<"mensuel" | "trimestriel">(loadChartMode);
  const gradId = useId().replace(/:/g, "_");

  const handleModeChange = (m: "mensuel" | "trimestriel") => {
    setMode(m);
    try { localStorage.setItem(CHART_MODE_KEY, m); } catch { /* ignore */ }
  };

  // All hooks MUST be called before any early return (Rules of Hooks)
  const chartData = useMemo(() =>
    mode === "trimestriel"
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
      : data,
    [data, mode]
  );

  const total = chartData.reduce((s, d) => s + d.simplifiee + d.standard + d.renforcee, 0);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-52 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid" role="figure" aria-label="Évolution du portefeuille clients par niveau de vigilance">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
          Évolution du portefeuille
        </h3>
        <div className="flex gap-1 print:hidden" role="group" aria-label="Période d'affichage">
          <Button
            size="sm"
            variant={mode === "mensuel" ? "default" : "ghost"}
            className="text-xs h-7 px-2.5"
            onClick={() => handleModeChange("mensuel")}
            aria-pressed={mode === "mensuel"}
            aria-label="Affichage mensuel"
          >
            Mensuel
          </Button>
          <Button
            size="sm"
            variant={mode === "trimestriel" ? "default" : "ghost"}
            className="text-xs h-7 px-2.5"
            onClick={() => handleModeChange("trimestriel")}
            aria-pressed={mode === "trimestriel"}
            aria-label="Affichage trimestriel"
          >
            Trimestriel
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Les données apparaîtront après l'ajout de clients</p>
        </div>
      ) : (
        <div className="h-72 print:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`${gradId}_simp`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.simplifiee} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.simplifiee} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gradId}_std`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.standard} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.standard} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gradId}_renf`} x1="0" y1="0" x2="0" y2="1">
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
                  color: "hsl(var(--card-foreground))",
                }}
                labelStyle={{ color: "hsl(var(--card-foreground))" }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
              />
              <Area
                type="monotone"
                dataKey="simplifiee"
                name="Simplifiée"
                stroke={COLORS.simplifiee}
                strokeWidth={2}
                fill={`url(#${gradId}_simp)`}
              />
              <Area
                type="monotone"
                dataKey="standard"
                name="Standard"
                stroke={COLORS.standard}
                strokeWidth={2}
                fill={`url(#${gradId}_std)`}
              />
              <Area
                type="monotone"
                dataKey="renforcee"
                name="Renforcée"
                stroke={COLORS.renforcee}
                strokeWidth={2}
                fill={`url(#${gradId}_renf)`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
