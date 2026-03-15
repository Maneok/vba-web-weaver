import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, TOOLTIP_STYLE, pct, progressColor, monthsSince, pluralize } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function ControlStatusWidget({ clients, loading }: Props) {
  const { data, aJourPct, total } = useMemo(() => {
    let aJour = 0, enRetard = 0;
    for (const c of clients) {
      if (!isActiveClient(c)) continue;
      const ms = monthsSince(c.dateDerniereRevue);
      if (ms <= 1) aJour++;
      else enRetard++;
    }
    const t = aJour + enRetard;
    const items = [
      { name: "À jour", value: aJour, color: "#22c55e" },
      { name: "En retard", value: enRetard, color: "#ef4444" },
    ].filter(d => d.value > 0);
    return { data: items, aJourPct: pct(aJour, t), total: t };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  const color = progressColor(aJourPct);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Contrôles mensuels</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}18`, color }}>{aJourPct}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">{total} {pluralize(total, "dossier")} {pluralize(total, "contrôlé")}</p>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">Aucun dossier à contrôler</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} cx="50%" cy="42%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2} animationDuration={1000}>
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <text x="50%" y="38%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 26, fontWeight: 700, fill: color }}>{aJourPct}%</text>
            <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}>à jour</text>
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
