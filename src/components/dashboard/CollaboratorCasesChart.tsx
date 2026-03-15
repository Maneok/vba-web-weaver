import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

export default function CollaboratorCasesChart({ clients, loading }: Props) {
  const { data, avgCases } = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (c.statut === "INACTIF") continue;
      const comptable = c.comptable?.trim() || "Non assigné";
      map.set(comptable, (map.get(comptable) || 0) + 1);
    }
    const items = Array.from(map, ([nom, count]) => ({ nom, count }))
      .sort((a, b) => b.count - a.count);
    const avg = items.length > 0 ? Math.round(items.reduce((s, d) => s + d.count, 0) / items.length) : 0;
    return { data: items, avgCases: avg };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-56 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          Nombre de dossiers par collaborateur
        </h3>
        <span className="text-xs text-muted-foreground">
          moy. {avgCases}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{data.length} collaborateur{data.length > 1 ? "s" : ""}</p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ left: 0, right: 10, top: 15, bottom: 5 }}>
          <XAxis
            dataKey="nom"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            interval={0}
            angle={data.length > 5 ? -25 : 0}
            textAnchor={data.length > 5 ? "end" : "middle"}
            height={data.length > 5 ? 50 : 30}
          />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          {avgCases > 0 && (
            <ReferenceLine
              y={avgCases}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `Moy. ${avgCases}`, fontSize: 9, fill: "#94a3b8", position: "insideTopRight" }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [`${value} dossier${value > 1 ? "s" : ""}`, "Nombre"]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1000} barSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
