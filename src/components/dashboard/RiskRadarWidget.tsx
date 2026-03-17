import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import type { Client } from "@/lib/types";
import { isActive, scoreColor, TT } from "./dashboardUtils";

interface Props { clients: Client[]; loading?: boolean }

export default function RiskRadarWidget({ clients, loading }: Props) {
  const { data, avg } = useMemo(() => {
    const a = clients.filter(isActive);
    const n = a.length || 1;
    let sAct = 0, sPays = 0, sMis = 0, sMat = 0, sStr = 0, sMal = 0, sGlob = 0;
    for (const c of a) { sAct += c.scoreActivite ?? 0; sPays += c.scorePays ?? 0; sMis += c.scoreMission ?? 0; sMat += c.scoreMaturite ?? 0; sStr += c.scoreStructure ?? 0; sMal += c.malus ?? 0; sGlob += c.scoreGlobal ?? 0; }
    return {
      data: [
        { axis: "Activité", v: Math.round(sAct / n) },
        { axis: "Pays", v: Math.round(sPays / n) },
        { axis: "Mission", v: Math.round(sMis / n) },
        { axis: "Maturité", v: Math.round(sMat / n) },
        { axis: "Structure", v: Math.round(sStr / n) },
        { axis: "Malus", v: Math.round(sMal / n) },
      ],
      avg: Math.round(sGlob / n),
    };
  }, [clients]);

  if (loading) return <div className="bg-card rounded-xl border border-border p-4 h-[300px] animate-pulse" />;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Cartographie des risques</p>
        <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(avg) }}>{avg}/120</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 2.5, fill: "#3b82f6" }} animationDuration={800} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [`${v}/100`, "Score"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
