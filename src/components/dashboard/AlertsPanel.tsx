import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { AlerteRegistre } from "@/lib/types";

interface AlertsPanelProps {
  alertes: AlerteRegistre[];
  loading?: boolean;
}

function statusBadge(statut: string) {
  const s = statut?.toUpperCase() || "";
  if (s.includes("CLOS") || s.includes("FERME") || s.includes("RESOLU"))
    return <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px]">CLOS</Badge>;
  if (s.includes("TRACFIN"))
    return <Badge className="bg-red-500/15 text-red-500 border-0 text-[10px]">TRACFIN</Badge>;
  return <Badge className="bg-orange-500/15 text-orange-500 border-0 text-[10px]">EN COURS</Badge>;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

export function AlertsPanel({ alertes, loading = false }: AlertsPanelProps) {
  const navigate = useNavigate();

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

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Alertes recentes
        </h3>
        <button
          className="text-xs text-primary hover:underline flex items-center gap-1"
          onClick={() => navigate("/registre")}
        >
          Voir tout <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {alertes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Aucune alerte recente</p>
      ) : (
        <div className="space-y-0.5">
          {alertes.slice(0, 5).map((a, i) => (
            <button
              key={a.id || i}
              className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              onClick={() => navigate("/registre")}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{a.clientConcerne}</span>
                  {statusBadge(a.statut)}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {a.categorie} &mdash; {formatDate(a.date)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
