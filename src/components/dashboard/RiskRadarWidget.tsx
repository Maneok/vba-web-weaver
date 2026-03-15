import { useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from "recharts";
import type { Client } from "@/lib/types";
import { isActiveClient, vigilanceColorFromScore, TOOLTIP_STYLE, pct } from "./dashboardUtils";

interface Props {
  clients: Client[];
  loading?: boolean;
}

export default function RiskRadarWidget({ clients, loading }: Props) {
  const { data, scoreMoyen, totalActifs } = useMemo(() => {
    const actifs = clients.filter(isActiveClient);
    const n = actifs.length;
    if (n === 0) {
      return {
        data: [
          { axis: "Activité", value: 0, max: 100, seuil: 25 },
          { axis: "Pays", value: 0, max: 100, seuil: 25 },
          { axis: "Mission", value: 0, max: 80, seuil: 25 },
          { axis: "Maturité", value: 0, max: 60, seuil: 25 },
          { axis: "Structure", value: 0, max: 60, seuil: 25 },
          { axis: "Malus", value: 0, max: 100, seuil: 25 },
        ],
        scoreMoyen: 0,
        totalActifs: 0,
      };
    }
    let sumAct = 0, sumPays = 0, sumMis = 0, sumMat = 0, sumStr = 0, sumMal = 0, sumGlobal = 0;
    for (const c of actifs) {
      sumAct += c.scoreActivite ?? 0;
      sumPays += c.scorePays ?? 0;
      sumMis += c.scoreMission ?? 0;
      sumMat += c.scoreMaturite ?? 0;
      sumStr += c.scoreStructure ?? 0;
      sumMal += c.malus ?? 0;
      sumGlobal += c.scoreGlobal ?? 0;
    }
    return {
      data: [
        { axis: "Activité", value: Math.round(sumAct / n), max: 100, seuil: 25 },
        { axis: "Pays", value: Math.round(sumPays / n), max: 100, seuil: 25 },
        { axis: "Mission", value: Math.round(sumMis / n), max: 80, seuil: 25 },
        { axis: "Maturité", value: Math.round(sumMat / n), max: 60, seuil: 25 },
        { axis: "Structure", value: Math.round(sumStr / n), max: 60, seuil: 25 },
        { axis: "Malus", value: Math.round(sumMal / n), max: 100, seuil: 25 },
      ],
      scoreMoyen: Math.round(sumGlobal / n),
      totalActifs: n,
    };
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-52 bg-muted rounded mb-4" />
        <div className="flex-1 bg-muted/40 rounded-xl mt-4 h-[230px]" />
      </div>
    );
  }

  const color = vigilanceColorFromScore(scoreMoyen);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight">Cartographie des risques</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${color}18`, color }}>{scoreMoyen}/120</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">Moyenne 6 axes · {totalActifs} client{totalActifs > 1 ? "s" : ""}</p>

      {totalActifs === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Aucun client actif</div>
      ) : (
        <ResponsiveContainer width="100%" height={235}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} tickCount={5} />
            <Radar name="Seuil" dataKey="seuil" stroke="#22c55e" strokeDasharray="4 4" fill="none" strokeWidth={1} isAnimationActive={false} />
            <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1 }} animationDuration={1000} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _: string, e: any) => e.dataKey === "seuil" ? [null, null] : [`${v} / ${e.payload.max}`, "Score"]} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
