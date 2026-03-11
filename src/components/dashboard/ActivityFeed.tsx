import { Activity } from "lucide-react";
import type { LogEntry } from "@/lib/types";

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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T"));
  if (isNaN(date.getTime())) return dateStr;

  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const ACTION_COLORS: Record<string, string> = {
  CREATION: "bg-emerald-500",
  "REVUE/MAJ": "bg-blue-500",
  SUPPRESSION: "bg-red-500",
  ALERTE: "bg-orange-500",
  CONNEXION: "bg-violet-500",
  DECONNEXION: "bg-slate-500",
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
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        Activite recente
      </h3>

      {recent.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">Aucune activite recente</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Les actions de votre equipe apparaitront ici</p>
        </div>
      ) : (
        <>
          {/* Desktop: horizontal scrollable */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {recent.map((log, i) => (
              <div
                key={i}
                className="shrink-0 w-60 bg-muted/30 rounded-xl p-3 border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${ACTION_COLORS[log.typeAction] || "bg-slate-500"}`}
                  >
                    {getInitials(log.utilisateur || "U")}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(log.horodatage)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2">{log.details}</p>
              </div>
            ))}
          </div>

          {/* Mobile: vertical list */}
          <div className="md:hidden space-y-2">
            {recent.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${ACTION_COLORS[log.typeAction] || "bg-slate-500"}`}
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
