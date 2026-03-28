import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auth/auditTrail";
import { logger } from "@/lib/logger";
import { formatDateFr } from "@/lib/dateUtils";
import { toast } from "sonner";
import {
  LM_STEP_TITLES,
  LM_TOTAL_STEPS,
  INITIAL_LM_WIZARD_DATA,
  LM_STATUTS,
  formatDuration,
  type LMWizardData,
  type SavedLetter,
} from "@/lib/lmWizardTypes";
import { VALIDATORS, sanitizeWizardData } from "@/lib/lmValidation";
import { incrementCounter } from "@/lib/lettreMissionEngine";
import type { Client } from "@/lib/types";

import LMNewStep1 from "@/components/lettre-mission/LMNewStep1";
import LMNewStep2 from "@/components/lettre-mission/LMNewStep2";
import LMNewStep3 from "@/components/lettre-mission/LMNewStep3";
import LMProgressBar from "@/components/lettre-mission/LMProgressBar";
import LMSummaryPanel from "@/components/lettre-mission/LMSummaryPanel";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip as TooltipRoot, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, FileText, FolderOpen, Plus,
  Loader2, ShieldAlert, Edit3, Save, Copy, Archive,
  FileDown, Search, Clock, AlertTriangle, Filter, Settings2,
  FilePlus2, Send, Link, Check, Trash2, LayoutGrid, LayoutList, List,
  CheckSquare, Square, MinusSquare, Download, Printer, Calendar,
  TrendingUp, BarChart3, Eye, RotateCcw, ChevronDown, ChevronUp,
  Zap, Star, StarOff, Columns3, Hash, X as XIcon, ArrowUpDown,
  CircleDot, Users, Briefcase, RefreshCw,
} from "lucide-react";
import ModeleListPage from "@/components/lettre-mission/ModeleListPage";
import LMStatusBadge from "@/components/lettre-mission/LMStatusBadge";
import LMAlertesList from "@/components/lettre-mission/LMAlertesList";
import { runAllChecks } from "@/lib/lettreMissionWorkflow";
import AvenantDialog from "@/components/lettre-mission/AvenantDialog";
import type { LMInstance } from "@/lib/lettreMissionEngine";
import { getAvenants, type LMAvenant } from "@/lib/lettreMissionAvenants";
import { MISSION_TYPES, getMissionCategory, getCategoryColorClasses, recommendClientType, getClientTypeConfig } from "@/lib/lettreMissionTypes";
import { generateSmartDefaults, getSmartMissionSelections, detectRegimeBenefices } from "@/lib/lmSmartDefaults";
import { getMissionsForClientType } from "@/lib/lmClientMissions";
import { sendForSignature, getSignatureTokens } from "@/lib/lettreMissionSignature";
import { buildClientFromWizardData } from "@/lib/lmUtils";

// ─────────────────────────────────────────
// Mission type labels for filters
// ─────────────────────────────────────────
const MISSION_TYPE_OPTIONS = Object.values(MISSION_TYPES).map((m) => ({
  id: m.id,
  label: m.shortLabel,
}));

// ─────────────────────────────────────────
// G) "Mes lettres" — Enhanced with 50 features
// ─────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ── Status pills config ──
const STATUS_PILLS = [
  { value: "all", label: "Tous", icon: "all", color: "bg-gray-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-gray-300 dark:border-white/[0.08]" },
  { value: "brouillon", label: "Brouillons", icon: "draft", color: "bg-slate-500/10 text-slate-400 dark:text-slate-400 border-slate-500/20" },
  { value: "envoyee", label: "Envoyees", icon: "sent", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "signee", label: "Signees", icon: "signed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "resiliee", label: "Resiliees", icon: "canceled", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "archivee", label: "Archivees", icon: "archived", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
];

// ── Relative date helper ──
const relativeDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  if (diffD < 30) return `Il y a ${Math.floor(diffD / 7)} sem.`;
  return formatDateFr(dateStr, "short");
};

// ── Client avatar color from name ──
const avatarColor = (name: string) => {
  const colors = [
    "bg-blue-500/20 text-blue-400", "bg-emerald-500/20 text-emerald-400",
    "bg-violet-500/20 text-violet-400", "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400", "bg-cyan-500/20 text-cyan-400",
    "bg-indigo-500/20 text-indigo-400", "bg-pink-500/20 text-pink-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ── Honoraires color bracket ──
const honorairesColor = (amount: number) => {
  if (amount >= 10000) return "text-emerald-400 font-semibold";
  if (amount >= 5000) return "text-blue-400";
  if (amount > 0) return "text-slate-300";
  return "text-slate-600";
};

type ViewMode = "table" | "cards" | "compact";

// ── EUR formatter (module-level to avoid re-creating on each render) ──
const eurFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const formatEurCompact = (n: number) => eurFormatter.format(n);


const LetterHistory = React.memo(function LetterHistory({
  letters, loading, onEdit, onDuplicate, onArchive, onDelete, onDownloadPdf, onCreateAvenant,
  onBulkDelete, onBulkArchive, onBulkStatusChange, onBulkDuplicate, onBulkDownloadPdf,
  avenantsByLetter, cabinetId,
}: {
  letters: SavedLetter[];
  loading: boolean;
  onEdit: (letter: SavedLetter) => void;
  onDuplicate: (letter: SavedLetter) => void;
  onArchive: (letter: SavedLetter) => void;
  onDelete: (letter: SavedLetter) => void;
  onDownloadPdf: (letter: SavedLetter) => void;
  onCreateAvenant: (letter: SavedLetter) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkArchive: (ids: string[]) => Promise<void>;
  onBulkStatusChange: (ids: string[], status: string) => Promise<void>;
  onBulkDuplicate: (letters: SavedLetter[]) => Promise<void>;
  onBulkDownloadPdf: (letters: SavedLetter[]) => Promise<void>;
  avenantsByLetter: Record<string, LMAvenant[]>;
  cabinetId?: string;
}) {
  // ── Core state ──
  const [searchQ, setSearchQ] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "client" | "status" | "honoraires" | "numero">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ── Feature 1-10: Bulk selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Feature 11-14: View modes ──
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // ── Feature 19-20: Advanced filters ──
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [honorairesMin, setHonoMin] = useState("");
  const [honorairesMax, setHonoMax] = useState("");
  const [filterResponsable, setFilterResponsable] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ── Feature 25: Quick filters ──
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  // ── Feature 39: Expandable rows ──
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ── Feature 49: Favorites ──
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { const stored = localStorage.getItem("lm_favorites"); return stored ? new Set(JSON.parse(stored)) : new Set(); } catch { return new Set(); }
  });

  // ── Signature state ──
  const [signTarget, setSignTarget] = useState<SavedLetter | null>(null);
  const [signEmail, setSignEmail] = useState("");
  const [signClientNom, setSignClientNom] = useState("");
  const [signLoading, setSignLoading] = useState(false);
  const [signUrl, setSignUrl] = useState("");

  // ── Feature 49: Persist favorites ──
  useEffect(() => {
    localStorage.setItem("lm_favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Signature handlers ──
  const handleSendForSignature = async () => {
    if (!signTarget || !signEmail.trim()) return;
    setSignLoading(true);
    try {
      const result = await sendForSignature(signTarget.id, signEmail.trim(), signClientNom.trim() || signTarget.raison_sociale);
      setSignUrl(result.signatureUrl);
      toast.success("Lien de signature genere");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation du lien");
    } finally { setSignLoading(false); }
  };

  const openSignDialog = (letter: SavedLetter) => {
    setSignTarget(letter);
    setSignEmail(letter.wizard_data?.email || "");
    setSignClientNom(letter.wizard_data?.dirigeant || letter.raison_sociale || "");
    setSignUrl("");
    setSignLoading(false);
  };

  // ── Feature 32: KPI stats ──
  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: letters.length };
    let totalActif = 0;
    let totalAll = 0;
    const clientSet = new Set<string>();
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    let thisMonthCount = 0;
    let lastMonthCount = 0;
    const lastMonth = new Date(thisMonth); lastMonth.setMonth(lastMonth.getMonth() - 1);

    for (const l of letters) {
      const s = l.status || "brouillon";
      counts[s] = (counts[s] || 0) + 1;
      if (s === "signee" || s === "envoyee") totalActif += (l.honoraires_ht || 0);
      totalAll += (l.honoraires_ht || 0);
      clientSet.add(l.raison_sociale);
      const d = new Date(l.created_at);
      if (d >= thisMonth) thisMonthCount++;
      else if (d >= lastMonth && d < thisMonth) lastMonthCount++;
    }

    const avgHono = letters.length > 0 ? Math.round(totalAll / letters.length) : 0;
    const conversionRate = letters.length > 0 ? Math.round(((counts["signee"] || 0) / letters.length) * 100) : 0;
    const trend = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : thisMonthCount > 0 ? 100 : 0;

    return { counts, totalActif, totalAll, avgHono, conversionRate, uniqueClients: clientSet.size, thisMonthCount, trend };
  }, [letters]);

  // ── Feature 21: Responsable options ──
  const responsableOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of letters) {
      const r = l.wizard_data?.collaborateur_principal_nom;
      if (r) set.add(r as string);
    }
    return [...set].sort();
  }, [letters]);

  // ── Active filter count (Feature 22) ──
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterStatut !== "all") c++;
    if (filterType !== "all") c++;
    if (searchQ.length >= 2) c++;
    if (dateFrom) c++;
    if (dateTo) c++;
    if (honorairesMin) c++;
    if (honorairesMax) c++;
    if (filterResponsable !== "all") c++;
    if (quickFilter) c++;
    return c;
  }, [filterStatut, filterType, searchQ, dateFrom, dateTo, honorairesMin, honorairesMax, filterResponsable, quickFilter]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let result = [...letters];

    if (quickFilter === "favorites") {
      result = result.filter(l => favorites.has(l.id));
    } else if (quickFilter === "this_week") {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      result = result.filter(l => new Date(l.updated_at) >= weekAgo);
    } else if (quickFilter === "this_month") {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      result = result.filter(l => new Date(l.created_at) >= monthStart);
    }

    if (filterStatut !== "all") result = result.filter(l => l.status === filterStatut);

    if (filterType !== "all") {
      result = result.filter(l => {
        const missionTypeId = l.wizard_data?.mission_type_id || l.type_mission || "";
        return missionTypeId === filterType || (l.type_mission || "").toLowerCase() === filterType.toLowerCase();
      });
    }

    if (filterResponsable !== "all") {
      result = result.filter(l => (l.wizard_data?.collaborateur_principal_nom || "") === filterResponsable);
    }

    if (dateFrom) result = result.filter(l => l.created_at >= dateFrom);
    if (dateTo) result = result.filter(l => l.created_at.slice(0, 10) <= dateTo);
    if (honorairesMin) result = result.filter(l => (l.honoraires_ht || 0) >= Number(honorairesMin));
    if (honorairesMax) result = result.filter(l => (l.honoraires_ht || 0) <= Number(honorairesMax));

    if (searchQ.length >= 2) {
      const q = searchQ.toLowerCase();
      result = result.filter(l =>
        l.raison_sociale.toLowerCase().includes(q) ||
        l.numero.toLowerCase().includes(q) ||
        l.client_ref.toLowerCase().includes(q) ||
        ((l.wizard_data?.collaborateur_principal_nom as string) || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sortBy === "client") cmp = a.raison_sociale.localeCompare(b.raison_sociale);
      else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else if (sortBy === "honoraires") cmp = (a.honoraires_ht || 0) - (b.honoraires_ht || 0);
      else if (sortBy === "numero") cmp = a.numero.localeCompare(b.numero);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [letters, filterStatut, filterType, searchQ, sortBy, sortAsc, dateFrom, dateTo, honorairesMin, honorairesMax, filterResponsable, quickFilter, favorites]);

  // ── Pagination ──
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  useEffect(() => { setPage(0); }, [filterStatut, filterType, searchQ, dateFrom, dateTo, honorairesMin, honorairesMax, filterResponsable, quickFilter, pageSize]);

  const filteredHonoraires = useMemo(() => filtered.reduce((s, l) => s + (l.honoraires_ht || 0), 0), [filtered]);

  // ── Helpers ──
  const getMissionLabel = (letter: SavedLetter) => {
    const missionTypeId = letter.wizard_data?.mission_type_id || letter.type_mission || "";
    const entry = Object.values(MISSION_TYPES).find(m => m.id === missionTypeId || m.shortLabel === missionTypeId || m.label === missionTypeId);
    return entry ? entry.shortLabel : letter.type_mission;
  };

  const getLetterCategoryColors = (letter: SavedLetter) => {
    const missionTypeId = letter.wizard_data?.mission_type_id || letter.type_mission || "";
    const entry = Object.values(MISSION_TYPES).find(m => m.id === missionTypeId || m.shortLabel === missionTypeId || m.label === missionTypeId);
    const cat = entry ? getMissionCategory(entry.id) : null;
    return cat ? getCategoryColorClasses(cat) : null;
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  // ── Selection helpers ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAllOnPage = () => {
    const allPageIds = paged.map(l => l.id);
    const allSelected = allPageIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); allPageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); allPageIds.forEach(id => n.add(id)); return n; });
    }
  };

  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map(l => l.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedLetters = useMemo(() => letters.filter(l => selectedIds.has(l.id)), [letters, selectedIds]);
  const allPageSelected = paged.length > 0 && paged.every(l => selectedIds.has(l.id));
  const somePageSelected = paged.some(l => selectedIds.has(l.id));

  const runBulkAction = async (action: () => Promise<void>) => {
    setBulkLoading(true);
    try { await action(); } finally { setBulkLoading(false); clearSelection(); }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── CSV Export ──
  const exportCsv = () => {
    const headers = ["Numero", "Client", "Ref Client", "Type Mission", "Responsable", "Honoraires HT", "Statut", "Date Creation", "Date MAJ"];
    const rows = filtered.map(l => [
      l.numero, l.raison_sociale, l.client_ref, getMissionLabel(l),
      l.wizard_data?.collaborateur_principal_nom || "", String(l.honoraires_ht || 0),
      l.status, l.created_at.slice(0, 10), l.updated_at.slice(0, 10),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lettres_mission_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(`${filtered.length} lignes exportees en CSV`);
  };

  const handlePrint = () => window.print();

  const copyDetails = (letter: SavedLetter) => {
    const text = `${letter.numero} — ${letter.raison_sociale}\nType: ${getMissionLabel(letter)}\nStatut: ${letter.status}\nHonoraires: ${letter.honoraires_ht || 0} EUR HT\nDate: ${formatDateFr(letter.created_at, "short")}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Details copies")).catch(() => toast.error("Erreur copie"));
  };

  const clearAllFilters = () => {
    setSearchQ(""); setFilterStatut("all"); setFilterType("all");
    setDateFrom(""); setDateTo(""); setHonoMin(""); setHonoMax("");
    setFilterResponsable("all"); setQuickFilter(null);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); selectAllOnPage(); }
      if (e.key === "Escape" && selectedIds.size > 0) clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paged, selectedIds]);

  // ── Search highlight ──
  const highlightMatch = (text: string) => {
    if (searchQ.length < 2) return text;
    const idx = text.toLowerCase().indexOf(searchQ.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-amber-400/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + searchQ.length)}</mark>{text.slice(idx + searchQ.length)}</>;
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Chargement">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse flex items-center gap-4 px-4">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-2"><div className="h-3 bg-white/[0.06] rounded w-1/3" /><div className="h-2 bg-white/[0.04] rounded w-1/5" /></div>
            <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto"><FileText className="w-8 h-8 text-blue-400" /></div>
        <div>
          <p className="text-slate-900 dark:text-white font-medium">Aucune lettre de mission</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Commencez par creer votre premiere lettre dans l'onglet "Nouvelle lettre"</p>
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~5 min par lettre</span>
          <span className="w-px h-3 bg-white/[0.06]" />
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF + DOCX</span>
          <span className="w-px h-3 bg-white/[0.06]" />
          <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Signature electronique</span>
        </div>
      </div>
    );
  }

  // ── Table row renderer ──
  const renderTableRow = (letter: SavedLetter) => {
    const avenantCount = avenantsByLetter[letter.id]?.length || 0;
    const rowCatColors = getLetterCategoryColors(letter);
    const isSelected = selectedIds.has(letter.id);
    const isExpanded = expandedRows.has(letter.id);
    const isFav = favorites.has(letter.id);
    const wizardStep = (letter.wizard_data?.wizard_step as number) ?? 0;

    return (
      <div key={letter.id}>
        <div className={`group sm:grid sm:grid-cols-[32px_1fr_100px_130px_90px_80px_80px_80px_40px_140px] sm:items-center gap-2 p-3 sm:px-3 rounded-xl border transition-all duration-200 ${isSelected ? "bg-blue-500/[0.08] border-blue-500/30 shadow-sm shadow-blue-500/5" : "bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.04]"} ${rowCatColors ? `border-l-[3px] ${rowCatColors.border}` : ""}`}>
          {/* Checkbox */}
          <div className="hidden sm:flex items-center justify-center">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(letter.id)} aria-label={`Selectionner ${letter.raison_sociale}`} />
          </div>
          {/* Client */}
          <button onClick={() => onEdit(letter)} className="flex items-center gap-2 text-left min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${avatarColor(letter.raison_sociale)}`}>
              {letter.raison_sociale.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{highlightMatch(letter.raison_sociale)}</p>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 sm:hidden">{letter.numero} · {relativeDate(letter.updated_at)}</p>
            </div>
          </button>
          {/* Numero */}
          <span className="hidden sm:block text-xs text-slate-400 font-mono truncate">{highlightMatch(letter.numero)}</span>
          {/* Type */}
          <div className="hidden sm:block">
            <Badge className={`text-[9px] gap-1 ${rowCatColors ? rowCatColors.badge : "bg-white/[0.04] border-white/[0.08] text-slate-300"}`}>{getMissionLabel(letter)}</Badge>
          </div>
          {/* Responsable */}
          <span className="hidden sm:block text-[10px] text-slate-400 truncate">{letter.wizard_data?.collaborateur_principal_nom as string || "—"}</span>
          {/* Honoraires */}
          <span className={`hidden sm:block text-[10px] font-mono ${honorairesColor(letter.honoraires_ht || 0)}`}>
            {letter.honoraires_ht ? formatEurCompact(letter.honoraires_ht) : "—"}
          </span>
          {/* Date */}
          <TooltipRoot>
            <TooltipTrigger asChild>
              <span className="hidden sm:block text-[10px] text-slate-500 cursor-default">{relativeDate(letter.updated_at)}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">{formatDateFr(letter.updated_at, "short")}</TooltipContent>
          </TooltipRoot>
          {/* Statut */}
          <div className="hidden sm:block">
            <LMStatusBadge status={letter.status} showTooltip />
            {letter.status === "brouillon" && <div className="mt-0.5"><Progress value={((wizardStep + 1) / 3) * 100} className="h-1" /></div>}
          </div>
          {/* Avenants */}
          <div className="hidden sm:block">
            {avenantCount > 0 && <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{avenantCount} av.</Badge>}
          </div>
          {/* Actions */}
          <div className="hidden sm:flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => toggleFavorite(letter.id)} className="p-1 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-amber-400 transition-colors" title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}>
              {isFav ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : <StarOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => toggleExpand(letter.id)} className="p-1 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-blue-400 transition-colors" title="Details">
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onEdit(letter)} className="p-1 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-blue-400 transition-colors" title={letter.status === "brouillon" ? "Modifier" : "Voir"}>
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors" title="Plus d'actions"><CircleDot className="w-3.5 h-3.5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(letter.status === "brouillon" || letter.status === "envoyee") && <DropdownMenuItem onClick={() => openSignDialog(letter)} className="gap-2 text-xs"><Send className="w-3 h-3" /> Envoyer pour signature</DropdownMenuItem>}
                {letter.status === "signee" && <DropdownMenuItem onClick={() => onCreateAvenant(letter)} className="gap-2 text-xs"><FilePlus2 className="w-3 h-3" /> Creer un avenant</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => onDuplicate(letter)} className="gap-2 text-xs"><Copy className="w-3 h-3" /> Dupliquer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadPdf(letter)} className="gap-2 text-xs"><FileDown className="w-3 h-3" /> Telecharger PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyDetails(letter)} className="gap-2 text-xs"><Hash className="w-3 h-3" /> Copier les details</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive(letter)} className="gap-2 text-xs"><Archive className="w-3 h-3" /> Archiver</DropdownMenuItem>
                {(letter.status === "brouillon" || letter.status === "archivee") && <DropdownMenuItem onClick={() => onDelete(letter)} className="gap-2 text-xs text-red-400 focus:text-red-400"><Trash2 className="w-3 h-3" /> Supprimer</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Mobile actions */}
          <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(letter.id)} />
            <LMStatusBadge status={letter.status} />
            {avenantCount > 0 && <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{avenantCount} av.</Badge>}
            {(letter.honoraires_ht ?? 0) > 0 && <span className="text-[9px] text-slate-500 font-mono">{formatEurCompact(letter.honoraires_ht)}</span>}
            <div className="flex-1" />
            <button onClick={() => toggleFavorite(letter.id)} className="p-1.5 text-slate-500"><Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} /></button>
            <button onClick={() => onEdit(letter)} className="p-1.5 text-slate-500"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDownloadPdf(letter)} className="p-1.5 text-slate-500"><FileDown className="w-3.5 h-3.5" /></button>
            {(letter.status === "brouillon" || letter.status === "archivee") && <button onClick={() => onDelete(letter)} className="p-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        {/* Expanded details */}
        {isExpanded && (
          <div className="ml-4 sm:ml-10 mt-1 mb-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2 animate-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-slate-500 block text-[10px]">Reference client</span><span className="text-slate-300 font-mono">{letter.client_ref || "—"}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Date creation</span><span className="text-slate-300">{formatDateFr(letter.created_at, "short")}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Derniere MAJ</span><span className="text-slate-300">{formatDateFr(letter.updated_at, "short")}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Duree redaction</span><span className="text-slate-300">{letter.duration_seconds ? formatDuration(letter.duration_seconds) : "—"}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Nb missions</span><span className="text-slate-300">{letter.missions_count || "—"}</span></div>
              <div><span className="text-slate-500 block text-[10px]">SIREN</span><span className="text-slate-300 font-mono">{letter.wizard_data?.siren as string || "—"}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Email</span><span className="text-slate-300">{letter.wizard_data?.email as string || "—"}</span></div>
              <div><span className="text-slate-500 block text-[10px]">Forme juridique</span><span className="text-slate-300">{letter.wizard_data?.forme_juridique as string || "—"}</span></div>
            </div>
            {avenantsByLetter[letter.id]?.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04] space-y-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{avenantsByLetter[letter.id].length} avenant{avenantsByLetter[letter.id].length > 1 ? "s" : ""}</p>
                {avenantsByLetter[letter.id].map(av => (
                  <div key={av.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.01] border border-white/[0.04]">
                    <FilePlus2 className="w-3 h-3 text-cyan-400/60 shrink-0" />
                    <span className="text-xs font-mono text-cyan-400/80">{av.numero}</span>
                    <span className="text-xs text-slate-400 truncate flex-1">{av.objet}</span>
                    <Badge variant="outline" className={`text-[9px] ${av.status === "signee" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : av.status === "envoyee" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>{av.status}</Badge>
                    <span className="text-[10px] text-slate-600">{formatDateFr(av.created_at, "short")}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-white/[0.08]" onClick={() => onEdit(letter)}><Edit3 className="w-3 h-3" /> Ouvrir</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-white/[0.08]" onClick={() => onDuplicate(letter)}><Copy className="w-3 h-3" /> Dupliquer</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-white/[0.08]" onClick={() => onDownloadPdf(letter)}><FileDown className="w-3 h-3" /> PDF</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-white/[0.08]" onClick={() => copyDetails(letter)}><Hash className="w-3 h-3" /> Copier</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Card view renderer ──
  const renderCardView = (letter: SavedLetter) => {
    const rowCatColors = getLetterCategoryColors(letter);
    const isSelected = selectedIds.has(letter.id);
    const isFav = favorites.has(letter.id);
    const avenantCount = avenantsByLetter[letter.id]?.length || 0;
    return (
      <div key={letter.id} className={`group relative p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] cursor-pointer ${isSelected ? "bg-blue-500/[0.08] border-blue-500/30 shadow-md shadow-blue-500/5" : "bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] hover:border-white/[0.12]"} ${rowCatColors ? `border-t-[3px] ${rowCatColors.border}` : ""}`} onClick={() => onEdit(letter)}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(letter.id)} onClick={(e) => e.stopPropagation()} />
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(letter.raison_sociale)}`}>{letter.raison_sociale.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">{isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}<p className="text-sm font-semibold text-white truncate">{letter.raison_sociale}</p></div>
              <p className="text-[10px] text-slate-500 font-mono">{letter.numero}</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(letter.id); }} className="p-1 text-slate-500 hover:text-amber-400">
            {isFav ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : <StarOff className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[9px] ${rowCatColors ? rowCatColors.badge : "bg-white/[0.04] border-white/[0.08] text-slate-300"}`}>{getMissionLabel(letter)}</Badge>
            <LMStatusBadge status={letter.status} />
            {avenantCount > 0 && <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{avenantCount} av.</Badge>}
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{letter.wizard_data?.collaborateur_principal_nom as string || "Non assigne"}</span>
            <span className={`font-mono ${honorairesColor(letter.honoraires_ht || 0)}`}>{letter.honoraires_ht ? formatEurCompact(letter.honoraires_ht) : "—"}</span>
          </div>
          <p className="text-[10px] text-slate-600">{relativeDate(letter.updated_at)}</p>
        </div>
        <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onDuplicate(letter)} className="p-1 rounded bg-white/[0.06] text-slate-500 hover:text-emerald-400" title="Dupliquer"><Copy className="w-3 h-3" /></button>
          <button onClick={() => onDownloadPdf(letter)} className="p-1 rounded bg-white/[0.06] text-slate-500 hover:text-purple-400" title="PDF"><FileDown className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  // ── Compact view renderer ──
  const renderCompactRow = (letter: SavedLetter) => {
    const isSelected = selectedIds.has(letter.id);
    const rowCatColors = getLetterCategoryColors(letter);
    return (
      <div key={letter.id} className={`group flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${isSelected ? "bg-blue-500/[0.08] border-blue-500/30" : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]"} ${rowCatColors ? `border-l-2 ${rowCatColors.border}` : ""}`} onClick={() => onEdit(letter)}>
        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(letter.id)} onClick={(e) => e.stopPropagation()} className="shrink-0" />
        {favorites.has(letter.id) && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
        <span className="text-xs text-slate-400 font-mono w-[90px] shrink-0 truncate">{letter.numero}</span>
        <span className="text-xs text-white font-medium truncate flex-1">{letter.raison_sociale}</span>
        <Badge className={`text-[8px] shrink-0 ${rowCatColors ? rowCatColors.badge : "bg-white/[0.04] text-slate-400"}`}>{getMissionLabel(letter)}</Badge>
        <span className={`text-[10px] font-mono w-[60px] text-right shrink-0 ${honorairesColor(letter.honoraires_ht || 0)}`}>{letter.honoraires_ht ? formatEurCompact(letter.honoraires_ht) : "—"}</span>
        <LMStatusBadge status={letter.status} />
        <span className="text-[10px] text-slate-600 w-[60px] text-right shrink-0">{relativeDate(letter.updated_at)}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onDownloadPdf(letter)} className="p-1 text-slate-500 hover:text-purple-400"><FileDown className="w-3 h-3" /></button>
          <button onClick={() => onDelete(letter)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {cabinetId && <LMAlertesList cabinetId={cabinetId} compact onNavigateToLM={(instanceId) => { const l = letters.find(ll => ll.id === instanceId); if (l) onEdit(l); }} />}

      {/* KPI Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
          <p className="text-[10px] text-blue-400/70 uppercase tracking-wide">Total lettres</p>
          <p className="text-xl font-bold text-blue-300">{letters.length}</p>
          <p className="text-[9px] text-blue-400/50">{stats.uniqueClients} client{stats.uniqueClients > 1 ? "s" : ""}</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wide">CA Actif</p>
          <p className="text-xl font-bold text-emerald-300">{formatEurCompact(stats.totalActif)}</p>
          <p className="text-[9px] text-emerald-400/50">Signees + Envoyees</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
          <p className="text-[10px] text-amber-400/70 uppercase tracking-wide">Moy. honoraires</p>
          <p className="text-xl font-bold text-amber-300">{formatEurCompact(stats.avgHono)}</p>
          <p className="text-[9px] text-amber-400/50">Par lettre</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
          <p className="text-[10px] text-violet-400/70 uppercase tracking-wide">Taux conversion</p>
          <p className="text-xl font-bold text-violet-300">{stats.conversionRate}%</p>
          <p className="text-[9px] text-violet-400/50">{stats.counts["signee"] || 0} signees</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
          <p className="text-[10px] text-cyan-400/70 uppercase tracking-wide">Ce mois</p>
          <p className="text-xl font-bold text-cyan-300">{stats.thisMonthCount}</p>
          <div className="flex items-center gap-1 text-[9px]">
            {stats.trend > 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : stats.trend < 0 ? <TrendingUp className="w-3 h-3 text-red-400 rotate-180" /> : null}
            <span className={stats.trend > 0 ? "text-emerald-400" : stats.trend < 0 ? "text-red-400" : "text-slate-500"}>{stats.trend > 0 ? "+" : ""}{stats.trend}%</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/10 to-slate-500/5 border border-slate-500/20">
          <p className="text-[10px] text-slate-400/70 uppercase tracking-wide">Brouillons</p>
          <p className="text-xl font-bold text-slate-300">{stats.counts["brouillon"] || 0}</p>
          <p className="text-[9px] text-slate-400/50">En attente</p>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_PILLS.map(pill => {
          const count = stats.counts[pill.value] || 0;
          if (pill.value !== "all" && count === 0) return null;
          const isActive = filterStatut === pill.value;
          return (
            <button key={pill.value} onClick={() => { setFilterStatut(pill.value); setQuickFilter(null); }} aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${isActive ? `${pill.color} ring-1 ring-white/10` : "bg-white/[0.02] text-slate-500 border-white/[0.06] hover:bg-white/[0.04]"}`}>
              {pill.label}
              <span className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-600"}`}>{pill.value === "all" ? letters.length : count}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input placeholder="Rechercher par client, n° LM, responsable..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-9 pr-8 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs" />
            {searchQ && <button onClick={() => setSearchQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><XIcon className="w-3.5 h-3.5" /></button>}
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/[0.04] border-white/[0.08] text-xs text-slate-300">
              <Filter className="w-3 h-3 mr-1.5 text-slate-500" /><SelectValue placeholder="Type de mission" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {MISSION_TYPE_OPTIONS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className={`h-9 gap-1.5 border-white/[0.08] text-xs ${showAdvancedFilters ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "text-slate-400"}`} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            <Filter className="w-3 h-3" /> Filtres
            {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center">{activeFilterCount}</span>}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-300">Filtres avances</p>
              {activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reinitialiser ({activeFilterCount})</button>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-[10px] text-slate-500 mb-1 block">Date depuis</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs bg-white/[0.04] border-white/[0.08]" /></div>
              <div><Label className="text-[10px] text-slate-500 mb-1 block">Date jusqu'au</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs bg-white/[0.04] border-white/[0.08]" /></div>
              <div><Label className="text-[10px] text-slate-500 mb-1 block">Honoraires min</Label><Input type="number" placeholder="0" value={honorairesMin} onChange={e => setHonoMin(e.target.value)} className="h-8 text-xs bg-white/[0.04] border-white/[0.08]" /></div>
              <div><Label className="text-[10px] text-slate-500 mb-1 block">Honoraires max</Label><Input type="number" placeholder="∞" value={honorairesMax} onChange={e => setHonoMax(e.target.value)} className="h-8 text-xs bg-white/[0.04] border-white/[0.08]" /></div>
            </div>
            {responsableOptions.length > 0 && (
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">Responsable</Label>
                <Select value={filterResponsable} onValueChange={setFilterResponsable}>
                  <SelectTrigger className="h-8 text-xs bg-white/[0.04] border-white/[0.08] w-full sm:w-[250px]"><Users className="w-3 h-3 mr-1.5 text-slate-500" /><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tous les responsables</SelectItem>{responsableOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              <p className="text-[10px] text-slate-500 self-center mr-1">Raccourcis :</p>
              {([{ id: "favorites", label: "Favoris", icon: Star }, { id: "this_week", label: "Cette semaine", icon: Calendar }, { id: "this_month", label: "Ce mois", icon: BarChart3 }] as const).map(qf => (
                <button key={qf.id} onClick={() => setQuickFilter(quickFilter === qf.id ? null : qf.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors ${quickFilter === qf.id ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "text-slate-500 border-white/[0.06] hover:bg-white/[0.04]"}`}>
                  <qf.icon className="w-3 h-3" /> {qf.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View controls bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-600">{filtered.length} lettre{filtered.length > 1 ? "s" : ""}</p>
            {filteredHonoraires > 0 && <p className="text-[10px] text-slate-500">· Total : <span className="text-white font-medium">{formatEurCompact(filteredHonoraires)}</span> HT</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-white/[0.08] rounded-md overflow-hidden">
              <button onClick={() => setViewMode("table")} className={`p-1.5 transition-colors ${viewMode === "table" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:bg-white/[0.04]"}`} title="Vue tableau"><LayoutList className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode("cards")} className={`p-1.5 transition-colors ${viewMode === "cards" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:bg-white/[0.04]"}`} title="Vue cartes"><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode("compact")} className={`p-1.5 transition-colors ${viewMode === "compact" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:bg-white/[0.04]"}`} title="Vue compacte"><List className="w-3.5 h-3.5" /></button>
            </div>
            <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
              <SelectTrigger className="w-[70px] h-7 text-[10px] bg-white/[0.04] border-white/[0.08]"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}/page</SelectItem>)}</SelectContent>
            </Select>
            <button onClick={exportCsv} className="p-1.5 rounded-md border border-white/[0.08] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors" title="Exporter en CSV"><Download className="w-3.5 h-3.5" /></button>
            <button onClick={handlePrint} className="p-1.5 rounded-md border border-white/[0.08] text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-colors" title="Imprimer"><Printer className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-30 p-3 rounded-xl bg-gradient-to-r from-blue-500/15 to-indigo-500/10 border border-blue-500/30 backdrop-blur-xl flex items-center gap-2 flex-wrap animate-in slide-in-from-top-2 duration-200 shadow-lg shadow-blue-500/10">
          <div className="flex items-center gap-2 mr-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">{selectedIds.size} selectionne{selectedIds.size > 1 ? "s" : ""}</span>
            {selectedIds.size < filtered.length && <button onClick={selectAllFiltered} className="text-[10px] text-blue-400 hover:underline">Tout selectionner ({filtered.length})</button>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" disabled={bulkLoading} onClick={() => runBulkAction(() => onBulkArchive([...selectedIds]))}><Archive className="w-3 h-3" /> Archiver</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10" disabled={bulkLoading}><ArrowUpDown className="w-3 h-3" /> Statut</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {["brouillon", "envoyee", "signee", "resiliee", "archivee"].map(s => (
                  <DropdownMenuItem key={s} onClick={() => runBulkAction(() => onBulkStatusChange([...selectedIds], s))} className="text-xs capitalize">{s}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" disabled={bulkLoading} onClick={() => runBulkAction(() => onBulkDuplicate(selectedLetters))}><Copy className="w-3 h-3" /> Dupliquer</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" disabled={bulkLoading}
              onClick={() => runBulkAction(() => onBulkDownloadPdf(selectedLetters))}><FileDown className="w-3 h-3" /> PDF</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10" disabled={bulkLoading} onClick={() => runBulkAction(() => onBulkDelete([...selectedIds]))}><Trash2 className="w-3 h-3" /> Supprimer</Button>
            <div className="w-px h-5 bg-white/[0.08] mx-1" />
            <button onClick={clearSelection} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"><XIcon className="w-3 h-3" /> Deselectionner</button>
          </div>
          {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-2" />}
        </div>
      )}

      {/* Table Header */}
      {viewMode === "table" && (
        <div className="hidden sm:grid grid-cols-[32px_1fr_100px_130px_90px_80px_80px_80px_40px_140px] gap-2 px-3 text-[10px] text-slate-600 uppercase tracking-wider">
          <div className="flex items-center justify-center"><Checkbox checked={allPageSelected} onCheckedChange={selectAllOnPage} aria-label="Tout selectionner" /></div>
          <button onClick={() => toggleSort("client")} className="text-left hover:text-slate-400 transition-colors flex items-center gap-1">Client {sortBy === "client" && <ArrowUpDown className="w-3 h-3" />}</button>
          <button onClick={() => toggleSort("numero")} className="text-left hover:text-slate-400 transition-colors flex items-center gap-1">Numero {sortBy === "numero" && <ArrowUpDown className="w-3 h-3" />}</button>
          <span>Type de mission</span>
          <span>Responsable</span>
          <button onClick={() => toggleSort("honoraires")} className="text-left hover:text-slate-400 transition-colors flex items-center gap-1">Honoraires {sortBy === "honoraires" && <ArrowUpDown className="w-3 h-3" />}</button>
          <button onClick={() => toggleSort("date")} className="text-left hover:text-slate-400 transition-colors flex items-center gap-1">Date {sortBy === "date" && <ArrowUpDown className="w-3 h-3" />}</button>
          <button onClick={() => toggleSort("status")} className="text-left hover:text-slate-400 transition-colors flex items-center gap-1">Statut {sortBy === "status" && <ArrowUpDown className="w-3 h-3" />}</button>
          <span>Av.</span>
          <span className="text-right">Actions</span>
        </div>
      )}

      {/* Content */}
      {viewMode === "table" && <div className="space-y-1.5">{paged.map(renderTableRow)}</div>}
      {viewMode === "cards" && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{paged.map(renderCardView)}</div>}
      {viewMode === "compact" && <div className="space-y-0.5">{paged.map(renderCompactRow)}</div>}

      {/* Empty filter state */}
      {filtered.length === 0 && letters.length > 0 && (
        <div className="text-center py-10 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto"><Search className="w-6 h-6 text-slate-600" /></div>
          <p className="text-slate-400 text-sm">Aucun resultat pour ces filtres</p>
          <p className="text-[10px] text-slate-600">{activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}</p>
          <button onClick={clearAllFilters} className="text-xs text-blue-400 hover:underline flex items-center gap-1 mx-auto"><RotateCcw className="w-3 h-3" /> Reinitialiser tous les filtres</button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-slate-600">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} sur {filtered.length}</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} className="h-7 w-7 p-0 border-white/[0.06]" aria-label="Page precedente"><ChevronLeft className="w-3.5 h-3.5" /></Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const start = Math.max(0, Math.min(page - 2, totalPages - 5)); return start + i; }).filter(p => p < totalPages).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded text-xs transition-colors ${p === page ? "bg-blue-500/20 text-blue-300" : "text-slate-500 hover:bg-white/[0.04]"}`}>{p + 1}</button>
            ))}
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="h-7 w-7 p-0 border-white/[0.06]" aria-label="Page suivante"><ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Signature dialog */}
      <Dialog open={!!signTarget} onOpenChange={(open) => !open && setSignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Envoyer pour signature</DialogTitle><DialogDescription>{signTarget?.raison_sociale} — {signTarget?.numero}</DialogDescription></DialogHeader>
          {signUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><Check className="w-4 h-4 text-emerald-400 shrink-0" /><p className="text-sm text-emerald-300">Lien de signature genere</p></div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Lien a envoyer au client</Label>
                <div className="flex gap-2">
                  <Input value={signUrl} readOnly className="bg-white/[0.04] border-white/[0.08] text-xs font-mono" />
                  <Button size="sm" variant="outline" className="shrink-0 gap-1 border-white/[0.06]" onClick={async () => { try { await navigator.clipboard.writeText(signUrl); toast.success("Lien copie"); } catch { toast.error("Impossible de copier"); } }}><Link className="w-3 h-3" /> Copier</Button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Le client pourra consulter la lettre de mission et la signer electroniquement via ce lien.</p>
              <DialogFooter><Button variant="outline" onClick={() => setSignTarget(null)} className="border-white/[0.06]">Fermer</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label htmlFor="sign-email" className="text-xs text-slate-400">Email du client *</Label><Input id="sign-email" type="email" value={signEmail} onChange={(e) => setSignEmail(e.target.value)} placeholder="client@example.com" className="bg-white/[0.04] border-white/[0.08]" /></div>
              <div className="space-y-1.5"><Label htmlFor="sign-client-nom" className="text-xs text-slate-400">Nom du signataire</Label><Input id="sign-client-nom" value={signClientNom} onChange={(e) => setSignClientNom(e.target.value)} placeholder="Nom du client" className="bg-white/[0.04] border-white/[0.08]" /></div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSignTarget(null)} className="border-white/[0.06]">Annuler</Button>
                <Button onClick={handleSendForSignature} disabled={signLoading || !signEmail.trim()} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  {signLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Generer le lien
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

// ─────────────────────────────────────────
// F) Renewal alerts
// ─────────────────────────────────────────
const RenewalAlerts = React.memo(function RenewalAlerts({ letters }: { letters: SavedLetter[] }) {
  const expiringSoon = useMemo(() => {
    const now = new Date();
    const in60Days = new Date(); in60Days.setDate(in60Days.getDate() + 60);
    return letters.filter((l) => {
      if (l.status !== "signee") return false;
      const wd = l.wizard_data;
      if (!wd?.date_debut || !wd?.duree) return false;
      const start = new Date(wd.date_debut);
      const years = parseInt(wd.duree, 10) || 1;
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + years);
      return end >= now && end <= in60Days;
    });
  }, [letters]);

  if (expiringSoon.length === 0) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in-up">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-300">
          {expiringSoon.length} lettre{expiringSoon.length > 1 ? "s" : ""} expire{expiringSoon.length > 1 ? "nt" : ""} dans 60 jours
        </p>
        <div className="mt-1.5 space-y-1">
          {expiringSoon.slice(0, 3).map((l) => (
            <p key={l.id} className="text-xs text-amber-400/70">{l.raison_sociale} — {l.numero}</p>
          ))}
          {expiringSoon.length > 3 && (
            <p className="text-[10px] text-amber-400/50">+{expiringSoon.length - 3} autres</p>
          )}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────
// Elapsed time mini-component
// ─────────────────────────────────────────
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const elapsed = Math.round((now - new Date(startedAt).getTime()) / 1000);
  return <>{formatDuration(elapsed)}</>;
}

// ─────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { ref: urlRef } = useParams<{ ref?: string }>();
  const { clients } = useAppState();
  const { hasPermission, profile } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("wizard");

  useDocumentTitle("Lettre de Mission");

  // Cabinet info from profile (avoids hardcoding)
  const cabinetInfo = useMemo(() => ({
    nom: profile?.full_name ? `Cabinet ${profile.full_name}` : "Cabinet Expertise Comptable",
    adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: profile?.email || "", telephone: "",
  }), [profile?.full_name, profile?.email]);

  // ── Wizard state (all hooks must be declared before any early return) ──
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [data, setData] = useState<LMWizardData>({ ...INITIAL_LM_WIZARD_DATA });
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const prevStepRef = useRef(0);
  const [lmId, setLmId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Draft
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ id: string; wizard_data: Record<string, unknown>; wizard_step: number } | null>(null);

  // History
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Cabinet logo
  const [cabinetLogo, setCabinetLogo] = useState<string | undefined>(undefined);

  // Cabinet data (for LM defaults)
  const [cabinetData, setCabinetData] = useState<Record<string, any> | null>(null);

  // Cabinet tarifs (for v3 wizard)
  const [cabinetTarifs, setCabinetTarifs] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);

  // Avenants
  const [avenantsByLetter, setAvenantsByLetter] = useState<Record<string, LMAvenant[]>>({});
  const [avenantDialogOpen, setAvenantDialogOpen] = useState(false);
  const [avenantTargetInstance, setAvenantTargetInstance] = useState<LMInstance | null>(null);

  // Swipe
  const touchStartX = useRef<number | null>(null);

  const canWrite = hasPermission("write_clients");

  // ── Run LM alertes checks on mount ──
  const alertesCheckedRef = useRef(false);
  useEffect(() => {
    if (profile?.cabinet_id && !alertesCheckedRef.current) {
      alertesCheckedRef.current = true;
      runAllChecks(profile.cabinet_id).catch((e) =>
        logger.warn("LM", "Alertes check failed:", e)
      );
    }
  }, [profile?.cabinet_id]);

  // ── Load cabinet logo from parametres ──
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("parametres")
      .select("valeur")
      .eq("cabinet_id", profile.cabinet_id)
      .eq("cle", "cabinet_info")
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.valeur) {
          try {
            const info = typeof row.valeur === "string" ? JSON.parse(row.valeur) : row.valeur;
            if (info.logo) setCabinetLogo(info.logo);
          } catch { /* ignore */ }
        }
      });
  }, [profile?.cabinet_id]);

  // ── Load cabinet data for LM defaults ──
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("cabinets")
      .select("outil_transmission_defaut, taux_ec, taux_collaborateur, id_sepa, assureur_rc, numero_contrat_rc, adresse_assureur, ville_tribunal, date_cgv")
      .eq("id", profile.cabinet_id)
      .single()
      .then(({ data: cab }) => {
        if (cab) setCabinetData(cab);
      });
  }, [profile?.cabinet_id]);

  // ── Load cabinet tarifs for v3 wizard ──
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("cabinets")
      .select("tarifs_defaut")
      .eq("id", profile.cabinet_id)
      .single()
      .then(({ data: cab }) => {
        if (cab?.tarifs_defaut) setCabinetTarifs(cab.tarifs_defaut as Record<string, number>);
      });
  }, [profile?.cabinet_id]);

  // ── Pre-fill tarifs when cabinet loaded ──
  useEffect(() => {
    if (Object.keys(cabinetTarifs).length === 0) return;
    setData((prev) => ({
      ...prev,
      tarifs_sociaux: {
        prix_bulletin: cabinetTarifs.prix_bulletin || 32,
        prix_fin_contrat: cabinetTarifs.prix_fin_contrat || 30,
        prix_coffre_fort: cabinetTarifs.prix_coffre_fort || 5,
        prix_contrat_simple: cabinetTarifs.prix_contrat_simple || 100,
        prix_entree_salarie: cabinetTarifs.prix_entree_salarie || 30,
        prix_attestation_maladie: cabinetTarifs.prix_attestation_maladie || 30,
        prix_bordereaux: cabinetTarifs.prix_bordereaux || 25,
        prix_sylae: cabinetTarifs.prix_sylae || 15,
      },
      honoraires_juridique: cabinetTarifs.honoraires_juridique_defaut || 300,
      forfait_constitution: cabinetTarifs.forfait_constitution_defaut || 500,
    }));
  }, [cabinetTarifs]);

  // ── Pre-fill LM fields when client is selected (from DB columns not in Client interface) ──
  useEffect(() => {
    if (!data.client_id) return;
    const loadClientDetails = async () => {
      const { data: fc } = await supabase
        .from("clients")
        .select("regime_fiscal, date_cloture_exercice, assujetti_tva, cac, volume_comptable, outil_transmission, capital, domaine, ape, iban_encrypted, bic_encrypted")
        .eq("ref", data.client_id)
        .maybeSingle();
      if (!fc) return;
      const updates: Partial<LMWizardData> = {};
      if (fc.regime_fiscal) updates.regime_fiscal = fc.regime_fiscal;
      if (fc.date_cloture_exercice) { updates.date_cloture_exercice = fc.date_cloture_exercice; (updates as any).date_cloture = fc.date_cloture_exercice; }
      if (fc.assujetti_tva !== null && fc.assujetti_tva !== undefined) { (updates as any).tva_assujetti = fc.assujetti_tva; updates.assujetti_tva = fc.assujetti_tva; }
      if (fc.cac !== null && fc.cac !== undefined) updates.cac = fc.cac;
      if (fc.volume_comptable) updates.volume_comptable = fc.volume_comptable;
      if (fc.outil_transmission) {
        updates.outil_transmission = fc.outil_transmission;
      } else if (cabinetData?.outil_transmission_defaut) {
        updates.outil_transmission = cabinetData.outil_transmission_defaut;
      }
      // Fill capital/ape if not already set by selectClient
      if (fc.capital && !data.capital) updates.capital = String(fc.capital);
      if (fc.ape && !data.ape) updates.ape = fc.ape;
      // Fill IBAN/BIC from encrypted columns
      if (fc.iban_encrypted && !data.iban) updates.iban = fc.iban_encrypted;
      if (fc.bic_encrypted && !data.bic) updates.bic = fc.bic_encrypted;
      if (Object.keys(updates).length > 0) {
        setData((prev) => ({ ...prev, ...updates }));
      }
    };
    loadClientDetails();
  }, [data.client_id, cabinetData]);

  // ── H) Time tracking ──
  useEffect(() => {
    if (!data.started_at) {
      setData((prev) => ({ ...prev, started_at: new Date().toISOString() }));
    }
  }, []);

  // ── Warn on unsaved changes (beforeunload) ──
  useEffect(() => {
    if (!data.client_id) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [data.client_id]);

  // ── Clean up auto-save timer on unmount ──
  useEffect(() => {
    return () => { clearTimeout(saveTimer.current); };
  }, []);

  // ── C7) Ctrl+S keyboard shortcut to save ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (data.client_id) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data.client_id]);

  // ── Step animation + scroll ──
  useEffect(() => {
    prevStepRef.current = step;
    setFieldsVisible(false);
    const t = setTimeout(() => setFieldsVisible(true), 50);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => clearTimeout(t);
  }, [step]);

  // ── sessionStorage draft ──
  useEffect(() => {
    try { sessionStorage.setItem("lm_wizard_draft", JSON.stringify({ ...data, wizard_step: step })); } catch { /* storage full */ }
  }, [data, step]);

  // ── Init: restore draft + load Supabase ──
  useEffect(() => {
    let cancelled = false;
    // If URL has a client ref, pre-fill from that client (skip draft restore)
    if (urlRef && clients.length > 0) {
      const client = clients.find((c) => c.ref === urlRef);
      if (client && !data.client_id) {
        setData((prev) => ({
          ...prev,
          client_id: client.ref,
          client_ref: client.ref,
          raison_sociale: client.raisonSociale,
          siren: client.siren,
          forme_juridique: client.forme,
          dirigeant: client.dirigeant,
          qualite_dirigeant: client.forme === "ENTREPRISE INDIVIDUELLE" ? "Gerant" : "President",
          adresse: client.adresse,
          cp: client.cp,
          ville: client.ville,
          capital: String(client.capital || ""),
          ape: client.ape,
          email: client.mail,
          telephone: client.tel,
          iban: client.iban,
          bic: client.bic,
          type_mission: client.mission?.includes("REVISION") || client.mission?.includes("SURVEILLANCE")
            ? "SURVEILLANCE"
            : "TENUE",
        }));
        loadSavedLetters();
        return () => { cancelled = true; };
      }
    }
    try {
      const raw = sessionStorage.getItem("lm_wizard_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.client_id) {
          setData(parsed);
          if (parsed.wizard_step > 0) {
            setStep(parsed.wizard_step);
            setMaxStepReached(parsed.wizard_step);
          }
        }
      }
    } catch (e) {
      logger.warn("LM", "Failed to restore session draft:", e);
    }
    loadSupabaseDraft(cancelled);
    loadSavedLetters();
    return () => { cancelled = true; };
  }, [urlRef, clients.length]);

  const loadSupabaseDraft = async (cancelled: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;
      const { data: drafts } = await supabase
        .from("lettres_mission")
        .select("id, wizard_data, wizard_step, created_at")
        .eq("status", "brouillon")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (drafts && drafts.length > 0 && drafts[0].wizard_data?.client_id) {
        setDraftInfo(drafts[0] as { id: string; wizard_data: Record<string, unknown>; wizard_step: number });
        setShowDraftBanner(true);
      }
    } catch (e) {
      logger.warn("LM", "Failed to load Supabase draft:", e);
    }
  };

  const resumeDraft = () => {
    if (draftInfo) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...draftInfo.wizard_data });
      setLmId(draftInfo.id);
      const resumeStep = draftInfo.wizard_step || 0;
      setStep(resumeStep);
      setMaxStepReached(resumeStep);
      setShowDraftBanner(false);
      setActiveTab("wizard");
      warningShown.current = false;
      sessionStorage.removeItem("lm_wizard_draft");
    }
  };

  // ── TVA auto (associations) ──
  useEffect(() => {
    if (data.forme_juridique === "ASSOCIATION" || data.forme_juridique === "ASSO") {
      setData((prev) => prev.taux_tva === 0 ? prev : { ...prev, taux_tva: 0 });
    }
  }, [data.forme_juridique]);

  // ── Existing LM warning ──
  const warningShown = useRef(false);
  useEffect(() => {
    if (data.client_id && !warningShown.current && !lmId) {
      warningShown.current = true;
      supabase
        .from("lettres_mission")
        .select("id")
        .eq("client_ref", data.client_id)
        .not("status", "eq", "archivee")
        .then(({ data: existing }) => {
          if (existing && existing.length > 0) {
            toast.warning("Ce client a deja une lettre de mission active");
          }
        })
        .catch((e) => logger.warn("LM", "Existing LM check failed:", e));
    }
  }, [data.client_id, lmId]);

  // ── Auto-save debounce 5s (silent — no toast) ──
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lmIdRef = useRef(lmId);
  lmIdRef.current = lmId;
  const profileCabinetRef = useRef(profile?.cabinet_id);
  profileCabinetRef.current = profile?.cabinet_id;

  const saveToSupabase = useCallback(async (currentData: LMWizardData, currentStep: number) => {
    if (!currentData.client_id) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return;
      const payload: Record<string, unknown> = {
        wizard_data: currentData,
        wizard_step: currentStep,
        client_ref: currentData.client_ref || null,
        raison_sociale: currentData.raison_sociale || null,
        type_mission: currentData.type_mission || null,
        updated_at: new Date().toISOString(),
        collaborateur_principal_id: currentData.collaborateur_principal_id || null,
        superviseur_id: (currentData.superviseur_id && currentData.superviseur_id !== "__none__") ? currentData.superviseur_id : null,
        intervenants: { liste: currentData.intervenants_liste || [] },
      };
      let saved = false;
      if (lmIdRef.current) {
        const { error: updErr } = await supabase.from("lettres_mission").update(payload).eq("id", lmIdRef.current);
        if (updErr) console.error("LM auto-save update failed:", updErr.message, updErr.details, updErr.hint);
        else saved = true;
      } else {
        const cabId = profileCabinetRef.current;
        if (!cabId) return;
        const { data: ins, error: insErr } = await supabase
          .from("lettres_mission")
          .insert({
            user_id: sessionData.session.user.id,
            cabinet_id: cabId,
            client_ref: currentData.client_ref || null,
            raison_sociale: currentData.raison_sociale || null,
            type_mission: currentData.type_mission || null,
            status: "brouillon",
            wizard_data: currentData,
            wizard_step: currentStep,
            numero: incrementCounter(),
            collaborateur_principal_id: currentData.collaborateur_principal_id || null,
            superviseur_id: (currentData.superviseur_id && currentData.superviseur_id !== "__none__") ? currentData.superviseur_id : null,
            intervenants: { liste: currentData.intervenants_liste || [] },
          })
          .select("id")
          .maybeSingle();
        if (insErr) console.error("LM auto-save insert failed:", insErr.message, insErr.details, insErr.hint);
        if (ins) { setLmId(ins.id); saved = true; }
      }
      if (saved) setLastSaved(new Date());
    } catch (e) {
      console.error("LM auto-save failed:", e);
    }
  }, []);

  // Trigger auto-save on data change (debounced 5s, silent)
  useEffect(() => {
    if (!data.client_id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase(data, step), 5000);
    return () => clearTimeout(saveTimer.current);
  }, [data, step, saveToSupabase]);

  const loadSavedLetters = async () => {
    setHistoryLoading(true);
    try {
      const { data: rows } = await supabase
        .from("lettres_mission")
        .select("id, numero, client_ref, raison_sociale, type_mission, status, created_at, updated_at, wizard_data, collaborateur_principal_id")
        .order("updated_at", { ascending: false });
      if (rows) {
        setSavedLetters(
          rows.map((r: any, i: number) => ({
            id: r.id,
            numero: r.numero || `LM-${new Date(r.created_at).getFullYear()}-${String(i + 1).padStart(3, "0")}`,
            client_ref: r.client_ref || "",
            raison_sociale: r.raison_sociale || r.wizard_data?.raison_sociale || "—",
            type_mission: r.type_mission || r.wizard_data?.type_mission || "—",
            status: r.status || "brouillon",
            created_at: r.created_at,
            updated_at: r.updated_at,
            wizard_data: r.wizard_data || {},
            duration_seconds: r.wizard_data?.duration_seconds || 0,
            honoraires_ht: r.wizard_data?.honoraires_ht || 0,
            missions_count: r.wizard_data?.missions_selected?.filter((m: any) => m.selected)?.length || 0,
          }))
        );
      }
    } catch (e) {
      console.error("LM", "Failed to load letters:", e);
      toast.error("Erreur lors du chargement des lettres");
    }
    setHistoryLoading(false);
  };

  const loadAvenants = async (letterIds: string[]) => {
    if (letterIds.length === 0) return;
    try {
      const { data: rows } = await supabase
        .from("lm_avenants")
        .select("*")
        .in("instance_id", letterIds)
        .order("created_at", { ascending: true });
      if (rows) {
        const grouped: Record<string, LMAvenant[]> = {};
        for (const r of rows) {
          const key = (r as any).instance_id;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(r as unknown as LMAvenant);
        }
        setAvenantsByLetter(grouped);
      }
    } catch (e) {
      logger.warn("LM", "Failed to load avenants:", e);
    }
  };

  // Load avenants when letters change
  useEffect(() => {
    const signedOrSent = savedLetters
      .filter((l) => l.status === "signee" || l.status === "envoyee")
      .map((l) => l.id);
    loadAvenants(signedOrSent);
  }, [savedLetters]);

  const handleCreateAvenant = (letter: SavedLetter) => {
    const instance: LMInstance = {
      id: letter.id,
      cabinet_id: profile?.cabinet_id || "",
      modele_id: "",
      client_ref: letter.client_ref,
      numero: letter.numero,
      status: letter.status as LMInstance["status"],
      sections_snapshot: [],
      cgv_snapshot: "",
      repartition_snapshot: [],
      variables_resolved: {
        raison_sociale: letter.raison_sociale,
        honoraires: String(letter.wizard_data?.honoraires_ht ?? letter.honoraires_ht ?? "0"),
      },
      wizard_data: letter.wizard_data as Record<string, unknown>,
      created_at: letter.created_at,
      updated_at: letter.updated_at,
    };
    setAvenantTargetInstance(instance);
    setAvenantDialogOpen(true);
  };

  const handleAvenantCreated = async (avenant: LMAvenant) => {
    // Reload avenants
    const signedOrSent = savedLetters
      .filter((l) => l.status === "signee" || l.status === "envoyee")
      .map((l) => l.id);
    await loadAvenants(signedOrSent);
  };

  // ── Handlers ──
  const handleChange = useCallback((updates: Partial<LMWizardData>) => {
    setData((prev) => {
      const merged = { ...prev, ...updates };

      // Auto-detect client type + smart defaults when client_id changes
      if (updates.client_id && updates.client_id !== prev.client_id && updates.forme_juridique) {
        const { recommended } = recommendClientType(updates.forme_juridique);
        if (recommended) {
          const config = getClientTypeConfig(recommended);
          if (config) {
            merged.client_type_id = recommended;
            merged.mission_type_id = config.defaultMissionType;
            if (config.defaultModeComptable) {
              merged.type_mission = config.defaultModeComptable;
            } else if (!merged.type_mission || !["TENUE", "SURVEILLANCE", "REVISION"].includes(merged.type_mission)) {
              merged.type_mission = "TENUE";
            }

            // Auto-detect regime_benefices from APE
            if (merged.ape) {
              merged.regime_benefices = detectRegimeBenefices(merged.ape) || undefined;
            }

            // Find the selected client for smart defaults
            const selectedClient = clients.find((c) => c.ref === updates.client_id);
            if (selectedClient) {
              const smartDefaults = generateSmartDefaults(recommended, selectedClient, merged);
              Object.assign(merged, smartDefaults);

              // Smart mission pre-selection
              const missions = getMissionsForClientType(recommended);
              merged.missions_selected = getSmartMissionSelections(recommended, selectedClient, missions, merged);
            }
          }
        }
      }

      return merged;
    });
  }, [clients]);

  const goToStep = useCallback((s: number) => {
    if (s >= 0 && s < LM_TOTAL_STEPS) setStep(s);
  }, []);

  const isStepValid = useCallback((stepIdx: number): boolean => {
    const validator = VALIDATORS[stepIdx];
    if (!validator) return true;
    return validator(data).length === 0;
  }, [data]);

  const handleNext = useCallback(() => {
    const validator = VALIDATORS[step];
    if (validator) {
      const errors = validator(data);
      if (errors.length > 0) {
        toast.error(errors.map((e) => e.message).join(" · "));
        // Scroll to first error field
        const firstField = errors[0]?.field;
        if (firstField) {
          const el = document.getElementById(`field-${firstField}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }
    setStep((prev) => {
      const next = Math.min(prev + 1, LM_TOTAL_STEPS - 1);
      setMaxStepReached((m) => Math.max(m, next));
      return next;
    });
  }, [step, data]);

  const handlePrevious = useCallback(() => {
    setStep(prev => Math.max(0, prev - 1));
  }, []);

  // Swipe
  const handleTouchStart = (e: React.TouchEvent) => { if (e.targetTouches.length > 0) touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 0) return;
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 75) { diff > 0 ? handleNext() : handlePrevious(); }
  };

  // ── H) Compute duration on final save ──
  const handleSave = async () => {
   if (saving) return;
   clearTimeout(saveTimer.current);
   setSaving(true);
   try {
    // Compute duration
    let duration = 0;
    if (data.started_at) {
      duration = Math.round((Date.now() - new Date(data.started_at).getTime()) / 1000);
    }
    const finalData = { ...data, duration_seconds: duration };

    const sanitized = sanitizeWizardData(finalData);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) { toast.error("Session expirée. Reconnectez-vous."); return; }
    const effectiveStatus = sanitized.statut || "brouillon";
    const payload: Record<string, unknown> = {
      client_ref: sanitized.client_ref,
      raison_sociale: sanitized.raison_sociale,
      type_mission: sanitized.type_mission,
      status: effectiveStatus,
      wizard_data: sanitized,
      wizard_step: step,
      numero: sanitized.numero_lettre || incrementCounter(),
      collaborateur_principal_id: sanitized.collaborateur_principal_id || null,
      superviseur_id: (sanitized.superviseur_id && sanitized.superviseur_id !== "__none__") ? sanitized.superviseur_id : null,
      intervenants: { liste: sanitized.intervenants_liste || [] },
    };
    if (lmIdRef.current) {
      const { error } = await supabase.from("lettres_mission").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", lmIdRef.current);
      if (error) throw error;
    } else {
      if (!profile?.cabinet_id) {
        toast.error("Impossible de sauvegarder : profil non initialisé. Reconnectez-vous.");
        return;
      }
      const { data: ins, error } = await supabase.from("lettres_mission").insert({ ...payload, user_id: authData?.user?.id, cabinet_id: profile.cabinet_id }).select("id").maybeSingle();
      if (error) throw error;
      if (ins) setLmId(ins.id);
    }
    toast.success("Lettre de mission sauvegardée !");
    setData(finalData);
    logAudit({
      action: "LETTRE_MISSION_SAVE",
      table_name: "lettres_mission",
      record_id: lmIdRef.current || undefined,
      new_data: { client_ref: sanitized.client_ref, type: sanitized.type_mission, status: effectiveStatus, duration_seconds: duration },
    }).catch((e) => logger.warn("LM", "Audit log failed:", e));
    sessionStorage.removeItem("lm_wizard_draft");
    setLastSaved(new Date());
    await loadSavedLetters();
   } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
    console.error("LM save failed:", err);
    toast.error("Erreur de sauvegarde : " + msg);
   } finally {
    setSaving(false);
   }
  };

  const handleReset = () => {
    if (data.client_id && !window.confirm("Réinitialiser le formulaire ? Les modifications non sauvegardées seront perdues.")) return;
    setData({ ...INITIAL_LM_WIZARD_DATA, started_at: new Date().toISOString() });
    setLmId(null);
    setStep(0);
    setMaxStepReached(0);
    warningShown.current = false;
    sessionStorage.removeItem("lm_wizard_draft");
  };

  const handleEditLetter = (letter: SavedLetter) => {
    if (letter.wizard_data) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data });
      setLmId(letter.id);
      const editStep = letter.wizard_data?.wizard_step || 0;
      setStep(editStep);
      setMaxStepReached(editStep);
      setActiveTab("wizard");
      warningShown.current = false;
    }
  };

  // G) Duplicate
  const handleDuplicate = async (letter: SavedLetter) => {
    if (!letter.wizard_data) return;
    const newData = {
      ...INITIAL_LM_WIZARD_DATA,
      ...letter.wizard_data,
      statut: "brouillon",
      numero_lettre: incrementCounter(),
      signature_expert: "",
      signature_client: "",
      date_signature: "",
      started_at: new Date().toISOString(),
      duration_seconds: 0,
    };
    setData(newData);
    setLmId(null);
    setStep(0);
    setMaxStepReached(0);
    setActiveTab("wizard");
    setTimeout(() => saveToSupabase(newData, 0), 100);
    toast.success("Lettre dupliquee — modifiez et sauvegardez");
  };

  // G) Archive
  const handleArchive = async (letter: SavedLetter) => {
    if (!window.confirm("Archiver cette lettre de mission ?")) return;
    try {
      const { error } = await supabase.from("lettres_mission").update({ status: "archivee", updated_at: new Date().toISOString() }).eq("id", letter.id);
      if (error) throw error;
      logAudit({ action: "LETTRE_MISSION_ARCHIVE", table_name: "lettres_mission", record_id: letter.id, new_data: { status: "archivee" } }).catch(() => {});
      toast.success("Lettre archivee");
      await loadSavedLetters();
    } catch (e: unknown) {
      toast.error("Erreur lors de l'archivage : " + (e instanceof Error ? e.message : "Erreur inconnue"));
    }
  };

  // G) Delete (brouillon + archivee only)
  const handleDelete = async (letter: SavedLetter) => {
    if (!["brouillon", "archivee"].includes(letter.status)) {
      toast.error("Seuls les brouillons et lettres archivees peuvent etre supprimes");
      return;
    }
    const confirmed = window.confirm(
      `Etes-vous sur de vouloir supprimer definitivement la lettre ${letter.numero} ?\n\nCette action est irreversible.`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("lettres_mission").delete().eq("id", letter.id);
      if (error) throw error;
      logAudit({ action: "LETTRE_MISSION_DELETE", table_name: "lettres_mission", record_id: letter.id, new_data: { deleted: true, numero: letter.numero } }).catch(() => {});
      toast.success("Lettre supprimee definitivement");
      setSavedLetters((prev) => prev.filter((l) => l.id !== letter.id));
      sessionStorage.removeItem("lm_wizard_draft");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  // ── Bulk operations ──
  const handleBulkDelete = async (ids: string[]) => {
    const deletable = savedLetters.filter(l => ids.includes(l.id) && ["brouillon", "archivee"].includes(l.status));
    if (deletable.length === 0) { toast.error("Aucune lettre supprimable dans la selection"); return; }
    const confirmed = window.confirm(`Supprimer definitivement ${deletable.length} lettre${deletable.length > 1 ? "s" : ""} ?\n\nCette action est irreversible.`);
    if (!confirmed) return;
    let count = 0;
    for (const l of deletable) {
      try {
        const { error } = await supabase.from("lettres_mission").delete().eq("id", l.id);
        if (!error) count++;
      } catch { /* continue */ }
    }
    logAudit({ action: "LETTRE_MISSION_BULK_DELETE", table_name: "lettres_mission", new_data: { count, ids: deletable.map(l => l.id) } }).catch(() => {});
    toast.success(`${count} lettre${count > 1 ? "s" : ""} supprimee${count > 1 ? "s" : ""}`);
    await loadSavedLetters();
  };

  const handleBulkArchive = async (ids: string[]) => {
    const confirmed = window.confirm(`Archiver ${ids.length} lettre${ids.length > 1 ? "s" : ""} ?`);
    if (!confirmed) return;
    let count = 0;
    for (const id of ids) {
      try {
        const { error } = await supabase.from("lettres_mission").update({ status: "archivee", updated_at: new Date().toISOString() }).eq("id", id);
        if (!error) count++;
      } catch { /* continue */ }
    }
    logAudit({ action: "LETTRE_MISSION_BULK_ARCHIVE", table_name: "lettres_mission", new_data: { count, ids } }).catch(() => {});
    toast.success(`${count} lettre${count > 1 ? "s" : ""} archivee${count > 1 ? "s" : ""}`);
    await loadSavedLetters();
  };

  const handleBulkStatusChange = async (ids: string[], newStatus: string) => {
    const confirmed = window.confirm(`Changer le statut de ${ids.length} lettre${ids.length > 1 ? "s" : ""} vers "${newStatus}" ?`);
    if (!confirmed) return;
    let count = 0;
    for (const id of ids) {
      try {
        const { error } = await supabase.from("lettres_mission").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
        if (!error) count++;
      } catch { /* continue */ }
    }
    logAudit({ action: "LETTRE_MISSION_BULK_STATUS", table_name: "lettres_mission", new_data: { count, ids, newStatus } }).catch(() => {});
    toast.success(`${count} lettre${count > 1 ? "s" : ""} mise${count > 1 ? "s" : ""} a jour`);
    await loadSavedLetters();
  };

  const handleBulkDuplicate = async (letters: SavedLetter[]) => {
    let count = 0;
    for (const letter of letters) {
      if (!letter.wizard_data) continue;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user || !profile?.cabinet_id) continue;
        const newWd = { ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data, statut: "brouillon", numero_lettre: incrementCounter(), signature_expert: "", signature_client: "", date_signature: "", started_at: new Date().toISOString(), duration_seconds: 0 };
        await supabase.from("lettres_mission").insert({
          user_id: sessionData.session.user.id, cabinet_id: profile.cabinet_id,
          client_ref: newWd.client_ref || null, raison_sociale: newWd.raison_sociale || null,
          type_mission: newWd.type_mission || null, status: "brouillon",
          wizard_data: newWd, wizard_step: 0, numero: newWd.numero_lettre,
        });
        count++;
      } catch { /* continue */ }
    }
    toast.success(`${count} lettre${count > 1 ? "s" : ""} dupliquee${count > 1 ? "s" : ""}`);
    await loadSavedLetters();
  };

  // G) Download PDF — core function (throws on error for bulk usage)
  const downloadPdfCore = async (letter: SavedLetter): Promise<void> => {
    if (!letter.wizard_data) throw new Error("Pas de donnees pour cette lettre");
    const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
    const wd = letter.wizard_data;
    const client = buildClientFromWizardData(wd as LMWizardData);
    await renderLettreMissionPdf({
      numero: letter.numero, date: formatDateFr(letter.created_at),
      client,
      cabinet: cabinetInfo,
      options: {
        genre: "M" as const,
        missionSociale: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "social" && m.selected),
        missionJuridique: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "juridique" && m.selected),
        missionControleFiscal: wd.missions_selected?.some((m: Record<string, unknown>) => m.section_id === "fiscal" && m.selected),
        regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
        tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
        periodicite: wd.frequence_facturation,
      },
    });
  };

  // Single PDF download (shows toast, safe for row-level actions)
  const handleDownloadPdf = async (letter: SavedLetter) => {
    try {
      await downloadPdfCore(letter);
      toast.success("PDF genere");
    } catch (e: any) {
      toast.error(e?.message || "Erreur PDF");
    }
  };

  // Bulk PDF download (per-item error handling, shows summary)
  const handleBulkDownloadPdf = async (letters: SavedLetter[]) => {
    let ok = 0;
    let fail = 0;
    for (const letter of letters) {
      try {
        await downloadPdfCore(letter);
        ok++;
      } catch {
        fail++;
      }
    }
    if (ok > 0) toast.success(`${ok} PDF genere${ok > 1 ? "s" : ""}`);
    if (fail > 0) toast.error(`${fail} PDF en erreur sur ${letters.length}`);
  };

  // Express mode removed (3-step wizard is already express)

  // Keyboard: Escape → prev
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (activeTab !== "wizard") return;
      if (e.key === "Escape" && step > 0) { if (document.querySelector('[data-state="open"]')) return; e.preventDefault(); setStep(step - 1); }
      if (e.key === "Enter" && e.ctrlKey && step < LM_TOTAL_STEPS - 1) { e.preventDefault(); handleNext(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [step, activeTab, handleNext]);

  // ── V3: Generate DOCX via edge function ──
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Session expirée"); return; }
      const missionsComp: string[] = [];
      if (data.mission_sociale) missionsComp.push("sociale");
      if (data.mission_juridique) missionsComp.push("juridique");
      if (data.mission_controle_fiscal) missionsComp.push("controle_fiscal");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: data.client_id,
            volume_comptable: data.volume_comptable,
            outil_transmission: data.outil_transmission,
            frequence_facturation: data.frequence_facturation,
            missions_complementaires: missionsComp,
            option_controle_fiscal: data.option_controle_fiscal,
            regime_fiscal: data.regime_fiscal,
            date_cloture_exercice: data.date_cloture_exercice,
            assujetti_tva: data.assujetti_tva,
            cac: data.cac,
            iban: data.iban,
            bic: data.bic,
            honoraires: {
              annuel: `${data.honoraires_annuels} €`,
              setup: data.forfait_constitution ? `${data.forfait_constitution} €` : "",
              juridique: data.honoraires_juridique ? `${data.honoraires_juridique} €` : "",
              bulletin: `${data.tarifs_sociaux.prix_bulletin} € HT`,
              fin_contrat: `${data.tarifs_sociaux.prix_fin_contrat} € HT`,
              coffre_fort: `${data.tarifs_sociaux.prix_coffre_fort} € HT`,
              contrat_simple: `${data.tarifs_sociaux.prix_contrat_simple} € HT`,
              entree_salarie: `${data.tarifs_sociaux.prix_entree_salarie} € HT`,
              attestation: `${data.tarifs_sociaux.prix_attestation_maladie} € HT`,
              bordereaux: `${data.tarifs_sociaux.prix_bordereaux} € HT / mois`,
              sylae: `${data.tarifs_sociaux.prix_sylae} € HT / salarié`,
            },
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try { const j = JSON.parse(errText); errMsg = j.error || errText; } catch {}
        throw new Error(errMsg);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LDM_${data.numero_lettre || "DRAFT"}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Lettre de mission générée !");
      // Also save to DB
      await handleSave();
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || "Erreur de génération"));
    } finally {
      setGenerating(false);
    }
  }, [data, profile?.cabinet_id]);

  // Step render (3 steps v3)
  const renderStep = () => {
    switch (step) {
      case 0: return <LMNewStep1 data={data} onChange={handleChange} />;
      case 1: return <LMNewStep2 data={data} onChange={handleChange} cabinetTarifs={cabinetTarifs} errors={currentErrors} />;
      case 2: return <LMNewStep3 data={data} onGenerate={handleGenerate} onSave={handleSave} onGoToStep={goToStep} generating={generating} />;
      default: return null;
    }
  };

  // Compute validation errors for current step (for inline display)
  const currentErrors = useMemo(() => {
    const validator = VALIDATORS[step];
    return validator ? validator(data) : [];
  }, [step, data]);
  const nextDisabled = currentErrors.length > 0;

  if (!canWrite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in-up">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-slate-900 dark:text-white font-medium">Acces refuse</p>
        <p className="text-slate-400 dark:text-slate-400 text-sm text-center px-4">Vous n'avez pas les permissions pour creer une lettre de mission.</p>
        <Button variant="outline" onClick={() => navigate("/bdd")} className="border-gray-200 dark:border-white/[0.06]">Retour</Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Lettres de mission</h1>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1">Creez et gerez vos lettres de mission{savedLetters.length > 0 ? ` · ${savedLetters.length} lettre${savedLetters.length > 1 ? "s" : ""}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleReset} className="gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm shadow-blue-500/15" size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4" /> {!isMobile && "Nouvelle"}
          </Button>
        </div>
      </div>

      {/* F) Renewal alerts */}
      <RenewalAlerts letters={savedLetters} />

      {/* Draft resume banner */}
      {showDraftBanner && draftInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-500/10 dark:to-indigo-500/5 border border-blue-200/60 dark:border-blue-500/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-fade-in-up">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-300">Reprendre le brouillon</p>
            <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
              {draftInfo.wizard_data?.raison_sociale || "Sans nom"} — Etape {(draftInfo.wizard_step || 0) + 1}/{LM_TOTAL_STEPS}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={resumeDraft} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm">Reprendre</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDraftBanner(false)} className="text-slate-400 dark:text-slate-400">Nouveau</Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] w-full sm:w-auto">
          <TabsTrigger value="wizard" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FileText className="w-3.5 h-3.5" /> {isMobile ? "Nouvelle" : "Nouvelle lettre"}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <FolderOpen className="w-3.5 h-3.5" /> Mes lettres
            {savedLetters.length > 0 && (
              <Badge className="ml-1 bg-gray-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-400 text-[10px] px-1.5">{savedLetters.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="modeles" className="gap-1.5 flex-1 sm:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
            <Settings2 className="w-3.5 h-3.5" /> {isMobile ? "Modeles" : "Modeles"}
          </TabsTrigger>
        </TabsList>

        {/* ─── WIZARD TAB ─── */}
        <TabsContent value="wizard" className="mt-4 space-y-4">
          {/* Progress bar */}
          <LMProgressBar
            currentStep={step}
            onStepClick={(s) => { if (s <= maxStepReached) goToStep(s); }}
            maxClickable={maxStepReached}
            missionCategory={getMissionCategory(data.mission_type_id || 'presentation')}
          />

          {/* Step title + H) elapsed time */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{LM_STEP_TITLES[step]}</h2>
            <div className="flex items-center gap-3">
              {data.started_at && (
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> <ElapsedTimer startedAt={data.started_at} />
                </span>
              )}
              {lastSaved && (
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          {/* ── 2-column layout ── */}
          <div className={`${!isMobile ? "flex gap-6" : ""}`}>
            {/* Left: form */}
            <div className={`${!isMobile ? "flex-[3] min-w-0" : "w-full"}`}>
              <div
                className={`wizard-card p-4 sm:p-6 transition-all duration-300 ease-out ${
                  isMobile ? "pb-32" : ""
                } ${
                  fieldsVisible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-2 scale-[0.998]"
                }`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {renderStep()}
              </div>
            </div>

            {/* Right: summary panel (desktop only) */}
            {!isMobile && (
              <div className="flex-[2] min-w-[260px] max-w-[360px]">
                <div className="wizard-card p-5">
                  <LMSummaryPanel data={data} cabinetLogo={cabinetLogo} />
                </div>
              </div>
            )}
          </div>

          {/* ── Navigation ── */}
          {isMobile ? (
            <>
              {/* Mobile: compact summary band */}
              <div className="fixed bottom-[52px] left-0 right-0 z-40">
                <LMSummaryPanel data={data} compact />
              </div>
              {/* Mobile: sticky bottom nav */}
              <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-white/[0.06] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.2)] p-3 pb-safe flex items-center justify-between z-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={step === 0}
                  className="gap-1 border-gray-200 dark:border-white/[0.06]"
                >
                  <ChevronLeft className="w-4 h-4" /> Prec.
                </Button>
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums font-medium">{step + 1}/{LM_TOTAL_STEPS}</span>
                {step < LM_TOTAL_STEPS - 1 ? (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className={`gap-1 wizard-nav-btn text-white shadow-sm shadow-blue-500/20 ${nextDisabled ? "bg-gradient-to-r from-blue-400 to-blue-500 opacity-80" : "bg-gradient-to-r from-blue-500 to-blue-600"}`}
                  >
                    Suivant <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="w-20" />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={step === 0}
                className="gap-1.5 wizard-nav-btn border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              >
                <ChevronLeft className="w-4 h-4" /> Precedent
              </Button>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                Etape {step + 1} / {LM_TOTAL_STEPS}
                <span className="ml-2 text-[9px] text-slate-600">
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-500 font-mono text-[8px]">Esc</kbd> prec.
                  {" · "}
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-500 font-mono text-[8px]">Ctrl+⏎</kbd> suiv.
                </span>
              </span>
              {step < LM_TOTAL_STEPS - 1 ? (
                <Button
                  onClick={handleNext}
                  className={`gap-1.5 wizard-nav-btn text-white shadow-md shadow-blue-500/20 ${nextDisabled ? "bg-gradient-to-r from-blue-400 to-blue-500 opacity-80 hover:opacity-100" : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"}`}
                >
                  {nextDisabled && currentErrors.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center -ml-1">{currentErrors.length}</span>
                  )}
                  Suivant <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div />
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── MES LETTRES TAB ─── */}
        <TabsContent value="history" className="mt-4">
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-6">
            <LetterHistory
              letters={savedLetters}
              loading={historyLoading}
              onEdit={handleEditLetter}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onDownloadPdf={handleDownloadPdf}
              onCreateAvenant={handleCreateAvenant}
              onBulkDelete={handleBulkDelete}
              onBulkArchive={handleBulkArchive}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkDuplicate={handleBulkDuplicate}
              onBulkDownloadPdf={handleBulkDownloadPdf}
              avenantsByLetter={avenantsByLetter}
              cabinetId={profile?.cabinet_id}
            />
          </div>
        </TabsContent>

        {/* ─── MODELES TAB ─── */}
        <TabsContent value="modeles" className="mt-4">
          {profile?.cabinet_id ? (
            <ModeleListPage
              cabinetId={profile.cabinet_id}
              onBack={() => setActiveTab("wizard")}
            />
          ) : (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm">
              Profil non initialisé. Reconnectez-vous.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Avenant Dialog */}
      {avenantTargetInstance && (
        <AvenantDialog
          open={avenantDialogOpen}
          onOpenChange={setAvenantDialogOpen}
          instance={avenantTargetInstance}
          onCreated={handleAvenantCreated}
        />
      )}
    </div>
  );
}
