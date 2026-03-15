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
  const data = useMemo(() => {
    const counts: Record<string, number> = { "A JOUR": 0, "BIENTÔT": 0, "RETARD": 0 };
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    for (const c of actifs) {
      const ep = (c.etatPilotage ?? "RETARD").toUpperCase().trim();
      if (ep === "A JOUR") counts["A JOUR"]++;
      else if (ep.includes("BIENT")) counts["BIENTÔT"]++;
      else counts["RETARD"]++;
    }
    return STATUS_CONFIG.map(s => ({
      name: s.label,
      value: counts[s.key],
      color: s.color,
    })).filter(d => d.value > 0);
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        LCB-FT : État des dossiers à mettre à jour
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">{total} dossier{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            nameKey="name"
            strokeWidth={2}
            stroke="hsl(var(--card))"
            isAnimationActive
            animationDuration={1200}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
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
