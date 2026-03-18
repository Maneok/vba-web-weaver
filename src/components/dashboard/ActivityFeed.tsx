import { Activity } from "lucide-react";
import type { LogEntry } from "@/lib/types";
import { timeAgo } from "@/lib/dateUtils";

interface ActivityFeedProps {
  logs: LogEntry[];
  loading?: boolean;
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
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            <div className="w-2 h-2 rounded-full bg-muted animate-pulse mt-1.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-2 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-gray-300 dark:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
        Activité récente
      </h3>

      {logs.length === 0 ? (
        <div className="text-center py-6">
          <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Aucune activité récente</p>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Activités récentes">
          {logs.map((log, i) => {
            const desc = String(
              log.details ||
                `${ACTION_LABELS[log.typeAction] || log.typeAction}${log.refClient ? ` — ${log.refClient}` : ""}`
            );
            return (
              <div
                key={`${log.horodatage}-${log.typeAction}-${i}`}
                role="listitem"
                className="flex items-start gap-3"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTION_COLORS[log.typeAction] || "bg-slate-500"}`}
                  title={ACTION_LABELS[log.typeAction] || log.typeAction}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed line-clamp-1">{desc}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(log.horodatage)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
