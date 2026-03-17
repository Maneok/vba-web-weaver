import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { COLOR, TT, pct } from "./dashboardUtils";

interface Props { simplifiee: number; standard: number; renforcee: number; loading?: boolean }

const SEG = [
  { name: "Simplifiée", color: COLOR.ok },
  { name: "Standard", color: COLOR.warn },
  { name: "Renforcée", color: COLOR.danger },
];

export default function ExpositionDonut({ simplifiee, standard, renforcee, loading }: Props) {
  const { data, total } = useMemo(() => {
    const vals = [simplifiee, standard, renforcee];
    const items = SEG.map((s, i) => ({ ...s, value: vals[i] })).filter(d => d.value > 0);
    return { data: items, total: vals.reduce((a, b) => a + b, 0) };
  }, [simplifiee, standard, renforcee]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Exposition du risque</p>
        <span className="text-xs text-muted-foreground tabular-nums">{total} client{total > 1 ? "s" : ""}</span>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun client</div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" stroke="none" animationDuration={800}>
                {data.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [`${v} (${pct(v, total)}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: -10 }}>
            <div className="text-center">
              <div className="text-xl font-bold tabular-nums">{total}</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">clients</div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-1">
            {SEG.map((s, i) => {
              const v = [simplifiee, standard, renforcee][i];
              return (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] text-muted-foreground">{s.name} {v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
