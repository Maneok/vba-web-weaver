import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  simplifiee: number;
  standard: number;
  renforcee: number;
  loading?: boolean;
}

const COLORS = {
  simplifiee: "#22c55e",
  standard: "#f59e0b",
  renforcee: "#ef4444",
};

export default function ExpositionDonut({ simplifiee, standard, renforcee, loading }: Props) {
  const data = useMemo(() => [
    { name: "Simplifiée", value: simplifiee, color: COLORS.simplifiee },
    { name: "Standard", value: standard, color: COLORS.standard },
    { name: "Renforcée", value: renforcee, color: COLORS.renforcee },
  ].filter(d => d.value > 0), [simplifiee, standard, renforcee]);

  const total = simplifiee + standard + renforcee;

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
      <h3 className="text-sm font-semibold text-foreground mb-1">
        LCB-FT : Exposition du risque du cabinet
      </h3>
      <p className="text-[11px] text-muted-foreground mb-2">
        {total} client{total > 1 ? "s" : ""} évalué{total > 1 ? "s" : ""}
      </p>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Aucun client évalué
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="42%"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
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
              style={{ fontSize: 26, fontWeight: 700, fill: "hsl(var(--foreground))" }}
            >
              {total}
            </text>
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            >
              clients
            </text>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value: string, entry: any) => {
                const item = data.find(d => d.name === value);
                const pct = item ? Math.round((item.value / total) * 100) : 0;
                return (
                  <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>
                    {value} · {item?.value} ({pct}%)
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
