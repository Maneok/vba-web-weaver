import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
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
  const { data, totalCA } = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>();
    for (const c of clients) {
      if (c.statut === "INACTIF" || !c.mission) continue;
      const entry = map.get(c.mission) || { ca: 0, count: 0 };
      entry.ca += c.honoraires ?? 0;
      entry.count++;
      map.set(c.mission, entry);
    }
    const items = Array.from(map, ([mission, { ca, count }]) => ({
      mission,
      ca,
      count,
      label: formatEuros(ca),
    })).sort((a, b) => b.ca - a.ca);
    return { data: items, totalCA: items.reduce((s, d) => s + d.ca, 0) };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          Structure du chiffre d'affaires
        </h3>
        <span className="text-xs font-bold tabular-nums text-primary">
          {formatEuros(totalCA)}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Par type de mission · {data.length} catégorie{data.length > 1 ? "s" : ""}
      </p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 50, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => formatEuros(v)}
          />
          <YAxis
            type="category"
            dataKey="mission"
            width={105}
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
            formatter={(value: number, _: string, entry: any) => [
              `${formatEuros(value)} · ${entry.payload.count} dossier${entry.payload.count > 1 ? "s" : ""}`,
              "CA",
            ]}
          />
          <Bar dataKey="ca" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000} barSize={18}>
            {data.map((entry) => (
              <Cell key={entry.mission} fill={MISSION_COLORS[entry.mission] || "#64748b"} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
