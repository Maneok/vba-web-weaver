import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, TOOLTIP_STYLE, pct, progressColor, pluralize } from "./dashboardUtils";

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
  const { data, total, aJourPct, retardCount } = useMemo(() => {
    let aJour = 0, bientot = 0, retard = 0;
    for (const c of clients) {
      if (!isActiveClient(c)) continue;
      const ep = (c.etatPilotage ?? "RETARD").toUpperCase().trim();
      if (ep === "A JOUR") aJour++;
      else if (ep.includes("BIENT")) bientot++;
      else retard++;
    }
    const t = aJour + bientot + retard;
    const items = STATUS_CONFIG.map(s => ({
      name: s.label,
      value: s.key === "A JOUR" ? aJour : s.key === "BIENTÔT" ? bientot : retard,
      color: s.color,
    })).filter(d => d.value > 0);
    return { data: items, total: t, aJourPct: pct(aJour + bientot, t), retardCount: retard };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  const color = progressColor(aJourPct);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">État des dossiers</h3>
        {retardCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ef444418", color: "#ef4444" }}>{retardCount} en retard</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">{total} {pluralize(total, "dossier")} {pluralize(total, "actif")}</p>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">Aucun dossier actif</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} cx="50%" cy="42%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2} animationDuration={1000}>
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <text x="50%" y="38%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 700, fill: color }}>{aJourPct}%</text>
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}>à jour</text>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v} (${pct(v, total)}%)`, name]} />
            <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => {
              const item = data.find(d => d.name === value);
              return <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value} · {item?.value ?? 0}</span>;
            }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
