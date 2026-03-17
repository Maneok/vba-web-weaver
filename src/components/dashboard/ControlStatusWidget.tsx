import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function ControlStatusWidget({ clients, loading }: Props) {
  const { data, aJourPct, total } = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    const now = new Date();
    let aJour = 0;
    let enRetard = 0;

    for (const c of actifs) {
      if (!c.dateDerniereRevue) { enRetard++; continue; }
      const lastReview = new Date(c.dateDerniereRevue);
      if (isNaN(lastReview.getTime())) { enRetard++; continue; }
      const monthsSince = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince > 1) enRetard++;
      else aJour++;
    }

    const items = [
      { name: "À jour", value: aJour, color: "#22c55e" },
      { name: "En retard", value: enRetard, color: "#ef4444" },
    ].filter(d => d.value > 0);

    const t = aJour + enRetard;
    return { data: items, aJourPct: t > 0 ? Math.round((aJour / t) * 100) : 0, total: t };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const statusColor = aJourPct >= 80 ? "#22c55e" : aJourPct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          LCB-FT : Contrôles mensuels des dossiers
        </h3>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {aJourPct}%
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{total} dossier{total > 1 ? "s" : ""} contrôlé{total > 1 ? "s" : ""}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="42%"
            innerRadius={55}
            outerRadius={82}
            dataKey="value"
            nameKey="name"
            strokeWidth={2}
            stroke="hsl(var(--card))"
            paddingAngle={2}
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
            y="38%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 28, fontWeight: 700, fill: statusColor }}
          >
            {aJourPct}%
          </text>
          <text
            x="50%"
            y="49%"
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
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number, name: string) => [
              `${value} (${Math.round((value / total) * 100)}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => {
              const item = data.find(d => d.name === value);
              return (
                <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>
                  {value} · {item?.value}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
