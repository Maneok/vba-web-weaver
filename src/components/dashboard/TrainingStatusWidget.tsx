import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { Collaborateur } from "@/lib/types";
import { TOOLTIP_STYLE, pct, progressColor, pluralize } from "./dashboardUtils";

interface Props {
  collaborateurs: Collaborateur[];
  loading?: boolean;
}

const STATUSES = [
  { key: "A_JOUR", label: "À jour", color: "#22c55e", match: "JOUR" },
  { key: "A_FORMER", label: "À former", color: "#f59e0b", match: "FORMER" },
  { key: "JAMAIS", label: "Jamais formé", color: "#ef4444", match: null },
] as const;

export default function TrainingStatusWidget({ collaborateurs, loading }: Props) {
  const { data, total, tauxFormation } = useMemo(() => {
    let aJour = 0, aFormer = 0, jamais = 0;
    for (const col of collaborateurs) {
      const s = (col.statutFormation ?? "").toUpperCase().trim();
      // Check "JOUR" first, then "FORMER", fallback = jamais
      if (s.includes("JOUR")) aJour++;
      else if (s.includes("FORMER")) aFormer++;
      else jamais++;
    }
    const n = collaborateurs.length;
    return {
      data: [
        { status: "À jour", count: aJour, color: "#22c55e" },
        { status: "À former", count: aFormer, color: "#f59e0b" },
        { status: "Jamais formé", count: jamais, color: "#ef4444" },
      ],
      total: n,
      tauxFormation: pct(aJour, n),
    };
  }, [collaborateurs]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-56 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Formation LCB-FT</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${progressColor(tauxFormation)}18`, color: progressColor(tauxFormation) }}>{tauxFormation}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{total} {pluralize(total, "collaborateur")}</p>

      {/* Traffic lights */}
      <div className="flex gap-5 mb-3 justify-center">
        {data.map(d => (
          <div key={d.status} className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.color, boxShadow: d.count > 0 ? `0 0 10px ${d.color}30` : undefined }}>
              {d.count}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium leading-tight">{d.status}</span>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">Aucun collaborateur</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} margin={{ left: 0, right: 5, top: 12, bottom: 0 }}>
            <XAxis dataKey="status" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} width={25} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} ${pluralize(v, "collaborateur")}`, ""]} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={900} barSize={32}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
