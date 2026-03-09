import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search,
  ScrollText,
  UserPlus,
  Calculator,
  AlertTriangle,
  Shield,
  LogIn,
  LogOut,
  RefreshCw,
  ClipboardCheck,
  FileText,
  Activity,
  Download,
} from "lucide-react";

const FRENCH_MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

function formatHorodatage(h: string): string {
  // h = "2026-03-08 14:49"
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

type ActionConfig = {
  icon: React.ElementType;
  color: string; // tailwind color prefix like "green", "blue", etc.
  bgClass: string;
  textClass: string;
  borderClass: string;
};

const ACTION_MAP: Record<string, ActionConfig> = {
  CREATION_CLIENT: { icon: UserPlus, color: "green", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/30" },
  SCREENING: { icon: Search, color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  SCORING_CALCUL: { icon: Calculator, color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  ALERTE_REGISTRE: { icon: AlertTriangle, color: "orange", bgClass: "bg-orange-500/15", textClass: "text-orange-400", borderClass: "border-orange-500/30" },
  DECLARATION_TRACFIN: { icon: Shield, color: "red", bgClass: "bg-red-500/15", textClass: "text-red-400", borderClass: "border-red-500/30" },
  CONNEXION: { icon: LogIn, color: "gray", bgClass: "bg-slate-500/15", textClass: "text-slate-400", borderClass: "border-slate-500/30" },
  DECONNEXION: { icon: LogOut, color: "gray", bgClass: "bg-slate-500/15", textClass: "text-slate-400", borderClass: "border-slate-500/30" },
  REVUE_PERIODIQUE: { icon: RefreshCw, color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
  CONTROLE_QUALITE: { icon: ClipboardCheck, color: "purple", bgClass: "bg-purple-500/15", textClass: "text-purple-400", borderClass: "border-purple-500/30" },
  LETTRE_MISSION: { icon: FileText, color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-400", borderClass: "border-blue-500/30" },
};

const DEFAULT_ACTION: ActionConfig = {
  icon: Activity,
  color: "slate",
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

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.typeAction.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.refClient.toLowerCase().includes(q) ||
        log.utilisateur.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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
          onClick={() => {
            const headers = ["Horodatage", "Utilisateur", "Action", "Reference", "Details"];
            const rows = filtered.map(l => [l.horodatage, l.utilisateur, l.typeAction, l.refClient, `"${l.details.replace(/"/g, '""')}"`]);
            const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Export CSV genere (${filtered.length} entrees)`);
          }}
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 animate-fade-in-up">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{logs.length}</p>
            <p className="text-[11px] text-slate-500">Total entrees</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
            <p className="text-[11px] text-slate-500">Resultats filtres</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="animate-fade-in-up">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par action, details, reference, utilisateur..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-6 animate-fade-in-up">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            Aucune entree ne correspond a la recherche
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.08]" />

            <div className="space-y-1">
              {visible.map((log, i) => {
                const config = getActionConfig(log.typeAction);
                const Icon = config.icon;

                return (
                  <div
                    key={i}
                    className="relative flex items-start gap-4 pl-0 py-3 group"
                  >
                    {/* Icon circle on the line */}
                    <div
                      className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border ${config.borderClass} ${config.bgClass} flex items-center justify-center transition-transform group-hover:scale-110`}
                    >
                      <Icon className={`w-4 h-4 ${config.textClass}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${config.bgClass} ${config.textClass}`}
                        >
                          {log.typeAction}
                        </span>
                        {log.refClient && (
                          <span className="text-[11px] font-mono text-slate-500">
                            {log.refClient}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-600 ml-auto flex-shrink-0">
                          {formatHorodatage(log.horodatage)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[8px] font-bold text-blue-400 flex-shrink-0">
                          {(log.utilisateur || "??").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-400 truncate">
                          {log.utilisateur}
                        </span>
                      </div>

                      {log.details && (
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed truncate max-w-2xl">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              Charger plus ({filtered.length - visibleCount} restants)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
