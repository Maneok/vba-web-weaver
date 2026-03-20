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

import LMStep1Client from "@/components/lettre-mission/LMStep1Client";
import LMStep2MissionType from "@/components/lettre-mission/LMStep2MissionType";
import LMStep2Missions from "@/components/lettre-mission/LMStep2Missions";
import LMStep4Modele from "@/components/lettre-mission/LMStep4Modele";
import LMStep4Honoraires from "@/components/lettre-mission/LMStep4Honoraires";
import LMStep6Clauses from "@/components/lettre-mission/LMStep6Clauses";
import LMStep5Preview from "@/components/lettre-mission/LMStep5Preview";
import LMStep6Export from "@/components/lettre-mission/LMStep6Export";
import LMProgressBar from "@/components/lettre-mission/LMProgressBar";
import LMSummaryPanel from "@/components/lettre-mission/LMSummaryPanel";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, FileText, FolderOpen, Plus,
  Loader2, ShieldAlert, Edit3, Save, Zap, Copy, Archive,
  FileDown, Search, Clock, AlertTriangle, Filter, Settings2,
  FilePlus2, Send, Link, Check,
} from "lucide-react";
import ModeleListPage from "@/components/lettre-mission/ModeleListPage";
import LMStatusBadge from "@/components/lettre-mission/LMStatusBadge";
import LMAlertesList from "@/components/lettre-mission/LMAlertesList";
import { runAllChecks } from "@/lib/lettreMissionWorkflow";
import AvenantDialog from "@/components/lettre-mission/AvenantDialog";
import type { LMInstance } from "@/lib/lettreMissionEngine";
import { getAvenants, type LMAvenant } from "@/lib/lettreMissionAvenants";
import { MISSION_TYPES, getMissionCategory, getCategoryColorClasses } from "@/lib/lettreMissionTypes";
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
// G) "Mes lettres" with filters, status pills, search, alertes bandeau
// ─────────────────────────────────────────
const PAGE_SIZE = 20;

// ── Status pills config (module-level for stable reference) ──
const STATUS_PILLS = [
  { value: "all", label: "Tous", color: "bg-gray-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-gray-300 dark:border-white/[0.08]" },
  { value: "brouillon", label: "Brouillons", color: "bg-slate-500/10 text-slate-400 dark:text-slate-400 border-slate-500/20" },
  { value: "envoyee", label: "Envoyees", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "signee", label: "Signees", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "resiliee", label: "Resiliees", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "archivee", label: "Archivees", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
];

// ── EUR formatter (module-level to avoid re-creating on each render) ──
const eurFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const formatEurCompact = (n: number) => eurFormatter.format(n);

const LetterHistory = React.memo(function LetterHistory({
  letters,
  loading,
  onEdit,
  onDuplicate,
  onArchive,
  onDownloadPdf,
  onCreateAvenant,
  avenantsByLetter,
  cabinetId,
}: {
  letters: SavedLetter[];
  loading: boolean;
  onEdit: (letter: SavedLetter) => void;
  onDuplicate: (letter: SavedLetter) => void;
  onArchive: (letter: SavedLetter) => void;
  onDownloadPdf: (letter: SavedLetter) => void;
  onCreateAvenant: (letter: SavedLetter) => void;
  avenantsByLetter: Record<string, LMAvenant[]>;
  cabinetId?: string;
}) {
  const [searchQ, setSearchQ] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "client" | "status">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  // Signature state
  const [signTarget, setSignTarget] = useState<SavedLetter | null>(null);
  const [signEmail, setSignEmail] = useState("");
  const [signClientNom, setSignClientNom] = useState("");
  const [signLoading, setSignLoading] = useState(false);
  const [signUrl, setSignUrl] = useState("");

  const handleSendForSignature = async () => {
    if (!signTarget || !signEmail.trim()) return;
    setSignLoading(true);
    try {
      const result = await sendForSignature(signTarget.id, signEmail.trim(), signClientNom.trim() || signTarget.raison_sociale);
      setSignUrl(result.signatureUrl);
      toast.success("Lien de signature genere");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation du lien");
    } finally {
      setSignLoading(false);
    }
  };

  const openSignDialog = (letter: SavedLetter) => {
    setSignTarget(letter);
    setSignEmail(letter.wizard_data?.email || "");
    setSignClientNom(letter.wizard_data?.dirigeant || letter.raison_sociale || "");
    setSignUrl("");
    setSignLoading(false);
  };

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: letters.length };
    for (const l of letters) {
      const s = l.status || "brouillon";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [letters]);

  // Total honoraires
  const totalHonoraires = useMemo(() => {
    return letters
      .filter((l) => l.status === "signee" || l.status === "envoyee")
      .reduce((sum, l) => sum + (l.honoraires_ht || 0), 0);
  }, [letters]);

  const filtered = useMemo(() => {
    let result = [...letters];

    // Filter by statut
    if (filterStatut !== "all") {
      result = result.filter((l) => l.status === filterStatut);
    }

    // Filter by mission type
    if (filterType !== "all") {
      result = result.filter((l) => {
        const wd = l.wizard_data;
        const missionTypeId = wd?.mission_type_id || l.type_mission || "";
        return missionTypeId === filterType || (l.type_mission || "").toLowerCase() === filterType.toLowerCase();
      });
    }

    // Search by client name or LM number
    if (searchQ.length >= 2) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        (l) =>
          l.raison_sociale.toLowerCase().includes(q) ||
          l.numero.toLowerCase().includes(q) ||
          l.client_ref.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sortBy === "client") cmp = a.raison_sociale.localeCompare(b.raison_sociale);
      else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [letters, filterStatut, filterType, searchQ, sortBy, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterStatut, filterType, searchQ]);

  // Get mission shortLabel for a type_mission string
  const getMissionLabel = (letter: SavedLetter) => {
    const missionTypeId = letter.wizard_data?.mission_type_id || letter.type_mission || "";
    const entry = Object.values(MISSION_TYPES).find(
      (m) => m.id === missionTypeId || m.shortLabel === missionTypeId || m.label === missionTypeId
    );
    return entry ? entry.shortLabel : letter.type_mission;
  };

  const getMissionNorme = (letter: SavedLetter) => {
    const missionTypeId = letter.wizard_data?.mission_type_id || letter.type_mission || "";
    const entry = Object.values(MISSION_TYPES).find(
      (m) => m.id === missionTypeId || m.shortLabel === missionTypeId || m.label === missionTypeId
    );
    return entry?.normeRef || "";
  };

  const getLetterCategoryColors = (letter: SavedLetter) => {
    const missionTypeId = letter.wizard_data?.mission_type_id || letter.type_mission || "";
    const entry = Object.values(MISSION_TYPES).find(
      (m) => m.id === missionTypeId || m.shortLabel === missionTypeId || m.label === missionTypeId
    );
    const cat = entry ? getMissionCategory(entry.id) : null;
    return cat ? getCategoryColorClasses(cat) : null;
  };

  const toggleSort = (col: "date" | "client" | "status") => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Chargement des lettres de mission">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-400 dark:text-slate-400 text-sm">Chargement...</span>
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <p className="text-slate-900 dark:text-white font-medium">Aucune lettre de mission</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Commencez par creer votre premiere lettre dans l'onglet "Nouvelle lettre"</p>
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~5 min par lettre</span>
          <span className="w-px h-3 bg-gray-100 dark:bg-white/[0.06]" />
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF + DOCX</span>
          <span className="w-px h-3 bg-gray-100 dark:bg-white/[0.06]" />
          <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Signature electronique</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact alertes bandeau */}
      {cabinetId && (
        <LMAlertesList
          cabinetId={cabinetId}
          compact
          onNavigateToLM={(instanceId) => {
            const letter = letters.find((l) => l.id === instanceId);
            if (letter) onEdit(letter);
          }}
        />
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_PILLS.map((pill) => {
          const count = statusCounts[pill.value] || 0;
          if (pill.value !== "all" && count === 0) return null;
          const isActive = filterStatut === pill.value;
          return (
            <button
              key={pill.value}
              onClick={() => setFilterStatut(pill.value)}
              aria-pressed={filterStatut === pill.value}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                isActive
                  ? `${pill.color} ring-1 ring-white/10`
                  : "bg-white dark:bg-white/[0.02] text-slate-400 dark:text-slate-500 border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.04]"
              }`}
            >
              {pill.label}
              <span className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-600"}`}>
                {pill.value === "all" ? letters.length : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Type filter + Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Rechercher par client ou n° LM..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            aria-label="Rechercher par client ou numero de lettre"
            className="pl-9 h-9 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white text-xs"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[200px] h-9 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300">
            <Filter className="w-3 h-3 mr-1.5 text-slate-400 dark:text-slate-500" />
            <SelectValue placeholder="Type de mission" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {MISSION_TYPE_OPTIONS.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count + total honoraires */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-600">{filtered.length} lettre{filtered.length > 1 ? "s" : ""}</p>
        {totalHonoraires > 0 && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Total honoraires actifs : <span className="text-slate-900 dark:text-white font-medium">{formatEurCompact(totalHonoraires)}</span> HT
          </p>
        )}
      </div>

      {/* Table header (desktop) — sortable */}
      <div className="hidden sm:grid grid-cols-[1fr_110px_140px_80px_90px_90px_50px_120px] gap-2 px-4 text-[10px] text-slate-600 uppercase tracking-wider">
        <button onClick={() => toggleSort("client")} className="text-left hover:text-slate-400 dark:text-slate-400 transition-colors">
          Client {sortBy === "client" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
        <span>Numero</span>
        <span>Type de mission</span>
        <span>Honoraires</span>
        <button onClick={() => toggleSort("date")} className="text-left hover:text-slate-400 dark:text-slate-400 transition-colors">
          Date {sortBy === "date" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
        <button onClick={() => toggleSort("status")} className="text-left hover:text-slate-400 dark:text-slate-400 transition-colors">
          Statut {sortBy === "status" ? (sortAsc ? "↑" : "↓") : ""}
        </button>
        <span>Av.</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {paged.map((letter) => {
          const avenantCount = avenantsByLetter[letter.id]?.length || 0;
          const modeComptable = letter.wizard_data?.type_mission;
          const rowCatColors = getLetterCategoryColors(letter);
          return (
          <div
            key={letter.id}
            className={`group sm:grid sm:grid-cols-[1fr_110px_140px_80px_90px_90px_50px_120px] sm:items-center gap-2 p-3 sm:px-4 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors ${rowCatColors ? `border-l-[3px] ${rowCatColors.border}` : ''}`}
          >
            {/* Client */}
            <button onClick={() => onEdit(letter)} className="flex items-center gap-2 text-left min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{letter.raison_sociale}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 sm:hidden">
                  {letter.numero} · {formatDateFr(letter.created_at, "short")}
                </p>
              </div>
            </button>

            {/* Numero */}
            <span className="hidden sm:block text-xs text-slate-400 dark:text-slate-400 font-mono truncate">{letter.numero}</span>

            {/* Type de mission + mode comptable */}
            <div className="hidden sm:block">
              <Badge className={`text-[9px] gap-1 ${rowCatColors ? rowCatColors.badge : 'bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
                {getMissionLabel(letter)}
              </Badge>
              {modeComptable && ["TENUE", "SURVEILLANCE", "REVISION"].includes(modeComptable) && (
                <span className="block text-[9px] text-emerald-500/70 mt-0.5">{modeComptable}</span>
              )}
              {getMissionNorme(letter) && !modeComptable && (
                <span className="block text-[9px] text-slate-600 mt-0.5 truncate">{getMissionNorme(letter)}</span>
              )}
            </div>

            {/* Honoraires HT */}
            <span className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-400 font-mono">
              {letter.honoraires_ht ? formatEurCompact(letter.honoraires_ht) : "—"}
            </span>

            {/* Date */}
            <span className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500">
              {formatDateFr(letter.updated_at, "short")}
            </span>

            {/* Statut */}
            <div className="hidden sm:block">
              <LMStatusBadge status={letter.status} showTooltip />
            </div>

            {/* Avenants count */}
            <div className="hidden sm:block">
              {avenantCount > 0 && (
                <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  {avenantCount} av.
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="hidden sm:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(letter)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-blue-400 transition-colors"
                title={letter.status === "brouillon" ? "Modifier" : "Voir"}
                aria-label={letter.status === "brouillon" ? "Modifier la lettre" : "Voir la lettre"}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {(letter.status === "brouillon" || letter.status === "envoyee") && (
                <button
                  onClick={() => openSignDialog(letter)}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-blue-400 transition-colors"
                  title="Envoyer pour signature"
                  aria-label="Envoyer pour signature"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
              {letter.status === "signee" && (
                <button
                  onClick={() => onCreateAvenant(letter)}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-cyan-400 transition-colors"
                  title="Creer un avenant"
                  aria-label="Creer un avenant"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onDuplicate(letter)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-emerald-400 transition-colors"
                title="Dupliquer"
                aria-label="Dupliquer la lettre"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDownloadPdf(letter)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-purple-400 transition-colors"
                title="Telecharger en PDF"
                aria-label="Telecharger en PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onArchive(letter)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-amber-400 transition-colors"
                title="Archiver"
                aria-label="Archiver la lettre"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile actions */}
            <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
              <LMStatusBadge status={letter.status} />
              {avenantCount > 0 && (
                <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  {avenantCount} av.
                </Badge>
              )}
              {(letter.honoraires_ht ?? 0) > 0 && (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{formatEurCompact(letter.honoraires_ht)}</span>
              )}
              <div className="flex-1" />
              {(letter.status === "brouillon" || letter.status === "envoyee") && (
                <button onClick={() => openSignDialog(letter)} className="p-1.5 text-slate-400 dark:text-slate-500" aria-label="Envoyer pour signature"><Send className="w-3.5 h-3.5" /></button>
              )}
              {letter.status === "signee" && (
                <button onClick={() => onCreateAvenant(letter)} className="p-1.5 text-slate-400 dark:text-slate-500" aria-label="Creer un avenant"><FilePlus2 className="w-3.5 h-3.5" /></button>
              )}
              <button onClick={() => onDuplicate(letter)} className="p-1.5 text-slate-400 dark:text-slate-500" aria-label="Dupliquer la lettre"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDownloadPdf(letter)} className="p-1.5 text-slate-400 dark:text-slate-500" aria-label="Telecharger en PDF"><FileDown className="w-3.5 h-3.5" /></button>
              <button onClick={() => onArchive(letter)} className="p-1.5 text-slate-400 dark:text-slate-500" aria-label="Archiver la lettre"><Archive className="w-3.5 h-3.5" /></button>
            </div>

            {/* Avenants list */}
            {avenantsByLetter[letter.id] && avenantsByLetter[letter.id].length > 0 && (
              <div className="col-span-full mt-2 pt-2 border-t border-gray-100 dark:border-white/[0.04] space-y-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">
                  {avenantsByLetter[letter.id].length} avenant{avenantsByLetter[letter.id].length > 1 ? "s" : ""}
                </p>
                {avenantsByLetter[letter.id].map((av) => (
                  <div
                    key={av.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.01] border border-gray-100 dark:border-white/[0.04]"
                  >
                    <FilePlus2 className="w-3 h-3 text-cyan-400/60 shrink-0" />
                    <span className="text-xs font-mono text-cyan-400/80">{av.numero}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-400 truncate flex-1">{av.objet}</span>
                    <Badge variant="outline" className={`text-[9px] ${
                      av.status === "signee" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      av.status === "envoyee" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      av.status === "archivee" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                      "bg-slate-500/10 text-slate-400 dark:text-slate-400 border-slate-500/20"
                    }`}>
                      {av.status}
                    </Badge>
                    <span className="text-[10px] text-slate-600">
                      {formatDateFr(av.created_at, "short")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Empty filter state */}
      {filtered.length === 0 && letters.length > 0 && (
        <div className="text-center py-10 space-y-2">
          <Search className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 dark:text-slate-400 text-sm">Aucun resultat pour ces filtres</p>
          <button
            onClick={() => { setSearchQ(""); setFilterStatut("all"); setFilterType("all"); }}
            className="text-xs text-blue-400 hover:underline"
          >
            Reinitialiser les filtres
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-slate-600">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-7 w-7 p-0 border-gray-200 dark:border-white/[0.06]"
              aria-label="Page precedente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              return start + i;
            }).filter(p => p < totalPages).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded text-xs transition-colors ${
                  p === page
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-slate-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                {p + 1}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="h-7 w-7 p-0 border-gray-200 dark:border-white/[0.06]"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Signature dialog */}
      <Dialog open={!!signTarget} onOpenChange={(open) => !open && setSignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer pour signature</DialogTitle>
            <DialogDescription>
              {signTarget?.raison_sociale} — {signTarget?.numero}
            </DialogDescription>
          </DialogHeader>
          {signUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">Lien de signature genere</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-400">Lien a envoyer au client</Label>
                <div className="flex gap-2">
                  <Input value={signUrl} readOnly className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-xs font-mono" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1 border-gray-200 dark:border-white/[0.06]"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(signUrl); toast.success("Lien copie"); } catch { toast.error("Impossible de copier le lien"); }
                    }}
                  >
                    <Link className="w-3 h-3" /> Copier
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Le client pourra consulter la lettre de mission et la signer electroniquement via ce lien.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSignTarget(null)} className="border-gray-200 dark:border-white/[0.06]">
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="sign-email" className="text-xs text-slate-400 dark:text-slate-400">Email du client *</Label>
                <Input
                  id="sign-email"
                  type="email"
                  value={signEmail}
                  onChange={(e) => setSignEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sign-client-nom" className="text-xs text-slate-400 dark:text-slate-400">Nom du signataire</Label>
                <Input
                  id="sign-client-nom"
                  value={signClientNom}
                  onChange={(e) => setSignClientNom(e.target.value)}
                  placeholder="Nom du client"
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSignTarget(null)} className="border-gray-200 dark:border-white/[0.06]">
                  Annuler
                </Button>
                <Button
                  onClick={handleSendForSignature}
                  disabled={signLoading || !signEmail.trim()}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
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
  const [data, setData] = useState<LMWizardData>({ ...INITIAL_LM_WIZARD_DATA });
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const prevStepRef = useRef(0);
  const [lmId, setLmId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expressMode, setExpressMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ id: string; wizard_data: Record<string, unknown>; wizard_step: number } | null>(null);

  // History
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Cabinet logo
  const [cabinetLogo, setCabinetLogo] = useState<string | undefined>(undefined);

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
          if (parsed.wizard_step > 0) setStep(parsed.wizard_step);
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
      setStep(draftInfo.wizard_step || 0);
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
      const payload = {
        wizard_data: currentData,
        wizard_step: currentStep,
        client_ref: currentData.client_ref || null,
        raison_sociale: currentData.raison_sociale || null,
        type_mission: currentData.type_mission || null,
        updated_at: new Date().toISOString(),
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
        .select("id, numero, client_ref, raison_sociale, type_mission, status, created_at, updated_at, wizard_data")
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
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

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
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, LM_TOTAL_STEPS - 1));
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
    const payload = {
      client_ref: sanitized.client_ref,
      raison_sociale: sanitized.raison_sociale,
      type_mission: sanitized.type_mission,
      status: effectiveStatus,
      wizard_data: sanitized,
      wizard_step: step,
      numero: sanitized.numero_lettre || incrementCounter(),
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
    warningShown.current = false;
    setExpressMode(false);
    sessionStorage.removeItem("lm_wizard_draft");
  };

  const handleEditLetter = (letter: SavedLetter) => {
    if (letter.wizard_data) {
      setData({ ...INITIAL_LM_WIZARD_DATA, ...letter.wizard_data });
      setLmId(letter.id);
      setStep(letter.wizard_data?.wizard_step || 0);
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

  // G) Download PDF from history
  const handleDownloadPdf = async (letter: SavedLetter) => {
    if (!letter.wizard_data) return;
    try {
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
      toast.success("PDF genere");
    } catch (e: any) {
      toast.error(e?.message || "Erreur PDF");
    }
  };

  // ── Express mode ──
  const handleExpress = () => {
    setExpressMode(!expressMode);
    if (!expressMode && data.client_id) {
      setStep(4); // Skip to Honoraires
    }
  };

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

  // Step render
  const renderStep = () => {
    switch (step) {
      case 0: return <LMStep1Client data={data} onChange={handleChange} />;
      case 1: return <LMStep2MissionType data={data} onChange={handleChange} />;
      case 2: return <LMStep2Missions data={data} onChange={handleChange} />;
      case 3: return <LMStep4Modele data={data} onChange={handleChange} />;
      case 4: return <LMStep4Honoraires data={data} onChange={handleChange} />;
      case 5: return <LMStep6Clauses data={data} onChange={handleChange} />;
      case 6: return <LMStep5Preview data={data} onGoToStep={goToStep} isMobile={isMobile} />;
      case 7: return <LMStep6Export data={data} onChange={handleChange} onSave={handleSave} onReset={handleReset} saving={saving} />;
      default: return null;
    }
  };

  const nextDisabled = !isStepValid(step);

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpress}
            className={`gap-1.5 border-gray-200 dark:border-white/[0.06] text-xs ${expressMode ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" : "text-slate-400 dark:text-slate-400"}`}
          >
            <Zap className="w-3.5 h-3.5" /> Express
          </Button>
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
            onStepClick={(s) => { if (s <= step) goToStep(s); }}
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
                    disabled={nextDisabled}
                    className="gap-1 wizard-nav-btn bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 disabled:opacity-40"
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
                  disabled={nextDisabled}
                  className="gap-1.5 wizard-nav-btn bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-40"
                >
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
              onDownloadPdf={handleDownloadPdf}
              onCreateAvenant={handleCreateAvenant}
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
