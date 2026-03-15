import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const STATUS_CONFIG = [
  { label: "À jour", color: "#22c55e" },
  { label: "En retard", color: "#ef4444" },
];

export default function ControlStatusWidget({ clients, loading }: Props) {
  const data = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    const now = new Date();
    let aJour = 0;
    let enRetard = 0;

    for (const c of actifs) {
      if (!c.dateDerniereRevue) {
        enRetard++;
        continue;
      }
      const lastReview = new Date(c.dateDerniereRevue);
      if (isNaN(lastReview.getTime())) {
        enRetard++;
        continue;
      }
      const monthsSince = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24 * 30);
      // Consider a control overdue if last review > 1 month ago
      if (monthsSince > 1) enRetard++;
      else aJour++;
    }

    return [
      { name: "À jour", value: aJour, color: "#22c55e" },
      { name: "En retard", value: enRetard, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const aJourPct = total > 0 ? Math.round((data.find(d => d.name === "À jour")?.value || 0) / total * 100) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        LCB-FT : Contrôles mensuels des dossiers
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">{aJourPct}% des dossiers contrôlés</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            dataKey="value"
            nameKey="name"
            strokeWidth={2}
            stroke="hsl(var(--card))"
            isAnimationActive
            animationDuration={1200}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          {/* Center label */}
          <text
            x="50%"
            y="42%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 28, fontWeight: 700, fill: "hsl(var(--foreground))" }}
          >
            {aJourPct}%
          </text>
          <text
            x="50%"
            y="52%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          >
            à jour
          </text>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value} dossier${value > 1 ? "s" : ""}`, ""]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
