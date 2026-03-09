import { useMemo } from "react";
import { Heart } from "lucide-react";

interface CabinetHealthScoreProps {
  tauxConformite: number;
  mttrDays: number;
  formationsAJour: number;
  revuesAJour: number;
  loading?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function CabinetHealthScore({
  tauxConformite,
  mttrDays,
  formationsAJour,
  revuesAJour,
  loading = false,
}: CabinetHealthScoreProps) {
  const score = useMemo(() => {
    let s = 0;
    if (tauxConformite >= 80) s += 25;
    else s += Math.round((tauxConformite / 80) * 25);

    if (mttrDays <= 15) s += 25;
    else if (mttrDays <= 30) s += 15;
    else s += 5;

    if (formationsAJour >= 90) s += 25;
    else s += Math.round((formationsAJour / 90) * 25);

    if (revuesAJour >= 90) s += 25;
    else s += Math.round((revuesAJour / 90) * 25);

    return Math.min(100, s);
  }, [tauxConformite, mttrDays, formationsAJour, revuesAJour]);

  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 flex flex-col items-center">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="w-32 h-32 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Heart className="w-4 h-4 text-primary" />
        Sante du cabinet
      </h3>

      <div className="flex flex-col items-center">
        {/* Animated SVG gauge */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color }}>{score}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Conformite</span>
            <span className="font-medium">{tauxConformite}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">MTTR</span>
            <span className="font-medium">{mttrDays}j</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Formations</span>
            <span className="font-medium">{formationsAJour}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Revues</span>
            <span className="font-medium">{revuesAJour}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
