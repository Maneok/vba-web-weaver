import { Target, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ComplianceGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  description: string;
}

interface DashboardGoalsProps {
  goals: ComplianceGoal[];
  isLoading: boolean;
}

function getProgressColor(current: number, target: number): string {
  if (current >= target) return "bg-green-500";
  if (current >= target * 0.75) return "bg-amber-500";
  return "bg-red-500";
}

export default function DashboardGoals({ goals, isLoading }: DashboardGoalsProps) {
  const achievedCount = goals.filter((g) => g.current >= g.target).length;

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm">Objectifs de conformité</h3>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Target className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Aucun objectif défini</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {goals.map((goal) => {
              const isAchieved = goal.current >= goal.target;
              const progressPct = Math.min((goal.current / Math.max(goal.target, 1)) * 100, 100);
              const barColor = getProgressColor(goal.current, goal.target);

              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{goal.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {goal.current}% / {goal.target}%
                      </span>
                      {isAchieved && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />
                          Atteint
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground leading-snug">{goal.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{achievedCount}/{goals.length}</span>{" "}
              objectif{goals.length > 1 ? "s" : ""} atteint{achievedCount > 1 ? "s" : ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
