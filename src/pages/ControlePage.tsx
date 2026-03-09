import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ClipboardCheck, FileDown, RefreshCw, Plus, Eye, AlertTriangle, CheckCircle2,
  XCircle, Info, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Filter, Download, Trash2, Edit3, Calendar, TrendingUp, TrendingDown,
  BarChart3, ShieldCheck, ShieldAlert, Target, Users, ArrowUpDown,
  ChevronsLeft, ChevronsRight, Shuffle, UserCheck, FileText, Printer,
  Copy, X, ListFilter, Percent, Hash, Clock, ArrowRight, Minus,
} from "lucide-react";
import { useAppState } from "@/lib/AppContext";
import { controlesService } from "@/lib/supabaseService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VigilanceBadge, ScoreGauge } from "@/components/RiskBadges";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { ControleQualite, Client } from "@/lib/types";
import { generateRapportControle, generateSingleControlePdf } from "@/lib/generateControlePdf";

// ─── Types ──────────────────────────────────────────────────────────
type ResultatGlobal = "CONFORME" | "NON CONFORME MINEUR" | "NON CONFORME MAJEUR" | "CONFORME AVEC RESERVES";
type SortField = "dateTirage" | "dossierAudite" | "scoreGlobal" | "nivVigilance" | "resultatGlobal";
type SortDir = "asc" | "desc";
type TabView = "historique" | "statistiques" | "couverture";

const RESULTAT_OPTIONS: ResultatGlobal[] = [
  "CONFORME",
  "NON CONFORME MINEUR",
  "NON CONFORME MAJEUR",
  "CONFORME AVEC RESERVES",
];

const SUIVI_OPTIONS = [
  { value: "A_TRAITER", label: "A traiter", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "EN_COURS", label: "En cours", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { value: "RESOLU", label: "Resolu", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "CLOTURE", label: "Cloture", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
];

const CHECKPOINT_TEMPLATES: Record<string, string[]> = {
  point1: [
    "CNI en cours de validite, KBIS < 3 mois, RBE conforme et a jour",
    "Identite verifiee, beneficiaires effectifs declares, aucune anomalie",
    "CNI expiree - demande de renouvellement en cours. BE declares conformes au RBE",
    "Verification complete: CNI valide, KBIS conforme, declarations BE a jour",
  ],
  point2: [
    "Score coherent avec le profil de risque, niveau de vigilance adapte",
    "Incoherence detectee entre le score et le niveau de vigilance - correction necessaire",
    "Scoring conforme, criteres de risque correctement evalues, vigilance proportionnee",
    "Score recalcule apres mise a jour des facteurs - vigilance ajustee en consequence",
  ],
  point3: [
    "Lettre de mission signee, mandat DAC en place, pieces justificatives completes",
    "Documents contractuels conformes, archivage numerique verifie",
    "Lettre de mission a renouveler, mandat conforme, justificatifs presents",
    "Ensemble documentaire complet et conforme aux exigences reglementaires",
  ],
};

const resultatConfig: Record<ResultatGlobal, { color: string; icon: typeof CheckCircle2; rowBg: string }> = {
  "CONFORME": {
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    icon: CheckCircle2,
    rowBg: "hover:bg-emerald-500/[0.03]",
  },
  "NON CONFORME MINEUR": {
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    icon: AlertTriangle,
    rowBg: "hover:bg-orange-500/[0.03]",
  },
  "NON CONFORME MAJEUR": {
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    icon: XCircle,
    rowBg: "hover:bg-red-500/[0.03]",
  },
  "CONFORME AVEC RESERVES": {
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    icon: Info,
    rowBg: "hover:bg-amber-500/[0.03]",
  },
};

const PAGE_SIZES = [10, 25, 50] as const;

// ─── Helpers ────────────────────────────────────────────────────────
function formatDateFR(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function relativeDate(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an(s)`;
}

function mapDbToControle(row: Record<string, unknown>): ControleQualite {
  return {
    id: (row.id as string) || undefined,
    dateTirage: (row.date_tirage as string) || "",
    dossierAudite: (row.dossier_audite as string) || "",
    siren: (row.siren as string) || "",
    forme: (row.forme as string) || "",
    ppe: ((row.ppe as string) || "NON") as "OUI" | "NON",
    paysRisque: ((row.pays_risque as string) || "NON") as "OUI" | "NON",
    atypique: ((row.atypique as string) || "NON") as "OUI" | "NON",
    distanciel: ((row.distanciel as string) || "NON") as "OUI" | "NON",
    cash: ((row.cash as string) || "NON") as "OUI" | "NON",
    pression: ((row.pression as string) || "NON") as "OUI" | "NON",
    scoreGlobal: (row.score_global as number) || 0,
    nivVigilance: ((row.niv_vigilance as string) || "SIMPLIFIEE") as ControleQualite["nivVigilance"],
    point1: (row.point1 as string) || "",
    point2: (row.point2 as string) || "",
    point3: (row.point3 as string) || "",
    resultatGlobal: (row.resultat_global as string) || "",
    incident: (row.incident as string) || "",
    commentaire: (row.commentaire as string) || "",
    controleur: (row.controleur as string) || "",
    actionCorrectrice: (row.action_correctrice as string) || "",
    dateEcheance: (row.date_echeance as string) || "",
    suiviStatut: (row.suivi_statut as string) || "",
    createdAt: (row.created_at as string) || "",
  };
}

function mapControleToDb(c: ControleQualite): Record<string, unknown> {
  return {
    date_tirage: c.dateTirage,
    dossier_audite: c.dossierAudite,
    siren: c.siren,
    forme: c.forme,
    ppe: c.ppe,
    pays_risque: c.paysRisque,
    atypique: c.atypique,
    distanciel: c.distanciel,
    cash: c.cash,
    pression: c.pression,
    score_global: c.scoreGlobal,
    niv_vigilance: c.nivVigilance,
    point1: c.point1,
    point2: c.point2,
    point3: c.point3,
    resultat_global: c.resultatGlobal,
    incident: c.incident,
    commentaire: c.commentaire,
    controleur: c.controleur,
    action_correctrice: c.actionCorrectrice,
    date_echeance: c.dateEcheance,
    suivi_statut: c.suiviStatut,
  };
}

function detectAnomalies(c: ControleQualite): string[] {
  const anomalies: string[] = [];
  if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI")) {
    anomalies.push("Vigilance simplifiee avec facteur de risque actif (PPE ou pays a risque)");
  }
  if (c.nivVigilance === "SIMPLIFIEE" && c.scoreGlobal >= 60) {
    anomalies.push("Vigilance simplifiee avec score eleve (>= 60)");
  }
  if (c.nivVigilance === "RENFORCEE" && c.scoreGlobal <= 25) {
    anomalies.push("Vigilance renforcee avec score faible (<= 25) - justification requise");
  }
  if (c.resultatGlobal.startsWith("NON CONFORME") && !c.actionCorrectrice) {
    anomalies.push("Non-conformite sans action correctrice definie");
  }
  if (c.resultatGlobal.startsWith("NON CONFORME") && !c.dateEcheance) {
    anomalies.push("Non-conformite sans date d'echeance pour correction");
  }
  const riskCount = [c.ppe, c.paysRisque, c.atypique, c.distanciel, c.cash, c.pression]
    .filter((v) => v === "OUI").length;
  if (riskCount >= 3 && c.nivVigilance !== "RENFORCEE") {
    anomalies.push(`${riskCount} facteurs de risque actifs mais vigilance non renforcee`);
  }
  return anomalies;
}

const emptyForm: ControleQualite = {
  dateTirage: "",
  dossierAudite: "",
  siren: "",
  forme: "",
  ppe: "NON",
  paysRisque: "NON",
  atypique: "NON",
  distanciel: "NON",
  cash: "NON",
  pression: "NON",
  scoreGlobal: 0,
  nivVigilance: "SIMPLIFIEE",
  point1: "",
  point2: "",
  point3: "",
  resultatGlobal: "CONFORME",
  incident: "",
  commentaire: "",
  controleur: "",
  actionCorrectrice: "",
  dateEcheance: "",
  suiviStatut: "",
};

// ─── Skeleton ───────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-4 bg-white/[0.06] rounded w-20" />
          <div className="h-4 bg-white/[0.06] rounded w-40 flex-1" />
          <div className="h-4 bg-white/[0.06] rounded w-16" />
          <div className="h-4 bg-white/[0.06] rounded w-20" />
          <div className="h-4 bg-white/[0.06] rounded w-32" />
          <div className="h-4 bg-white/[0.06] rounded w-4" />
        </div>
      ))}
    </div>
  );
}

// ─── Flag Pills Component ───────────────────────────────────────────
function FlagPills({ data }: { data: ControleQualite }) {
  const flags = [
    { label: "PPE", value: data.ppe },
    { label: "Pays risque", value: data.paysRisque },
    { label: "Atypique", value: data.atypique },
    { label: "Distanciel", value: data.distanciel },
    { label: "Cash", value: data.cash },
    { label: "Pression", value: data.pression },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span
          key={flag.label}
          className={`text-xs px-2 py-0.5 rounded-full border ${
            flag.value === "OUI"
              ? "text-red-400 bg-red-500/10 border-red-500/20"
              : "text-slate-500 bg-slate-500/5 border-white/[0.06]"
          }`}
        >
          {flag.label}: {flag.value}
        </span>
      ))}
    </div>
  );
}

// ─── Stats Card ─────────────────────────────────────────────────────
function StatCard({
  label, value, color, icon: Icon, subtitle, onClick, active,
}: {
  label: string; value: number | string; color: string; icon: typeof CheckCircle2;
  subtitle?: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      className={`glass-card p-4 text-center transition-all duration-200 ${
        onClick ? "cursor-pointer hover:bg-white/[0.04]" : ""
      } ${active ? "ring-1 ring-blue-500/50" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className={`text-2xl font-bold ${color} tabular-nums`}>{value}</p>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      {subtitle && <p className="text-[10px] text-slate-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ControlePage() {
  const { clients, addLog, isOnline } = useAppState();
  const [controles, setControles] = useState<ControleQualite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDrawOptions, setShowDrawOptions] = useState(false);

  // Filter & sort state
  const [search, setSearch] = useState("");
  const [filterResultat, setFilterResultat] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterVigilance, setFilterVigilance] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("dateTirage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("historique");

  // Draw options
  const [drawCount, setDrawCount] = useState(1);
  const [drawMode, setDrawMode] = useState<"random" | "weighted" | "manual">("random");
  const [excludeControlled, setExcludeControlled] = useState(true);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");

  // Form state
  const [form, setForm] = useState<ControleQualite>({ ...emptyForm });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formDirty, setFormDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load controles ──
  const loadControles = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const rows = await controlesService.getAll();
      setControles(rows.map((r: Record<string, unknown>) => mapDbToControle(r)));
    } catch {
      setLoadError(true);
      toast.error("Erreur lors du chargement des controles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadControles();
  }, [loadControles]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowDrawOptions(true);
      }
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Filtered & sorted data ──
  const filteredControles = useMemo(() => {
    let result = [...controles];

    // Stat filter
    if (activeStatFilter) {
      if (activeStatFilter === "CONFORME") result = result.filter((c) => c.resultatGlobal === "CONFORME");
      else if (activeStatFilter === "NON_CONFORME") result = result.filter((c) => c.resultatGlobal.startsWith("NON CONFORME"));
      else if (activeStatFilter === "RESERVES") result = result.filter((c) => c.resultatGlobal === "CONFORME AVEC RESERVES");
      else if (activeStatFilter === "INCIDENTS") result = result.filter((c) => c.incident);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.dossierAudite.toLowerCase().includes(q) ||
          c.siren.includes(q) ||
          c.controleur.toLowerCase().includes(q) ||
          c.incident.toLowerCase().includes(q) ||
          c.commentaire.toLowerCase().includes(q)
      );
    }

    // Filter by result
    if (filterResultat !== "ALL") {
      result = result.filter((c) => c.resultatGlobal === filterResultat);
    }

    // Filter by vigilance
    if (filterVigilance !== "ALL") {
      result = result.filter((c) => c.nivVigilance === filterVigilance);
    }

    // Filter by date range
    if (filterDateFrom) {
      result = result.filter((c) => c.dateTirage >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((c) => c.dateTirage <= filterDateTo);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const fa = a[sortField];
      const fb = b[sortField];
      if (typeof fa === "number" && typeof fb === "number") cmp = fa - fb;
      else cmp = String(fa).localeCompare(String(fb), "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [controles, search, filterResultat, filterVigilance, filterDateFrom, filterDateTo, sortField, sortDir, activeStatFilter]);

  // ── Pagination ──
  const totalPages = Math.ceil(filteredControles.length / pageSize);
  const paginatedControles = useMemo(
    () => filteredControles.slice(page * pageSize, (page + 1) * pageSize),
    [filteredControles, page, pageSize]
  );

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, filterResultat, filterVigilance, filterDateFrom, filterDateTo, activeStatFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = controles.length;
    const conformes = controles.filter((c) => c.resultatGlobal === "CONFORME").length;
    const ncMineur = controles.filter((c) => c.resultatGlobal === "NON CONFORME MINEUR").length;
    const ncMajeur = controles.filter((c) => c.resultatGlobal === "NON CONFORME MAJEUR").length;
    const reserves = controles.filter((c) => c.resultatGlobal === "CONFORME AVEC RESERVES").length;
    const incidents = controles.filter((c) => c.incident).length;
    const tauxConformite = total > 0 ? Math.round(((conformes + reserves) / total) * 100) : 0;

    // Trend: compare last 30 days vs previous 30 days
    const now = Date.now();
    const d30 = 30 * 86400000;
    const recent = controles.filter((c) => now - new Date(c.dateTirage).getTime() < d30);
    const previous = controles.filter((c) => {
      const diff = now - new Date(c.dateTirage).getTime();
      return diff >= d30 && diff < d30 * 2;
    });
    const recentRate = recent.length > 0 ? (recent.filter((c) => c.resultatGlobal === "CONFORME" || c.resultatGlobal === "CONFORME AVEC RESERVES").length / recent.length) * 100 : 0;
    const prevRate = previous.length > 0 ? (previous.filter((c) => c.resultatGlobal === "CONFORME" || c.resultatGlobal === "CONFORME AVEC RESERVES").length / previous.length) * 100 : 0;
    const trend = recentRate - prevRate;

    // Coverage: unique clients controlled vs total valid clients
    const controlledSirens = new Set(controles.map((c) => c.siren));
    const validClients = clients.filter((c) => c.etat === "VALIDE");
    const coverageRate = validClients.length > 0 ? Math.round((controlledSirens.size / validClients.length) * 100) : 0;

    return { total, conformes, ncMineur, ncMajeur, reserves, incidents, tauxConformite, trend, coverageRate, controlledSirens, validClients };
  }, [controles, clients]);

  // ── Sort handler ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  // ── Draw logic ──
  const executeRandomDraw = useCallback(() => {
    const valides = clients.filter((c) => c.etat === "VALIDE");
    let pool = valides;

    if (excludeControlled) {
      const controlledSirens = new Set(controles.map((c) => c.siren));
      pool = valides.filter((c) => !controlledSirens.has(c.siren));
      if (pool.length === 0) {
        pool = valides; // fallback if all already controlled
        toast.info("Tous les clients ont deja ete controles — tirage sur l'ensemble");
      }
    }

    if (pool.length === 0) {
      toast.error("Aucun client valide pour le tirage");
      return;
    }

    let selected: Client[];

    if (drawMode === "weighted") {
      // Weight by risk score — higher score = more likely to be drawn
      const totalScore = pool.reduce((sum, c) => sum + Math.max(c.scoreGlobal, 5), 0);
      selected = [];
      const remaining = [...pool];
      const count = Math.min(drawCount, remaining.length);
      for (let i = 0; i < count; i++) {
        const totalW = remaining.reduce((sum, c) => sum + Math.max(c.scoreGlobal, 5), 0);
        let r = Math.random() * totalW;
        let picked = remaining[0];
        for (const c of remaining) {
          r -= Math.max(c.scoreGlobal, 5);
          if (r <= 0) { picked = c; break; }
        }
        selected.push(picked);
        const idx = remaining.indexOf(picked);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    } else if (drawMode === "manual") {
      selected = valides.filter((c) => selectedClients.includes(c.siren));
      if (selected.length === 0) {
        toast.error("Selectionnez au moins un client");
        return;
      }
    } else {
      // Pure random
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      selected = shuffled.slice(0, Math.min(drawCount, shuffled.length));
    }

    if (selected.length === 1) {
      // Single client → open form directly
      const c = selected[0];
      prefillForm(c);
      setShowDrawOptions(false);
      setShowForm(true);
    } else {
      // Multiple clients → create controls for each
      for (const c of selected) {
        prefillForm(c);
        // For batch, we open the first one for editing
      }
      // Actually for batch, open first one
      prefillForm(selected[0]);
      setShowDrawOptions(false);
      setShowForm(true);
      if (selected.length > 1) {
        toast.info(`${selected.length} clients tires — formulaire ouvert pour le premier. Repetez pour les suivants.`);
      }
    }
  }, [clients, controles, drawCount, drawMode, excludeControlled, selectedClients]);

  const prefillForm = (c: Client) => {
    const today = new Date().toISOString().split("T")[0];
    setForm({
      ...emptyForm,
      dateTirage: today,
      dossierAudite: c.raisonSociale,
      siren: c.siren,
      forme: c.forme,
      ppe: c.ppe,
      paysRisque: c.paysRisque,
      atypique: c.atypique,
      distanciel: c.distanciel,
      cash: c.cash,
      pression: c.pression,
      scoreGlobal: c.scoreGlobal,
      nivVigilance: c.nivVigilance,
    });
    setFormErrors({});
    setFormDirty(false);
    setEditMode(false);
  };

  // ── Form validation ──
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.point1.trim()) errors.point1 = "Ce point de controle est obligatoire";
    if (!form.point2.trim()) errors.point2 = "Ce point de controle est obligatoire";
    if (!form.point3.trim()) errors.point3 = "Ce point de controle est obligatoire";
    if (!form.controleur.trim()) errors.controleur = "Le nom du controleur est obligatoire";
    if (form.resultatGlobal.startsWith("NON CONFORME") && !form.actionCorrectrice.trim()) {
      errors.actionCorrectrice = "Une action correctrice est requise pour une non-conformite";
    }
    if (form.resultatGlobal.startsWith("NON CONFORME") && !form.dateEcheance) {
      errors.dateEcheance = "Une date d'echeance est requise pour une non-conformite";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Save ──
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Veuillez corriger les erreurs du formulaire");
      return;
    }

    // Check for duplicates (same siren + same month)
    const month = form.dateTirage.slice(0, 7);
    const duplicate = controles.find(
      (c) => c.siren === form.siren && c.dateTirage.startsWith(month) && (!editMode || c.id !== form.id)
    );
    if (duplicate && !editMode) {
      toast.warning(`Ce client a deja ete controle ce mois (${formatDateFR(duplicate.dateTirage)}). Le controle sera quand meme enregistre.`);
    }

    setSaving(true);
    try {
      const dbRow = mapControleToDb(form);

      if (editMode && form.id) {
        const result = await controlesService.update(form.id, dbRow);
        if (result) {
          setControles((prev) =>
            prev.map((c) => (c.id === form.id ? mapDbToControle(result) : c))
          );
          toast.success("Controle mis a jour");
        } else {
          toast.error("Erreur lors de la mise a jour");
        }
      } else {
        const result = await controlesService.create(dbRow);
        if (result) {
          setControles((prev) => [mapDbToControle(result), ...prev]);
          addLog({
            horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
            utilisateur: form.controleur || "Utilisateur",
            refClient: form.siren,
            typeAction: "CONTROLE_QUALITE",
            details: `Controle qualite: ${form.dossierAudite} — ${form.resultatGlobal}`,
          });
          toast.success("Controle enregistre avec succes");
        } else {
          toast.error("Erreur lors de l'enregistrement");
        }
      }
      setShowForm(false);
      setFormDirty(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!detailControle?.id) return;
    setDeleting(true);
    try {
      const success = await controlesService.delete(detailControle.id);
      if (success) {
        setControles((prev) => prev.filter((c) => c.id !== detailControle.id));
        addLog({
          horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
          utilisateur: "Utilisateur",
          refClient: detailControle.siren,
          typeAction: "SUPPRESSION_CONTROLE",
          details: `Controle supprime: ${detailControle.dossierAudite}`,
        });
        toast.success("Controle supprime");
        setDetailIndex(null);
        setShowDeleteConfirm(false);
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit from detail ──
  const handleEditFromDetail = () => {
    if (!detailControle) return;
    setForm({ ...detailControle });
    setEditMode(true);
    setDetailIndex(null);
    setShowForm(true);
  };

  // ── Detail navigation ──
  const navigateDetail = (dir: 1 | -1) => {
    if (detailIndex === null) return;
    const newIdx = detailIndex + dir;
    if (newIdx >= 0 && newIdx < filteredControles.length) {
      setDetailIndex(newIdx);
    }
  };

  // ── Export CSV ──
  const handleExportCSV = () => {
    const headers = [
      "Date tirage", "Dossier", "SIREN", "Forme", "Score", "Vigilance",
      "PPE", "Pays risque", "Atypique", "Distanciel", "Cash", "Pression",
      "Point 1", "Point 2", "Point 3", "Resultat", "Incident", "Commentaire",
      "Controleur", "Action correctrice", "Echeance", "Suivi",
    ];
    const rows = filteredControles.map((c) => [
      c.dateTirage, c.dossierAudite, c.siren, c.forme, c.scoreGlobal, c.nivVigilance,
      c.ppe, c.paysRisque, c.atypique, c.distanciel, c.cash, c.pression,
      c.point1, c.point2, c.point3, c.resultatGlobal, c.incident, c.commentaire,
      c.controleur, c.actionCorrectrice, c.dateEcheance, c.suiviStatut,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Controles_Qualite_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredControles.length} controles exportes en CSV`);
  };

  // ── Export PDF ──
  const handleExportPDF = () => {
    if (controles.length === 0) {
      toast.error("Aucun controle pour le rapport");
      return;
    }
    generateRapportControle(
      clients.filter((c) => c.etat === "VALIDE").slice(0, 5),
      filteredControles
    );
    toast.success("Rapport de controle genere (PDF)");
  };

  // ── Export single control PDF ──
  const handleExportSinglePDF = (c: ControleQualite) => {
    generateSingleControlePdf(c);
    toast.success("Fiche de controle generee (PDF)");
  };

  // ── Close form with warning ──
  const handleCloseForm = () => {
    if (formDirty) {
      if (!window.confirm("Des modifications non enregistrees seront perdues. Fermer quand meme ?")) return;
    }
    setShowForm(false);
    setFormDirty(false);
    setEditMode(false);
  };

  // ── Copy to clipboard ──
  const handleCopyControl = (c: ControleQualite) => {
    const text = [
      `Controle qualite — ${c.dossierAudite} (${c.siren})`,
      `Date: ${formatDateFR(c.dateTirage)}`,
      `Score: ${c.scoreGlobal} | Vigilance: ${c.nivVigilance}`,
      `Resultat: ${c.resultatGlobal}`,
      ``,
      `Point 1 - Identite & BE: ${c.point1}`,
      `Point 2 - Scoring & Vigilance: ${c.point2}`,
      `Point 3 - Documents & Contrat: ${c.point3}`,
      c.incident ? `Incident: ${c.incident}` : "",
      c.commentaire ? `Commentaire: ${c.commentaire}` : "",
      c.actionCorrectrice ? `Action correctrice: ${c.actionCorrectrice}` : "",
      c.controleur ? `Controleur: ${c.controleur}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Controle copie dans le presse-papier");
  };

  // ── Clear all filters ──
  const clearFilters = () => {
    setSearch("");
    setFilterResultat("ALL");
    setFilterVigilance("ALL");
    setFilterDateFrom("");
    setFilterDateTo("");
    setActiveStatFilter(null);
  };

  const hasFilters = search || filterResultat !== "ALL" || filterVigilance !== "ALL" || filterDateFrom || filterDateTo || activeStatFilter;

  const detailControle = detailIndex !== null ? filteredControles[detailIndex] : null;

  // Anomalies for current form
  const formAnomalies = useMemo(() => detectAnomalies(form), [form]);

  // Coverage data
  const coverageData = useMemo(() => {
    const validClients = clients.filter((c) => c.etat === "VALIDE");
    const controlledSirens = new Set(controles.map((c) => c.siren));
    return validClients.map((c) => ({
      ...c,
      controlled: controlledSirens.has(c.siren),
      lastControl: controles.find((ctrl) => ctrl.siren === c.siren)?.dateTirage || "",
      controlCount: controles.filter((ctrl) => ctrl.siren === c.siren).length,
    }));
  }, [clients, controles]);

  // Monthly stats for chart
  const monthlyStats = useMemo(() => {
    const months: Record<string, { total: number; conformes: number; nc: number }> = {};
    for (const c of controles) {
      const m = c.dateTirage.slice(0, 7);
      if (!months[m]) months[m] = { total: 0, conformes: 0, nc: 0 };
      months[m].total++;
      if (c.resultatGlobal === "CONFORME" || c.resultatGlobal === "CONFORME AVEC RESERVES") months[m].conformes++;
      else months[m].nc++;
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        ...data,
        rate: data.total > 0 ? Math.round((data.conformes / data.total) * 100) : 0,
      }));
  }, [controles]);

  // Clients available for manual selection
  const availableClients = useMemo(() => {
    const valides = clients.filter((c) => c.etat === "VALIDE");
    if (!clientSearch.trim()) return valides;
    const q = clientSearch.toLowerCase();
    return valides.filter(
      (c) => c.raisonSociale.toLowerCase().includes(q) || c.siren.includes(q)
    );
  }, [clients, clientSearch]);

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header ── */}
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Controle qualite</p>
            <h1 className="text-xl font-semibold text-slate-100 mt-1">
              Revue des dossiers LCB-FT
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {stats.total} controle{stats.total > 1 ? "s" : ""} enregistre{stats.total > 1 ? "s" : ""}
              {stats.total > 0 && ` · Taux de conformite: ${stats.tauxConformite}%`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isOnline && (
              <span className="text-xs text-amber-400 self-center mr-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Hors ligne
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={handleExportCSV}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter les controles filtres en CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={handleExportPDF}>
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generer un rapport PDF complet</TooltipContent>
            </Tooltip>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowDrawOptions(true)}>
              <Shuffle className="w-3.5 h-3.5" /> Nouveau tirage
            </Button>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total controles" value={stats.total} color="text-blue-400" icon={Hash}
            onClick={() => setActiveStatFilter(activeStatFilter === null ? null : null)}
            active={!activeStatFilter}
          />
          <StatCard
            label="Conformes" value={stats.conformes} color="text-emerald-400" icon={CheckCircle2}
            subtitle={stats.total > 0 ? `${Math.round((stats.conformes / stats.total) * 100)}%` : undefined}
            onClick={() => setActiveStatFilter(activeStatFilter === "CONFORME" ? null : "CONFORME")}
            active={activeStatFilter === "CONFORME"}
          />
          <StatCard
            label="Non conformes" value={stats.ncMineur + stats.ncMajeur} color="text-red-400" icon={XCircle}
            subtitle={stats.ncMajeur > 0 ? `dont ${stats.ncMajeur} majeur(s)` : undefined}
            onClick={() => setActiveStatFilter(activeStatFilter === "NON_CONFORME" ? null : "NON_CONFORME")}
            active={activeStatFilter === "NON_CONFORME"}
          />
          <StatCard
            label="Avec reserves" value={stats.reserves} color="text-amber-400" icon={AlertTriangle}
            onClick={() => setActiveStatFilter(activeStatFilter === "RESERVES" ? null : "RESERVES")}
            active={activeStatFilter === "RESERVES"}
          />
          <StatCard
            label="Taux conformite" value={`${stats.tauxConformite}%`} color={stats.tauxConformite >= 80 ? "text-emerald-400" : stats.tauxConformite >= 60 ? "text-amber-400" : "text-red-400"} icon={Percent}
            subtitle={stats.trend > 0 ? `+${stats.trend.toFixed(0)}% vs mois prec.` : stats.trend < 0 ? `${stats.trend.toFixed(0)}% vs mois prec.` : undefined}
          />
          <StatCard
            label="Couverture" value={`${stats.coverageRate}%`} color={stats.coverageRate >= 80 ? "text-emerald-400" : stats.coverageRate >= 50 ? "text-amber-400" : "text-red-400"} icon={Target}
            subtitle={`${stats.controlledSirens.size}/${stats.validClients.length} clients`}
          />
        </div>

        {/* ── Tabs ── */}
        <div className="animate-fade-in-up flex gap-1 border-b border-white/[0.06] pb-0">
          {([
            { id: "historique" as const, label: "Historique", icon: ClipboardCheck },
            { id: "statistiques" as const, label: "Statistiques", icon: BarChart3 },
            { id: "couverture" as const, label: "Couverture", icon: Target },
          ]).map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors rounded-t-lg ${
                activeTab === tab.id
                  ? "text-blue-400 bg-white/[0.04] border-b-2 border-blue-400"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Historique ── */}
        {activeTab === "historique" && (
          <>
            {/* ── Filter Bar ── */}
            <div className="animate-fade-in-up flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher par nom, SIREN, controleur... (Ctrl+F)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                    <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  value={filterResultat}
                  onChange={(e) => setFilterResultat(e.target.value)}
                >
                  <option value="ALL" className="bg-slate-900">Tous les resultats</option>
                  {RESULTAT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  value={filterVigilance}
                  onChange={(e) => setFilterVigilance(e.target.value)}
                >
                  <option value="ALL" className="bg-slate-900">Toutes vigilances</option>
                  <option value="SIMPLIFIEE" className="bg-slate-900">Simplifiee</option>
                  <option value="STANDARD" className="bg-slate-900">Standard</option>
                  <option value="RENFORCEE" className="bg-slate-900">Renforcee</option>
                </select>
                <input
                  type="date"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  title="Date debut"
                />
                <input
                  type="date"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  title="Date fin"
                />
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-300 gap-1" onClick={clearFilters}>
                    <X className="w-3 h-3" /> Effacer filtres
                  </Button>
                )}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="animate-fade-in-up glass-card overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-300">Historique des controles</h3>
                <span className="text-xs text-slate-500 ml-auto">
                  {filteredControles.length !== controles.length && `${filteredControles.length} / `}
                  {controles.length} enregistrement{controles.length > 1 ? "s" : ""}
                </span>
              </div>

              {loading ? (
                <TableSkeleton />
              ) : loadError ? (
                <div className="p-12 text-center">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                  <p className="text-sm text-red-400">Erreur de chargement</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5 border-white/[0.06]" onClick={loadControles}>
                    <RefreshCw className="w-3.5 h-3.5" /> Reessayer
                  </Button>
                </div>
              ) : filteredControles.length === 0 ? (
                <div className="p-12 text-center">
                  {controles.length === 0 ? (
                    <>
                      <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 font-medium">Aucun controle enregistre</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Lancez un tirage aleatoire pour commencer votre premier controle qualite.
                      </p>
                      <Button size="sm" className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowDrawOptions(true)}>
                        <Shuffle className="w-3.5 h-3.5" /> Lancer un tirage
                      </Button>
                    </>
                  ) : (
                    <>
                      <Filter className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">Aucun controle ne correspond aux filtres</p>
                      <Button variant="ghost" size="sm" className="mt-2 text-xs text-slate-500" onClick={clearFilters}>
                        Effacer les filtres
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-white/[0.06]">
                          <th className="px-6 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("dateTirage")}>
                            <span className="flex items-center gap-1">Date <SortIcon field="dateTirage" /></span>
                          </th>
                          <th className="px-6 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("dossierAudite")}>
                            <span className="flex items-center gap-1">Dossier audite <SortIcon field="dossierAudite" /></span>
                          </th>
                          <th className="px-6 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("scoreGlobal")}>
                            <span className="flex items-center gap-1">Score <SortIcon field="scoreGlobal" /></span>
                          </th>
                          <th className="px-6 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("nivVigilance")}>
                            <span className="flex items-center gap-1">Vigilance <SortIcon field="nivVigilance" /></span>
                          </th>
                          <th className="px-6 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("resultatGlobal")}>
                            <span className="flex items-center gap-1">Resultat <SortIcon field="resultatGlobal" /></span>
                          </th>
                          <th className="px-6 py-3 font-medium">Controleur</th>
                          <th className="px-6 py-3 font-medium">Suivi</th>
                          <th className="px-6 py-3 font-medium w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {paginatedControles.map((c, idx) => {
                          const cfg = resultatConfig[c.resultatGlobal as ResultatGlobal];
                          const ResultIcon = cfg?.icon || CheckCircle2;
                          const anomalies = detectAnomalies(c);
                          const globalIdx = page * pageSize + idx;
                          return (
                            <tr
                              key={c.id || `${c.siren}-${c.dateTirage}-${idx}`}
                              className={`${cfg?.rowBg || "hover:bg-white/[0.02]"} cursor-pointer transition-colors`}
                              onClick={() => setDetailIndex(globalIdx)}
                            >
                              <td className="px-6 py-3.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-slate-400 font-mono text-xs">{formatDateFR(c.dateTirage)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{relativeDate(c.dateTirage)}</TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-6 py-3.5">
                                <p className="text-slate-200 font-medium">{c.dossierAudite}</p>
                                <p className="text-xs text-slate-500">{c.siren} · {c.forme}</p>
                              </td>
                              <td className="px-6 py-3.5">
                                <ScoreGauge score={c.scoreGlobal} />
                              </td>
                              <td className="px-6 py-3.5">
                                <VigilanceBadge level={c.nivVigilance} />
                              </td>
                              <td className="px-6 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg?.color || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                                  <ResultIcon className="w-3 h-3" />
                                  {c.resultatGlobal}
                                </span>
                                {anomalies.length > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 ml-1.5 inline" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      {anomalies.map((a, i) => <p key={i} className="text-xs">{a}</p>)}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                              <td className="px-6 py-3.5 text-xs text-slate-400">
                                {c.controleur || <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-6 py-3.5">
                                {c.suiviStatut ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${SUIVI_OPTIONS.find((s) => s.value === c.suiviStatut)?.color || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                                    {SUIVI_OPTIONS.find((s) => s.value === c.suiviStatut)?.label || c.suiviStatut}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-6 py-3.5">
                                <Eye className="w-4 h-4 text-slate-500" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Pagination ── */}
                  <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Afficher</span>
                      <select
                        className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-slate-300"
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                      >
                        {PAGE_SIZES.map((s) => (
                          <option key={s} value={s} className="bg-slate-900">{s}</option>
                        ))}
                      </select>
                      <span>par page</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 mr-2">
                        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredControles.length)} sur {filteredControles.length}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(0)}>
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-slate-400 mx-1">{page + 1}/{totalPages || 1}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Tab: Statistiques ── */}
        {activeTab === "statistiques" && (
          <div className="animate-fade-in-up space-y-6">
            {/* Monthly chart */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Evolution mensuelle de la conformite
              </h3>
              {monthlyStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Pas de donnees disponibles</p>
              ) : (
                <div className="space-y-4">
                  {/* Bar chart */}
                  <div className="flex items-end gap-2 h-40">
                    {monthlyStats.map((m) => (
                      <Tooltip key={m.month}>
                        <TooltipTrigger asChild>
                          <div className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] text-slate-500 tabular-nums">{m.rate}%</span>
                            <div className="w-full flex flex-col gap-0.5" style={{ height: "120px" }}>
                              <div
                                className="w-full bg-emerald-500/30 rounded-t transition-all"
                                style={{ height: `${(m.conformes / Math.max(m.total, 1)) * 120}px` }}
                              />
                              <div
                                className="w-full bg-red-500/30 rounded-b transition-all"
                                style={{ height: `${(m.nc / Math.max(m.total, 1)) * 120}px` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-600">{m.label}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{m.total} controles · {m.conformes} conformes · {m.nc} NC</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded bg-emerald-500/30" /> Conformes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded bg-red-500/30" /> Non conformes
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Risk factor distribution */}
              <div className="glass-card p-5">
                <h4 className="text-xs font-medium text-slate-400 mb-3">Facteurs de risque les plus frequents</h4>
                {(() => {
                  const factors = [
                    { label: "PPE", count: controles.filter((c) => c.ppe === "OUI").length },
                    { label: "Pays risque", count: controles.filter((c) => c.paysRisque === "OUI").length },
                    { label: "Atypique", count: controles.filter((c) => c.atypique === "OUI").length },
                    { label: "Distanciel", count: controles.filter((c) => c.distanciel === "OUI").length },
                    { label: "Cash", count: controles.filter((c) => c.cash === "OUI").length },
                    { label: "Pression", count: controles.filter((c) => c.pression === "OUI").length },
                  ].sort((a, b) => b.count - a.count);
                  const max = Math.max(...factors.map((f) => f.count), 1);
                  return (
                    <div className="space-y-2">
                      {factors.map((f) => (
                        <div key={f.label} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-20">{f.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full bg-red-500/50" style={{ width: `${(f.count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-6 text-right">{f.count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Vigilance distribution */}
              <div className="glass-card p-5">
                <h4 className="text-xs font-medium text-slate-400 mb-3">Repartition par vigilance</h4>
                {(() => {
                  const levels = [
                    { label: "Simplifiee", count: controles.filter((c) => c.nivVigilance === "SIMPLIFIEE").length, color: "bg-emerald-500/50" },
                    { label: "Standard", count: controles.filter((c) => c.nivVigilance === "STANDARD").length, color: "bg-amber-500/50" },
                    { label: "Renforcee", count: controles.filter((c) => c.nivVigilance === "RENFORCEE").length, color: "bg-red-500/50" },
                  ];
                  const total = Math.max(levels.reduce((s, l) => s + l.count, 0), 1);
                  return (
                    <div className="space-y-3">
                      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
                        {levels.map((l) => (
                          <div key={l.label} className={`${l.color} transition-all`} style={{ width: `${(l.count / total) * 100}%` }} />
                        ))}
                      </div>
                      {levels.map((l) => (
                        <div key={l.label} className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <span className={`w-2 h-2 rounded-full ${l.color}`} />
                            {l.label}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">{l.count} ({Math.round((l.count / total) * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Score distribution */}
              <div className="glass-card p-5">
                <h4 className="text-xs font-medium text-slate-400 mb-3">Distribution des scores</h4>
                {(() => {
                  const ranges = [
                    { label: "0-25", count: controles.filter((c) => c.scoreGlobal <= 25).length, color: "bg-emerald-500/50" },
                    { label: "26-50", count: controles.filter((c) => c.scoreGlobal > 25 && c.scoreGlobal <= 50).length, color: "bg-amber-500/50" },
                    { label: "51-75", count: controles.filter((c) => c.scoreGlobal > 50 && c.scoreGlobal <= 75).length, color: "bg-orange-500/50" },
                    { label: "76-100", count: controles.filter((c) => c.scoreGlobal > 75).length, color: "bg-red-500/50" },
                  ];
                  const max = Math.max(...ranges.map((r) => r.count), 1);
                  return (
                    <div className="space-y-2">
                      {ranges.map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-12 tabular-nums">{r.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className={`h-full rounded-full ${r.color}`} style={{ width: `${(r.count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-6 text-right">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Incidents summary */}
              <div className="glass-card p-5">
                <h4 className="text-xs font-medium text-slate-400 mb-3">Resume des incidents</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total incidents</span>
                    <span className="text-sm font-bold text-orange-400 tabular-nums">{stats.incidents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">NC mineures</span>
                    <span className="text-sm font-bold text-amber-400 tabular-nums">{stats.ncMineur}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">NC majeures</span>
                    <span className="text-sm font-bold text-red-400 tabular-nums">{stats.ncMajeur}</span>
                  </div>
                  <div className="border-t border-white/[0.06] pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Actions en cours</span>
                    <span className="text-sm font-bold text-blue-400 tabular-nums">
                      {controles.filter((c) => c.suiviStatut === "EN_COURS" || c.suiviStatut === "A_TRAITER").length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Couverture ── */}
        {activeTab === "couverture" && (
          <div className="animate-fade-in-up glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-300">Couverture des controles</h3>
              <span className="text-xs text-slate-500 ml-auto">
                {stats.controlledSirens.size}/{stats.validClients.length} clients controles ({stats.coverageRate}%)
              </span>
            </div>

            {/* Progress bar */}
            <div className="px-6 py-3 border-b border-white/[0.06]">
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${stats.coverageRate}%` }}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-white/[0.06]">
                    <th className="px-6 py-3 font-medium">Statut</th>
                    <th className="px-6 py-3 font-medium">Client</th>
                    <th className="px-6 py-3 font-medium">Score</th>
                    <th className="px-6 py-3 font-medium">Vigilance</th>
                    <th className="px-6 py-3 font-medium">Nb controles</th>
                    <th className="px-6 py-3 font-medium">Dernier controle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {coverageData
                    .sort((a, b) => (a.controlled ? 1 : 0) - (b.controlled ? 1 : 0) || b.scoreGlobal - a.scoreGlobal)
                    .slice(0, 50)
                    .map((c) => (
                      <tr key={c.siren} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-3">
                          {c.controlled ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Controle
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Minus className="w-3.5 h-3.5" /> Non controle
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-slate-200 font-medium text-xs">{c.raisonSociale}</p>
                          <p className="text-[10px] text-slate-500">{c.siren}</p>
                        </td>
                        <td className="px-6 py-3"><ScoreGauge score={c.scoreGlobal} /></td>
                        <td className="px-6 py-3"><VigilanceBadge level={c.nivVigilance} /></td>
                        <td className="px-6 py-3 text-xs text-slate-400 tabular-nums">{c.controlCount}</td>
                        <td className="px-6 py-3 text-xs text-slate-400">
                          {c.lastControl ? formatDateFR(c.lastControl) : <span className="text-slate-600">Jamais</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── Draw Options Dialog ── */}
        <Dialog open={showDrawOptions} onOpenChange={setShowDrawOptions}>
          <DialogContent className="max-w-lg bg-slate-900 border-white/[0.08] text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-100">
                <Shuffle className="w-5 h-5 text-blue-400" />
                Options de tirage
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Mode */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Mode de selection</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "random" as const, label: "Aleatoire", icon: Shuffle, desc: "Tirage pur" },
                    { value: "weighted" as const, label: "Pondere", icon: Target, desc: "Priorise les risques eleves" },
                    { value: "manual" as const, label: "Manuel", icon: UserCheck, desc: "Choisir les clients" },
                  ]).map((m) => (
                    <button
                      key={m.value}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        drawMode === m.value
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                          : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]"
                      }`}
                      onClick={() => setDrawMode(m.value)}
                    >
                      <m.icon className="w-4 h-4 mx-auto mb-1" />
                      <p className="text-xs font-medium">{m.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count (for random/weighted) */}
              {drawMode !== "manual" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Nombre de clients a tirer</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={Math.min(10, clients.filter((c) => c.etat === "VALIDE").length)}
                      value={drawCount}
                      onChange={(e) => setDrawCount(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-bold text-slate-200 tabular-nums w-6 text-center">{drawCount}</span>
                  </div>
                </div>
              )}

              {/* Exclude already controlled */}
              {drawMode !== "manual" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeControlled}
                    onChange={(e) => setExcludeControlled(e.target.checked)}
                    className="rounded border-white/[0.2] bg-white/[0.05]"
                  />
                  <span className="text-xs text-slate-400">Exclure les clients deja controles ({stats.controlledSirens.size})</span>
                </label>
              )}

              {/* Manual client selection */}
              {drawMode === "manual" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Selectionner les clients</label>
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/[0.06] p-2">
                    {availableClients.slice(0, 20).map((c) => (
                      <label key={c.siren} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/[0.04] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(c.siren)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedClients((prev) => [...prev, c.siren]);
                            else setSelectedClients((prev) => prev.filter((s) => s !== c.siren));
                          }}
                          className="rounded border-white/[0.2] bg-white/[0.05]"
                        />
                        <span className="text-xs text-slate-300">{c.raisonSociale}</span>
                        <span className="text-[10px] text-slate-500 ml-auto">{c.siren}</span>
                      </label>
                    ))}
                  </div>
                  {selectedClients.length > 0 && (
                    <p className="text-xs text-blue-400">{selectedClients.length} client(s) selectionne(s)</p>
                  )}
                </div>
              )}

              {/* Pool info */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Clients valides disponibles</span>
                  <span className="text-slate-300 font-medium tabular-nums">
                    {excludeControlled
                      ? clients.filter((c) => c.etat === "VALIDE" && !stats.controlledSirens.has(c.siren)).length
                      : clients.filter((c) => c.etat === "VALIDE").length}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="border-white/[0.06]" onClick={() => setShowDrawOptions(false)}>
                  Annuler
                </Button>
                <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={executeRandomDraw}>
                  <Shuffle className="w-4 h-4" /> Lancer le tirage
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── New/Edit Control Form Dialog ── */}
        <Dialog open={showForm} onOpenChange={handleCloseForm}>
          <DialogContent className="max-w-3xl bg-slate-900 border-white/[0.08] text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-100">
                {editMode ? <Edit3 className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-blue-400" />}
                {editMode ? "Modifier le controle qualite" : "Nouveau controle qualite"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Pre-filled client info */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Dossier tire au sort</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{form.dossierAudite}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{form.siren} · {form.forme} · {formatDateFR(form.dateTirage)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreGauge score={form.scoreGlobal} />
                    <VigilanceBadge level={form.nivVigilance} />
                  </div>
                </div>
                <FlagPills data={form} />
              </div>

              {/* Controleur */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">
                  Controleur <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full rounded-lg border ${formErrors.controleur ? "border-red-500/50" : "border-white/[0.08]"} bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                  placeholder="Nom du controleur..."
                  value={form.controleur}
                  onChange={(e) => { setForm((prev) => ({ ...prev, controleur: e.target.value })); setFormDirty(true); }}
                />
                {formErrors.controleur && <p className="text-xs text-red-400">{formErrors.controleur}</p>}
              </div>

              {/* 3 checkpoints */}
              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Points de controle <span className="text-red-400">*</span></p>
                {([
                  { key: "point1" as const, label: "1. Identite & Beneficiaires effectifs", placeholder: "Verification CNI, KBIS, RBE a jour..." },
                  { key: "point2" as const, label: "2. Scoring & Niveau de vigilance", placeholder: "Coherence du score, criteres de risque..." },
                  { key: "point3" as const, label: "3. Documents & Contrat", placeholder: "Lettre de mission, mandat, pieces justificatives..." },
                ]).map((cp) => (
                  <div key={cp.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-400">{cp.label}</label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-600 tabular-nums">{form[cp.key].length}/500</span>
                        <button
                          className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                          onClick={() => setShowTemplates(showTemplates === cp.key ? null : cp.key)}
                        >
                          Modeles
                        </button>
                      </div>
                    </div>
                    <textarea
                      className={`w-full rounded-lg border ${formErrors[cp.key] ? "border-red-500/50" : "border-white/[0.08]"} bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none`}
                      rows={2}
                      maxLength={500}
                      placeholder={cp.placeholder}
                      value={form[cp.key]}
                      onChange={(e) => { setForm((prev) => ({ ...prev, [cp.key]: e.target.value })); setFormDirty(true); }}
                    />
                    {formErrors[cp.key] && <p className="text-xs text-red-400">{formErrors[cp.key]}</p>}
                    {showTemplates === cp.key && (
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 space-y-1">
                        {CHECKPOINT_TEMPLATES[cp.key].map((tpl, i) => (
                          <button
                            key={i}
                            className="w-full text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] px-2 py-1.5 rounded transition-colors"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, [cp.key]: tpl }));
                              setShowTemplates(null);
                              setFormDirty(true);
                            }}
                          >
                            {tpl}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Resultat global */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Resultat global</label>
                <div className="grid grid-cols-2 gap-2">
                  {RESULTAT_OPTIONS.map((opt) => {
                    const cfg = resultatConfig[opt];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={opt}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                          form.resultatGlobal === opt
                            ? cfg.color
                            : "border-white/[0.06] text-slate-500 hover:border-white/[0.12]"
                        }`}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            resultatGlobal: opt,
                            suiviStatut: opt.startsWith("NON CONFORME") ? "A_TRAITER" : prev.suiviStatut,
                          }));
                          setFormDirty(true);
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action correctrice (shown for NC) */}
              {form.resultatGlobal.startsWith("NON CONFORME") && (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
                  <p className="text-xs font-medium text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Plan d'action correctrice requis
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Action correctrice <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      className={`w-full rounded-lg border ${formErrors.actionCorrectrice ? "border-red-500/50" : "border-white/[0.08]"} bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none`}
                      rows={2}
                      placeholder="Decrire les actions a mener pour corriger la non-conformite..."
                      value={form.actionCorrectrice}
                      onChange={(e) => { setForm((prev) => ({ ...prev, actionCorrectrice: e.target.value })); setFormDirty(true); }}
                    />
                    {formErrors.actionCorrectrice && <p className="text-xs text-red-400">{formErrors.actionCorrectrice}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">
                        Date d'echeance <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border ${formErrors.dateEcheance ? "border-red-500/50" : "border-white/[0.08]"} bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                        value={form.dateEcheance}
                        onChange={(e) => { setForm((prev) => ({ ...prev, dateEcheance: e.target.value })); setFormDirty(true); }}
                      />
                      {formErrors.dateEcheance && <p className="text-xs text-red-400">{formErrors.dateEcheance}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Statut de suivi</label>
                      <select
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        value={form.suiviStatut}
                        onChange={(e) => { setForm((prev) => ({ ...prev, suiviStatut: e.target.value })); setFormDirty(true); }}
                      >
                        {SUIVI_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Incident */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Incident declare</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Decrire l'incident le cas echeant..."
                  value={form.incident}
                  onChange={(e) => { setForm((prev) => ({ ...prev, incident: e.target.value })); setFormDirty(true); }}
                />
              </div>

              {/* Commentaire */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">Commentaire</label>
                  <span className="text-[10px] text-slate-600 tabular-nums">{form.commentaire.length}/1000</span>
                </div>
                <textarea
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                  rows={3}
                  maxLength={1000}
                  placeholder="Observations complementaires..."
                  value={form.commentaire}
                  onChange={(e) => { setForm((prev) => ({ ...prev, commentaire: e.target.value })); setFormDirty(true); }}
                />
              </div>

              {/* Anomaly warnings */}
              {formAnomalies.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Anomalies detectees ({formAnomalies.length})
                  </p>
                  <ul className="space-y-1">
                    {formAnomalies.map((a, i) => (
                      <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                <div className="text-xs text-slate-600">
                  {formDirty && <span className="text-amber-400">Modifications non enregistrees</span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-white/[0.06]" onClick={handleCloseForm}>
                    Annuler
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {editMode ? "Mise a jour..." : "Enregistrement..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {editMode ? "Mettre a jour" : "Enregistrer le controle"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── Detail Dialog ── */}
        <Dialog open={detailIndex !== null} onOpenChange={() => setDetailIndex(null)}>
          <DialogContent className="max-w-3xl bg-slate-900 border-white/[0.08] text-slate-100 max-h-[90vh] overflow-y-auto">
            {detailControle && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2 text-slate-100">
                      <Eye className="w-5 h-5 text-blue-400" />
                      Detail du controle
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigateDetail(-1)} disabled={detailIndex === 0}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-slate-500 tabular-nums">{(detailIndex ?? 0) + 1}/{filteredControles.length}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigateDetail(1)} disabled={detailIndex === filteredControles.length - 1}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {/* Client info */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{detailControle.dossierAudite}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {detailControle.siren} · {detailControle.forme} · {formatDateFR(detailControle.dateTirage)}
                          <span className="text-slate-600 ml-1">({relativeDate(detailControle.dateTirage)})</span>
                        </p>
                        {detailControle.controleur && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Controleur: {detailControle.controleur}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <ScoreGauge score={detailControle.scoreGlobal} />
                        <VigilanceBadge level={detailControle.nivVigilance} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <FlagPills data={detailControle} />
                    </div>
                  </div>

                  {/* 3 checkpoints */}
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Points de controle</p>
                    {([
                      { label: "1. Identite & Beneficiaires effectifs", value: detailControle.point1 },
                      { label: "2. Scoring & Niveau de vigilance", value: detailControle.point2 },
                      { label: "3. Documents & Contrat", value: detailControle.point3 },
                    ]).map((cp) => (
                      <div key={cp.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-xs font-medium text-slate-400 mb-1">{cp.label}</p>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{cp.value || <span className="text-slate-600 italic">Non renseigne</span>}</p>
                      </div>
                    ))}
                  </div>

                  {/* Resultat */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Resultat:</span>
                    {(() => {
                      const cfg = resultatConfig[detailControle.resultatGlobal as ResultatGlobal];
                      const ResultIcon = cfg?.icon || CheckCircle2;
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg?.color || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                          <ResultIcon className="w-3 h-3" />
                          {detailControle.resultatGlobal}
                        </span>
                      );
                    })()}
                    {detailControle.suiviStatut && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${SUIVI_OPTIONS.find((s) => s.value === detailControle.suiviStatut)?.color || ""}`}>
                        {SUIVI_OPTIONS.find((s) => s.value === detailControle.suiviStatut)?.label || detailControle.suiviStatut}
                      </span>
                    )}
                  </div>

                  {/* Action correctrice */}
                  {detailControle.actionCorrectrice && (
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" /> Action correctrice
                      </p>
                      <p className="text-sm text-slate-200">{detailControle.actionCorrectrice}</p>
                      {detailControle.dateEcheance && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Echeance: {formatDateFR(detailControle.dateEcheance)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Incident & Commentaire */}
                  {detailControle.incident && (
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                      <p className="text-xs font-medium text-orange-400 mb-1">Incident declare</p>
                      <p className="text-sm text-slate-200">{detailControle.incident}</p>
                    </div>
                  )}

                  {detailControle.commentaire && (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-xs font-medium text-slate-400 mb-1">Commentaire</p>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{detailControle.commentaire}</p>
                    </div>
                  )}

                  {/* Anomalies */}
                  {(() => {
                    const anomalies = detectAnomalies(detailControle);
                    if (anomalies.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Anomalies detectees
                        </p>
                        <ul className="space-y-1">
                          {anomalies.map((a, i) => (
                            <li key={i} className="text-xs text-amber-300/80">- {a}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Actions bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={handleEditFromDetail}>
                      <Edit3 className="w-3.5 h-3.5" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={() => handleExportSinglePDF(detailControle)}>
                      <FileText className="w-3.5 h-3.5" /> Fiche PDF
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={() => handleCopyControl(detailControle)}>
                      <Copy className="w-3.5 h-3.5" /> Copier
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={() => window.print()}>
                      <Printer className="w-3.5 h-3.5" /> Imprimer
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Delete confirmation ── */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-sm bg-slate-900 border-white/[0.08] text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-5 h-5" />
                Confirmer la suppression
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-300 mt-2">
              Etes-vous sur de vouloir supprimer le controle de <span className="font-semibold">{detailControle?.dossierAudite}</span> ?
              Cette action est irreversible.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" className="border-white/[0.06]" onClick={() => setShowDeleteConfirm(false)}>
                Annuler
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 gap-1.5" onClick={handleDelete} disabled={deleting}>
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Keyboard shortcuts help ── */}
        <div className="text-[10px] text-slate-600 text-center">
          <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">N</kbd> Nouveau tirage
          {" · "}
          <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">Ctrl+F</kbd> Rechercher
        </div>
      </div>
    </TooltipProvider>
  );
}
