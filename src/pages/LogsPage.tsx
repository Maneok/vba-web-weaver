import { useState, useMemo, useEffect, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAppState } from "@/lib/AppContext";
import { downloadCSV } from "@/lib/csvUtils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, ScrollText, UserPlus, Calculator, AlertTriangle, Shield,
  LogIn, LogOut, RefreshCw, ClipboardCheck, FileText, Activity,
  Download, Filter, X, Calendar, BarChart3,
} from "lucide-react";

const FRENCH_MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

function formatHorodatage(h: string): string {
  if (!h) return "—";
  const parts = h.split(" ");
  if (parts.length < 2) return h;
  const [datePart, timePart] = parts;
  const dateParts = datePart.split("-");
  if (dateParts.length < 3) return h;
  const [year, month, day] = dateParts;
  const monthIdx = parseInt(month, 10) - 1;
  if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return h;
  const monthName = FRENCH_MONTHS[monthIdx];
  const dayNum = parseInt(day, 10);
  if (isNaN(dayNum)) return h;
  return `${dayNum < 10 ? "0" + dayNum : dayNum} ${monthName} ${year} a ${timePart}`;
}

function getDateFromHorodatage(h: string): string {
  if (!h) return "";
  return h.split(" ")[0] || "";
}

type ActionConfig = {
  icon: React.ElementType;
  bgClass: string;
  textClass: string;
  borderClass: string;
};

const ACTION_MAP: Record<string, ActionConfig> = {
  CREATION_CLIENT: { icon: UserPlus, bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/30" },
  SCREENING: { icon: Search, bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  SCORING_CALCUL: { icon: Calculator, bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  ALERTE_REGISTRE: { icon: AlertTriangle, bgClass: "bg-orange-500/15", textClass: "text-orange-400", borderClass: "border-orange-500/30" },
  DECLARATION_TRACFIN: { icon: Shield, bgClass: "bg-red-500/15", textClass: "text-red-400", borderClass: "border-red-500/30" },
  CONNEXION: { icon: LogIn, bgClass: "bg-slate-500/15", textClass: "text-slate-400", borderClass: "border-slate-500/30" },
  DECONNEXION: { icon: LogOut, bgClass: "bg-slate-500/15", textClass: "text-slate-400", borderClass: "border-slate-500/30" },
  REVUE_PERIODIQUE: { icon: RefreshCw, bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  CONTROLE_QUALITE: { icon: ClipboardCheck, bgClass: "bg-purple-500/15", textClass: "text-purple-400", borderClass: "border-purple-500/30" },
  LETTRE_MISSION: { icon: FileText, bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
};

const DEFAULT_ACTION: ActionConfig = {
  icon: Activity,
  bgClass: "bg-slate-500/15",
  textClass: "text-slate-400",
  borderClass: "border-slate-500/30",
};

function getActionConfig(typeAction: string): ActionConfig {
  return ACTION_MAP[typeAction] || DEFAULT_ACTION;
}

const PAGE_SIZE = 50;

export default function LogsPage() {
  const { logs } = useAppState();
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useDocumentTitle("Historique");

  // Unique values for filters
  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.typeAction))).sort(), [logs]);
  const uniqueUsers = useMemo(() => Array.from(new Set(logs.map(l => l.utilisateur).filter(Boolean))).sort(), [logs]);

  // Stats
  const stats = useMemo(() => {
    const now = Date.now();
    const last7d = logs.filter(l => {
      const d = new Date(l.horodatage.replace(" ", "T"));
      return (now - d.getTime()) < 7 * 86400000;
    }).length;
    const last30d = logs.filter(l => {
      const d = new Date(l.horodatage.replace(" ", "T"));
      return (now - d.getTime()) < 30 * 86400000;
    }).length;
    const last90d = logs.filter(l => {
      const d = new Date(l.horodatage.replace(" ", "T"));
      return (now - d.getTime()) < 90 * 86400000;
    }).length;

    // Action distribution
    const actionCounts: Record<string, number> = {};
    logs.forEach(l => { actionCounts[l.typeAction] = (actionCounts[l.typeAction] || 0) + 1; });
    const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { total: logs.length, last7d, last30d, last90d, topActions };
  }, [logs]);

  // Day grouping helper
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const yesterday = useMemo(() => new Date(Date.now() - 86400000).toISOString().split("T")[0], []);

  const getDayLabel = useCallback((horodatage: string): string => {
    const dateStr = getDateFromHorodatage(horodatage);
    if (!dateStr) return "Inconnu";
    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return "Hier";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return dateStr; }
  }, [today, yesterday]);

  const filtered = useMemo(() => {
    let result = logs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(log =>
        log.typeAction.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.refClient.toLowerCase().includes(q) ||
        log.utilisateur.toLowerCase().includes(q)
      );
    }
    if (filterAction !== "all") result = result.filter(l => l.typeAction === filterAction);
    if (filterUser !== "all") result = result.filter(l => l.utilisateur === filterUser);
    if (dateStart) result = result.filter(l => getDateFromHorodatage(l.horodatage) >= dateStart);
    if (dateEnd) result = result.filter(l => getDateFromHorodatage(l.horodatage) <= dateEnd);
    return result;
  }, [logs, search, filterAction, filterUser, dateStart, dateEnd]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const hasFilters = search || filterAction !== "all" || filterUser !== "all" || dateStart || dateEnd;

  const clearFilters = () => {
    setSearch("");
    setFilterAction("all");
    setFilterUser("all");
    setDateStart("");
    setDateEnd("");
    setVisibleCount(PAGE_SIZE);
  };

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: { label: string; logs: typeof visible }[] = [];
    let currentLabel = "";
    let currentGroup: typeof visible = [];

    for (const log of visible) {
      const label = getDayLabel(log.horodatage);
      if (label !== currentLabel) {
        if (currentGroup.length > 0) groups.push({ label: currentLabel, logs: currentGroup });
        currentLabel = label;
        currentGroup = [log];
      } else {
        currentGroup.push(log);
      }
    }
    if (currentGroup.length > 0) groups.push({ label: currentLabel, logs: currentGroup });
    return groups;
  }, [visible, getDayLabel]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Journal des Actions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Historique automatique de toutes les actions effectuees
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/[0.06]"
          aria-label="Exporter le journal en CSV"
          onClick={() => {
            const headers = ["Horodatage", "Utilisateur", "Action", "Reference", "Details"];
            const rows = filtered.map(l => [l.horodatage, l.utilisateur, l.typeAction, l.refClient, l.details]);
            downloadCSV(headers, rows, `journal_actions_${new Date().toISOString().slice(0, 10)}.csv`);
            toast.success(`Export CSV genere (${filtered.length} entrees)`);
          }}
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ScrollText className="w-[18px] h-[18px] text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-slate-500">Total</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Calendar className="w-[18px] h-[18px] text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-400">{stats.last7d}</p>
            <p className="text-[10px] text-slate-500">7 derniers j.</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Calendar className="w-[18px] h-[18px] text-purple-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-purple-400">{stats.last30d}</p>
            <p className="text-[10px] text-slate-500">30 derniers j.</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Calendar className="w-[18px] h-[18px] text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-400">{stats.last90d}</p>
            <p className="text-[10px] text-slate-500">90 derniers j.</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
            <Activity className="w-[18px] h-[18px] text-slate-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{filtered.length}</p>
            <p className="text-[10px] text-slate-500">Filtre actuel</p>
          </div>
        </div>
      </div>

      {/* Top actions distribution */}
      {stats.topActions.length > 0 && (
        <div className="glass-card p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-300">Repartition des actions</span>
          </div>
          <div className="space-y-1.5">
            {stats.topActions.map(([action, count]) => {
              const config = getActionConfig(action);
              return (
                <div key={action} className="flex items-center gap-3">
                  <span className={`text-[10px] font-medium w-[180px] truncate ${config.textClass}`}>{action}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full ${config.bgClass.replace("/15", "")} transition-all`} style={{ width: `${(count / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 animate-fade-in-up">
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par action, details, reference, utilisateur..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            aria-label="Rechercher dans le journal"
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setVisibleCount(PAGE_SIZE); }}>
          <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.06] text-slate-300" aria-label="Filtrer par type d'action">
            <SelectValue placeholder="Type d'action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={v => { setFilterUser(v); setVisibleCount(PAGE_SIZE); }}>
          <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/[0.06] text-slate-300" aria-label="Filtrer par utilisateur">
            <SelectValue placeholder="Utilisateur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Date de debut" className="w-[140px] bg-white/[0.03] border-white/[0.06] text-slate-300" />
        <Input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Date de fin" className="w-[140px] bg-white/[0.03] border-white/[0.06] text-slate-300" />
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400" onClick={clearFilters} aria-label="Effacer tous les filtres">
            <X className="w-3 h-3 mr-1" /> Effacer
          </Button>
        )}
      </div>

      {/* Timeline grouped by day */}
      <div className="glass-card p-6 animate-fade-in-up">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {hasFilters ? (
              <div className="flex flex-col items-center gap-2">
                <Filter className="w-6 h-6 text-slate-600" />
                <p className="text-sm">Aucune entree ne correspond aux filtres</p>
                <Button variant="ghost" size="sm" className="text-xs text-blue-400" onClick={clearFilters}>
                  Effacer les filtres
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center">
                  <ScrollText className="w-8 h-8 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Aucune entree dans le journal</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Les actions effectuees dans l'application apparaitront ici automatiquement.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.08]" />

            {groupedByDay.map((group, gi) => (
              <div key={gi}>
                {/* Day header */}
                <div className="relative flex items-center gap-3 mb-2 mt-4 first:mt-0">
                  <div className="relative z-10 w-10 h-6 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <Calendar className="w-3 h-3 text-slate-500" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 capitalize">{group.label}</span>
                  <span className="text-[10px] text-slate-600">({group.logs.length})</span>
                </div>

                <div className="space-y-1">
                  {group.logs.map((log, i) => {
                    const config = getActionConfig(log.typeAction);
                    const Icon = config.icon;

                    return (
                      <div key={`${gi}-${i}`} className="relative flex items-start gap-4 pl-0 py-2.5 group">
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border ${config.borderClass} ${config.bgClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                          <Icon className={`w-4 h-4 ${config.textClass}`} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${config.bgClass} ${config.textClass}`}>
                              {log.typeAction}
                            </span>
                            {log.refClient && (
                              <span className="text-[11px] font-mono text-slate-500">{log.refClient}</span>
                            )}
                            <span className="text-[11px] text-slate-600 ml-auto flex-shrink-0">
                              {formatHorodatage(log.horodatage)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[8px] font-bold text-blue-400 flex-shrink-0">
                              {(log.utilisateur || "??").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-400 truncate">{log.utilisateur}</span>
                          </div>
                          {log.details && (
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed truncate max-w-2xl">{log.details}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              aria-label={`Charger ${filtered.length - visibleCount} entrees supplementaires`}
            >
              Charger plus ({filtered.length - visibleCount} restants)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
