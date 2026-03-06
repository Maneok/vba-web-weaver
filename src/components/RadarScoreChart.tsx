import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
import type { ScoreHistoryEntry } from "@/lib/types";

interface Props {
  scores: {
    scoreActivite: number;
    scorePays: number;
    scoreMission: number;
    scoreMaturite: number;
    scoreStructure: number;
    malus: number;
  };
  compareScores?: {
    scoreActivite: number;
    scorePays: number;
    scoreMission: number;
    scoreMaturite: number;
    scoreStructure: number;
    malus: number;
  };
  height?: number;
}

export default function RadarScoreChart({ scores, compareScores, height = 280 }: Props) {
  const data = [
    { axis: "Activité", current: scores.scoreActivite, ...(compareScores && { simulated: compareScores.scoreActivite }) },
    { axis: "Pays", current: scores.scorePays, ...(compareScores && { simulated: compareScores.scorePays }) },
    { axis: "Mission", current: scores.scoreMission, ...(compareScores && { simulated: compareScores.scoreMission }) },
    { axis: "Maturité", current: scores.scoreMaturite, ...(compareScores && { simulated: compareScores.scoreMaturite }) },
    { axis: "Structure", current: scores.scoreStructure, ...(compareScores && { simulated: compareScores.scoreStructure }) },
    { axis: "Malus", current: Math.min(scores.malus, 100), ...(compareScores && { simulated: Math.min(compareScores.malus, 100) }) },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar name="Actuel" dataKey="current" stroke="hsl(220, 60%, 40%)" fill="hsl(220, 60%, 40%)" fillOpacity={0.3} />
        {compareScores && (
          <Radar name="Simulation" dataKey="simulated" stroke="hsl(0, 72%, 51%)" fill="hsl(0, 72%, 51%)" fillOpacity={0.15} strokeDasharray="5 5" />
        )}
        <Tooltip />
        {compareScores && <Legend />}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Score history timeline mini-chart
export function ScoreHistoryChart({ history }: { history: ScoreHistoryEntry[] }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Historique des scores</h4>
      <div className="space-y-1">
        {history.slice(-10).map((entry, i) => (
          <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-muted last:border-0">
            <span className="font-mono text-muted-foreground w-20 shrink-0">{entry.date}</span>
            <span className={`font-bold w-8 text-center ${
              entry.scoreGlobal <= 25 ? "text-green-600" :
              entry.scoreGlobal < 60 ? "text-amber-600" :
              "text-red-600"
            }`}>{entry.scoreGlobal}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              entry.nivVigilance === "SIMPLIFIEE" ? "bg-green-100 text-green-700" :
              entry.nivVigilance === "STANDARD" ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            }`}>{entry.nivVigilance}</span>
            <span className="text-muted-foreground truncate">{entry.motif}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
