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
  const { data, scoreMoyen } = useMemo(() => {
    const actifs = clients.filter(c => c.statut !== "INACTIF");
    const n = actifs.length || 1;
    const axes = [
      { axis: "Activité", value: Math.round(actifs.reduce((s, c) => s + (c.scoreActivite ?? 0), 0) / n), max: 100 },
      { axis: "Pays", value: Math.round(actifs.reduce((s, c) => s + (c.scorePays ?? 0), 0) / n), max: 100 },
      { axis: "Mission", value: Math.round(actifs.reduce((s, c) => s + (c.scoreMission ?? 0), 0) / n), max: 80 },
      { axis: "Maturité", value: Math.round(actifs.reduce((s, c) => s + (c.scoreMaturite ?? 0), 0) / n), max: 60 },
      { axis: "Structure", value: Math.round(actifs.reduce((s, c) => s + (c.scoreStructure ?? 0), 0) / n), max: 60 },
      { axis: "Malus", value: Math.round(actifs.reduce((s, c) => s + (c.malus ?? 0), 0) / n), max: 100 },
    ];
    // Add a "seuil" (threshold) reference at 25 (SIMPLIFIEE_MAX) for each axis
    const dataWithSeuil = axes.map(a => ({
      ...a,
      seuil: 25,
    }));
    const moyenneGlobale = Math.round(actifs.reduce((s, c) => s + (c.scoreGlobal ?? 0), 0) / n);
    return { data: dataWithSeuil, scoreMoyen: moyenneGlobale };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const vigilanceColor = scoreMoyen <= 25 ? "#22c55e" : scoreMoyen <= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          LCB-FT : Cartographie des risques cabinet
        </h3>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${vigilanceColor}20`, color: vigilanceColor }}
        >
          {scoreMoyen}/100
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">Moyenne des 6 axes de scoring</p>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
            tickCount={5}
          />
          {/* Reference threshold at 25 (seuil simplifiée) */}
          <Radar
            name="Seuil simplifiée"
            dataKey="seuil"
            stroke="#22c55e"
            strokeDasharray="4 4"
            fill="none"
            strokeWidth={1}
            isAnimationActive={false}
          />
          {/* Actual scores */}
          <Radar
            name="Score moyen"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1 }}
            isAnimationActive
            animationDuration={1200}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number, name: string, entry: any) => {
              if (name === "Seuil simplifiée") return [null, null];
              return [`${value} / ${entry.payload.max}`, "Score moyen"];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
