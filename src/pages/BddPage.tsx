import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { downloadCSV } from "@/lib/csvUtils";
import { useDebounce } from "@/hooks/useDebounce";
import { useReglages } from "@/hooks/useReglages";
import ReglagesInfoBanner from "@/components/ReglagesInfoBanner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight as ChevronRightIcon, Plus, Edit3, FileDown, FileText, Archive, Download, Clock, Trash2, ChevronLeft, ChevronsLeft, ChevronsRight, X, Users, SearchX, RotateCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { toast } from "sonner";
import { getUserInitials } from "@/lib/utils";
import type { Client } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 25;

/** #OPT-1: KYC completion percentage */
function computeKycPercent(client: Client): number {
  let s = 0;
  if (client.siren) s += 25;
  if (client.mail) s += 25;
  if (client.iban) s += 25;
  if (client.adresse) s += 25;
  return s;
}

/** #OPT-2: Avatar color palette (dark-mode friendly) */
const AVATAR_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-400" },
  { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  { bg: "bg-violet-500/15", text: "text-violet-400" },
  { bg: "bg-amber-500/15", text: "text-amber-400" },
  { bg: "bg-rose-500/15", text: "text-rose-400" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  { bg: "bg-indigo-500/15", text: "text-indigo-400" },
  { bg: "bg-pink-500/15", text: "text-pink-400" },
  { bg: "bg-teal-500/15", text: "text-teal-400" },
  { bg: "bg-orange-500/15", text: "text-orange-400" },
];

function avatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** #OPT-3: Generate hue from name (legacy fallback for mobile) */
function nameHue(name: string): number {
  return name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

/** #OPT-4: Days until date */
function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** #OPT-5: Format mission type (TENUE_COMPTABLE → Tenue comptable) */
function formatMission(m: string): string {
  if (!m) return "—";
  return m.replace(/_/g, " ").replace(/\b\w/g, (c, i) => i === 0 ? c.toUpperCase() : c.toLowerCase());
}

/** #OPT-6: Format date FR (2028-03-28 → 28/03/2028) */
function formatDateShort(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** #OPT-7: Relative time for butoir */
function relativeButoir(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `${Math.abs(days)}j de retard`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days <= 7) return `${days}j`;
  if (days <= 30) return `${Math.ceil(days / 7)} sem.`;
  if (days <= 365) return `${Math.ceil(days / 30)} mois`;
  return `${Math.floor(days / 365)}a`;
}

/** #OPT-8: Forme juridique short label */
function formeShort(forme: string): string {
  const map: Record<string, string> = {
    "SOCIETE CIVILE IMMOBILIERE": "SCI",
    "SOCIETE A RESPONSABILITE LIMITEE": "SARL",
    "SOCIETE PAR ACTIONS SIMPLIFIEE": "SAS",
    "SOCIETE ANONYME": "SA",
    "ENTREPRISE INDIVIDUELLE": "EI",
    "SOCIETE EN NOM COLLECTIF": "SNC",
    "ASSOCIATION": "ASSO",
    "AUTO-ENTREPRENEUR": "AE",
    "EURL": "EURL",
  };
  const upper = (forme || "").toUpperCase();
  return map[upper] || (forme || "").slice(0, 5).toUpperCase();
}

interface DraftInfo {
  siren: string;
  raisonSociale: string;
  step: number;
  savedAt: number;
  key: string;
}

type SortKey = "raisonSociale" | "scoreGlobal" | "nivVigilance" | "etatPilotage" | "dateButoir" | "comptable";
type SortDir = "asc" | "desc";

export default function BddPage() {
  const { clients, updateClient, deleteClient, isLoading, refreshClients } = useAppState();
  const { profile } = useAuth();
  const { reglages } = useReglages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filterVigilance, setFilterVigilance] = useState<string>(searchParams.get("vigilance") || "all");
  const [filterPilotage, setFilterPilotage] = useState<string>(searchParams.get("pilotage") || "all");
  const [filterEtat, setFilterEtat] = useState<string>(searchParams.get("etat") || "all");
  const [filterResponsable, setFilterResponsable] = useState<string>(searchParams.get("responsable") || "all");
  const [sortKey, setSortKey] = useState<SortKey>("raisonSociale");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; ref: string; name: string } | { type: "bulk"; refs: string[] } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const tableRef = useRef<HTMLDivElement>(null);

  useDocumentTitle("Clients");

  // Sync filter state to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (filterVigilance !== "all") params.vigilance = filterVigilance;
    if (filterPilotage !== "all") params.pilotage = filterPilotage;
    if (filterEtat !== "all") params.etat = filterEtat;
    if (filterResponsable !== "all") params.responsable = filterResponsable;
    setSearchParams(params, { replace: true });
  }, [search, filterVigilance, filterPilotage, filterEtat, filterResponsable, setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterVigilance !== "all") count++;
    if (filterPilotage !== "all") count++;
    if (filterEtat !== "all") count++;
    if (filterResponsable !== "all") count++;
    return count;
  }, [filterVigilance, filterPilotage, filterEtat, filterResponsable]);

  const hasAnyFilter = activeFilterCount > 0 || !!debouncedSearch;

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterVigilance("all");
    setFilterPilotage("all");
    setFilterEtat("all");
    setFilterResponsable("all");
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Keyboard shortcut: press 'n' to navigate to /nouveau-client
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        navigate("/nouveau-client");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Scan sessionStorage for drafts
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  useEffect(() => {
    const found: DraftInfo[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("draft_nc_")) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || "");
          if (data.form?.siren) {
            found.push({
              siren: data.form.siren,
              raisonSociale: data.form.raisonSociale || "",
              step: data.step || 0,
              savedAt: data.savedAt || 0,
              key,
            });
          }
        } catch {}
      }
    }
    try {
      const main = JSON.parse(sessionStorage.getItem("draft_nouveau_client") || "");
      if (main.form?.siren && !found.some(d => d.siren.replace(/\s/g, "") === main.form.siren.replace(/\s/g, ""))) {
        found.push({
          siren: main.form.siren,
          raisonSociale: main.form.raisonSociale || "",
          step: main.step || 0,
          savedAt: main.savedAt || 0,
          key: "draft_nouveau_client",
        });
      }
    } catch {}
    found.sort((a, b) => b.savedAt - a.savedAt);
    setDrafts(found);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const ariaSort = (col: SortKey) => sortKey === col ? (sortDir === "asc" ? "ascending" as const : "descending" as const) : undefined;

  // #24 — Sort icon with rotation animation
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-500 transition-transform duration-200" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-500 transition-transform duration-200" />;
  };

  // #OPT-9: KPI stats
  const stats = useMemo(() => {
    let simplifiee = 0, standard = 0, renforcee = 0;
    let aJour = 0, retard = 0, bientot = 0;
    let totalScore = 0;
    let avgKyc = 0;
    for (const c of clients) {
      if (c.nivVigilance === "SIMPLIFIEE") simplifiee++;
      else if (c.nivVigilance === "RENFORCEE") renforcee++;
      else standard++;
      if (c.etatPilotage === "A JOUR") aJour++;
      else if (c.etatPilotage === "RETARD") retard++;
      else bientot++;
      totalScore += c.scoreGlobal || 0;
      avgKyc += computeKycPercent(c);
    }
    const avgScore = clients.length > 0 ? Math.round(totalScore / clients.length) : 0;
    const avgKycPct = clients.length > 0 ? Math.round(avgKyc / clients.length) : 0;
    return { simplifiee, standard, renforcee, aJour, retard, bientot, avgScore, avgKycPct };
  }, [clients]);

  // Reset page when filters change
  useEffect(() => { setPage(0); setSelectAllPages(false); }, [debouncedSearch, filterVigilance, filterPilotage, filterEtat, filterResponsable]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const result = clients.filter(c => {
      const matchSearch = !q ||
        (c.raisonSociale || "").toLowerCase().includes(q) ||
        (c.ref || "").toLowerCase().includes(q) ||
        (c.siren || "").includes(debouncedSearch) ||
        (c.dirigeant || "").toLowerCase().includes(q) ||
        (c.comptable || "").toLowerCase().includes(q);
      const matchVig = filterVigilance === "all" || c.nivVigilance === filterVigilance;
      const matchPil = filterPilotage === "all" || c.etatPilotage === filterPilotage;
      const matchEtat = filterEtat === "all" ||
        (filterEtat === "ACTIF" && c.etat === "VALIDE") ||
        (filterEtat === "PROSPECT" && c.etat === "PROSPECT") ||
        (filterEtat === "ARCHIVE" && c.etat === "ARCHIVE");
      const matchResp = filterResponsable === "all" ||
        (filterResponsable === "__me__" && c.assignedTo === profile?.id) ||
        (filterResponsable === "__none__" && !c.assignedTo) ||
        c.assignedTo === filterResponsable;
      return matchSearch && matchVig && matchPil && matchEtat && matchResp;
    });

    result.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [clients, debouncedSearch, filterVigilance, filterPilotage, filterEtat, filterResponsable, profile?.id, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // #15 — Checkbox header state
  const allPageSelected = paginated.length > 0 && paginated.every(c => selectedRefs.has(c.ref));
  const somePageSelected = paginated.some(c => selectedRefs.has(c.ref));
  const isIndeterminate = somePageSelected && !allPageSelected;

  const handleExportCSV = useCallback(() => {
    const headers = ["Ref", "Raison Sociale", "SIREN", "Forme", "Mission", "Comptable", "Score", "Vigilance", "Pilotage", "KYC%", "Butoir"];
    const exportable = filtered.filter(c => !c.nonDiffusible);
    const excluded = filtered.length - exportable.length;
    const rows = exportable.map(c => [
      String(c.ref), c.raisonSociale, c.siren, c.forme, c.mission, c.comptable,
      String(c.scoreGlobal), c.nivVigilance, c.etatPilotage, `${computeKycPercent(c)}%`, c.dateButoir,
    ]);
    downloadCSV(headers, rows, "clients_lcb.csv");
    if (excluded > 0) {
      toast.warning(`Export CSV telecharge — ${excluded} client(s) non-diffusible(s) exclus (art. R.123-320 C.com)`);
    } else {
      toast.success("Export CSV telecharge");
    }
  }, [filtered]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshClients();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // #19 — Row click handler (navigates to client detail)
  const handleRowClick = useCallback((ref: string) => {
    navigate(`/client/${ref}`);
  }, [navigate]);

  // Skeleton loading
  if (isLoading) {
    return (
      <div className="px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-24 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            <div className="h-5 w-20 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            <div className="h-9 w-36 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 flex-1 max-w-sm rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          <div className="h-9 w-[160px] rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          <div className="h-9 w-[150px] rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          <div className="h-9 w-[130px] rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-sm dark:shadow-none overflow-hidden p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse"
              style={{ animationDelay: `${i * 75}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 animate-fade-in-up">
      {/* Restriction banner */}
      <ReglagesInfoBanner
        show={reglages.restreindre_visibilite_affectations && profile?.role !== 'ADMIN' && profile?.role !== 'SUPERVISEUR'}
        message="Mode restreint : vous ne voyez que les dossiers qui vous sont affectes."
      />

      {/* #OPT-10: Breadcrumb ameliore */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mb-2">
        <button onClick={() => navigate("/")} className="hover:text-blue-400 transition-colors">Accueil</button>
        <ChevronRightIcon className="w-3 h-3" />
        <span className="text-slate-600 dark:text-slate-300 font-medium">Clients</span>
      </nav>

      {/* #OPT-11: Header ameliore avec sous-titre */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Base Clients</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            {clients.length} dossier{clients.length !== 1 ? "s" : ""}
            {filtered.length !== clients.length && ` · ${filtered.length} affiche${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="w-9 h-9 p-0 rounded-lg border-white/[0.1] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            onClick={handleRefresh}
            title="Rafraichir la liste"
            aria-label="Rafraichir la liste"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            className="rounded-lg px-3 h-9 text-sm border-white/[0.1] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] gap-1.5"
            onClick={handleExportCSV}
            aria-label="Exporter en CSV"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button
            className="rounded-lg px-4 h-9 text-sm font-medium shadow-md shadow-blue-500/20 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white gap-1.5"
            onClick={() => navigate("/nouveau-client")}
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau client</span>
          </Button>
        </div>
      </div>

      {/* #OPT-12: KPI Stats Dashboard */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
            <p className="text-[9px] text-blue-400/70 uppercase tracking-wide font-medium">Total</p>
            <p className="text-lg font-bold text-blue-300">{clients.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <p className="text-[9px] text-emerald-400/70 uppercase tracking-wide font-medium">A jour</p>
            <p className="text-lg font-bold text-emerald-300">{stats.aJour}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
            <p className="text-[9px] text-red-400/70 uppercase tracking-wide font-medium">Retard</p>
            <p className="text-lg font-bold text-red-300">{stats.retard}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
            <p className="text-[9px] text-amber-400/70 uppercase tracking-wide font-medium">Score moy.</p>
            <p className="text-lg font-bold text-amber-300">{stats.avgScore}</p>
          </div>
          <div className="hidden lg:block p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <p className="text-[9px] text-emerald-400/70 uppercase tracking-wide font-medium">Simplifiee</p>
            <p className="text-lg font-bold text-emerald-300">{stats.simplifiee}</p>
          </div>
          <div className="hidden lg:block p-2.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
            <p className="text-[9px] text-violet-400/70 uppercase tracking-wide font-medium">Renforcee</p>
            <p className="text-lg font-bold text-violet-300">{stats.renforcee}</p>
          </div>
          <div className="hidden lg:block p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
            <p className="text-[9px] text-cyan-400/70 uppercase tracking-wide font-medium">KYC moy.</p>
            <p className="text-lg font-bold text-cyan-300">{stats.avgKycPct}%</p>
          </div>
        </div>
      )}

      {/* #OPT-13: Search and filters bar ameliore */}
      <div className="flex items-center gap-3 mb-4 flex-wrap lg:flex-nowrap transition-all duration-200">
        {/* #OPT-14: Search avec clear button */}
        <div className="relative flex-1 min-w-[200px] max-w-sm w-full lg:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher un client, un SIREN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un client"
            className="pl-9 pr-8 h-9 rounded-lg bg-white/[0.04] border-white/[0.08] text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={filterVigilance} onValueChange={setFilterVigilance}>
          <SelectTrigger className="w-full lg:w-[160px] h-9 rounded-lg border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm text-slate-600 dark:text-slate-300 px-3">
            <div className="flex items-center gap-1.5">
              {filterVigilance !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              <SelectValue placeholder="Vigilance" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes vigilances</SelectItem>
            <SelectItem value="SIMPLIFIEE">Simplifiee</SelectItem>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="RENFORCEE">Renforcee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPilotage} onValueChange={setFilterPilotage}>
          <SelectTrigger className="w-full lg:w-[150px] h-9 rounded-lg border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm text-slate-600 dark:text-slate-300 px-3">
            <div className="flex items-center gap-1.5">
              {filterPilotage !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              <SelectValue placeholder="Pilotage" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous etats</SelectItem>
            <SelectItem value="A JOUR">A jour</SelectItem>
            <SelectItem value="RETARD">Retard</SelectItem>
            <SelectItem value="BIENTÔT">Bientot</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEtat} onValueChange={setFilterEtat}>
          <SelectTrigger className="w-full lg:w-[130px] h-9 rounded-lg border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm text-slate-600 dark:text-slate-300 px-3">
            <div className="flex items-center gap-1.5">
              {filterEtat !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              <SelectValue placeholder="Etat" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="ACTIF">Actif</SelectItem>
            <SelectItem value="PROSPECT">Prospect</SelectItem>
            <SelectItem value="ARCHIVE">Archive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResponsable} onValueChange={setFilterResponsable}>
          <SelectTrigger className="w-full lg:w-[150px] h-9 rounded-lg border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm text-slate-600 dark:text-slate-300 px-3">
            <div className="flex items-center gap-1.5">
              {filterResponsable !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
              <SelectValue placeholder="Responsable" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous responsables</SelectItem>
            <SelectItem value="__me__">Mes clients</SelectItem>
            <SelectItem value="__none__">Non assignes</SelectItem>
          </SelectContent>
        </Select>

        {hasAnyFilter && (
          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap" aria-live="polite">
            {filtered.length} resultat{filtered.length !== 1 ? "s" : ""}
          </span>
        )}

        {hasAnyFilter && (
          <button
            onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        )}
      </div>

      {/* Brouillons section */}
      {drafts.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-sm dark:shadow-none p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Brouillons ({drafts.length})</h3>
          </div>
          <div className="space-y-2">
            {drafts.map(draft => (
              <div key={draft.key} className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{draft.raisonSociale || "Sans nom"}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-2 font-mono">{draft.siren}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Etape {draft.step + 1}/6 · {draft.savedAt ? (() => {
                      const diff = Date.now() - draft.savedAt;
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "a l'instant";
                      if (mins < 60) return `il y a ${mins} min`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `il y a ${hours}h`;
                      return `il y a ${Math.floor(hours / 24)}j`;
                    })() : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1 text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate("/nouveau-client?resume=1")}
                  >
                    Reprendre
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                    aria-label="Supprimer le brouillon"
                    onClick={() => {
                      sessionStorage.removeItem(draft.key);
                      const mainDraft = sessionStorage.getItem("draft_nouveau_client");
                      if (mainDraft) {
                        try {
                          const md = JSON.parse(mainDraft);
                          if (md.form?.siren?.replace(/\s/g, "") === draft.siren.replace(/\s/g, "")) {
                            sessionStorage.removeItem("draft_nouveau_client");
                          }
                        } catch { /* ignore */ }
                      }
                      setDrafts(prev => prev.filter(d => d.key !== draft.key));
                      toast.success("Brouillon supprime");
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #14 — Bulk actions bar */}
      {selectedRefs.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border-b border-blue-200 dark:border-blue-500/20 px-4 py-2 flex items-center gap-3 text-sm rounded-lg mb-4 animate-fade-in-up">
          <span className="text-blue-700 dark:text-blue-200 font-medium">{selectedRefs.size} selectionne{selectedRefs.size > 1 ? "s" : ""}</span>
          {!selectAllPages && filtered.length > paginated.length && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
              onClick={() => {
                const next = new Set(selectedRefs);
                filtered.forEach(c => next.add(c.ref));
                setSelectedRefs(next);
                setSelectAllPages(true);
              }}
            >
              Selectionner les {filtered.length} resultats
            </Button>
          )}
          {selectAllPages && (
            <span className="text-xs text-blue-500 dark:text-blue-400">Tous les {filtered.length} resultats selectionnes</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-blue-300 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/10"
            onClick={handleExportCSV}
          >
            <Download className="w-3 h-3" /> Exporter
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            onClick={() => {
              try {
                const validRefs = [...selectedRefs].filter(ref => clients.some(c => c.ref === ref));
                if (validRefs.length === 0) return;
                const refsToArchive = new Set(validRefs);
                const previousStates = new Map<string, string>();
                refsToArchive.forEach(ref => {
                  const client = clients.find(c => c.ref === ref);
                  if (client) previousStates.set(ref, client.etat);
                });
                refsToArchive.forEach(ref => updateClient(ref, { etat: "ARCHIVE" }));
                setSelectedRefs(new Set());
                setSelectAllPages(false);
                toast.success(`${refsToArchive.size} client(s) archive(s)`, {
                  action: {
                    label: "Annuler",
                    onClick: () => {
                      previousStates.forEach((etat, ref) => updateClient(ref, { etat: etat as Client["etat"] }));
                      toast.info("Archivage annule");
                    },
                  },
                });
              } catch (err) {
                toast.error("Erreur lors de l'archivage des clients");
              }
            }}
          >
            <Archive className="w-3 h-3" /> Archiver
          </Button>
          {profile?.role === "ADMIN" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
              onClick={() => {
                const validRefs = [...selectedRefs].filter(ref => clients.some(c => c.ref === ref));
                if (validRefs.length === 0) return;
                setDeleteTarget({ type: "bulk", refs: validRefs });
              }}
            >
              <Trash2 className="w-3 h-3" /> Supprimer
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-xs text-slate-500 dark:text-slate-400" onClick={() => { setSelectedRefs(new Set()); setSelectAllPages(false); }}>
            Deselectionner
          </Button>
        </div>
      )}

      {/* Empty state global */}
      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <h2 className="text-lg font-medium text-slate-600 dark:text-slate-400">Aucun client pour le moment</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">Commencez par ajouter votre premier client</p>
          <Button
            className="rounded-lg px-4 h-9 text-sm font-medium shadow-sm bg-blue-600 hover:bg-blue-700 text-white gap-1.5 mt-2"
            onClick={() => navigate("/nouveau-client")}
          >
            <Plus className="w-4 h-4" /> Nouveau client
          </Button>
        </div>
      )}

      {/* Mobile card view */}
      {clients.length > 0 && (
        <div className="sm:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-center">
              <SearchX className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aucun client ne correspond a votre recherche</p>
              {hasAnyFilter && (
                <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-400 underline">
                  Reinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            paginated.map((client) => {
              const hue = nameHue(client.raisonSociale || "?");
              return (
                <div
                  key={client.ref}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  onClick={() => navigate(`/client/${client.ref}`)}
                >
                  <div className="min-w-0 flex-1 flex gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: `hsl(${hue}, 60%, 92%)`,
                        color: `hsl(${hue}, 70%, 35%)`,
                      }}
                    >
                      {getUserInitials(client.raisonSociale || "?")}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate" title={client.raisonSociale}>{client.raisonSociale}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{client.ref}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">{client.forme}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{client.mission}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Score mini */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ${
                      client.scoreGlobal <= 25
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/20"
                        : client.scoreGlobal < 60
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-200 dark:ring-amber-500/20"
                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-500/20"
                    }`}>
                      {client.scoreGlobal}
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  </div>
                </div>
              );
            })
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">{page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} sur {filtered.length}</p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-xs text-slate-400 dark:text-slate-400 px-2">{page + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0"><ChevronRightIcon className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop table */}
      {clients.length > 0 && (
        {/* #OPT-21: Table container ameliore */}
        <div ref={tableRef} aria-label="Liste des clients" className="hidden sm:block rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-lg shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            <Table>
              {/* #21-23 — Styled sticky header */}
              <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0f1117]">
                <TableRow className="border-b border-slate-200 dark:border-white/[0.06] hover:bg-transparent">
                  {/* #1 — Checkbox */}
                  <TableHead scope="col" className="w-10 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={allPageSelected ? true : isIndeterminate ? "indeterminate" : false}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedRefs);
                        paginated.forEach(c => checked ? next.add(c.ref) : next.delete(c.ref));
                        setSelectedRefs(next);
                        if (!checked) setSelectAllPages(false);
                      }}
                      aria-label="Selectionner tous les clients de la page"
                    />
                  </TableHead>
                  {/* #2 — Client */}
                  <TableHead
                    scope="col"
                    className="flex-1 min-w-[200px] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer group"
                    onClick={() => handleSort("raisonSociale")}
                    role="columnheader"
                    tabIndex={0}
                    aria-label="Trier par Client"
                    aria-sort={ariaSort("raisonSociale")}
                  >
                    <div className="flex items-center">Client <SortIcon column="raisonSociale" /></div>
                  </TableHead>
                  {/* #3 — Forme */}
                  <TableHead scope="col" className="w-16 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Forme</TableHead>
                  {/* #4 — Comptable (hidden below xl) */}
                  <TableHead
                    scope="col"
                    className="w-24 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer group hidden xl:table-cell"
                    onClick={() => handleSort("comptable")}
                    role="columnheader"
                    tabIndex={0}
                    aria-label="Trier par Comptable"
                    aria-sort={ariaSort("comptable")}
                  >
                    <div className="flex items-center">Comptable <SortIcon column="comptable" /></div>
                  </TableHead>
                  {/* #4b — Responsable (hidden below xl) */}
                  <TableHead scope="col" className="w-24 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden xl:table-cell">Responsable</TableHead>
                  {/* #5 — Mission (hidden below xl) */}
                  <TableHead scope="col" className="w-28 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden xl:table-cell">Mission</TableHead>
                  {/* #6 — Risque */}
                  <TableHead
                    scope="col"
                    className="w-32 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer group"
                    onClick={() => handleSort("scoreGlobal")}
                    role="columnheader"
                    tabIndex={0}
                    aria-label="Trier par Risque"
                    aria-sort={ariaSort("scoreGlobal")}
                  >
                    <div className="flex items-center">Risque <SortIcon column="scoreGlobal" /></div>
                  </TableHead>
                  {/* #7 — Pilotage */}
                  <TableHead scope="col" className="w-20 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Pilotage</TableHead>
                  {/* #8 — KYC (hidden below lg) */}
                  <TableHead scope="col" className="w-20 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center hidden lg:table-cell">KYC</TableHead>
                  {/* #9 — Butoir (hidden below lg) */}
                  <TableHead
                    scope="col"
                    className="w-24 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer group hidden lg:table-cell"
                    onClick={() => handleSort("dateButoir")}
                    role="columnheader"
                    tabIndex={0}
                    aria-label="Trier par Butoir"
                    aria-sort={ariaSort("dateButoir")}
                  >
                    <div className="flex items-center">Butoir <SortIcon column="dateButoir" /></div>
                  </TableHead>
                  {/* #10 — Actions */}
                  <TableHead scope="col" className="w-10 px-3 py-2.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((client, idx) => {
                  const hue = nameHue(client.raisonSociale || "?");
                  const kycPct = computeKycPercent(client);
                  const days = daysUntil(client.dateButoir);
                  const isSelected = selectedRefs.has(client.ref);

                  return (
                    <TableRow
                      key={client.ref}
                      className={`cursor-pointer transition-colors duration-100 hover:bg-slate-50 dark:hover:bg-white/[0.025] active:bg-slate-100 dark:active:bg-white/[0.04] ${
                        isSelected ? "bg-blue-50/50 dark:bg-blue-500/[0.05]" : ""
                      } ${idx < paginated.length - 1 ? "border-b border-slate-100 dark:border-white/[0.04]" : "border-b-0"}`}
                      style={{ animation: `fadeInRow 200ms ease-out forwards`, animationDelay: `${idx * 40}ms`, opacity: 0 } as React.CSSProperties}
                      onClick={() => handleRowClick(client.ref)}
                      onDoubleClick={() => handleRowClick(client.ref)}
                    >
                      {/* #1 — Checkbox */}
                      <TableCell className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedRefs);
                            checked ? next.add(client.ref) : next.delete(client.ref);
                            setSelectedRefs(next);
                            if (selectAllPages && !checked) setSelectAllPages(false);
                          }}
                          aria-label={`Selectionner ${client.raisonSociale}`}
                        />
                      </TableCell>
                      {/* #OPT-15: Client (avatar dark-mode + name + ref) */}
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarStyle(client.raisonSociale || "?").bg} ${avatarStyle(client.raisonSociale || "?").text}`}>
                            {getUserInitials(client.raisonSociale || "?")}
                          </div>
                          <div className="min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm font-medium text-white truncate max-w-[200px]">
                                  {client.raisonSociale}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{client.raisonSociale} · {client.siren || "Pas de SIREN"}</p>
                              </TooltipContent>
                            </Tooltip>
                            <p className="text-[11px] text-slate-500 font-mono">{client.ref}</p>
                          </div>
                        </div>
                      </TableCell>
                      {/* #OPT-16: Forme juridique avec badge ameliore */}
                      <TableCell className="px-3 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/10">
                          {formeShort(client.forme)}
                        </span>
                      </TableCell>
                      {/* #4 — Comptable (hidden below xl) */}
                      <TableCell className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden xl:table-cell" title={client.comptable}>
                        {client.comptable}
                      </TableCell>
                      {/* #4b — Responsable (hidden below xl) */}
                      <TableCell className="px-3 py-3 hidden xl:table-cell">
                        {client.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[8px] font-semibold text-blue-500">
                              {getUserInitials(client.assignedToName || "?")}
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title={client.assignedToName || ""}>
                              {client.assignedToName || "—"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </TableCell>
                      {/* #OPT-17: Mission formatee (plus d'underscore) */}
                      <TableCell className="px-3 py-3 hidden xl:table-cell">
                        <span className="text-xs text-slate-400">{formatMission(client.mission)}</span>
                      </TableCell>
                      {/* #OPT-18: Risque ameliore avec score + vigilance */}
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                client.scoreGlobal <= 25
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : client.scoreGlobal < 60
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}>
                                {client.scoreGlobal}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">Score de risque LCB-FT : {client.scoreGlobal}/120</TooltipContent>
                          </Tooltip>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            client.nivVigilance === "SIMPLIFIEE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : client.nivVigilance === "RENFORCEE"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {client.nivVigilance === "SIMPLIFIEE" ? "Simplifiee" : client.nivVigilance === "RENFORCEE" ? "Renforcee" : "Standard"}
                          </span>
                        </div>
                      </TableCell>
                      {/* #7 — Pilotage (icon only) */}
                      <TableCell className="px-3 py-3 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center">
                              {client.etatPilotage === "A JOUR" ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  <span className="sr-only">A jour</span>
                                </>
                              ) : client.etatPilotage === "RETARD" ? (
                                <>
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  <span className="sr-only">En retard</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-4 h-4 text-amber-500" />
                                  <span className="sr-only">Bientot</span>
                                </>
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{client.etatPilotage === "A JOUR" ? "A jour" : client.etatPilotage === "RETARD" ? "En retard" : "Bientot a revoir"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {/* #OPT-19: KYC progress ameliore avec tooltip */}
                      <TableCell className="px-3 py-3 hidden lg:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center gap-1.5 cursor-default">
                              <div className="w-14 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                                <div
                                  className={`rounded-full h-full transition-all duration-700 ${
                                    kycPct >= 100 ? "bg-emerald-500" : kycPct >= 75 ? "bg-emerald-500" : kycPct >= 50 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${kycPct}%` }}
                                />
                              </div>
                              <span className={`text-[11px] font-medium ${kycPct >= 100 ? "text-emerald-400" : kycPct >= 50 ? "text-amber-400" : "text-red-400"}`}>{kycPct}%</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>KYC : {kycPct}% complete</p>
                            <p className="text-[10px] text-slate-400">{!client.siren ? "SIREN manquant" : ""}{!client.mail ? " · Email manquant" : ""}{!client.iban ? " · IBAN manquant" : ""}{!client.adresse ? " · Adresse manquante" : ""}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {/* #OPT-20: Butoir formate + relative + couleur */}
                      <TableCell className="px-3 py-3 hidden lg:table-cell">
                        {client.dateButoir ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex flex-col ${
                                days !== null && days <= 0 ? "text-red-400" :
                                days !== null && days <= 7 ? "text-red-400" :
                                days !== null && days <= 30 ? "text-amber-400" :
                                "text-slate-400"
                              }`}>
                                <span className="text-xs font-medium flex items-center gap-1">
                                  {days !== null && days <= 7 && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                  {formatDateShort(client.dateButoir)}
                                </span>
                                <span className="text-[9px] opacity-70">{relativeButoir(days)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">{days !== null && days >= 0 ? `${days} jours restants` : days !== null ? `${Math.abs(days)} jours de retard` : ""}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </TableCell>
                      {/* #10 — Actions (chevron + dropdown) */}
                      <TableCell className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="group/chevron inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                              aria-label="Actions"
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ChevronRightIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover/chevron:text-slate-500 dark:group-hover/chevron:text-slate-300 group-hover/chevron:translate-x-0.5 transition-all duration-150" />
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p>Voir la fiche</p>
                                </TooltipContent>
                              </Tooltip>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/client/${client.ref}`)}>
                              <Eye className="w-3.5 h-3.5 mr-2" /> Voir la fiche
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/client/${client.ref}`)}>
                              <Edit3 className="w-3.5 h-3.5 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { try { generateFicheAcceptation(client); toast.success("PDF genere"); } catch { toast.error("Erreur PDF"); } }}>
                              <FileDown className="w-3.5 h-3.5 mr-2" /> Exporter PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/lettre-mission/${client.ref}`)}>
                              <FileText className="w-3.5 h-3.5 mr-2" /> Lettre de mission
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const prevEtat = client.etat;
                              updateClient(client.ref, { etat: "ARCHIVE" });
                              toast.success("Client archive", {
                                action: {
                                  label: "Annuler",
                                  onClick: () => {
                                    updateClient(client.ref, { etat: prevEtat });
                                    toast.info("Archivage annule");
                                  },
                                },
                              });
                            }}>
                              <Archive className="w-3.5 h-3.5 mr-2" /> Archiver
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {profile?.role === "ADMIN" && (
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-500/10"
                                onClick={() => setDeleteTarget({ type: "single", ref: client.ref, name: client.raisonSociale || client.ref })}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Empty state filtered (desktop) */}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <SearchX className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Aucun client ne correspond a votre recherche</p>
                        {hasAnyFilter && (
                          <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-400 underline mt-1">
                            Reinitialiser les filtres
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* #31 — Footer counter + #32 — Pagination */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-white/[0.06]">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Affichage de {filtered.length > 0 ? page * pageSize + 1 : 0} a {Math.min((page + 1) * pageSize, filtered.length)} sur {filtered.length} dossier{filtered.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                <SelectTrigger className="h-7 w-[70px] text-xs border-slate-200 dark:border-white/[0.08] bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(0)} className="h-7 w-7 p-0" title="Premiere page" aria-label="Premiere page">
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => { setPage(p => p - 1); tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="h-7 w-7 p-0" title="Page precedente" aria-label="Page precedente">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                    const p = start + i;
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPage(p)}
                        aria-current={p === page ? "page" : undefined}
                        aria-label={`Page ${p + 1}`}
                        className={`h-7 w-7 p-0 text-xs ${p === page ? "bg-blue-600" : ""}`}
                      >
                        {p + 1}
                      </Button>
                    );
                  })}
                  <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="h-7 w-7 p-0" title="Page suivante" aria-label="Page suivante">
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-7 w-7 p-0" title="Derniere page" aria-label="Derniere page">
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500">Confirmer la suppression</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "single"
                ? `Etes-vous sur de vouloir supprimer definitivement "${deleteTarget.name}" ? Cette action est irreversible.`
                : `Etes-vous sur de vouloir supprimer definitivement ${deleteTarget?.refs.length} client(s) ? Cette action est irreversible.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => {
              if (!deleteTarget) return;
              try {
                if (deleteTarget.type === "single") {
                  deleteClient(deleteTarget.ref);
                  toast.success("Client supprime");
                } else {
                  deleteTarget.refs.forEach(ref => deleteClient(ref));
                  setSelectedRefs(new Set());
                  setSelectAllPages(false);
                  toast.success(`${deleteTarget.refs.length} clients supprimes`);
                }
              } catch {
                toast.error("Erreur lors de la suppression");
              }
              setDeleteTarget(null);
            }}>
              <Trash2 className="w-4 h-4 mr-2" /> Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
