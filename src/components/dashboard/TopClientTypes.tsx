import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, PALETTE, TOOLTIP_STYLE, pct, pluralize } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function TopClientTypes({ clients, loading }: Props) {
  const { data, total } = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const c of clients) {
      if (!isActiveClient(c) || !c.forme) continue;
      map.set(c.forme, (map.get(c.forme) ?? 0) + 1);
      count++;
    }
    const items = Array.from(map, ([forme, n]) => ({ forme, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { data: items, total: count };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Top 5 — Typologie</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} {pluralize(total, "client")}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Par forme juridique</p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Aucun client actif</div>
      ) : (
        <ResponsiveContainer width="100%" height={225}>
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 30, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <YAxis type="category" dataKey="forme" width={95} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} ${pluralize(v, "dossier")} (${pct(v, total)}%)`, ""]} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={900} barSize={18}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i]} />)}
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
