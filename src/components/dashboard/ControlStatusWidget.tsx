import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, COLOR, TT, pct, monthsSince } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

export default function ControlStatusWidget({ clients, loading }: Props) {
  const { data, aJourPct, total } = useMemo(() => {
    let ok = 0, late = 0;
    for (const c of clients) {
      if (!isActive(c)) continue;
      if (monthsSince(c.dateDerniereRevue) <= 1) ok++;
      else late++;
    }
    const t = ok + late;
    return {
      data: [
        { name: "À jour", value: ok, color: COLOR.ok },
        { name: "En retard", value: late, color: COLOR.danger },
      ].filter(d => d.value > 0),
      aJourPct: pct(ok, t),
      total: t,
    };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  const color = aJourPct >= 75 ? COLOR.ok : aJourPct >= 40 ? COLOR.warn : COLOR.danger;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Contrôles mensuels</p>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{aJourPct}%</span>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun dossier</div>
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums" style={{ color }}>{aJourPct}%</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">à jour</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] text-muted-foreground">{d.name} {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
