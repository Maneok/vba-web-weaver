import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { VIGILANCE_COLORS, TOOLTIP_STYLE, pct } from "./dashboardUtils";

interface Props {
  simplifiee: number;
  standard: number;
  renforcee: number;
  loading?: boolean;
}

const SEGMENTS = [
  { key: "simplifiee" as const, name: "Simplifiée", color: VIGILANCE_COLORS.simplifiee },
  { key: "standard" as const, name: "Standard", color: VIGILANCE_COLORS.standard },
  { key: "renforcee" as const, name: "Renforcée", color: VIGILANCE_COLORS.renforcee },
];

export default function ExpositionDonut({ simplifiee, standard, renforcee, loading }: Props) {
  const { data, total } = useMemo(() => {
    const counts = { simplifiee, standard, renforcee };
    const items = SEGMENTS.map(s => ({ ...s, value: counts[s.key] })).filter(d => d.value > 0);
    return { data: items, total: simplifiee + standard + renforcee };
  }, [simplifiee, standard, renforcee]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Exposition du risque</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} client{total > 1 ? "s" : ""}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">Répartition par niveau de vigilance</p>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun client évalué</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} cx="50%" cy="42%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value" stroke="none" animationDuration={1000}>
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <text x="50%" y="38%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 700, fill: "hsl(var(--foreground))" }}>{total}</text>
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}>clients</text>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v} (${pct(v, total)}%)`, name]} />
            <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => {
              const item = data.find(d => d.name === value);
              return <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value} · {item?.value ?? 0} ({pct(item?.value ?? 0, total)}%)</span>;
            }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
