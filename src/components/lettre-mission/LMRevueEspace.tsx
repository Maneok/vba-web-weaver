import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { computeRevueKPIs } from "@/lib/lettreMissionWorkflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDateFr } from "@/lib/dateUtils";
import {
  ShieldAlert, Clock, AlertTriangle, Search, ClipboardCheck,
  FileText, Filter,
} from "lucide-react";

type RiskFilter = "all" | "eleve" | "moyen" | "faible";
type AlerteFilter = "all" | "revue_annuelle" | "risque_eleve" | "kyc_expire";

function getRiskLevel(score: number): "eleve" | "moyen" | "faible" {
  if (score >= 70) return "eleve";
  if (score >= 50) return "moyen";
  return "faible";
}

function riskBorderColor(score: number): string {
  if (score >= 70) return "border-l-4 border-l-red-500";
  if (score >= 50) return "border-l-4 border-l-orange-500";
  return "border-l-4 border-l-emerald-500";
}

function vigilanceLabel(niv: string): string {
  switch (niv) {
    case "SIMPLIFIEE": return "Simplifiee";
    case "STANDARD": return "Normale";
    case "RENFORCEE": return "Renforcee";
    default: return niv || "—";
  }
}

function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function LMRevueEspace() {
  const { clients } = useAppState();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [alerteFilter, setAlerteFilter] = useState<AlerteFilter>("all");

  const kpis = useMemo(() => computeRevueKPIs(clients), [clients]);

  const filtered = useMemo(() => {
    let result = [...clients];

    if (search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.raisonSociale?.toLowerCase().includes(q) ||
          c.ref?.toLowerCase().includes(q) ||
          c.siren?.includes(q)
      );
    }

    if (riskFilter !== "all") {
      result = result.filter((c) => getRiskLevel(c.scoreGlobal ?? 0) === riskFilter);
    }

    if (alerteFilter !== "all") {
      const now = new Date();
      result = result.filter((c) => {
        const score = c.scoreGlobal ?? 0;
        const revueDate = c.dateDerniereRevue ? new Date(c.dateDerniereRevue) : null;
        const diffYears = revueDate && !isNaN(revueDate.getTime())
          ? (now.getTime() - revueDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          : 999;

        switch (alerteFilter) {
          case "risque_eleve": return score >= 70;
          case "revue_annuelle": return diffYears > 1;
          case "kyc_expire":
            return (score >= 70 && diffYears > 1) ||
              (score >= 50 && score < 70 && diffYears > 2) ||
              (score < 50 && diffYears > 3);
          default: return true;
        }
      });
    }

    result.sort((a, b) => (b.scoreGlobal ?? 0) - (a.scoreGlobal ?? 0));
    return result;
  }, [clients, search, riskFilter, alerteFilter]);

  return (
    <div className="space-y-5">
      {/* KPI counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-400">{kpis.vigilanceRenforcee}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Vigilance renforcee</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-400">{kpis.kycExpires}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">KYC expires</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-400">{kpis.revuesAFaire}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Revues a faire</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Rechercher par nom, reference, SIREN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white text-xs"
          />
        </div>
        <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300">
            <Filter className="w-3 h-3 mr-1.5 text-slate-400 dark:text-slate-500" />
            <SelectValue placeholder="Niveau risque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            <SelectItem value="eleve">Risque eleve</SelectItem>
            <SelectItem value="moyen">Risque moyen</SelectItem>
            <SelectItem value="faible">Risque faible</SelectItem>
          </SelectContent>
        </Select>
        <Select value={alerteFilter} onValueChange={(v) => setAlerteFilter(v as AlerteFilter)}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300">
            <AlertTriangle className="w-3 h-3 mr-1.5 text-slate-400 dark:text-slate-500" />
            <SelectValue placeholder="Type alerte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes alertes</SelectItem>
            <SelectItem value="risque_eleve">Risque eleve</SelectItem>
            <SelectItem value="revue_annuelle">Revue annuelle</SelectItem>
            <SelectItem value="kyc_expire">KYC expire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-[10px] text-slate-300 dark:text-slate-600">{filtered.length} client{filtered.length > 1 ? "s" : ""}</p>

      {/* Client rows */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">Aucun client pour ces filtres</div>
        )}
        {filtered.map((client) => {
          const score = client.scoreGlobal ?? 0;
          const days = daysSince(client.dateDerniereRevue);

          return (
            <div
              key={client.ref}
              className={`${riskBorderColor(score)} rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] p-4 hover:bg-gray-50/80 dark:bg-white/[0.04] transition-colors`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{client.raisonSociale}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{client.ref} · {client.siren} · {client.forme}</p>
                </div>

                <Badge
                  variant="outline"
                  className={`text-xs font-mono tabular-nums shrink-0 ${
                    score >= 70
                      ? "text-red-400 border-red-500/30 bg-red-500/10"
                      : score >= 50
                      ? "text-orange-400 border-orange-500/30 bg-orange-500/10"
                      : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  }`}
                >
                  {score}/100
                </Badge>

                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    client.nivVigilance === "RENFORCEE"
                      ? "text-red-400 border-red-500/30 bg-red-500/10"
                      : client.nivVigilance === "STANDARD"
                      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                      : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  }`}
                >
                  {vigilanceLabel(client.nivVigilance)}
                </Badge>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {client.dateDerniereRevue
                      ? formatDateFr(client.dateDerniereRevue, "short")
                      : "Jamais"}
                  </span>
                  {days !== null && (
                    <span className={`text-[9px] ${days > 365 ? "text-red-400" : days > 180 ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}>
                      ({days}j)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 border-gray-200 dark:border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                    onClick={() => navigate(`/client/${client.ref}`)}
                  >
                    <ClipboardCheck className="w-3 h-3" /> Effectuer la revue
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] gap-1 text-slate-400 dark:text-slate-500 hover:text-indigo-400"
                    onClick={() => navigate(`/lettre-mission/${client.ref}`)}
                  >
                    <FileText className="w-3 h-3" /> LM
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
