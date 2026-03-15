import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, PALETTE, TOOLTIP_STYLE, pluralize } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function CollaboratorCasesChart({ clients, loading }: Props) {
  const { data, avg } = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!isActiveClient(c)) continue;
      const key = c.comptable?.trim() || "Non assigné";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const items = Array.from(map, ([nom, count]) => ({ nom, count })).sort((a, b) => b.count - a.count);
    const avgVal = items.length > 0 ? Math.round(items.reduce((s, d) => s + d.count, 0) / items.length) : 0;
    return { data: items, avg: avgVal };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-56 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  const needsRotation = data.length > 5;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Dossiers / collaborateur</h3>
        <span className="text-xs text-muted-foreground">moy. {avg}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{data.length} {pluralize(data.length, "collaborateur")}</p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Aucun dossier assigné</div>
      ) : (
        <ResponsiveContainer width="100%" height={225}>
          <BarChart data={data} margin={{ left: 0, right: 5, top: 15, bottom: needsRotation ? 20 : 0 }}>
            <XAxis dataKey="nom" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={needsRotation ? -20 : 0} textAnchor={needsRotation ? "end" : "middle"} height={needsRotation ? 45 : 25} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} width={28} />
            {avg > 0 && <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />}
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} ${pluralize(v, "dossier")}`, ""]} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={900} barSize={Math.min(28, Math.max(16, 200 / data.length))}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
