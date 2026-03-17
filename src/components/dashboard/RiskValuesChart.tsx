import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, COLOR, TT, pct, plural } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

const FLAGS = [
  { key: "cash", label: "Cash" },
  { key: "ppe", label: "PPE" },
  { key: "paysRisque", label: "Pays risque" },
  { key: "atypique", label: "Atypique" },
  { key: "distanciel", label: "Distanciel" },
  { key: "pression", label: "Pression" },
] as const;

export default function RiskValuesChart({ clients, loading }: Props) {
  const { data, n } = useMemo(() => {
    const actifs = clients.filter(isActive);
    const counts: Record<string, number> = {};
    for (const f of FLAGS) counts[f.label] = 0;
    for (const c of actifs) {
      if (c.cash === "OUI") counts["Cash"]++;
      if (c.ppe === "OUI") counts["PPE"]++;
      if (c.paysRisque === "OUI") counts["Pays risque"]++;
      if (c.atypique === "OUI") counts["Atypique"]++;
      if (c.distanciel === "OUI") counts["Distanciel"]++;
      if (c.pression === "OUI") counts["Pression"]++;
    }
    return {
      data: FLAGS.map(f => ({ name: f.label, count: counts[f.label] })).sort((a, b) => b.count - a.count),
      n: actifs.length,
    };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  const sig = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Valeurs à risque</p>
        <span className="text-xs text-muted-foreground tabular-nums">{sig} {plural(sig, "signal", "signaux")}</span>
      </div>

      {n === 0 ? (
        <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">Aucun client</div>
      ) : (
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 30, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={TT} formatter={(v: number) => [`${v} ${plural(v, "client")} (${pct(v, n)}%)`, ""]} />
            <Bar dataKey="count" fill={COLOR.primary} radius={[0, 4, 4, 0]} animationDuration={800} barSize={14}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
