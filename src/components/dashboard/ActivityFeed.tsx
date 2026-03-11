import { Activity } from "lucide-react";
import type { LogEntry } from "@/lib/types";
import { timeAgo } from "@/lib/dateUtils";

interface ActivityFeedProps {
  logs: LogEntry[];
  loading?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ACTION_COLORS: Record<string, string> = {
  CREATION: "bg-emerald-500",
  "REVUE/MAJ": "bg-blue-500",
  SUPPRESSION: "bg-red-500",
  ALERTE: "bg-orange-500",
  CONNEXION: "bg-violet-500",
  DECONNEXION: "bg-slate-500",
};

const ACTION_LABELS: Record<string, string> = {
  CREATION: "Création",
  "REVUE/MAJ": "Mise à jour",
  SUPPRESSION: "Suppression",
  ALERTE: "Alerte",
  CONNEXION: "Connexion",
  DECONNEXION: "Déconnexion",
};

export function ActivityFeed({ logs, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-56 h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const recent = logs.slice(0, 10);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
        Activité récente
        {recent.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-normal">
            ({recent.length} dernière{recent.length > 1 ? "s" : ""} action{recent.length > 1 ? "s" : ""})
          </span>
        )}
      </h3>

      {recent.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune activité récente</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Les actions effectuées apparaîtront ici</p>
        </div>
      ) : (
        <>
          {/* Desktop: horizontal scrollable */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Activités récentes">
            {recent.map((log, i) => (
              <div
                key={`${log.horodatage}-${log.typeAction}-${i}`}
                role="listitem"
                className="shrink-0 w-60 bg-muted/30 rounded-xl p-3 border border-border/50 hover:border-border hover:bg-muted/50 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${ACTION_COLORS[log.typeAction] || "bg-slate-500"}`}
                    title={ACTION_LABELS[log.typeAction] || log.typeAction}
                  >
                    {getInitials(log.utilisateur || "U")}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium truncate max-w-[140px]">{log.utilisateur}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(log.horodatage)}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2">{log.details}</p>
              </div>
            ))}
          </div>

          {/* Mobile: vertical list */}
          <div className="md:hidden space-y-2" role="list" aria-label="Activités récentes">
            {recent.map((log, i) => (
              <div
                key={`${log.horodatage}-${log.typeAction}-${i}`}
                role="listitem"
                className="flex items-start gap-3 py-2"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${ACTION_COLORS[log.typeAction] || "bg-slate-500"}`}
                  title={ACTION_LABELS[log.typeAction] || log.typeAction}
                >
                  {getInitials(log.utilisateur || "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed line-clamp-2">{log.details}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(log.horodatage)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
