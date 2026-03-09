import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import {
  runDiagnostic360,
  type DiagnosticReport,
  type DiagnosticItem,
  type CategoryStats,
} from "@/lib/diagnosticEngine";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { useDebounce } from "@/hooks/useDebounce";
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
  ChevronUp,
  Search,
  Filter,
  FileSpreadsheet,
  Loader2,
  Scale,
  Info,
  ExternalLink,
  Clock,
  Zap,
  Target,
  HelpCircle,
  RefreshCw,
  X,
  FolderCheck,
  BarChart3,
  CalendarClock,
  UserCheck,
  Building2,
  BookOpen,
  History,
  Shield,
  Sparkles,
  ArrowUp,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

// ---------------------------------------------------------------------------
// #1 Category icon mapping
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, typeof ShieldCheck> = {
  FolderCheck,
  BarChart3,
  CalendarClock,
  UserCheck,
  Building2,
  BookOpen,
  History,
  Shield,
  HelpCircle,
};

// ---------------------------------------------------------------------------
// #2 Score explanation labels
// ---------------------------------------------------------------------------
const NOTE_EXPLANATIONS: Record<string, string> = {
  A: "Excellent — Votre dispositif est conforme et bien organise.",
  B: "Correct — Quelques ameliorations recommandees.",
  C: "Insuffisant — Des corrections importantes sont necessaires.",
  D: "Critique — Actions urgentes requises pour la conformite.",
};

// ---------------------------------------------------------------------------
// #3 Difficulty & Impact badges
// ---------------------------------------------------------------------------
const DIFFICULTE_CONFIG = {
  facile: { label: "Facile", color: "text-emerald-400 bg-emerald-500/10" },
  moyen: { label: "Moyen", color: "text-amber-400 bg-amber-500/10" },
  complexe: { label: "Complexe", color: "text-red-400 bg-red-500/10" },
};

const IMPACT_CONFIG = {
  faible: { label: "Impact faible", color: "text-slate-400 bg-slate-500/10" },
  moyen: { label: "Impact moyen", color: "text-amber-400 bg-amber-500/10" },
  fort: { label: "Impact fort", color: "text-red-400 bg-red-500/10" },
};

// ---------------------------------------------------------------------------
// #4 Gauge component with tooltip
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
        <RadialBarChart width={112} height={112} cx={56} cy={56} innerRadius={40} outerRadius={52} startAngle={90} endAngle={-270} barSize={10} data={data}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" angleAxisId={0} cornerRadius={6} />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-100">{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-300 text-center leading-tight max-w-[120px]">{label}</p>
      {sublabel && <p className="text-[10px] text-slate-500 text-center">{sublabel}</p>}
      {tooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap border border-white/10">
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// #5 Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  OK: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Conforme", humanLabel: "Tout va bien" },
  ALERTE: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Alerte", humanLabel: "A ameliorer" },
  CRITIQUE: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critique", humanLabel: "Action urgente" },
};

const NOTE_COLORS: Record<string, string> = {
  A: "from-emerald-600/80 to-emerald-700/60",
  B: "from-yellow-600/80 to-yellow-700/60",
  C: "from-orange-600/80 to-orange-700/60",
  D: "from-red-600/80 to-red-700/60",
};

// ---------------------------------------------------------------------------
// #6 DiagnosticItemCard with deep-links, difficulty, impact, time
// ---------------------------------------------------------------------------
function DiagnosticItemCard({ item, onNavigate }: { item: DiagnosticItem; onNavigate: (url: string) => void }) {
  const config = STATUS_CONFIG[item.statut];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`p-3 rounded-lg border ${config.border} ${config.bg} transition-all duration-200 hover:shadow-md`}
      role="listitem"
      aria-label={`${item.indicateur}: ${config.label}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {/* #7 Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-200">{item.indicateur}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.color} ${config.bg}`}>
              {config.humanLabel}
            </span>
            {item.referenceReglementaire && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {item.referenceReglementaire}
              </span>
            )}
          </div>

          {/* #8 Detail */}
          <p className="text-xs text-slate-400 mt-1">{item.detail}</p>

          {/* #9 Recommendation with action button */}
          {item.recommandation !== "Aucune action requise." && (
            <div className="mt-2">
              <p className="text-xs text-amber-400 font-medium">
                &rarr; {item.recommandation}
              </p>

              {/* #10 Progressive disclosure: expand for more details */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 flex items-center gap-1 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Moins de details" : "Plus de details"}
              </button>

              {expanded && (
                <div className="mt-2 flex flex-wrap gap-2 items-center animate-in fade-in duration-200">
                  {/* #11 Difficulty badge */}
                  {item.difficulte && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 ${DIFFICULTE_CONFIG[item.difficulte].color}`}>
                      <Zap className="w-2.5 h-2.5" />
                      {DIFFICULTE_CONFIG[item.difficulte].label}
                    </span>
                  )}
                  {/* #12 Impact badge */}
                  {item.impact && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 ${IMPACT_CONFIG[item.impact].color}`}>
                      <Target className="w-2.5 h-2.5" />
                      {IMPACT_CONFIG[item.impact].label}
                    </span>
                  )}
                  {/* #13 Time estimate */}
                  {item.tempsEstime && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {item.tempsEstime}
                    </span>
                  )}
                  {/* #14 Deep-link "Corriger" button */}
                  {item.actionUrl && item.statut !== "OK" && (
                    <button
                      onClick={() => onNavigate(item.actionUrl!)}
                      className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Corriger
                    </button>
                  )}
                  {/* #15 Client names involved */}
                  {item.clientsConcernes && item.clientsConcernes.length > 0 && (
                    <p className="text-[9px] text-slate-500 w-full mt-1">
                      Clients: {item.clientsConcernes.slice(0, 5).join(", ")}{item.clientsConcernes.length > 5 ? ` (+${item.clientsConcernes.length - 5})` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// #16 CategoryHeader with icon, description, collapsible, positive message
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
  const CatIcon = stats?.meta?.icon ? (CATEGORY_ICONS[stats.meta.icon] || HelpCircle) : HelpCircle;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 group text-left"
        aria-expanded={isOpen}
        aria-label={`Categorie ${cat}${stats ? `, score ${stats.score}%` : ""}`}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          <CatIcon className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-200">{cat}</h3>
          {stats && <span className={`text-xs font-bold ${scoreColor}`}>{stats.score}%</span>}
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-[10px]">
            {stats.ok > 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {stats.ok}</span>}
            {stats.alerte > 0 && <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {stats.alerte}</span>}
            {stats.critique > 0 && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {stats.critique}</span>}
          </div>
        )}
      </button>
      {/* #17 Category description */}
      {isOpen && stats?.meta?.description && (
        <p className="text-[10px] text-slate-500 ml-10 -mt-1 mb-2">{stats.meta.description}</p>
      )}
      {/* #18 Positive reinforcement when all OK */}
      {isOpen && stats && stats.critique === 0 && stats.alerte === 0 && stats.ok > 0 && (
        <div className="ml-10 mb-2 flex items-center gap-2 text-[10px] text-emerald-400">
          <Sparkles className="w-3 h-3" />
          {stats.meta.positiveMessage}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// #19 CSV Export
// ---------------------------------------------------------------------------
function escapeCsvField(value: string): string {
  // Escape double quotes by doubling them, then wrap in quotes if contains separator/quotes/newlines
  if (value.includes('"') || value.includes(';') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportDiagnosticCsv(report: DiagnosticReport) {
  const header = "Categorie;Indicateur;Statut;Detail;Recommandation;Difficulte;Impact;Temps estime;Reference\n";
  const rows = report.items.map(item =>
    [
      escapeCsvField(item.categorie),
      escapeCsvField(item.indicateur),
      item.statut,
      escapeCsvField(item.detail),
      escapeCsvField(item.recommandation),
      item.difficulte || "",
      item.impact || "",
      item.tempsEstime || "",
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
  toast.success("Export CSV telecharge avec succes.");
}

// ---------------------------------------------------------------------------
// #20 Onboarding help section
// ---------------------------------------------------------------------------
function HelpSection({ onClose }: { onClose: () => void }) {
  return (
    <div className="glass-card p-5 ring-1 ring-sky-500/20 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-slate-300" aria-label="Fermer l'aide">
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-semibold text-sky-400 flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4" />
        Comment lire ce diagnostic ?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-300">Conforme</p>
            <p>L'indicateur est conforme aux exigences reglementaires. Aucune action necessaire.</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-300">Alerte</p>
            <p>Un point d'amelioration a ete detecte. Une action est recommandee sous 30 jours.</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-300">Critique</p>
            <p>Un probleme urgent necessite une correction immediate pour rester en conformite.</p>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 mt-3">
        Cliquez sur "Plus de details" sur chaque indicateur pour voir la difficulte, l'impact et un lien direct vers la correction.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// #21 Quick-jump section navigator (sticky)
// ---------------------------------------------------------------------------
function SectionNav({
  categories,
  activeCategory,
  onJump,
}: {
  categories: string[];
  activeCategory: string | null;
  onJump: (cat: string) => void;
}) {
  return (
    <div className="glass-card p-2 flex gap-1 overflow-x-auto sticky top-0 z-10" role="navigation" aria-label="Navigation rapide par categorie">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onJump(cat)}
          className={`text-[10px] px-2 py-1 rounded whitespace-nowrap transition-colors ${
            activeCategory === cat ? "bg-sky-500/20 text-sky-400" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DiagnosticPage() {
  const { clients, collaborateurs, alertes, logs } = useAppState();
  const navigate = useNavigate();

  // --- Refs for section jumping (#22) ---
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const topRef = useRef<HTMLDivElement>(null);

  // --- States ---
  const [isLoading, setIsLoading] = useState(true);
  const [controles, setControles] = useState<Record<string, unknown>[]>([]);
  const [derniereFormation, setDerniereFormation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OK" | "ALERTE" | "CRITIQUE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortPriority, setSortPriority] = useState(false);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem("diag360_help_dismissed")); // #23 persistent help
  const [showBackToTop, setShowBackToTop] = useState(false); // #24 back to top
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // #25 active section

  // --- #24 Back to top scroll listener ---
  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // --- Data loading ---
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
        const { data } = await supabase.from("parametres").select("valeur").eq("cle", "lcbft_config").maybeSingle();
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

  // --- #26 Refresh function ---
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    toast.success("Diagnostic actualise.");
  }, []);

  // --- Diagnostic report ---
  const report = useMemo<DiagnosticReport>(
    () => runDiagnostic360(clients, collaborateurs, alertes, logs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, collaborateurs, alertes, logs, refreshKey]
  );

  // --- Computed indicators ---
  const indicators = useMemo(() => {
    const totalControles = controles.length;
    const conformes = controles.filter((c) => ((c.resultat_global as string) || "").startsWith("CONFORME")).length;
    const tauxConformite = totalControles > 0 ? (conformes / totalControles) * 100 : 0;

    const totalClients = clients.length;
    const kycComplete = clients.filter((c) => c.be && c.be.trim() !== "" && c.dateExpCni && c.dateExpCni.trim() !== "").length;
    const tauxKYC = totalClients > 0 ? (kycComplete / totalClients) * 100 : 0;

    const totalAlertes = alertes.length;
    const alertesResolues = alertes.filter((a) => a.statut !== "EN COURS").length;
    const alertesRatio = totalAlertes > 0 ? (alertesResolues / totalAlertes) * 100 : 100;

    let formationPct = 0;
    let formationLabel = "Aucune formation";
    if (derniereFormation) {
      const formDate = new Date(derniereFormation);
      const now = new Date();
      const diffMonths = (now.getFullYear() - formDate.getFullYear()) * 12 + (now.getMonth() - formDate.getMonth());
      if (diffMonths < 12) { formationPct = 100; formationLabel = `Il y a ${diffMonths} mois`; }
      else if (diffMonths < 24) { formationPct = Math.max(20, 100 - (diffMonths - 12) * 6); formationLabel = `Il y a ${diffMonths} mois`; }
      else { formationPct = 10; formationLabel = `Il y a ${Math.floor(diffMonths / 12)} ans`; }
    }

    const avgScore = totalClients > 0 ? clients.reduce((sum, c) => sum + (c.scoreGlobal || 0), 0) / totalClients : 0;
    const scoreInverted = Math.max(0, 100 - avgScore);

    return { tauxConformite, tauxKYC, alertesRatio, formationPct, formationLabel, scoreInverted, avgScore };
  }, [clients, alertes, controles, derniereFormation]);

  // --- Auto recommendations ---
  const autoRecommandations = useMemo(() => {
    const recs: string[] = [];
    if (indicators.tauxConformite < 80) recs.push(`Taux de conformite a ${Math.round(indicators.tauxConformite)}% — renforcer les controles qualite.`);
    if (indicators.tauxKYC < 80) recs.push(`Completude KYC insuffisante (${Math.round(indicators.tauxKYC)}%) — verifier les pieces manquantes.`);
    if (indicators.alertesRatio < 80) recs.push(`${Math.round(100 - indicators.alertesRatio)}% des alertes en cours — prioriser leur traitement.`);
    if (indicators.formationPct < 80) recs.push(`Formation LCB-FT obsolete (${indicators.formationLabel}) — programmer une session.`);
    if (indicators.scoreInverted < 50) recs.push(`Risque moyen eleve (${Math.round(indicators.avgScore)}/100) — revoir la classification.`);
    return recs;
  }, [indicators]);

  // --- Debounced search for perf ---
  const debouncedSearch = useDebounce(searchQuery, 250);

  // --- Filtered & sorted items ---
  const filteredItems = useMemo(() => {
    let items = report.items;
    if (statusFilter !== "ALL") items = items.filter(i => i.statut === statusFilter);
    if (categoryFilter !== "ALL") items = items.filter(i => i.categorie === categoryFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(i =>
        i.indicateur.toLowerCase().includes(q) ||
        i.detail.toLowerCase().includes(q) ||
        i.recommandation.toLowerCase().includes(q) ||
        (i.referenceReglementaire && i.referenceReglementaire.toLowerCase().includes(q))
      );
    }
    if (sortPriority) {
      const order = { CRITIQUE: 0, ALERTE: 1, OK: 2 };
      items = [...items].sort((a, b) => order[a.statut] - order[b.statut]);
    }
    return items;
  }, [report.items, statusFilter, categoryFilter, debouncedSearch, sortPriority]);

  const categories = useMemo(() => {
    if (sortPriority) return ["TOUS"];
    return [...new Set(filteredItems.map(i => i.categorie))];
  }, [filteredItems, sortPriority]);

  const allCategories = useMemo(() => [...new Set(report.items.map(i => i.categorie))], [report.items]);

  const { critiques, alerteCount, okCount } = useMemo(() => ({
    critiques: report.items.filter(i => i.statut === "CRITIQUE").length,
    alerteCount: report.items.filter(i => i.statut === "ALERTE").length,
    okCount: report.items.filter(i => i.statut === "OK").length,
  }), [report.items]);
  const hasFilters = statusFilter !== "ALL" || categoryFilter !== "ALL" || searchQuery.trim();

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  // --- #27 Collapse/expand all ---
  const collapseAll = useCallback(() => setCollapsedCategories(new Set(allCategories)), [allCategories]);
  const expandAll = useCallback(() => setCollapsedCategories(new Set()), []);
  const allCollapsed = collapsedCategories.size === allCategories.length;

  // --- #28 Reset all filters ---
  const resetFilters = useCallback(() => {
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSearchQuery("");
    setSortPriority(false);
  }, []);

  // --- #22 Jump to category section ---
  const jumpToCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    const el = categoryRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // --- #29 Dismiss help ---
  const dismissHelp = useCallback(() => {
    setShowHelp(false);
    localStorage.setItem("diag360_help_dismissed", "1");
  }, []);

  // --- #30 Navigate handler for deep links ---
  const handleNavigate = useCallback((url: string) => navigate(url), [navigate]);

  // --- Upcoming deadlines (memoized, avoids IIFE in JSX) ---
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return clients
      .filter(c => c.statut !== "INACTIF" && c.dateButoir)
      .map(c => ({ nom: c.raisonSociale, date: c.dateButoir, diff: Math.round((new Date(c.dateButoir).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) }))
      .filter(c => c.diff > 0 && c.diff <= 90)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5);
  }, [clients]);

  // --- Empty state ---
  if (clients.length === 0 && !isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">Aucune donnee a analyser</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Le diagnostic 360° necessite au moins un client dans votre portefeuille.
          </p>
          <Button onClick={() => navigate("/nouveau-client")} className="gap-2">
            Ajouter votre premier client
          </Button>
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-sm text-slate-400">Analyse du dispositif en cours...</p>
          <p className="text-[10px] text-slate-600">Verification de {clients.length} client(s), {collaborateurs.length} collaborateur(s)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto print:max-w-none print:p-2" role="main" aria-label="Diagnostic 360 Tracfin" ref={topRef}>
      {/* #31 Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" aria-hidden="true" />
            Diagnostic 360° Tracfin
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {report.dateGeneration} — {report.totalClients} client(s), {report.totalCollaborateurs} collaborateur(s), {report.totalAlertes} alerte(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* #32 Help toggle */}
          <Button onClick={() => setShowHelp(!showHelp)} variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-slate-300" aria-label="Afficher l'aide">
            <HelpCircle className="w-4 h-4" />
          </Button>
          {/* #33 Refresh */}
          <Button onClick={handleRefresh} variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-slate-300" aria-label="Actualiser le diagnostic">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => exportDiagnosticCsv(report)} variant="outline" size="sm" className="gap-2 border-white/10 text-slate-300 hover:bg-white/5" aria-label="Exporter en CSV">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button
            onClick={() => { try { generateDiagnosticPdf(report); toast.success("PDF telecharge avec succes."); } catch { toast.error("Erreur lors de la generation du PDF."); } }}
            variant="outline" size="sm" className="gap-2 border-white/10 text-slate-300 hover:bg-white/5" aria-label="Exporter en PDF"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* #34 Onboarding help section */}
      {showHelp && <HelpSection onClose={dismissHelp} />}

      {/* #35 Score Banner with explanation */}
      <div className="glass-card overflow-hidden">
        <div className={`bg-gradient-to-r ${NOTE_COLORS[report.noteLettre] || NOTE_COLORS.D} p-4 sm:p-6`}>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 group relative" aria-label={`Note: ${report.noteLettre}`}>
              <span className="text-3xl sm:text-4xl font-black text-white">{report.noteLettre}</span>
              {/* #36 Score explanation tooltip */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full bg-slate-900 text-[10px] text-slate-300 px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap border border-white/10">
                {NOTE_EXPLANATIONS[report.noteLettre] || ""}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold text-white">
                Score : {report.scoreGlobalDispositif}/100
              </p>
              {/* #37 Plain-language synthesis */}
              <p className="text-xs sm:text-sm text-white/90 mt-1 font-medium">{report.syntheseSimple}</p>
              <p className="text-[10px] text-white/60 mt-1 hidden sm:block">{report.synthese}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-4 sm:gap-6 text-center flex-wrap">
            <div><p className="text-2xl font-bold text-emerald-400">{okCount}</p><p className="text-xs text-slate-400">Conformes</p></div>
            <div><p className="text-2xl font-bold text-amber-400">{alerteCount}</p><p className="text-xs text-slate-400">Alertes</p></div>
            <div><p className="text-2xl font-bold text-red-400">{critiques}</p><p className="text-xs text-slate-400">Critiques</p></div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-200">{report.items.length} indicateurs</p>
              <p className="text-xs text-slate-500">analyses sur {allCategories.length} categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* #38 Animated progress bar */}
      <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex" role="progressbar" aria-label="Repartition des statuts" aria-valuenow={report.scoreGlobalDispositif} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${(okCount / report.items.length) * 100}%` }} />
        <div className="bg-amber-400 transition-all duration-1000 ease-out" style={{ width: `${(alerteCount / report.items.length) * 100}%` }} />
        <div className="bg-red-500 transition-all duration-1000 ease-out" style={{ width: `${(critiques / report.items.length) * 100}%` }} />
      </div>

      {/* #39 Key indicators gauges */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Indicateurs cles</h2>
        </div>
        <div className="flex flex-wrap justify-around gap-4 sm:gap-6">
          <CircularGauge value={indicators.tauxConformite} label="Conformite" sublabel={`${controles.length} controles`} tooltip="Pourcentage de controles qualite conformes" />
          <CircularGauge value={indicators.tauxKYC} label="KYC complet" sublabel={`${clients.length} clients`} tooltip="Clients avec BE et CNI renseignes" />
          <CircularGauge value={indicators.alertesRatio} label="Alertes traitees" sublabel={`${alertes.length} alertes`} tooltip="Pourcentage d'alertes resolues" />
          <CircularGauge value={indicators.formationPct} label="Formation" sublabel={indicators.formationLabel} tooltip="Recence de la derniere formation LCB-FT" />
          <CircularGauge value={indicators.scoreInverted} label="Maitrise du risque" sublabel={`Score: ${Math.round(indicators.avgScore)}`} tooltip="100% = risque tres faible" />
        </div>
      </div>

      {/* #40 Category score cards (clickable → jump) */}
      {report.categoryStats.length > 0 && (
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Score par categorie</h2>
            <span className="text-[10px] text-slate-600 ml-2">(cliquez pour naviguer)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.categoryStats.map(cs => {
              const color = cs.score >= 80 ? "bg-emerald-500" : cs.score >= 50 ? "bg-amber-500" : "bg-red-500";
              const CatIcon = CATEGORY_ICONS[cs.meta?.icon] || HelpCircle;
              return (
                <button
                  key={cs.categorie}
                  onClick={() => jumpToCategory(cs.categorie)}
                  className="bg-white/5 rounded-lg p-3 text-left hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CatIcon className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                    <p className="text-xs text-slate-400 truncate group-hover:text-slate-300">{cs.categorie}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-slate-200">{cs.score}%</span>
                    <span className="text-[10px] text-slate-500 mb-0.5">{cs.total} ind.</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out`} style={{ width: `${cs.score}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* #41 Section quick-nav (sticky) */}
      {!sortPriority && (
        <SectionNav categories={allCategories} activeCategory={activeCategory} onJump={jumpToCategory} />
      )}

      {/* #42 Filters bar */}
      <div className="glass-card p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center print:hidden">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span className="text-xs text-slate-500">Filtrer:</span>
        </div>

        {/* Status filter */}
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
              {status === "ALL" ? "Tous" : STATUS_CONFIG[status].humanLabel}
              {status !== "ALL" && <span className="ml-1 text-[10px] opacity-70">({status === "OK" ? okCount : status === "ALERTE" ? alerteCount : critiques})</span>}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 text-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500" aria-label="Filtre par categorie"
        >
          <option value="ALL">Toutes les categories</option>
          {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-white/5 border border-white/10 text-slate-300 rounded-md pl-7 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-600" aria-label="Rechercher"
          />
        </div>

        {/* Priority sort */}
        <button onClick={() => setSortPriority(!sortPriority)}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${sortPriority ? "bg-red-500/20 text-red-400" : "bg-white/5 text-slate-500 hover:bg-white/10"}`} aria-pressed={sortPriority}
        >
          Priorite
        </button>

        {/* #43 Collapse/expand all */}
        <button onClick={allCollapsed ? expandAll : collapseAll}
          className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-slate-500 hover:bg-white/10 transition-colors"
        >
          {allCollapsed ? "Deplier" : "Replier"}
        </button>

        {/* #44 Reset filters */}
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-slate-500 hover:bg-white/10 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Reinitialiser
          </button>
        )}
      </div>

      {/* #45 Filtered count */}
      {hasFilters && (
        <p className="text-xs text-slate-500">{filteredItems.length} indicateur(s) sur {report.items.length}</p>
      )}

      {/* Empty filter results */}
      {hasFilters && filteredItems.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucun indicateur ne correspond a vos filtres.</p>
          <button onClick={resetFilters} className="text-xs text-sky-400 hover:text-sky-300 mt-2 transition-colors">
            Reinitialiser les filtres
          </button>
        </div>
      )}

      {/* #46 Items by category / priority */}
      {sortPriority ? (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            Tous les indicateurs (par priorite)
          </h3>
          <div className="space-y-2" role="list">
            {filteredItems.map((item) => <DiagnosticItemCard key={`${item.categorie}-${item.indicateur}`} item={item} onNavigate={handleNavigate} />)}
          </div>
        </div>
      ) : (
        categories.map(cat => {
          const isOpen = !collapsedCategories.has(cat);
          const stats = report.categoryStats.find(cs => cs.categorie === cat);
          const catItems = filteredItems.filter(i => i.categorie === cat);
          return (
            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} className="glass-card p-4 sm:p-5 scroll-mt-20">
              <CategoryHeader cat={cat} stats={stats} isOpen={isOpen} onToggle={() => toggleCategory(cat)} />
              {isOpen && (
                <div className="space-y-2 mt-2" role="list" aria-label={`Indicateurs ${cat}`}>
                  {catItems.map((item) => <DiagnosticItemCard key={`${item.categorie}-${item.indicateur}`} item={item} onNavigate={handleNavigate} />)}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* #47 Recommendations */}
      {autoRecommandations.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-amber-500/20">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Que faire en priorite ?
          </h3>
          <div className="space-y-2" role="list">
            {autoRecommandations.map((rec, i) => (
              <div key={`rec-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10" role="listitem">
                <span className="font-bold text-amber-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #48 Priority actions */}
      {report.recommandationsPrioritaires.length > 0 && (
        <div className="glass-card p-5 ring-1 ring-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4" aria-hidden="true" />
            Actions correctives urgentes
          </h3>
          <div className="space-y-2" role="list">
            {report.recommandationsPrioritaires.map((rec, i) => (
              <div key={`prio-${i}-${rec.slice(0, 20)}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10" role="listitem">
                <span className="font-bold text-red-400 text-sm">{i + 1}.</span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #49 Next deadlines summary */}
      {upcomingDeadlines.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-sky-400" />
            Prochaines echeances (90 jours)
          </h3>
          <div className="space-y-1.5">
            {upcomingDeadlines.map((c) => (
              <div key={`${c.nom}-${c.date}`} className="flex items-center gap-3 text-xs">
                <span className={`font-mono ${c.diff <= 30 ? "text-red-400" : c.diff <= 60 ? "text-amber-400" : "text-slate-400"}`}>
                  J-{c.diff}
                </span>
                <span className="text-slate-300">{c.nom}</span>
                <span className="text-slate-600 text-[10px]">{c.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #50 Back to top button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 backdrop-blur border border-sky-500/20 shadow-lg transition-all z-50 print:hidden"
          aria-label="Retour en haut"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
