import { useMemo } from "react";
import type { Collaborateur } from "@/lib/types";
import { COLOR, pct } from "./dashboardUtils";

interface Props { collaborateurs: Collaborateur[]; loading?: boolean }

const STATUSES = [
  { label: "À jour", color: COLOR.ok, match: "JOUR" },
  { label: "À former", color: COLOR.warn, match: "FORMER" },
  { label: "Jamais formé", color: COLOR.danger, match: null },
];

export default function TrainingStatusWidget({ collaborateurs, loading }: Props) {
  const { data, total, taux } = useMemo(() => {
    let aJour = 0, aFormer = 0, jamais = 0;
    for (const col of collaborateurs) {
      const s = (col.statutFormation ?? "").toUpperCase();
      if (s.includes("JOUR")) aJour++;
      else if (s.includes("FORMER")) aFormer++;
      else jamais++;
    }
    const n = collaborateurs.length;
    return {
      data: [
        { ...STATUSES[0], count: aJour },
        { ...STATUSES[1], count: aFormer },
        { ...STATUSES[2], count: jamais },
      ],
      total: n,
      taux: pct(aJour, n),
    };
  }, [collaborateurs]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Formation LCB-FT</p>
        <span className="text-xs font-semibold tabular-nums" style={{ color: taux >= 75 ? COLOR.ok : taux >= 40 ? COLOR.warn : COLOR.danger }}>{taux}%</span>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun collaborateur</div>
      ) : (
        <div className="mt-6 space-y-5 px-2">
          {data.map(d => (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{d.label}</span>
                <span className="text-xs font-semibold tabular-nums">{d.count}<span className="text-muted-foreground font-normal">/{total}</span></span>
              </div>
              <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct(d.count, total)}%`, backgroundColor: d.color }}
                />
              </div>
            </div>
          ))}
          {/* Summary */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{total} collaborateur{total > 1 ? "s" : ""}</span>
            <span className="text-xs font-medium">{data[0].count} à jour sur {total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
