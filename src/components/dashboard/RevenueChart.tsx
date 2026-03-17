import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, formatEuros, COLOR, TT, plural } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

export default function RevenueChart({ clients, loading }: Props) {
  const { data, totalCA } = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>();
    for (const c of clients) {
      if (!isActive(c) || !c.mission) continue;
      const e = map.get(c.mission);
      if (e) { e.ca += c.honoraires ?? 0; e.count++; }
      else map.set(c.mission, { ca: c.honoraires ?? 0, count: 1 });
    }
    let sum = 0;
    const items = Array.from(map, ([mission, { ca, count }]) => { sum += ca; return { mission, ca, count, label: formatEuros(ca) }; })
      .sort((a, b) => b.ca - a.ca);
    return { data: items, totalCA: sum };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Chiffre d'affaires</p>
        <span className="text-xs font-semibold tabular-nums" style={{ color: COLOR.primary }}>{formatEuros(totalCA)}</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucune donnée</div>
      ) : (
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 42, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => formatEuros(v)} />
            <YAxis type="category" dataKey="mission" width={95} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={TT} formatter={(v: number, _: string, e: any) => [`${formatEuros(v)} · ${e.payload.count} ${plural(e.payload.count, "dossier")}`, ""]} />
            <Bar dataKey="ca" fill={COLOR.primary} radius={[0, 4, 4, 0]} animationDuration={800} barSize={14}>
              <LabelList dataKey="label" position="right" style={{ fontSize: 9, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
