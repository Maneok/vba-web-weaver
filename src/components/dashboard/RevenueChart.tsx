import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const MISSION_COLORS: Record<string, string> = {
  "TENUE COMPTABLE": "#3b82f6",
  "REVISION / SURVEILLANCE": "#8b5cf6",
  "SOCIAL / PAIE SEULE": "#06b6d4",
  "CONSEIL DE GESTION": "#f59e0b",
  "CONSTITUTION / CESSION": "#ef4444",
  "DOMICILIATION": "#ec4899",
  "IRPP": "#10b981",
};

function formatEuros(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, "")} M€`;
  if (v >= 1000) return `${Math.round(v / 1000)} k€`;
  return `${v} €`;
}

export default function RevenueChart({ clients, loading }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (c.statut === "INACTIF" || !c.mission) continue;
      map.set(c.mission, (map.get(c.mission) || 0) + (c.honoraires ?? 0));
    }
    return Array.from(map, ([mission, ca]) => ({ mission, ca }))
      .sort((a, b) => b.ca - a.ca);
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const totalCA = data.reduce((s, d) => s + d.ca, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Structure du chiffre d'affaires
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        CA total : {formatEuros(totalCA)}
      </p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => formatEuros(v)}
          />
          <YAxis
            type="category"
            dataKey="mission"
            width={110}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatEuros(value), "CA"]}
          />
          <Bar dataKey="ca" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000}>
            {data.map((entry) => (
              <Cell key={entry.mission} fill={MISSION_COLORS[entry.mission] || "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
