import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DashboardCockpitFilters from "./DashboardCockpitFilters";
import type { CockpitUrgency, CockpitSummary } from "@/lib/cockpitEngine";

type SeverityFilter = "all" | "critique" | "warning" | "info";
type CategoryFilter = "all" | "revision" | "cni" | "scoring" | "kyc" | "formation" | "be" | "document" | "alerte" | "autre";

interface DashboardCockpitProps {
  cockpit: CockpitSummary;
  isLoading: boolean;
}

const VISIBLE_DEFAULT = 5;

const severityDot: Record<CockpitUrgency["severity"], string> = {
  critique: "bg-red-500 animate-pulse",
  warning: "bg-orange-500",
  info: "bg-blue-500",
};

const severityBadge: Record<CockpitUrgency["severity"], { bg: string; label: string }> = {
  critique: { bg: "bg-red-500/15 text-red-500", label: "critique" },
  warning: { bg: "bg-orange-500/15 text-orange-500", label: "warning" },
  info: { bg: "bg-blue-500/15 text-blue-500", label: "info" },
};

function countBySeverity(urgencies: CockpitUrgency[]): Record<CockpitUrgency["severity"], number> {
  const counts = { critique: 0, warning: 0, info: 0 };
  for (const u of urgencies) {
    if (counts[u.severity] !== undefined) {
      counts[u.severity]++;
    }
  }
  return counts;
}

function mapTypeToCategory(type: string): CategoryFilter {
  const t = type.toLowerCase();
  if (t.includes("revision") || t.includes("revue")) return "revision";
  if (t.includes("cni") || t.includes("identite")) return "cni";
  if (t.includes("scor")) return "scoring";
  if (t.includes("kyc")) return "kyc";
  if (t.includes("formation")) return "formation";
  if (t.includes("be") || t.includes("beneficiaire")) return "be";
  if (t.includes("document")) return "document";
  if (t.includes("alerte")) return "alerte";
  return "autre"; // fantome, capital, doublon, domiciliation
}

export default function DashboardCockpit({ cockpit, isLoading }: DashboardCockpitProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // All hooks MUST be called before any early return (Rules of Hooks)
  const allUrgencies = cockpit.urgencies ?? [];
  const counts = countBySeverity(allUrgencies);

  const urgencies = useMemo(() => {
    return allUrgencies.filter(u => {
      if (severityFilter !== "all" && u.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && mapTypeToCategory(u.type) !== categoryFilter) return false;
      return true;
    });
  }, [allUrgencies, severityFilter, categoryFilter]);

  if (isLoading) {
    return (
      <div
        className="bg-card rounded-2xl border border-border p-5 print:break-inside-avoid"
        aria-busy="true"
        aria-label="Chargement du cockpit LCB-FT"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded bg-muted animate-pulse" />
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <div className="w-2 h-2 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const visibleItems = expanded ? urgencies : urgencies.slice(0, VISIBLE_DEFAULT);
  const hiddenCount = urgencies.length - VISIBLE_DEFAULT;
  const hasActiveFilters = severityFilter !== "all" || categoryFilter !== "all";

  return (
    <div
      className="bg-card rounded-2xl border border-border p-5 hover:border-white/[0.1] transition-colors duration-300 print:break-inside-avoid"
      aria-label="Actions requises"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" aria-hidden="true" />
          Actions requises
          {allUrgencies.length > 0 && (
            <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold">
              {allUrgencies.length}
            </Badge>
          )}
        </h3>
        {urgencies.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label="Résumé des anomalies">
            {counts.critique > 0 && (
              <Badge className={`${severityBadge.critique.bg} border-0 text-[10px] font-bold`}>
                {counts.critique} critique{counts.critique > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.warning > 0 && (
              <Badge className={`${severityBadge.warning.bg} border-0 text-[10px] font-bold`}>
                {counts.warning} warning{counts.warning > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.info > 0 && (
              <Badge className={`${severityBadge.info.bg} border-0 text-[10px] font-bold`}>
                {counts.info} info{counts.info > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {allUrgencies.length > 0 && (
        <div className="mb-4 print:hidden">
          <DashboardCockpitFilters
            activeSeverity={severityFilter}
            activeCategory={categoryFilter}
            onSeverityChange={setSeverityFilter}
            onCategoryChange={setCategoryFilter}
            counts={counts}
          />
        </div>
      )}

      {/* Empty state */}
      {urgencies.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "Aucune anomalie pour ces filtres" : "Tous vos dossiers sont à jour"}
          </p>
          {!hasActiveFilters && (
            <p className="text-xs text-emerald-500/80 mt-1 font-medium">Aucune action requise</p>
          )}
          {hasActiveFilters && (
            <button
              className="text-xs text-primary hover:underline mt-2"
              onClick={() => { setSeverityFilter("all"); setCategoryFilter("all"); }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Urgency list */}
          <div className="space-y-0.5" role="list" aria-label="Liste des anomalies cockpit">
            {visibleItems.map((u, i) => {
              const isClickable = !!u.ref;
              const Tag = isClickable ? "button" : "div";
              return (
                <Tag
                  key={`${u.type}-${u.ref ?? ""}-${i}`}
                  role="listitem"
                  className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg border border-transparent transition-all duration-200 text-left ${
                    isClickable
                      ? "hover:bg-muted/50 hover:border-white/[0.06] cursor-pointer"
                      : ""
                  }`}
                  {...(isClickable
                    ? {
                        onClick: () => navigate(`/client/${u.ref}`),
                        "aria-label": `${u.title} — cliquer pour voir le client ${u.ref}`,
                      }
                    : {
                        "aria-label": u.title,
                      })}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${severityDot[u.severity]}`}
                    title={`Sévérité : ${u.severity}`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.detail}</p>
                  </div>
                  {isClickable && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                </Tag>
              );
            })}
          </div>

          {/* Expand / collapse */}
          {hiddenCount > 0 && (
            <button
              className="mt-3 w-full text-xs text-primary hover:underline text-center py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="cockpit-urgency-list"
            >
              {expanded
                ? "Réduire la liste"
                : `Voir les ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
