import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, COLOR, TT, pct } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

const S = [
  { key: "A JOUR", label: "À jour", color: COLOR.ok },
  { key: "BIENTÔT", label: "Bientôt", color: COLOR.warn },
  { key: "RETARD", label: "En retard", color: COLOR.danger },
];

export default function FileUpdateStatusWidget({ clients, loading }: Props) {
  const { data, total, aJourPct } = useMemo(() => {
    let aJour = 0, bientot = 0, retard = 0;
    for (const c of clients) {
      if (!isActive(c)) continue;
      const ep = (c.etatPilotage ?? "RETARD").toUpperCase();
      if (ep === "A JOUR") aJour++;
      else if (ep.includes("BIENT")) bientot++;
      else retard++;
    }
    const t = aJour + bientot + retard;
    return {
      data: S.map(s => ({ ...s, value: s.key === "A JOUR" ? aJour : s.key === "BIENTÔT" ? bientot : retard })).filter(d => d.value > 0),
      total: t,
      aJourPct: pct(aJour + bientot, t),
    };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  const color = aJourPct >= 75 ? COLOR.ok : aJourPct >= 40 ? COLOR.warn : COLOR.danger;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">État des dossiers</p>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{aJourPct}% à jour</span>
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
            {S.map(s => {
              const item = data.find(d => d.key === s.key);
              if (!item || item.value === 0) return null;
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] text-muted-foreground">{s.label} {item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
