import { CalendarClock, Clock, FileText, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Deadline {
  id: string;
  title: string;
  date: string;
  type: "revue" | "lettre_mission" | "formation";
  clientRef?: string;
}

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
  loading?: boolean;
}

const TYPE_CONFIG = {
  revue: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
  lettre_mission: { icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10" },
  formation: { icon: GraduationCap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function UpcomingDeadlines({ deadlines, loading = false }: UpcomingDeadlinesProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-44 bg-muted rounded animate-pulse mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-2.5 w-1/3 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-primary" />
        Prochaines echeances
      </h3>

      {deadlines.length === 0 ? (
        <div className="text-center py-8">
          <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune echeance a venir</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

          <div className="space-y-0.5">
            {deadlines.slice(0, 5).map((d) => {
              const days = daysUntil(d.date);
              const isUrgent = days <= 7;
              const isOverdue = days < 0;
              const config = TYPE_CONFIG[d.type];
              const Icon = config.icon;

              return (
                <div key={d.id} className="flex items-start gap-3 py-3 pl-0 relative">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 z-10 ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{d.title}</span>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          En retard
                        </Badge>
                      )}
                      {!isOverdue && isUrgent && (
                        <Badge className="bg-orange-500/15 text-orange-500 border-0 text-[10px] px-1.5 py-0">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-400" : isUrgent ? "text-orange-400" : "text-muted-foreground"}`}>
                      {formatDate(d.date)}
                      {!isOverdue && ` \u2014 dans ${days} jour${days > 1 ? "s" : ""}`}
                      {isOverdue && ` \u2014 ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""} de retard`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
