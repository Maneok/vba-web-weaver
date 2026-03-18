import { useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, ResponsiveContainer,
} from "recharts";
import { Shield } from "lucide-react";

interface ComplianceItem {
  label: string;
  value: number;
  target: number;
  description: string;
}

interface ComplianceRadarProps {
  items: ComplianceItem[];
  score: number;
  isLoading?: boolean;
}

const SHORT_LABELS: Record<string, string> = {
  "Identification clients": "Ident.",
  "Documents KYC": "KYC",
  "Lettres de mission": "LM",
  "Formation collaborateurs": "Form.",
  "Bénéficiaires effectifs": "BE",
  "Adresses vérifiées": "Adr.",
  "Contrôle qualité": "Ctrl.",
};

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export default function ComplianceRadar({ items, score, isLoading = false }: ComplianceRadarProps) {
  const radarData = useMemo(() =>
    items.map(item => ({
      subject: SHORT_LABELS[item.label] || item.label,
      value: item.value,
      fullMark: 100,
      label: item.label,
      target: item.target,
      description: item.description,
    })),
    [items]
  );

  const objectifsAtteints = useMemo(() =>
    items.filter(item => item.value >= item.target).length,
    [items]
  );

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-44 bg-muted rounded animate-pulse mb-4" />
        <div className="h-[280px] bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-2xl border border-border p-5 hover:border-gray-300 dark:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid"
      role="figure"
      aria-label={`Radar de conformité LCB-FT : ${score}%`}
    >
      {/* Header with title and score */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
          Conformité LCB-FT
        </h3>
        <span className={`text-3xl font-bold tabular-nums ${scoreColorClass(score)}`}>
          {score}%
        </span>
      </div>

      {/* Radar chart */}
      <div className="min-h-[280px]">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="hsl(215, 20%, 25%)" strokeOpacity={0.6} />
            <PolarAngleAxis
              dataKey="subject"
              tick={({ x, y, textAnchor, payload }: any) => {
                const item = radarData.find(d => d.subject === payload.value);
                const val = item?.value ?? 0;
                const met = item ? val >= item.target : false;
                return (
                  <text
                    x={x}
                    y={y}
                    dy={4}
                    textAnchor={textAnchor}
                    fill={met ? "hsl(142, 71%, 45%)" : "hsl(215, 20%, 55%)"}
                    fontSize={11}
                  >
                    <tspan fontWeight={500}>{payload.value}</tspan>
                    <tspan dx={3} opacity={0.8}>{val}%</tspan>
                  </text>
                );
              }}
            />
            <Radar
              name="Conformité"
              dataKey="value"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fill="hsl(217, 91%, 60%)"
              fillOpacity={0.3}
              dot={{ r: 4, fill: "hsl(217, 91%, 60%)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--card-foreground))",
              }}
              formatter={(_value: number, _name: string, props: any) => {
                const item = radarData.find(d => d.subject === props.payload.subject);
                return [
                  `${item?.value ?? 0}% — Objectif : ${item?.target ?? 0}%`,
                  item?.label || props.payload.subject,
                ];
              }}
              labelStyle={{ color: "hsl(var(--card-foreground))" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary with objective dots */}
      <div className="flex items-center justify-center gap-1.5 mt-1">
        {items.map((item, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${item.value >= item.target ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
            title={`${SHORT_LABELS[item.label] || item.label} : ${item.value >= item.target ? "atteint" : "non atteint"}`}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          <span className="font-medium text-foreground">{objectifsAtteints}/{items.length}</span>{" "}
          objectifs
        </span>
      </div>
    </div>
  );
}
