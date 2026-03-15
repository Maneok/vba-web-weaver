import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, RISK_FACTOR_COLORS, TOOLTIP_STYLE, pct, pluralize } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

type Flag = "cash" | "ppe" | "paysRisque" | "atypique" | "distanciel" | "pression";
const FLAGS: { key: Flag; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "ppe", label: "PPE" },
  { key: "paysRisque", label: "Pays risque" },
  { key: "atypique", label: "Atypique" },
  { key: "distanciel", label: "Distanciel" },
  { key: "pression", label: "Pression" },
];

export default function RiskValuesChart({ clients, loading }: Props) {
  const { data, totalActifs, totalSignaux } = useMemo(() => {
    const actifs = clients.filter(isActiveClient);
    const n = actifs.length;
    // Single pass through clients
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
    const items = FLAGS.map(f => ({
      name: f.label,
      count: counts[f.label],
      pctVal: pct(counts[f.label], n),
    })).sort((a, b) => b.count - a.count);
    const sig = items.reduce((s, d) => s + d.count, 0);
    return { data: items, totalActifs: n, totalSignaux: sig };
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
        <h3 className="text-sm font-semibold text-foreground leading-tight">Valeurs à risque</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{totalSignaux} {pluralize(totalSignaux, "signal", "signaux")}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Sur {totalActifs} {pluralize(totalActifs, "client")} {pluralize(totalActifs, "actif")}</p>

      {totalActifs === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Aucun client actif</div>
      ) : (
        <ResponsiveContainer width="100%" height={225}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 35, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _: string, e: any) => [`${v} ${pluralize(v, "client")} (${e.payload.pctVal}%)`, ""]} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={900} barSize={16}>
              {data.map(e => <Cell key={e.name} fill={RISK_FACTOR_COLORS[e.name] ?? "#64748b"} />)}
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
