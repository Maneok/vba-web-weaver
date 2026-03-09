import { useState, useMemo, useCallback, useEffect } from "react";
import { logger } from "@/lib/logger";
import { useAppState } from "@/lib/AppContext";
import { collaborateursService } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Users, CheckCircle2, AlertCircle, Key, Mail, UserPlus,
  Pencil, Shield, ChevronDown, GraduationCap, Building2, Trash2,
  Download, ArrowUpDown, Clock, Phone, Calendar, BarChart3,
  AlertTriangle, Filter, X, WifiOff, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { FONCTION_OPTIONS, COMPETENCE_LEVELS } from "@/lib/constants";

interface ReferentConfig {
  referent_lcb: string;
  date_derniere_formation: string;
  date_signature_manuel: string;
}

type SortField = "nom" | "fonction" | "niveauCompetence" | "derniereFormation" | "statutFormation";
type SortDirection = "asc" | "desc";
type FormationFilter = "all" | "a_jour" | "a_former" | "non_renseigne";

function getFormationBadge(dateStr: string) {
  if (!dateStr) return { label: "Non renseigne", color: "bg-slate-500/15 text-slate-400", days: 0 };
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return { label: "Non renseigne", color: "bg-slate-500/15 text-slate-400", days: 0 };
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365;
  if (diffYears < 1) return { label: "A jour", color: "bg-emerald-500/15 text-emerald-400", days: Math.max(0, 365 - diffDays) };
  if (diffYears < 2) return { label: "A renouveler", color: "bg-amber-500/15 text-amber-400", days: 0 };
  return { label: "Expiree", color: "bg-red-500/15 text-red-400", days: 0 };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function daysSince(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `il y a ${days}j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an(s)`;
}

function exportCollaborateursCSV(collaborateurs: typeof import("@/lib/types").Collaborateur extends never ? never : Array<{
  nom: string; fonction: string; email: string; niveauCompetence: string;
  derniereFormation: string; statutFormation: string; referentLcb: boolean; suppleant: string;
  dateSignatureManuel: string;
}>) {
  const headers = ["Nom", "Fonction", "Email", "Niveau", "Derniere Formation", "Statut Formation", "Referent LCB", "Suppleant", "Signature Manuel"];
  const rows = collaborateurs.map(c => [
    c.nom, c.fonction, c.email, c.niveauCompetence,
    c.derniereFormation || "", c.statutFormation, c.referentLcb ? "OUI" : "NON",
    c.suppleant || "", c.dateSignatureManuel || "",
  ]);
  const csv = [headers.join(";"), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, "")}"`).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `collaborateurs-lcb-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  nom: "", fonction: "COLLABORATEUR", email: "", niveau_competence: "JUNIOR",
  suppleant: "", telephone: "", derniereFormation: "", dateSignatureManuel: "",
  referentLcb: false,
};

export default function GouvernancePage() {
  const { collaborateurs, isLoading, isOnline, refreshAll } = useAppState();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingCollab, setEditingCollab] = useState<typeof collaborateurs[0] | null>(null);
  const [deletingCollab, setDeletingCollab] = useState<typeof collaborateurs[0] | null>(null);
  const [newCollab, setNewCollab] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [referentConfig, setReferentConfig] = useState<ReferentConfig | null>(null);
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [formationFilter, setFormationFilter] = useState<FormationFilter>("all");
  const [deleting, setDeleting] = useState(false);

  // Load referent config from parametres
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from("parametres")
          .select("value")
          .eq("key", "lcbft_config")
          .maybeSingle();
        if (cancelled) return;
        if (data?.value) {
          let val;
          try {
            val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          } catch {
            logger.error("[Gouvernance] Invalid JSON in parametres.value");
            return;
          }
          setReferentConfig(val as ReferentConfig);
        }
      } catch (err) {
        logger.error("[Gouvernance] Failed to load config:", err);
      }
    }
    loadConfig();
    return () => { cancelled = true; };
  }, []);

  // Add collaborateur
  const handleAddCollab = useCallback(async () => {
    if (!newCollab.nom) return;
    try {
      if (isOnline) {
        await collaborateursService.create({
          nom: newCollab.nom,
          fonction: newCollab.fonction,
          email: newCollab.email,
          referent_lcb: newCollab.referentLcb,
          suppleant: newCollab.suppleant,
          niveau_competence: newCollab.niveau_competence,
          date_signature_manuel: newCollab.dateSignatureManuel,
          derniere_formation: newCollab.derniereFormation,
          statut_formation: newCollab.derniereFormation ? "A JOUR" : "A FORMER",
        });
        await refreshAll();
      }
      setShowAddDialog(false);
      setNewCollab({ ...EMPTY_FORM });
      toast.success("Collaborateur ajoute avec succes");
    } catch (err) {
      logger.error("[Gouvernance] handleAddCollab error:", err);
      toast.error("Erreur lors de l'ajout du collaborateur");
    }
  }, [newCollab, isOnline, refreshAll]);

  // Edit collaborateur
  const handleOpenEdit = (collab: typeof collaborateurs[0]) => {
    setEditingCollab(collab);
    setEditForm({
      nom: collab.nom,
      fonction: collab.fonction,
      email: collab.email,
      niveau_competence: collab.niveauCompetence || "JUNIOR",
      suppleant: collab.suppleant || "",
      telephone: "",
      derniereFormation: collab.derniereFormation || "",
      dateSignatureManuel: collab.dateSignatureManuel || "",
      referentLcb: collab.referentLcb || false,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingCollab?.id || !editForm.nom) return;
    try {
      if (isOnline) {
        await collaborateursService.update(editingCollab.id, {
          nom: editForm.nom,
          fonction: editForm.fonction,
          email: editForm.email,
          niveau_competence: editForm.niveau_competence,
          suppleant: editForm.suppleant,
          derniere_formation: editForm.derniereFormation,
          date_signature_manuel: editForm.dateSignatureManuel,
          referent_lcb: editForm.referentLcb,
          statut_formation: editForm.derniereFormation
            ? getFormationBadge(editForm.derniereFormation).label === "Expiree" ? "A FORMER" : "A JOUR"
            : "A FORMER",
        });
        await refreshAll();
      }
      setShowEditDialog(false);
      setEditingCollab(null);
      toast.success("Collaborateur mis a jour");
    } catch (err) {
      logger.error("[Gouvernance] handleSaveEdit error:", err);
      toast.error("Erreur lors de la mise a jour");
    }
  }, [editingCollab, editForm, isOnline, refreshAll]);

  // Delete collaborateur
  const handleDeleteCollab = useCallback(async () => {
    if (!deletingCollab?.id) return;
    setDeleting(true);
    try {
      if (isOnline) {
        await collaborateursService.delete(deletingCollab.id);
        await refreshAll();
      }
      setShowDeleteDialog(false);
      setDeletingCollab(null);
      toast.success("Collaborateur supprime");
    } catch (err) {
      logger.error("[Gouvernance] handleDeleteCollab error:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  }, [deletingCollab, isOnline, refreshAll]);

  // Bulk relance
  const handleBulkRelance = () => {
    const toRelance = collaborateurs.filter(c =>
      (c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")) && c.email
    );
    if (toRelance.length === 0) {
      toast.info("Aucun collaborateur a relancer");
      return;
    }
    const emails = toRelance.map(c => c.email).join(",");
    const subject = encodeURIComponent("Relance formation LCB-FT");
    const body = encodeURIComponent(
      `Bonjour,\n\nVotre formation LCB-FT est echue ou n'a jamais ete effectuee.\n\nConformement aux obligations reglementaires (art. L.561-36 CMF), nous vous invitons a regulariser votre situation dans les meilleurs delais.\n\nCordialement,\nLe Referent LCB-FT`
    );
    window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
    toast.success(`Email de relance groupee ouvert pour ${toRelance.length} collaborateur(s)`);
  };

  // Stats
  const formesOk = collaborateurs.filter(c => c.statutFormation.includes("A JOUR")).length;
  const formesKo = collaborateurs.filter(c => c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")).length;
  const formesRenouveler = collaborateurs.filter(c => {
    if (!c.derniereFormation) return false;
    const diff = (Date.now() - new Date(c.derniereFormation).getTime()) / (1000 * 60 * 60 * 24 * 365);
    return diff >= 1 && diff < 2;
  }).length;
  const formationPct = collaborateurs.length > 0 ? Math.round((formesOk / collaborateurs.length) * 100) : 0;
  const manuelSignes = collaborateurs.filter(c => c.dateSignatureManuel).length;
  const manuelPct = collaborateurs.length > 0 ? Math.round((manuelSignes / collaborateurs.length) * 100) : 0;

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = collaborateurs;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.nom || "").toLowerCase().includes(q) ||
        (c.fonction || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    }

    // Formation filter
    if (formationFilter !== "all") {
      result = result.filter(c => {
        if (formationFilter === "a_jour") return c.statutFormation.includes("A JOUR");
        if (formationFilter === "a_former") return c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS");
        if (formationFilter === "non_renseigne") return !c.derniereFormation;
        return true;
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA = "", valB = "";
      switch (sortField) {
        case "nom": valA = a.nom; valB = b.nom; break;
        case "fonction": valA = a.fonction; valB = b.fonction; break;
        case "niveauCompetence": valA = a.niveauCompetence; valB = b.niveauCompetence; break;
        case "derniereFormation": valA = a.derniereFormation; valB = b.derniereFormation; break;
        case "statutFormation": valA = a.statutFormation; valB = b.statutFormation; break;
      }
      const cmp = valA.localeCompare(valB, "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [collaborateurs, search, formationFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Referent badge
  const referentBadge = referentConfig ? getFormationBadge(referentConfig.date_derniere_formation) : null;

  // Organigramme data
  const referent = collaborateurs.find(c => c.referentLcb);
  const suppleants = collaborateurs.filter(c => c.suppleant && !c.referentLcb);
  const others = collaborateurs.filter(c => !c.referentLcb && !c.suppleant);

  // Relance email
  const handleRelance = (collab: typeof collaborateurs[0]) => {
    if (!collab.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collab.email)) {
      toast.error(`Email invalide ou manquant pour ${collab.nom}`);
      return;
    }
    const subject = encodeURIComponent(`Relance formation LCB-FT — ${collab.nom}`);
    const body = encodeURIComponent(
      `Bonjour ${collab.nom},\n\nVotre formation LCB-FT est expiree (derniere formation : ${collab.derniereFormation || "aucune"}).\n\nConformement aux obligations reglementaires (art. L.561-36 CMF), nous vous invitons a regulariser votre situation dans les meilleurs delais.\n\nCordialement,\nLe Referent LCB-FT`
    );
    window.location.href = `mailto:${collab.email}?subject=${subject}&body=${body}`;
    toast.success(`Email de relance ouvert pour ${collab.nom}`);
  };

  // Form field renderer
  const renderFormField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { placeholder?: string; type?: "input" | "select" | "date"; options?: { value: string; label: string }[]; icon?: React.ReactNode }
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400 flex items-center gap-1.5">
        {opts?.icon}
        {label}
      </Label>
      {opts?.type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.options?.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : opts?.type === "date" ? (
        <Input
          type="date"
          className="bg-white/[0.03] border-white/[0.06] text-slate-200"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <Input
          className="bg-white/[0.03] border-white/[0.06] text-slate-200 placeholder:text-slate-600"
          placeholder={opts?.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );

  const niveauOptions = COMPETENCE_LEVELS.map(l => ({ value: l.value, label: l.label }));
  const fonctionOptions = FONCTION_OPTIONS.map(f => ({ value: f.value, label: f.label }));

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-blue-400" : "text-slate-600"}`} />
      </span>
    </TableHead>
  );

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in-up">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Gouvernance LCB-FT
              {!isOnline && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  <WifiOff className="w-3 h-3" /> Hors ligne
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Suivi de l'equipe et des formations obligatoires
              <span className="text-slate-600 ml-2">({collaborateurs.length} collaborateur{collaborateurs.length > 1 ? "s" : ""})</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/[0.06] text-slate-400 hover:text-slate-200"
              onClick={() => {
                exportCollaborateursCSV(collaborateurs);
                toast.success(`${collaborateurs.length} collaborateurs exportes en CSV`);
              }}
            >
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            {formesKo > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                onClick={handleBulkRelance}
              >
                <Mail className="w-3.5 h-3.5" /> Relancer tous ({formesKo})
              </Button>
            )}
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddDialog(true)}>
              <UserPlus className="w-4 h-4" /> Ajouter
            </Button>
          </div>
        </div>

        {/* Referent LCB-FT Card */}
        {referentConfig && (
          <div className="glass-card p-6 animate-fade-in-up border border-blue-500/20">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center border border-blue-500/20">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-400/70 font-semibold mb-1">Referent LCB-FT designe</p>
                  <p className="text-xl font-bold text-white">{referentConfig.referent_lcb}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Manuel : <span className="text-slate-300 font-mono">{formatDate(referentConfig.date_signature_manuel)}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Date de signature du Manuel Interne LCB-FT</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          Formation : <span className="text-slate-300 font-mono">{formatDate(referentConfig.date_derniere_formation)}</span>
                          {referentConfig.date_derniere_formation && (
                            <span className="text-slate-500 ml-1">({daysSince(referentConfig.date_derniere_formation)})</span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Date de la derniere formation LCB-FT du referent</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              {referentBadge && (
                <Tooltip>
                  <TooltipTrigger>
                    <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${referentBadge.color}`}>
                      <GraduationCap className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      {referentBadge.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {referentBadge.days > 0 ? `Expire dans ${referentBadge.days} jours` : referentBadge.label}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up-delay-1">
          <div className="glass-card p-4 kpi-glow-blue">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{collaborateurs.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Collaborateurs</p>
          </div>
          <div className="glass-card p-4 kpi-glow-green">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formesOk}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Formations a jour</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formesRenouveler}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">A renouveler</p>
          </div>
          <div className="glass-card p-4 kpi-glow-red">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-4.5 h-4.5 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-400">{formesKo}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">A former / relancer</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-purple-400">{manuelSignes}<span className="text-sm text-slate-500">/{collaborateurs.length}</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5">Manuel signe</p>
          </div>
        </div>

        {/* Formation progress bar */}
        <div className="glass-card p-4 animate-fade-in-up-delay-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">Taux de formation</span>
            </div>
            <span className={`text-sm font-bold ${formationPct >= 90 ? "text-emerald-400" : formationPct >= 60 ? "text-amber-400" : "text-red-400"}`}>
              {formationPct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden flex">
            <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(formesOk / Math.max(collaborateurs.length, 1)) * 100}%` }} />
            <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(formesRenouveler / Math.max(collaborateurs.length, 1)) * 100}%` }} />
            <div className="bg-red-500 transition-all duration-700" style={{ width: `${(formesKo / Math.max(collaborateurs.length, 1)) * 100}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> A jour ({formesOk})
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> A renouveler ({formesRenouveler})
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-red-500" /> A former ({formesKo})
            </span>
            <span className="ml-auto text-[10px] text-slate-500">
              Manuel signe : {manuelPct}%
            </span>
          </div>
          {formationPct < 90 && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/5 rounded-md px-3 py-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Objectif reglementaire : 90% des collaborateurs formes (art. L.561-36 CMF)
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div className="animate-fade-in-up-delay-2 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Rechercher un collaborateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
            />
          </div>
          <Select value={formationFilter} onValueChange={v => setFormationFilter(v as FormationFilter)}>
            <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.06] text-slate-300">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="a_jour">A jour</SelectItem>
              <SelectItem value="a_former">A former</SelectItem>
              <SelectItem value="non_renseigne">Non renseigne</SelectItem>
            </SelectContent>
          </Select>
          {(search || formationFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-slate-400 hover:text-white"
              onClick={() => { setSearch(""); setFormationFilter("all"); }}
            >
              <X className="w-3 h-3 mr-1" /> Effacer filtres
            </Button>
          )}
          <span className="text-xs text-slate-500 ml-auto">
            {filtered.length} resultat{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden animate-fade-in-up-delay-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <SortableHeader field="nom">Collaborateur</SortableHeader>
                  <SortableHeader field="fonction">Fonction</SortableHeader>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Ref. LCB</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Suppleant</TableHead>
                  <SortableHeader field="niveauCompetence">Niveau</SortableHeader>
                  <SortableHeader field="derniereFormation">Derniere Formation</SortableHeader>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Manuel</TableHead>
                  <SortableHeader field="statutFormation">Statut</SortableHeader>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-slate-500 py-12">
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                          Chargement...
                        </span>
                      ) : search || formationFilter !== "all" ? (
                        "Aucun collaborateur ne correspond aux filtres"
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-slate-600" />
                          <p>Aucun collaborateur enregistre</p>
                          <Button size="sm" className="mt-2 bg-blue-600" onClick={() => setShowAddDialog(true)}>
                            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Ajouter le premier collaborateur
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c, i) => {
                  const formBadge = getFormationBadge(c.derniereFormation);
                  return (
                    <TableRow key={c.id || i} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0">
                            {c.nom.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-medium text-sm text-slate-200">{c.nom}</span>
                            {c.email && <p className="text-[11px] text-slate-500">{c.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">{c.fonction}</TableCell>
                      <TableCell className="text-center">
                        {c.referentLcb && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                                <Key className="w-3 h-3" /> REF
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Referent LCB-FT designe</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">{c.suppleant || "---"}</TableCell>
                      <TableCell>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                          COMPETENCE_LEVELS.find(l => l.value === c.niveauCompetence)?.color || "bg-slate-500/15 text-slate-400"
                        }`}>
                          {c.niveauCompetence || "---"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 font-mono">{c.derniereFormation ? formatDate(c.derniereFormation) : "---"}</span>
                              {c.derniereFormation && (
                                <span className="text-[10px] text-slate-600">{daysSince(c.derniereFormation)}</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {c.derniereFormation
                              ? `Formation du ${formatDate(c.derniereFormation)} — ${formBadge.label}`
                              : "Aucune formation enregistree"
                            }
                            {formBadge.days > 0 && ` — Expire dans ${formBadge.days} jours`}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {c.dateSignatureManuel ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3 inline mr-0.5 -mt-0.5" /> Signe
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Signe le {formatDate(c.dateSignatureManuel)}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">Non signe</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                          c.statutFormation.includes("A JOUR")
                            ? "bg-emerald-500/15 text-emerald-400"
                            : c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")
                            ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}>
                          {c.statutFormation}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-white/[0.06] text-slate-400 hover:text-blue-400"
                                onClick={() => handleOpenEdit(c)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                                onClick={() => { setDeletingCollab(c); setShowDeleteDialog(true); }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                          </Tooltip>
                          {(c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs hover:bg-blue-500/10 hover:text-blue-400 text-slate-400"
                              onClick={() => handleRelance(c)}
                            >
                              <Mail className="w-3 h-3" /> Relancer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Organigramme LCB-FT */}
        <div className="animate-fade-in-up-delay-3">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Organigramme LCB-FT
          </h2>
          <div className="glass-card p-8">
            <div className="flex flex-col items-center gap-0">
              {/* Referent */}
              <div className="flex flex-col items-center">
                <div className="px-6 py-3 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/30 text-center min-w-[220px] shadow-lg shadow-blue-500/5">
                  <p className="text-[10px] uppercase tracking-wider text-blue-400/70 font-semibold">Referent LCB-FT</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {referent?.nom || referentConfig?.referent_lcb || "Non designe"}
                  </p>
                  {referent?.email && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{referent.email}</p>
                  )}
                </div>
                {(suppleants.length > 0 || others.length > 0) && (
                  <>
                    <div className="w-px h-6 bg-white/10" />
                    <ChevronDown className="w-4 h-4 text-white/20 -mt-1 -mb-1" />
                  </>
                )}
              </div>

              {/* Suppleants */}
              {suppleants.length > 0 && (
                <>
                  <div className="flex items-center gap-4 flex-wrap justify-center">
                    {suppleants.map((s, i) => (
                      <div key={i} className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center min-w-[180px]">
                        <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold">Suppleant</p>
                        <p className="text-sm font-medium text-white mt-1">{s.nom}</p>
                        {s.email && <p className="text-[10px] text-slate-500 mt-0.5">{s.email}</p>}
                      </div>
                    ))}
                  </div>
                  {others.length > 0 && (
                    <>
                      <div className="w-px h-6 bg-white/10" />
                      <ChevronDown className="w-4 h-4 text-white/20 -mt-1 -mb-1" />
                    </>
                  )}
                </>
              )}

              {/* Collaborateurs */}
              {others.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  {others.map((o, i) => (
                    <div key={i} className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center min-w-[150px]">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{o.fonction}</p>
                      <p className="text-xs font-medium text-slate-300 mt-0.5">{o.nom}</p>
                      {o.statutFormation.includes("FORMER") || o.statutFormation.includes("JAMAIS") ? (
                        <span className="text-[9px] text-red-400 mt-0.5 inline-block">Formation requise</span>
                      ) : (
                        <span className="text-[9px] text-emerald-400 mt-0.5 inline-block">Forme</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {collaborateurs.length === 0 && (
                <p className="text-sm text-slate-500 mt-2">Aucun collaborateur enregistre</p>
              )}
            </div>
          </div>
        </div>

        {/* Add collaborator dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Ajouter un collaborateur
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                Remplissez les informations du nouveau collaborateur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {renderFormField("Nom", newCollab.nom, v => setNewCollab(p => ({ ...p, nom: v })), { placeholder: "NOM Prenom" })}
              {renderFormField("Email", newCollab.email, v => setNewCollab(p => ({ ...p, email: v })), { placeholder: "email@cabinet.fr", icon: <Mail className="w-3 h-3" /> })}
              {renderFormField("Telephone", newCollab.telephone, v => setNewCollab(p => ({ ...p, telephone: v })), { placeholder: "06 12 34 56 78", icon: <Phone className="w-3 h-3" /> })}
              {renderFormField("Fonction", newCollab.fonction, v => setNewCollab(p => ({ ...p, fonction: v })), {
                type: "select", options: fonctionOptions,
              })}
              {renderFormField("Niveau de competence", newCollab.niveau_competence, v => setNewCollab(p => ({ ...p, niveau_competence: v })), {
                type: "select", options: niveauOptions,
              })}
              {renderFormField("Derniere formation LCB-FT", newCollab.derniereFormation, v => setNewCollab(p => ({ ...p, derniereFormation: v })), {
                type: "date", icon: <GraduationCap className="w-3 h-3" />,
              })}
              {renderFormField("Signature du Manuel", newCollab.dateSignatureManuel, v => setNewCollab(p => ({ ...p, dateSignatureManuel: v })), {
                type: "date", icon: <FileText className="w-3 h-3" />,
              })}
              {renderFormField("Suppleant de", newCollab.suppleant, v => setNewCollab(p => ({ ...p, suppleant: v })), { placeholder: "Nom du referent (optionnel)" })}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="newReferentLcb"
                  checked={newCollab.referentLcb}
                  onChange={e => setNewCollab(p => ({ ...p, referentLcb: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/[0.1] bg-white/[0.03]"
                />
                <Label htmlFor="newReferentLcb" className="text-xs text-slate-400 cursor-pointer">
                  Referent LCB-FT designe
                </Label>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2" onClick={handleAddCollab} disabled={!newCollab.nom}>
                Ajouter le collaborateur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit collaborator dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-400" />
                Modifier le collaborateur
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {renderFormField("Nom", editForm.nom, v => setEditForm(p => ({ ...p, nom: v })), { placeholder: "NOM Prenom" })}
              {renderFormField("Email", editForm.email, v => setEditForm(p => ({ ...p, email: v })), { placeholder: "email@cabinet.fr", icon: <Mail className="w-3 h-3" /> })}
              {renderFormField("Fonction", editForm.fonction, v => setEditForm(p => ({ ...p, fonction: v })), {
                type: "select", options: fonctionOptions,
              })}
              {renderFormField("Niveau de competence", editForm.niveau_competence, v => setEditForm(p => ({ ...p, niveau_competence: v })), {
                type: "select", options: niveauOptions,
              })}
              {renderFormField("Derniere formation LCB-FT", editForm.derniereFormation, v => setEditForm(p => ({ ...p, derniereFormation: v })), {
                type: "date", icon: <GraduationCap className="w-3 h-3" />,
              })}
              {renderFormField("Signature du Manuel", editForm.dateSignatureManuel, v => setEditForm(p => ({ ...p, dateSignatureManuel: v })), {
                type: "date", icon: <FileText className="w-3 h-3" />,
              })}
              {renderFormField("Suppleant de", editForm.suppleant, v => setEditForm(p => ({ ...p, suppleant: v })), { placeholder: "Nom du referent (optionnel)" })}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="editReferentLcb"
                  checked={editForm.referentLcb}
                  onChange={e => setEditForm(p => ({ ...p, referentLcb: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/[0.1] bg-white/[0.03]"
                />
                <Label htmlFor="editReferentLcb" className="text-xs text-slate-400 cursor-pointer">
                  Referent LCB-FT designe
                </Label>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2" onClick={handleSaveEdit} disabled={!editForm.nom}>
                Enregistrer les modifications
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Confirmer la suppression
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <p className="text-sm text-slate-300">
                Etes-vous sur de vouloir supprimer <span className="font-semibold text-white">{deletingCollab?.nom}</span> ?
              </p>
              <p className="text-xs text-slate-500">
                Cette action est irreversible. Toutes les donnees associees seront perdues.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/[0.06]" onClick={() => setShowDeleteDialog(false)}>
                  Annuler
                </Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDeleteCollab} disabled={deleting}>
                  {deleting ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
