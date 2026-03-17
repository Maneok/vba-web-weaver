import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Info, AlertTriangle, AlertOctagon, CheckCircle2, Loader2,
  ExternalLink, Filter, RefreshCw, ChevronDown, ChevronUp, EyeOff,
  Bell,
} from "lucide-react";
import {
  getAlertes, resolveAlerte, dismissAlerte, runAllChecks,
  getUnresolvedAlertesCount,
  ALERTE_TYPE_LABELS,
  type LMAlerte, type LMAlerteType,
} from "@/lib/lettreMissionWorkflow";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

// ── Props ──

interface LMAlertesListProps {
  cabinetId: string;
  limit?: number;
  compact?: boolean;
  filterType?: string;
  showResolved?: boolean;
  onNavigateToLM?: (instanceId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

// ── Severity config ──

const SEVERITY_CONFIG = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Warning" },
  critical: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Critique" },
} as const;

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

type SeverityFilter = "all" | "critical" | "warning" | "info";

const SEVERITY_PILLS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "critical", label: "Critiques" },
  { value: "warning", label: "Warnings" },
  { value: "info", label: "Infos" },
];

// ── Sort helper ──

function sortAlertes(a: LMAlerte, b: LMAlerte): number {
  // 1. Critical first
  const sevDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
  if (sevDiff !== 0) return sevDiff;
  // 2. Soonest due_date first
  if (a.due_date && b.due_date) {
    const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (diff !== 0) return diff;
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  // 3. Newest created_at first
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// ── Group helper ──

function groupByType(alertes: LMAlerte[]): { type: LMAlerteType; label: string; items: LMAlerte[] }[] {
  const map = new Map<LMAlerteType, LMAlerte[]>();
  for (const a of alertes) {
    const arr = map.get(a.type);
    if (arr) arr.push(a);
    else map.set(a.type, [a]);
  }
  return Array.from(map.entries()).map(([type, items]) => ({
    type,
    label: ALERTE_TYPE_LABELS[type] || type,
    items,
  }));
}

// ── Auto-refresh interval (ms) ──
const REFRESH_INTERVAL = 60_000;

// ──────────────────────────────────────────────
// LMAlertesBadge — named export
// ──────────────────────────────────────────────

export function LMAlertesBadge({ cabinetId }: { cabinetId: string }) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!cabinetId) return;
    try {
      const n = await getUnresolvedAlertesCount(cabinetId);
      setCount(n);
    } catch {
      // silent
    }
  }, [cabinetId]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ──────────────────────────────────────────────
// LMAlertesList — default export
// ──────────────────────────────────────────────

export default function LMAlertesList({
  cabinetId,
  limit,
  compact = false,
  filterType: filterTypeProp,
  showResolved = false,
  onNavigateToLM,
  onNavigateToClient,
}: LMAlertesListProps) {
  const navigate = useNavigate();
  const [alertes, setAlertes] = useState<LMAlerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filterType, setFilterType] = useState<string>(filterTypeProp || "all");
  const [filterSeverity, setFilterSeverity] = useState<SeverityFilter>("all");
  const [expanded, setExpanded] = useState(false);
  // Track dismissed/resolved ids for slide-out animation
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync external filterType prop
  useEffect(() => {
    if (filterTypeProp) setFilterType(filterTypeProp);
  }, [filterTypeProp]);

  const loadAlertes = useCallback(async () => {
    if (!cabinetId) return;
    try {
      const data = await getAlertes(cabinetId, {
        unresolvedOnly: !showResolved,
        type: filterType !== "all" ? (filterType as LMAlerteType) : undefined,
        severity: filterSeverity !== "all" ? filterSeverity : undefined,
        limit,
      });
      data.sort(sortAlertes);
      setAlertes(data);
    } catch (e) {
      logger.error("LM_ALERTES", "Failed to load alertes:", e);
    } finally {
      setLoading(false);
    }
  }, [cabinetId, showResolved, filterType, filterSeverity, limit]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadAlertes();
  }, [loadAlertes]);

  // Auto-refresh every 60s
  useEffect(() => {
    refreshRef.current = setInterval(loadAlertes, REFRESH_INTERVAL);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [loadAlertes]);

  // ── Slide-out animation helper ──
  const animateRemove = (alerteId: string, afterFn: () => Promise<void>) => {
    setRemovingIds((prev) => new Set(prev).add(alerteId));
    setTimeout(async () => {
      await afterFn();
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(alerteId);
        return next;
      });
      loadAlertes();
    }, 300);
  };

  // ── "Traiter" action per type ──
  const handleTraiter = async (alerte: LMAlerte) => {
    const doResolve = async () => {
      try {
        await resolveAlerte(alerte.id);
      } catch {
        toast.error("Erreur lors du traitement de l'alerte");
      }
    };

    switch (alerte.type) {
      case "reconduction_3mois":
      case "reconduction_1mois":
        toast.success("Reconduction tacite confirmee — alerte traitee");
        animateRemove(alerte.id, doResolve);
        break;
      case "signature_relance":
        toast.success("Relance signature prise en compte — alerte traitee");
        animateRemove(alerte.id, doResolve);
        break;
      case "revue_annuelle":
        await doResolve();
        navigate("/revue-maintien");
        break;
      case "risque_eleve":
      case "expiration_kyc":
        if (alerte.client_id && onNavigateToClient) {
          await doResolve();
          onNavigateToClient(alerte.client_id);
        } else {
          toast.info("Aucun client associe a cette alerte");
          animateRemove(alerte.id, doResolve);
        }
        break;
      case "avenant_necessaire":
        if (alerte.instance_id && onNavigateToLM) {
          await doResolve();
          onNavigateToLM(alerte.instance_id);
        } else {
          toast.success("Alerte traitee");
          animateRemove(alerte.id, doResolve);
        }
        break;
      default:
        toast.success("Alerte marquee comme traitee");
        animateRemove(alerte.id, doResolve);
    }
  };

  // ── "Ignorer" action ──
  const handleIgnorer = (alerte: LMAlerte) => {
    animateRemove(alerte.id, async () => {
      try {
        await dismissAlerte(alerte.id);
        toast.info("Alerte ignoree");
      } catch {
        toast.error("Erreur lors de l'action");
      }
    });
  };

  // ── Run checks ──
  const handleRunChecks = async () => {
    setChecking(true);
    try {
      const { total } = await runAllChecks(cabinetId);
      if (total > 0) {
        toast.success(`${total} nouvelle${total > 1 ? "s" : ""} alerte${total > 1 ? "s" : ""} detectee${total > 1 ? "s" : ""}`);
      } else {
        toast.info("Aucune nouvelle alerte detectee");
      }
      loadAlertes();
    } catch {
      toast.error("Erreur lors de la verification");
    } finally {
      setChecking(false);
    }
  };

  // ── CSS transition class for slide-out ──
  const getItemClasses = (alerteId: string) =>
    removingIds.has(alerteId)
      ? "opacity-0 -translate-x-4 max-h-0 overflow-hidden"
      : "opacity-100 translate-x-0 max-h-[200px]";

  const transitionStyle = "transition-all duration-300 ease-in-out";

  // ══════════════════════════════════════════
  // COMPACT MODE (bandeau)
  // ══════════════════════════════════════════

  if (compact) {
    if (loading || alertes.length === 0) return null;

    const criticalCount = alertes.filter((a) => a.severity === "critical").length;
    const warningCount = alertes.filter((a) => a.severity === "warning").length;
    const hasCritical = criticalCount > 0;
    const bannerColor = hasCritical
      ? "bg-red-500/10 border-red-500/20"
      : "bg-amber-500/10 border-amber-500/20";
    const textColor = hasCritical ? "text-red-300" : "text-amber-300";
    const BannerIcon = hasCritical ? AlertOctagon : AlertTriangle;

    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critique${criticalCount > 1 ? "s" : ""}`);
    if (warningCount > 0) parts.push(`${warningCount} avertissement${warningCount > 1 ? "s" : ""}`);
    const infoCount = alertes.length - criticalCount - warningCount;
    if (infoCount > 0) parts.push(`${infoCount} info${infoCount > 1 ? "s" : ""}`);

    const COMPACT_MAX = 5;
    const visibleAlertes = alertes.slice(0, COMPACT_MAX);
    const remaining = alertes.length - COMPACT_MAX;

    return (
      <div className={`rounded-xl border ${bannerColor} overflow-hidden`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          <BannerIcon className={`w-4 h-4 ${hasCritical ? "text-red-400" : "text-amber-400"} shrink-0`} />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium ${textColor}`}>
              {alertes.length} alerte{alertes.length > 1 ? "s" : ""} en cours
            </span>
            <span className="text-xs text-slate-500 ml-2">{parts.join(", ")}</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {expanded && (
          <div className="border-t border-white/[0.06] p-2 space-y-1">
            {visibleAlertes.map((alerte) => {
              const sev = SEVERITY_CONFIG[alerte.severity] || SEVERITY_CONFIG.warning;
              const SevIcon = sev.icon;
              const truncMsg = alerte.message.length > 60
                ? alerte.message.slice(0, 60) + "..."
                : alerte.message;

              return (
                <div
                  key={alerte.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] ${transitionStyle} ${getItemClasses(alerte.id)}`}
                >
                  <SevIcon className={`w-3.5 h-3.5 ${sev.color} shrink-0`} />
                  <span className="text-xs text-slate-300 flex-1 min-w-0 truncate" title={alerte.message}>
                    {truncMsg}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTraiter(alerte)}
                    className="h-6 px-2 text-[10px] text-slate-400 hover:text-emerald-400"
                  >
                    Traiter
                  </Button>
                </div>
              );
            })}
            {remaining > 0 && (
              <p className="text-[10px] text-slate-500 text-center py-1">
                et {remaining} autre{remaining > 1 ? "s" : ""}...
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // FULL MODE
  // ══════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-400 text-sm">Chargement des alertes...</span>
      </div>
    );
  }

  // ── Apply local filters (severity pills, type pills) ──
  const filtered = alertes;

  // ── Group ──
  const groups = groupByType(filtered);

  return (
    <div className="space-y-4">
      {/* ── Severity filter pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {SEVERITY_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setFilterSeverity(pill.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterSeverity === pill.value
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:bg-white/[0.06]"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Type filter pills ── */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filterType === "all"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:bg-white/[0.06]"
          }`}
        >
          Tous les types
        </button>
        {Object.entries(ALERTE_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterType === key
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:bg-white/[0.06]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Toolbar row ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-600">
          {filtered.length} alerte{filtered.length !== 1 ? "s" : ""}
          {!showResolved ? ` non traitee${filtered.length !== 1 ? "s" : ""}` : ""}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRunChecks}
          disabled={checking}
          className="gap-1.5 border-white/[0.08] text-slate-400 text-xs"
        >
          {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Verifier maintenant
        </Button>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune alerte en cours. Tout est en ordre !</p>
        </div>
      )}

      {/* ── Grouped alerte cards ── */}
      {groups.map((group) => (
        <div key={group.type} className="space-y-2">
          {/* Group header */}
          <div className="flex items-center gap-2 pt-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {group.label}
            </h4>
            <Badge variant="outline" className="text-[9px] bg-white/[0.04] border-white/[0.08] text-slate-500 h-4 px-1.5">
              {group.items.length}
            </Badge>
          </div>

          {/* Cards */}
          {group.items.map((alerte) => {
            const sev = SEVERITY_CONFIG[alerte.severity] || SEVERITY_CONFIG.warning;
            const SevIcon = sev.icon;

            return (
              <div
                key={alerte.id}
                className={`p-3 rounded-xl border ${sev.bg} flex items-start gap-3 group ${transitionStyle} ${getItemClasses(alerte.id)}`}
              >
                <SevIcon className={`w-4 h-4 ${sev.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] bg-white/[0.04] border-white/[0.08] text-slate-300">
                      {ALERTE_TYPE_LABELS[alerte.type] || alerte.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[9px] border-white/[0.08] ${
                        alerte.severity === "critical"
                          ? "text-red-400 bg-red-500/10"
                          : alerte.severity === "warning"
                            ? "text-amber-400 bg-amber-500/10"
                            : "text-blue-400 bg-blue-500/10"
                      }`}
                    >
                      {sev.label}
                    </Badge>
                    {alerte.due_date && (
                      <span className="text-[10px] text-slate-500">
                        Echeance : {new Date(alerte.due_date).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 mt-1">{alerte.message}</p>
                  {alerte.is_resolved && alerte.resolved_at && (
                    <p className="text-[10px] text-slate-600 mt-1">
                      Resolue le {new Date(alerte.resolved_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onNavigateToLM && alerte.instance_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavigateToLM(alerte.instance_id!)}
                      className="h-7 px-2 text-slate-500 hover:text-blue-400"
                      title="Voir la lettre"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                  {!alerte.is_resolved && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTraiter(alerte)}
                        className="h-7 px-2 text-xs text-slate-400 hover:text-emerald-400 gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Traiter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleIgnorer(alerte)}
                        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-300 gap-1"
                        title="Ignorer cette alerte"
                      >
                        <EyeOff className="w-3 h-3" />
                        Ignorer
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
