import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ZAxis,
} from "recharts";
import { Target } from "lucide-react";
import type { Client } from "@/lib/types";

interface RiskHeatmapProps {
  clients: Client[];
  loading?: boolean;
}

function vigilanceColor(niv: string): string {
  if (niv === "SIMPLIFIEE") return "#22c55e";
  if (niv === "STANDARD") return "#f59e0b";
  return "#ef4444";
}

function countRiskFactors(c: Client): number {
  let count = 0;
  if (c.ppe === "OUI") count++;
  if (c.paysRisque === "OUI") count++;
  if (c.atypique === "OUI") count++;
  if (c.distanciel === "OUI") count++;
  if (c.cash === "OUI") count++;
  if (c.pression === "OUI") count++;
  return count;
}

export function RiskHeatmap({ clients, loading = false }: RiskHeatmapProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-4 w-48 rounded skeleton-shimmer mb-4" />
        <div className="h-64 rounded-xl skeleton-shimmer" />
      </div>
    );
  }

  const data = clients
    .filter(c => c.scoreGlobal > 0)
    .map(c => ({
      x: c.scoreGlobal,
      y: countRiskFactors(c),
      name: c.raisonSociale,
      siren: c.siren,
      score: c.scoreGlobal,
      vigilance: c.nivVigilance,
      z: 1,
    }));

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        Cartographie des risques
      </h3>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Aucune donnee</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="x"
                name="Score global"
                domain={[0, 120]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Score global", position: "insideBottom", offset: -5, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Facteurs de risque"
                domain={[0, 6]}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Facteurs", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 80]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-muted-foreground">SIREN : {d.siren || "\u2014"}</p>
                      <p>Score : {d.score} &mdash; {d.vigilance}</p>
                      <p>Facteurs de risque : {d.y}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={data}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={vigilanceColor(entry.vigilance)} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-3">
        {[
          { label: "Simplifiee", color: "#22c55e" },
          { label: "Standard", color: "#f59e0b" },
          { label: "Renforcee", color: "#ef4444" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
