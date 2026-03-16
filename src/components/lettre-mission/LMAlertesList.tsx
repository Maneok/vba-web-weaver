import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Info, AlertTriangle, AlertOctagon, CheckCircle2, Loader2,
  ExternalLink, Filter, RefreshCw,
} from "lucide-react";
import {
  getAlertes, resolveAlerte, runAllChecks,
  ALERTE_TYPE_LABELS,
  type LMAlerte, type LMAlerteType,
} from "@/lib/lettreMissionWorkflow";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface LMAlertesListProps {
  cabinetId: string;
  limit?: number;
  showResolved?: boolean;
  onNavigateToLM?: (instanceId: string) => void;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  critical: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function LMAlertesList({ cabinetId, limit, showResolved = false, onNavigateToLM }: LMAlertesListProps) {
  const [alertes, setAlertes] = useState<LMAlerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const loadAlertes = useCallback(async () => {
    if (!cabinetId) return;
    setLoading(true);
    try {
      const data = await getAlertes(cabinetId, {
        unresolvedOnly: !showResolved,
        type: filterType !== "all" ? (filterType as LMAlerteType) : undefined,
        severity: filterSeverity !== "all" ? filterSeverity : undefined,
        limit: limit,
      });
      setAlertes(data);
    } catch (e) {
      logger.error("LM_ALERTES", "Failed to load alertes:", e);
    } finally {
      setLoading(false);
    }
  }, [cabinetId, showResolved, filterType, filterSeverity, limit]);

  useEffect(() => {
    loadAlertes();
  }, [loadAlertes]);

  const handleResolve = async (alerteId: string) => {
    try {
      await resolveAlerte(alerteId);
      toast.success("Alerte marquee comme traitee");
      loadAlertes();
    } catch {
      toast.error("Erreur lors du traitement de l'alerte");
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-400 text-sm">Chargement des alertes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px] h-8 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
              <Filter className="w-3 h-3 mr-1.5 text-slate-500" />
              <SelectValue placeholder="Type d'alerte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(ALERTE_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px] h-8 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
              <SelectValue placeholder="Severite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      {/* Count */}
      <p className="text-[10px] text-slate-600">
        {alertes.length} alerte{alertes.length !== 1 ? "s" : ""}{!showResolved ? " non traitee" + (alertes.length !== 1 ? "s" : "") : ""}
      </p>

      {/* Empty state */}
      {alertes.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune alerte en cours</p>
          <p className="text-xs text-slate-600 mt-1">Toutes les alertes ont ete traitees</p>
        </div>
      )}

      {/* Alerte cards */}
      <div className="space-y-2">
        {alertes.map((alerte) => {
          const sev = SEVERITY_CONFIG[alerte.severity] || SEVERITY_CONFIG.warning;
          const SevIcon = sev.icon;

          return (
            <div
              key={alerte.id}
              className={`p-3 rounded-xl border ${sev.bg} flex items-start gap-3 group transition-colors`}
            >
              <SevIcon className={`w-4 h-4 ${sev.color} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] bg-white/[0.04] border-white/[0.08] text-slate-300">
                    {ALERTE_TYPE_LABELS[alerte.type] || alerte.type}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(alerte.id)}
                    className="h-7 px-2 text-slate-500 hover:text-emerald-400"
                    title="Marquer comme traite"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
