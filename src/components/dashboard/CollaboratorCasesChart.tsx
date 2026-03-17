import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, COLOR, TT, plural } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

export default function CollaboratorCasesChart({ clients, loading }: Props) {
  const { data, avg } = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!isActive(c)) continue;
      const key = c.comptable?.trim() || "Non assigné";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const items = Array.from(map, ([nom, count]) => ({ nom, count })).sort((a, b) => b.count - a.count);
    const a = items.length > 0 ? Math.round(items.reduce((s, d) => s + d.count, 0) / items.length) : 0;
    return { data: items, avg: a };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Dossiers / collaborateur</p>
        <span className="text-xs text-muted-foreground">moy. {avg}</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun dossier</div>
      ) : (
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={data} margin={{ left: 0, right: 5, top: 12, bottom: 0 }}>
            <XAxis dataKey="nom" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} height={25} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} width={25} />
            <Tooltip contentStyle={TT} formatter={(v: number) => [`${v} ${plural(v, "dossier")}`, ""]} />
            <Bar dataKey="count" fill={COLOR.primary} radius={[4, 4, 0, 0]} animationDuration={800} barSize={24}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
