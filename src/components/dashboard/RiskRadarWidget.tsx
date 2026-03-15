import { useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from "recharts";
import type { Client } from "@/lib/types";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function RiskRadarWidget({ clients, loading }: Props) {
  const data = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    const n = actifs.length || 1;
    return [
      { axis: "Activité", value: Math.round(actifs.reduce((s, c) => s + (c.scoreActivite ?? 0), 0) / n), max: 100 },
      { axis: "Pays", value: Math.round(actifs.reduce((s, c) => s + (c.scorePays ?? 0), 0) / n), max: 100 },
      { axis: "Mission", value: Math.round(actifs.reduce((s, c) => s + (c.scoreMission ?? 0), 0) / n), max: 80 },
      { axis: "Maturité", value: Math.round(actifs.reduce((s, c) => s + (c.scoreMaturite ?? 0), 0) / n), max: 60 },
      { axis: "Structure", value: Math.round(actifs.reduce((s, c) => s + (c.scoreStructure ?? 0), 0) / n), max: 60 },
      { axis: "Malus", value: Math.round(actifs.reduce((s, c) => s + (c.malus ?? 0), 0) / n), max: 100 },
    ];
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        LCB-FT : Cartographie des risques cabinet
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">Moyenne des 6 axes de scoring</p>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickCount={5}
          />
          <Radar
            name="Score moyen"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            isAnimationActive
            animationDuration={1200}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _: string, entry: any) =>
              [`${value} / ${entry.payload.max}`, "Score moyen"]
            }
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
