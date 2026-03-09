import { useMemo, useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { runDiagnostic360, type DiagnosticReport, type DiagnosticItem, type CategoryStats } from "@/lib/diagnosticEngine";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { controlesService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  FileSpreadsheet,
  Loader2,
  Scale,
  Info,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

// ---------------------------------------------------------------------------
// Gauge component using Recharts RadialBarChart (Amélioration #42 - tooltip)
// ---------------------------------------------------------------------------
function CircularGauge({
  value,
  label,
  sublabel,
  tooltip,
}: {
  value: number;
  label: string;
  sublabel?: string;
  tooltip?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 80 ? "#22c55e" : clamped >= 50 ? "#f59e0b" : "#ef4444";
  const data = [{ value: clamped, fill: color }];

  return (
    <div className="flex flex-col items-center gap-1 group relative" title={tooltip}>
      <div className="relative w-28 h-28">
        <RadialBarChart
          width={112}
          height={112}
          cx={56}
          cy={56}
          innerRadius={40}
          outerRadius={52}
          startAngle={90}
          endAngle={-270}
          barSize={10}
          data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "rgba(255,255,255,0.06)" }}
            dataKey="value"
            angleAxisId={0}
            cornerRadius={6}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-100">{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-300 text-center leading-tight max-w-[120px]">{label}</p>
      {sublabel && <p className="text-[10px] text-slate-500 text-center">{sublabel}</p>}
      {/* Tooltip (Amélioration #42) */}
      {tooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap border border-white/10">
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status config for diagnostic items
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  OK: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Conforme" },
  ALERTE: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Alerte" },
  CRITIQUE: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critique" },
};

const NOTE_COLORS: Record<string, string> = {
  A: "from-emerald-600/80 to-emerald-700/60",
  B: "from-yellow-600/80 to-yellow-700/60",
  C: "from-orange-600/80 to-orange-700/60",
  D: "from-red-600/80 to-red-700/60",
};

// ---------------------------------------------------------------------------
// DiagnosticItemCard (Amélioration #34 - référence réglementaire)
// ---------------------------------------------------------------------------
function DiagnosticItemCard({ item }: { item: DiagnosticItem }) {
  const config = STATUS_CONFIG[item.statut];
  const Icon = config.icon;
  return (
    <div
      className={`p-3 rounded-lg border ${config.border} ${config.bg} transition-all duration-200 hover:shadow-md`}
      role="listitem"
      aria-label={`${item.indicateur}: ${config.label}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-200">{item.indicateur}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
              {item.statut}
            </span>
            {/* Amélioration #34 - Référence réglementaire */}
            {item.referenceReglementaire && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {item.referenceReglementaire}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{item.detail}</p>
          {item.recommandation !== "Aucune action requise." && (
            <p className="text-xs mt-1.5 text-amber-400 font-medium">
              &rarr; {item.recommandation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryHeader with badge and collapsible (Améliorations #32, #33)
// ---------------------------------------------------------------------------
function CategoryHeader({
  cat,
  stats,
  isOpen,
  onToggle,
}: {
  cat: string;
  stats?: CategoryStats;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const scoreColor = stats
    ? stats.score >= 80 ? "text-emerald-400" : stats.score >= 50 ? "text-amber-400" : "text-red-400"
    : "text-slate-400";

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 group text-left"
      aria-expanded={isOpen}
      aria-label={`Categorie ${cat}${stats ? `, score ${stats.score}%` : ""}`}
    >
      <div className="flex items-center gap-2">
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 transition-transform" />
        )}
        <h3 className="text-sm font-semibold text-slate-200">{cat}</h3>
        {stats && (
          <span className={`text-xs font-bold ${scoreColor}`}>
            {stats.score}%
          </span>
        )}
      </div>
      {stats && (
        <div className="flex items-center gap-3 text-[10px]">
          {stats.ok > 0 && (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {stats.ok}
            </span>
          )}
          {stats.alerte > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {stats.alerte}
            </span>
          )}
          {stats.critique > 0 && (
            <span className="text-red-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {stats.critique}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CSV Export helper (Amélioration #36)
// ---------------------------------------------------------------------------
function exportDiagnosticCsv(report: DiagnosticReport) {
  const header = "Categorie;Indicateur;Statut;Detail;Recommandation;Reference Reglementaire\n";
  const rows = report.items.map(item =>
    [
      item.categorie,
      `"${item.indicateur}"`,
      item.statut,
      `"${item.detail}"`,
      `"${item.recommandation}"`,
      item.referenceReglementaire || "",
    ].join(";")
  ).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Diagnostic_360_${report.dateGeneration}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DiagnosticPage() {
  const { clients, collaborateurs, alertes, logs } = useAppState();

  // --- Loading state (Amélioration #28) ---
  const [isLoading, setIsLoading] = useState(true);

  // --- Supabase data: controles + parametres ---
  const [controles, setControles] = useState<Record<string, unknown>[]>([]);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);

  // --- Filter states (Améliorations #29, #30, #31) ---
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OK" | "ALERTE" | "CRITIQUE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Collapsible sections (Amélioration #32) ---
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // --- Sort mode (Amélioration #35) ---
  const [sortPriority, setSortPriority] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const loadControles = controlesService.getAll()
      .then((data) => { if (!cancelled) setControles(data as Record<string, unknown>[]); })
      .catch((err) => {
        logger.error("[Diagnostic] controles error:", err);
        if (!cancelled) toast.error("Erreur lors du chargement des controles");
      });

    async function loadParametres() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const { data } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("cle", "lcbft_config")
          .maybeSingle();
        if (cancelled) return;
        if (data?.valeur) {
          const valeur = data.valeur as Record<string, unknown>;
          if (valeur.date_derniere_formation) {
            setDerniereFormation(valeur.date_derniere_formation as string);
          }
        }
      } catch (err) {
        logger.error("[Diagnostic] loadParametres error:", err);
        if (!cancelled) toast.error("Erreur lors du chargement des parametres");
      }
    }

    Promise.all([loadControles, loadParametres()]).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // --- Diagnostic engine report ---
  const report = useMemo<DiagnosticReport>(
    () => runDiagnostic360(clients, collaborateurs, alertes, logs),
    [clients, collaborateurs, alertes, logs]
  );

  // --- Computed indicators ---
  const indicators = useMemo(() => {
    // 1. Taux de conformite
    const totalControles = controles.length;
    const conformes = controles.filter((c) => {
      const res = (c.resultat_global as string) || "";
      return res.startsWith("CONFORME");
    }).length;
    const tauxConformite = totalControles > 0 ? (conformes / totalControles) * 100 : 0;

    // 2. Completude KYC
    const totalClients = clients.length;
    const kycComplete = clients.filter(
      (c) => c.be && c.be.trim() !== "" && c.dateExpCni && c.dateExpCni.trim() !== ""
    ).length;
    const tauxKYC = totalClients > 0 ? (kycComplete / totalClients) * 100 : 0;

    // 3. Alertes ratio (resolved / total)
    const totalAlertes = alertes.length;
    const alertesResolues = alertes.filter((a) => a.statut !== "EN COURS").length;
    const alertesRatio = totalAlertes > 0 ? (alertesResolues / totalAlertes) * 100 : 100;

    // 4. Formation recency
    let formationPct = 0;
    let formationLabel = "Aucune formation";
    if (derniereFormation) {
      const formDate = new Date(derniereFormation);
      if (isNaN(formDate.getTime())) {
        formationPct = 0;
        formationLabel = "Date invalide";
      } else {
      const now = new Date();
      const diffMonths = (now.getFullYear() - formDate.getFullYear()) * 12 + (now.getMonth() - formDate.getMonth());
      if (diffMonths < 12) {
        formationPct = 100;
        formationLabel = `Il y a ${diffMonths} mois`;
      } else if (diffMonths < 24) {
        formationPct = Math.max(20, 100 - (diffMonths - 12) * 6);
        formationLabel = `Il y a ${diffMonths} mois`;
      } else {
        formationPct = 10;
        formationLabel = `Il y a ${Math.floor(diffMonths / 12)} ans`;
      }
      }
    }

    // 5. Score moyen (inverted: lower = better)
    const avgScore =
      totalClients > 0
        ? clients.reduce((sum, c) => sum + (c.scoreGlobal || 0), 0) / totalClients
        : 0;
    const scoreInverted = Math.max(0, 100 - avgScore);

    return { tauxConformite, tauxKYC, alertesRatio, formationPct, formationLabel, scoreInverted, avgScore };
  }, [clients, alertes, controles, derniereFormation]);

  // --- Auto-generated recommendations based on weak indicators ---
  const autoRecommandations = useMemo(() => {
    const recs: string[] = [];
    if (indicators.tauxConformite < 80) {
      recs.push(
        `Taux de conformite a ${Math.round(indicators.tauxConformite)}% — renforcer les controles qualite et planifier des revues periodiques.`
      );
    }
    if (indicators.tauxKYC < 80) {
      recs.push(
        `Completude KYC insuffisante (${Math.round(indicators.tauxKYC)}%) — verifier les pieces d'identite et beneficiaires effectifs manquants.`
      );
    }
    if (indicators.alertesRatio < 80) {
      recs.push(
        `${Math.round(100 - indicators.alertesRatio)}% des alertes sont encore en cours — prioriser le traitement des declarations de soupcon.`
      );
    }
    if (indicators.formationPct < 80) {
      recs.push(
        `Formation LCB-FT obsolete (${indicators.formationLabel}) — programmer une session de mise a jour pour l'equipe.`
      );
    }
    if (indicators.scoreInverted < 50) {
      recs.push(
        `Score de risque moyen eleve (${Math.round(indicators.avgScore)}/100) — revoir la classification des clients a risque.`
      );
    }
    return recs;
  }, [indicators]);

  // --- Filtered & sorted items (Améliorations #29, #30, #31, #35) ---
  const filteredItems = useMemo(() => {
    let items = report.items;

    // Status filter
    if (statusFilter !== "ALL") {
      items = items.filter(i => i.statut === statusFilter);
    }

    // Category filter
    if (categoryFilter !== "ALL") {
      items = items.filter(i => i.categorie === categoryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.indicateur.toLowerCase().includes(q) ||
        i.detail.toLowerCase().includes(q) ||
        i.recommandation.toLowerCase().includes(q) ||
        (i.referenceReglementaire && i.referenceReglementaire.toLowerCase().includes(q))
      );
    }

    // Priority sort (CRITIQUE first)
    if (sortPriority) {
      const order = { CRITIQUE: 0, ALERTE: 1, OK: 2 };
      items = [...items].sort((a, b) => order[a.statut] - order[b.statut]);
    }

    return items;
  }, [report.items, statusFilter, categoryFilter, searchQuery, sortPriority]);

  const categories = useMemo(() => {
    if (sortPriority) return ["TOUS"];
    return [...new Set(filteredItems.map(i => i.categorie))];
  }, [filteredItems, sortPriority]);

  const allCategories = useMemo(() => [...new Set(report.items.map(i => i.categorie))], [report.items]);

  const critiques = report.items.filter((i) => i.statut === "CRITIQUE").length;
  const alerteCount = report.items.filter((i) => i.statut === "ALERTE").length;
  const okCount = report.items.filter((i) => i.statut === "OK").length;

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // --- Empty state (Amélioration #37) ---
  if (clients.length === 0 && !isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">Aucune donnee a analyser</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Le diagnostic 360° necessite au moins un client dans votre portefeuille.
            Ajoutez des clients pour generer votre premier diagnostic de conformite LCB-FT.
          </p>
        </div>
      </div>
    );
  }

  // --- Loading state (Amélioration #28) ---
  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-sm text-slate-400">Analyse du dispositif en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto" role="main" aria-label="Diagnostic 360 Tracfin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" aria-hidden="true" />
            Diagnostic 360° Tracfin
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Analyse complete du dispositif LCB-FT — {report.dateGeneration}
            {" — "}
            <span className="text-slate-500">
              {report.totalClients} client(s), {report.totalCollaborateurs} collaborateur(s), {report.totalAlertes} alerte(s)
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {/* Export CSV (Amélioration #36) */}
          <Button
            onClick={() => exportDiagnosticCsv(report)}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
            aria-label="Exporter en CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button
            onClick={() => generateDiagnosticPdf(report)}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
            aria-label="Exporter le diagnostic en PDF"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Score Banner */}
      <div className="glass-card overflow-hidden">
        <div className={`bg-gradient-to-r ${NOTE_COLORS[report.noteLettre] || NOTE_COLORS.D} p-4 sm:p-6`}>
          <div className="flex items-center gap-4 sm:gap-6">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0"
              aria-label={`Note globale: ${report.noteLettre}`}
            >
              <span className="text-3xl sm:text-4xl font-black text-white">{report.noteLettre}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold text-white">
                Score du dispositif : {report.scoreGlobalDispositif}/100
              </p>
              <p className="text-xs sm:text-sm text-white/80 mt-1">{report.synthese}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-4 sm:gap-6 text-center flex-wrap">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{okCount}</p>
              <p className="text-xs text-slate-400">Conformes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{alerteCount}</p>
              <p className="text-xs text-slate-400">Alertes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{critiques}</p>
              <p className="text-xs text-slate-400">Critiques</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-200">{report.items.length} indicateurs analyses</p>
              <p className="text-xs text-slate-500">sur l'ensemble du dispositif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar (Amélioration #41 - animation) */}
      <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex" role="progressbar" aria-label="Repartition des statuts">
        <div
          className="bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${(okCount / report.items.length) * 100}%` }}
        />
        <div
          className="bg-amber-400 transition-all duration-700 ease-out"
          style={{ width: `${(alerteCount / report.items.length) * 100}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700 ease-out"
          style={{ width: `${(critiques / report.items.length) * 100}%` }}
        />
      </div>

      {/* Circular Gauges (Amélioration #42 - tooltips) */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Indicateurs cles</h2>
        </div>
        <div className="flex flex-wrap justify-around gap-4 sm:gap-6">
          <CircularGauge
            value={indicators.tauxConformite}
            label="Taux de conformite"
            sublabel={`${controles.length} controles`}
            tooltip="Pourcentage de controles qualite conformes"
          />
          <CircularGauge
            value={indicators.tauxKYC}
            label="Completude KYC"
            sublabel={`${clients.length} clients`}
            tooltip="Clients avec BE et CNI renseignes"
          />
          <CircularGauge
            value={indicators.alertesRatio}
            label="Alertes resolues"
            sublabel={`${alertes.length} alertes`}
            tooltip="Pourcentage d'alertes traitees"
          />
          <CircularGauge
            value={indicators.formationPct}
            label="Formation LCB-FT"
            sublabel={indicators.formationLabel}
            tooltip="Recence de la derniere formation LCB-FT"
          />
          <CircularGauge
            value={indicators.scoreInverted}
            label="Score risque moyen"
            sublabel={`${Math.round(indicators.avgScore)}/100`}
            tooltip="Score inverse: 100% = risque tres faible"
          />
        </div>
      </div>

      {/* Category Score Summary (Amélioration #38) */}
      {report.categoryStats.length > 0 && (
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Score par categorie</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.categoryStats.map(cs => {
              const color = cs.score >= 80 ? "bg-emerald-500" : cs.score >= 50 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={cs.categorie} className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1 truncate">{cs.categorie}</p>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-slate-200">{cs.score}%</span>
                    <span className="text-[10px] text-slate-500 mb-0.5">{cs.total} ind.</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
                      style={{ width: `${cs.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Bar (Améliorations #29, #30, #31, #35) */}
      <div className="glass-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span className="text-xs text-slate-500">Filtrer:</span>
        </div>

        {/* Status filter (Amélioration #29) */}
        <div className="flex gap-1" role="group" aria-label="Filtre par statut">
          {(["ALL", "CRITIQUE", "ALERTE", "OK"] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === status
                  ? status === "ALL" ? "bg-sky-500/20 text-sky-400"
                    : status === "OK" ? "bg-emerald-500/20 text-emerald-400"
                    : status === "ALERTE" ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
                  : "bg-white/5 text-slate-500 hover:bg-white/10"
              }`}
            >
              {status === "ALL" ? "Tous" : status}
              {status !== "ALL" && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({status === "OK" ? okCount : status === "ALERTE" ? alerteCount : critiques})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Category filter (Amélioration #30) */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 text-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
          aria-label="Filtre par categorie"
        >
          <option value="ALL">Toutes les categories</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Search (Amélioration #31) */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            placeholder="Rechercher un indicateur..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-white/5 border border-white/10 text-slate-300 rounded-md pl-7 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-600"
            aria-label="Rechercher dans les indicateurs"
          />
        </div>

        {/* Priority sort toggle (Amélioration #35) */}
        <button
          onClick={() => setSortPriority(!sortPriority)}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            sortPriority ? "bg-red-500/20 text-red-400" : "bg-white/5 text-slate-500 hover:bg-white/10"
          }`}
          aria-label="Trier par priorite"
          aria-pressed={sortPriority}
        >
          Priorite
        </button>
      </div>

      {/* Filtered results count */}
      {(statusFilter !== "ALL" || categoryFilter !== "ALL" || searchQuery.trim()) && (
        <p className="text-xs text-slate-500">
          {filteredItems.length} indicateur(s) affiche(s) sur {report.items.length}
        </p>
      )}

      {/* Detail by Category (Améliorations #32, #33) */}
      {sortPriority ? (
        // Flat sorted list when priority mode is on
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            Tous les indicateurs (par priorite)
          </h3>
          <div className="space-y-2" role="list">
            {filteredItems.map((item, idx) => (
              <DiagnosticItemCard key={idx} item={item} />
            ))}
          </div>
        </div>
      ) : (
        categories.map((cat) => {
          const isOpen = !collapsedCategories.has(cat);
          const stats = report.categoryStats.find(cs => cs.categorie === cat);
          const catItems = filteredItems.filter(i => i.categorie === cat);

          return (
            <div key={cat} className="glass-card p-4 sm:p-5">
              <CategoryHeader
                cat={cat}
                stats={stats}
                isOpen={isOpen}
                onToggle={() => toggleCategory(cat)}
              />
              {isOpen && (
                <div className="space-y-2 mt-2" role="list" aria-label={`Indicateurs ${cat}`}>
                  {catItems.map((item, idx) => (
                    <DiagnosticItemCard key={idx} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Recommandations (auto-generated from weak indicators) */}
      {autoRecommandations.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-amber-500/20">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Recommandations
          </h3>
          <div className="space-y-2" role="list" aria-label="Recommandations">
            {autoRecommandations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10" role="listitem">
                <span className="font-bold text-amber-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Actions from diagnostic engine */}
      {report.recommandationsPrioritaires.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4" aria-hidden="true" />
            Actions correctives prioritaires
          </h3>
          <div className="space-y-2" role="list" aria-label="Actions correctives prioritaires">
            {report.recommandationsPrioritaires.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10" role="listitem">
                <span className="font-bold text-red-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
