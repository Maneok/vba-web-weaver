import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

const STATUS_CONFIG = [
  { key: "A JOUR", label: "À jour", color: "#22c55e" },
  { key: "BIENTÔT", label: "Bientôt", color: "#f59e0b" },
  { key: "RETARD", label: "En retard", color: "#ef4444" },
];

export default function FileUpdateStatusWidget({ clients, loading }: Props) {
  const { data, total, retardCount } = useMemo(() => {
    const counts: Record<string, number> = { "A JOUR": 0, "BIENTÔT": 0, "RETARD": 0 };
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    for (const c of actifs) {
      const ep = (c.etatPilotage ?? "RETARD").toUpperCase().trim();
      if (ep === "A JOUR") counts["A JOUR"]++;
      else if (ep.includes("BIENT")) counts["BIENTÔT"]++;
      else counts["RETARD"]++;
    }
    const items = STATUS_CONFIG.map(s => ({
      name: s.label,
      value: counts[s.key],
      color: s.color,
    })).filter(d => d.value > 0);
    return {
      data: items,
      total: actifs.length,
      retardCount: counts["RETARD"],
    };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const aJourPct = total > 0 ? Math.round(((total - retardCount) / total) * 100) : 0;
  const statusColor = aJourPct >= 80 ? "#22c55e" : aJourPct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          LCB-FT : État des dossiers à mettre à jour
        </h3>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {retardCount} en retard
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{total} dossier{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="42%"
            innerRadius={50}
            outerRadius={78}
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
            style={{ fontSize: 24, fontWeight: 700, fill: statusColor }}
          >
            {aJourPct}%
          </text>
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          >
            conformes
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
