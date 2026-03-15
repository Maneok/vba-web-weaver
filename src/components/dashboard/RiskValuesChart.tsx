import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const COLORS: Record<string, string> = {
  "Cash": "#ef4444",
  "PPE": "#f97316",
  "Pays risque": "#eab308",
  "Atypique": "#8b5cf6",
  "Distanciel": "#3b82f6",
  "Pression": "#ec4899",
};

export default function RiskValuesChart({ clients, loading }: Props) {
  const { data, totalActifs } = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    const n = actifs.length || 1;
    const items = [
      { name: "Cash", count: actifs.filter(c => c.cash === "OUI").length },
      { name: "PPE", count: actifs.filter(c => c.ppe === "OUI").length },
      { name: "Pays risque", count: actifs.filter(c => c.paysRisque === "OUI").length },
      { name: "Atypique", count: actifs.filter(c => c.atypique === "OUI").length },
      { name: "Distanciel", count: actifs.filter(c => c.distanciel === "OUI").length },
      { name: "Pression", count: actifs.filter(c => c.pression === "OUI").length },
    ]
      .sort((a, b) => b.count - a.count)
      .map(d => ({ ...d, pct: Math.round((d.count / n) * 100) }));
    return { data: items, totalActifs: actifs.length };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const totalFacteurs = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          LCB-FT : Cartographie des valeurs à risque
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalFacteurs} signal{totalFacteurs > 1 ? "aux" : ""}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Sur {totalActifs} client{totalActifs > 1 ? "s" : ""} actif{totalActifs > 1 ? "s" : ""}
      </p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={75}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
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
              `${value} client${value > 1 ? "s" : ""} (${entry.payload.pct}%)`,
              "Nombre",
            ]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000} barSize={18}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || "#64748b"} />
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
