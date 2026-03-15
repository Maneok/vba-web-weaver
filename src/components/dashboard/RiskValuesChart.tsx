import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
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
  const data = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    return [
      { name: "Cash", count: actifs.filter(c => c.cash === "OUI").length },
      { name: "PPE", count: actifs.filter(c => c.ppe === "OUI").length },
      { name: "Pays risque", count: actifs.filter(c => c.paysRisque === "OUI").length },
      { name: "Atypique", count: actifs.filter(c => c.atypique === "OUI").length },
      { name: "Distanciel", count: actifs.filter(c => c.distanciel === "OUI").length },
      { name: "Pression", count: actifs.filter(c => c.pression === "OUI").length },
    ].sort((a, b) => b.count - a.count);
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        LCB-FT : Cartographie des valeurs à risque
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        {total} facteur{total > 1 ? "s" : ""} de risque détecté{total > 1 ? "s" : ""}
      </p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value} client${value > 1 ? "s" : ""}`, "Nombre"]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
