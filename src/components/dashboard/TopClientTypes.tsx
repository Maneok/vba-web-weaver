import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, COLOR, TT, pct, plural } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

export default function TopClientTypes({ clients, loading }: Props) {
  const { data, total } = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const c of clients) {
      if (!isActive(c) || !c.forme) continue;
      map.set(c.forme, (map.get(c.forme) ?? 0) + 1);
      count++;
    }
    return {
      data: Array.from(map, ([forme, n]) => ({ forme, count: n })).sort((a, b) => b.count - a.count).slice(0, 5),
      total: count,
    };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Top 5 — Typologie</p>
        <span className="text-xs text-muted-foreground tabular-nums">{total} {plural(total, "client")}</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun client</div>
      ) : (
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 28, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <YAxis type="category" dataKey="forme" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={TT} formatter={(v: number) => [`${v} ${plural(v, "dossier")} (${pct(v, total)}%)`, ""]} />
            <Bar dataKey="count" fill={COLOR.purple} radius={[0, 4, 4, 0]} animationDuration={800} barSize={14}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
