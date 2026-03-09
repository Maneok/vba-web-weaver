import { useMemo } from "react";
import { useCountUp } from "@/hooks/useCountUp";

interface CabinetHealthScoreProps {
  tauxConformite: number;
  mttrDays: number;
  formationsAJour: number;
  revuesAJour: number;
  totalActions: number;
  loading?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export function CabinetHealthScore({
  tauxConformite,
  mttrDays,
  formationsAJour,
  revuesAJour,
  totalActions,
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

  const animatedScore = useCountUp(score, 1800);
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (animatedScore / 100) * circumference;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-[120px] h-[120px] rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse mt-4" />
      </div>
    );
  }

  // Contextual phrase
  let phrase: string;
  let phraseColor: string;
  if (score >= 75) {
    phrase = "Votre cabinet est en conformite";
    phraseColor = "#10B981";
  } else if (score >= 50) {
    phrase = `${totalActions} action${totalActions > 1 ? "s" : ""} requise${totalActions > 1 ? "s" : ""}`;
    phraseColor = "#F59E0B";
  } else {
    phrase = "Conformite incomplete \u2014 actions urgentes";
    phraseColor = "#EF4444";
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Animated SVG gauge — 120px diameter */}
      <div className="relative" style={{ width: 120, height: 120 }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="7"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>
            {animatedScore}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>

      {/* Contextual phrase */}
      <p className="mt-3 text-sm font-medium" style={{ color: phraseColor }}>
        {phrase}
      </p>

      {/* Sub-score breakdown — compact */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>Conformite {tauxConformite}%</span>
        <span className="text-border">|</span>
        <span>MTTR {mttrDays}j</span>
        <span className="text-border">|</span>
        <span>Formations {formationsAJour}%</span>
        <span className="text-border">|</span>
        <span>Revues {revuesAJour}%</span>
      </div>
    </div>
  );
}
