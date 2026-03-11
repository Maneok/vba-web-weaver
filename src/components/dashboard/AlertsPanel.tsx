import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight, Filter } from "lucide-react";
import type { AlerteRegistre } from "@/lib/types";

type AlertFilter = "all" | "open" | "closed";

interface AlertsPanelProps {
  alertes: AlerteRegistre[];
  loading?: boolean;
}

function statusBadge(statut: string) {
  const s = statut?.toUpperCase() || "";
  if (s.includes("CLOS") || s.includes("FERME") || s.includes("RESOLU"))
    return <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px]">Clos</Badge>;
  if (s.includes("TRACFIN"))
    return <Badge className="bg-red-500/15 text-red-500 border-0 text-[10px]">TRACFIN</Badge>;
  return <Badge className="bg-orange-500/15 text-orange-500 border-0 text-[10px]">En cours</Badge>;
}

function priorityIndicator(priorite: string | undefined) {
  if (!priorite) return null;
  const p = priorite.toUpperCase();
  if (p === "CRITIQUE") return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" title="Priorité critique" />;
  if (p === "HAUTE") return <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Priorité haute" />;
  return null;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

function isAlertOpen(a: AlerteRegistre): boolean {
  const s = (a.statut || "").toUpperCase();
  return !s.includes("CLOS") && !s.includes("FERME") && !s.includes("RESOLU");
}

export function AlertsPanel({ alertes, loading = false }: AlertsPanelProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AlertFilter>("all");

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="h-5 w-36 bg-muted rounded animate-pulse mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Filter alerts
  const filteredAlertes = alertes.filter(a => {
    if (filter === "open") return isAlertOpen(a);
    if (filter === "closed") return !isAlertOpen(a);
    return true;
  });

  const openCount = alertes.filter(isAlertOpen).length;
  const closedCount = alertes.length - openCount;

  // Sort: open alerts first, then by priority, then by date
  const sortedAlertes = [...filteredAlertes].sort((a, b) => {
    const aOpen = isAlertOpen(a);
    const bOpen = isAlertOpen(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const prio = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 } as Record<string, number>;
    const ap = prio[(a.priorite || "").toUpperCase()] ?? 4;
    const bp = prio[(b.priorite || "").toUpperCase()] ?? 4;
    if (ap !== bp) return ap - bp;
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" aria-hidden="true" />
          Alertes récentes
          {alertes.length > 0 && (
            <span className="text-[10px] bg-orange-500/15 text-orange-500 rounded-full px-1.5 py-0.5 font-bold">
              {alertes.filter(a => {
                const s = (a.statut || "").toUpperCase();
                return !s.includes("CLOS") && !s.includes("FERME") && !s.includes("RESOLU");
              }).length}
            </span>
          )}
        </h3>
        <button
          className="text-xs text-primary hover:underline flex items-center gap-1"
          onClick={() => navigate("/registre")}
          aria-label="Voir toutes les alertes dans le registre"
        >
          Voir tout <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Filter chips */}
      {alertes.length > 0 && (
        <div className="flex gap-1.5 mb-3 print:hidden" role="group" aria-label="Filtrer les alertes">
          {([
            { key: "all" as AlertFilter, label: "Tout", count: alertes.length },
            { key: "open" as AlertFilter, label: "En cours", count: openCount },
            { key: "closed" as AlertFilter, label: "Clos", count: closedCount },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {alertes.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune alerte récente</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Les alertes LCB-FT apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-0.5" role="list" aria-label="Liste des alertes récentes">
          {sortedAlertes.slice(0, 5).map((a, i) => (
            <button
              key={`${a.date}-${a.clientConcerne}-${i}`}
              role="listitem"
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-white/[0.06] transition-all duration-200 text-left"
              onClick={() => navigate("/registre")}
              aria-label={`Alerte ${a.clientConcerne} — ${a.categorie} — ${a.statut}`}
            >
              {priorityIndicator(a.priorite)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{a.clientConcerne}</span>
                  {statusBadge(a.statut)}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {a.categorie} &mdash; {formatDate(a.date)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
