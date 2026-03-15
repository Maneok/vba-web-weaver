import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { Collaborateur } from "@/lib/types";

interface Props {
  collaborateurs: Collaborateur[];
  loading?: boolean;
}

const STATUS_CONFIG = [
  { key: "A JOUR", label: "À jour", color: "#22c55e" },
  { key: "A FORMER", label: "À former", color: "#f59e0b" },
  { key: "JAMAIS FORME", label: "Jamais formé", color: "#ef4444" },
];

export default function TrainingStatusWidget({ collaborateurs, loading }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, number> = { "A JOUR": 0, "A FORMER": 0, "JAMAIS FORME": 0 };
    for (const col of collaborateurs) {
      const status = (col.statutFormation ?? "").toUpperCase().trim();
      if (status.includes("JOUR")) counts["A JOUR"]++;
      else if (status.includes("FORMER")) counts["A FORMER"]++;
      else counts["JAMAIS FORME"]++;
    }
    return STATUS_CONFIG.map(s => ({
      status: s.label,
      count: counts[s.key],
      color: s.color,
    }));
  }, [collaborateurs]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 h-[320px] animate-pulse">
        <div className="h-4 w-56 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded-xl" />
      </div>
    );
  }

  const total = collaborateurs.length;
  const aJourCount = data[0]?.count ?? 0;
  const tauxFormation = total > 0 ? Math.round((aJourCount / total) * 100) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 h-[320px]">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">
          LCB-FT : Formation des collaborateurs
        </h3>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: tauxFormation >= 80 ? "#22c55e20" : tauxFormation >= 50 ? "#f59e0b20" : "#ef444420",
            color: tauxFormation >= 80 ? "#22c55e" : tauxFormation >= 50 ? "#f59e0b" : "#ef4444",
          }}
        >
          {tauxFormation}%
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{total} collaborateur{total > 1 ? "s" : ""}</p>

      {/* Traffic light indicators */}
      <div className="flex gap-5 mb-4 justify-center">
        {data.map(d => (
          <div key={d.status} className="flex flex-col items-center gap-1.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                d.status === "Jamais formé" && d.count > 0 ? "animate-pulse" : ""
              }`}
              style={{
                backgroundColor: d.color,
                boxShadow: d.count > 0 ? `0 0 12px ${d.color}40` : undefined,
              }}
            >
              {d.count}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{d.status}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ left: 0, right: 10, top: 15, bottom: 5 }}>
          <XAxis
            dataKey="status"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [`${value} collaborateur${value > 1 ? "s" : ""}`, ""]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1000} barSize={36}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 12, fontWeight: 700, fill: "hsl(var(--foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
