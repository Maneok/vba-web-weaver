import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, formatEuros, MISSION_COLORS, TOOLTIP_STYLE, pluralize } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function RevenueChart({ clients, loading }: Props) {
  const { data, totalCA } = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>();
    for (const c of clients) {
      if (!isActiveClient(c) || !c.mission) continue;
      const entry = map.get(c.mission);
      if (entry) { entry.ca += c.honoraires ?? 0; entry.count++; }
      else map.set(c.mission, { ca: c.honoraires ?? 0, count: 1 });
    }
    let sumCA = 0;
    const items = Array.from(map, ([mission, { ca, count }]) => {
      sumCA += ca;
      return { mission, ca, count, label: formatEuros(ca) };
    }).sort((a, b) => b.ca - a.ca);
    return { data: items, totalCA: sumCA };
  }, [clients]);

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
        <h3 className="text-sm font-semibold text-foreground leading-tight">Chiffre d'affaires</h3>
        <span className="text-xs font-bold tabular-nums text-primary">{formatEuros(totalCA)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Par mission · {data.length} {pluralize(data.length, "type")}</p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Aucune donnée de CA</div>
      ) : (
        <ResponsiveContainer width="100%" height={225}>
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 48, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => formatEuros(v)} />
            <YAxis type="category" dataKey="mission" width={100} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _: string, e: any) => [`${formatEuros(v)} · ${e.payload.count} ${pluralize(e.payload.count, "dossier")}`, ""]} />
            <Bar dataKey="ca" radius={[0, 6, 6, 0]} animationDuration={900} barSize={16}>
              {data.map(e => <Cell key={e.mission} fill={MISSION_COLORS[e.mission] ?? "#64748b"} />)}
              <LabelList dataKey="label" position="right" style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
