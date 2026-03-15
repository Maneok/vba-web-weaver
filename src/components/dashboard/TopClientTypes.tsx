import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

export default function TopClientTypes({ clients, loading }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (c.statut === "INACTIF" || !c.forme) continue;
      map.set(c.forme, (map.get(c.forme) || 0) + 1);
    }
    return Array.from(map, ([forme, count]) => ({ forme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          Top 5 — Typologie de la clientèle
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} clients</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Par forme juridique</p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 35, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="forme"
            width={100}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [
              `${value} dossier${value > 1 ? "s" : ""} (${Math.round((value / total) * 100)}%)`,
              "Nombre",
            ]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000} barSize={20}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
