import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateFr } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getModeles,
  createModele,
  deleteModele,
  duplicateModele,
  setAsDefault,
  updateModele,
  validateCnoecCompliance,
  buildSectionsForMissionType,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
} from "@/lib/lettreMissionModeles";
import type { LMModele } from "@/lib/lettreMissionModeles";
import { MISSION_TYPES, MISSION_CATEGORIES, getMissionTypeConfig, getCategoryColorClasses, getMissionCategory } from "@/lib/lettreMissionTypes";
import type { MissionCategory, MissionTypeConfig } from "@/lib/lettreMissionTypes";
import { supabase } from "@/integrations/supabase/client";
import DocxImportDialog from "./DocxImportDialog";
import ModeleEditor from "./ModeleEditor";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Plus,
  Upload,
  FileText,
  Copy,
  Star,
  Trash2,
  Edit3,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Search,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

// ══════════════════════════════════════════════
// OPT-3: Category subtitles
// ══════════════════════════════════════════════

const CATEGORY_SUBTITLES: Record<MissionCategory, string> = {
  assurance_comptes: "Missions de presentation, examen limite et audit — NP 2300, NP 2400, ISA 210",
  autres_assurance: "Attestations particulieres et previsionnels — NP 3100, NP 3400",
  sans_assurance: "Procedures convenues et compilation — NP 4400, NP 4410",
  activites: "Activites commerciales, conseil et accompagnement — Art. 22 Ord. 1945",
};

const CATEGORY_TAB_LABELS: Record<MissionCategory, string> = {
  assurance_comptes: "Comptes historiques",
  autres_assurance: "Autres assurance",
  sans_assurance: "Sans assurance",
  activites: "Activites",
};

// ══════════════════════════════════════════════
// OPT-48: JSON export
// ══════════════════════════════════════════════

function exportModeleJson(m: LMModele) {
  const payload = {
    nom: m.nom,
    description: m.description,
    mission_type: m.mission_type,
    sections: m.sections,
    cgv_content: m.cgv_content,
    repartition_taches: m.repartition_taches,
    source: m.source,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${m.nom.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// OPT-6-15: Modele card component
// ══════════════════════════════════════════════

function ModeleCard({
  modele: m,
  usageCount,
  compact,
  actionLoading,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
  onExport,
  onPreview,
}: {
  modele: LMModele;
  usageCount: number;
  compact: boolean;
  actionLoading: string | null;
  onEdit: (m: LMModele) => void;
  onDuplicate: (m: LMModele) => void;
  onSetDefault: (m: LMModele) => void;
  onDelete: (m: LMModele) => void;
  onExport: (m: LMModele) => void;
  onPreview: (m: LMModele) => void;
}) {
  const cnoec = validateCnoecCompliance(m.sections, m.mission_type);
  const activeSections = m.sections.length;
  const mtConfig = m.mission_type ? getMissionTypeConfig(m.mission_type) : null;
  const sourceLabel = m.source === "grimy" ? "GRIMY" : m.source === "import_docx" ? "Import DOCX" : "Copie";
  const sourceColor = m.source === "grimy" ? "border-teal-500/30 text-teal-400" : m.source === "import_docx" ? "border-purple-500/30 text-purple-400" : "border-slate-500/30 text-slate-400 dark:text-slate-500 dark:text-slate-400";

  return (
    <Card
      className={`bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] p-4 space-y-3 hover:border-white/[0.12] transition-colors ${
        m.is_default ? "border-l-[3px] border-l-emerald-500/60" : ""
      }`}
    >
      {/* OPT-6: Line 1 — Name + badges */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.nom}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {m.is_default && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">
              <Star className="h-2.5 w-2.5 mr-0.5" /> Par defaut
            </Badge>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {mtConfig && (() => {
          const cat = getMissionCategory(m.mission_type || "");
          const catColors = cat ? getCategoryColorClasses(cat) : null;
          return (
            <Badge variant="outline" className={`text-[9px] ${catColors ? catColors.badge : "border-indigo-500/30 text-indigo-400"}`}>
              <BookOpen className="h-2.5 w-2.5 mr-0.5" /> {mtConfig.shortLabel}
            </Badge>
          );
        })()}
        {mtConfig && (
          <Badge variant="outline" className="text-[8px] border-slate-500/30 text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">
            {mtConfig.normeRef}
          </Badge>
        )}
        <Badge variant="outline" className={`text-[9px] ${sourceColor}`}>
          {sourceLabel}
        </Badge>
        {cnoec.valid ? (
          <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400">
            <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Conforme
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {cnoec.warnings.length} alerte{cnoec.warnings.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* OPT-7: Line 2 — Description + metadata (hidden in compact) */}
      {!compact && (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
            {m.description || mtConfig?.description || "Aucune description"}
          </p>
          <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
            <span>{activeSections} sections actives</span>
            <span>
              Modifie le {formatDateFr(m.updated_at, "short")}
            </span>
            {/* OPT-10: Usage count */}
            <span>Utilise dans {usageCount} lettre{usageCount > 1 ? "s" : ""}</span>
          </div>
        </>
      )}

      {/* OPT-8: Line 3 — Actions (hidden in compact) */}
      {!compact && (
        <>
          <Separator className="bg-gray-100 dark:bg-white/[0.06]" />
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-blue-400"
              onClick={() => onEdit(m)}
              aria-label={`Editer ${m.nom}`}
            >
              <Edit3 className="h-3 w-3" /> Editer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-emerald-400"
              onClick={() => onDuplicate(m)}
              disabled={actionLoading === `dup-${m.id}`}
              aria-label={`Dupliquer ${m.nom}`}
            >
              {actionLoading === `dup-${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} Dupliquer
            </Button>
            {!m.is_default && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-amber-400"
                onClick={() => onSetDefault(m)}
                disabled={actionLoading === `def-${m.id}`}
                aria-label={`Definir ${m.nom} par defaut`}
              >
                {actionLoading === `def-${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />} Defaut
              </Button>
            )}
            {/* OPT-49: Preview */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-purple-400"
              onClick={() => onPreview(m)}
              aria-label={`Previsualiser ${m.nom}`}
            >
              <Eye className="h-3 w-3" />
            </Button>
            {/* OPT-48: Export JSON */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-cyan-400"
              onClick={() => onExport(m)}
              aria-label={`Exporter ${m.nom}`}
            >
              <Download className="h-3 w-3" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-400 dark:text-slate-500 hover:text-red-400 disabled:opacity-30"
              disabled={m.is_default || actionLoading === `del-${m.id}`}
              onClick={() => onDelete(m)}
              title={m.is_default ? "Le modele par defaut ne peut pas etre supprime" : "Supprimer"}
              aria-label={`Supprimer ${m.nom}`}
            >
              {actionLoading === `del-${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════
// OPT-15: Skeleton loader
// ══════════════════════════════════════════════

function ModeleGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] p-4 space-y-3">
          <Skeleton className="h-5 w-3/4 bg-gray-100 dark:bg-white/[0.06]" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 bg-gray-100 dark:bg-white/[0.06]" />
            <Skeleton className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06]" />
            <Skeleton className="h-5 w-14 bg-gray-100 dark:bg-white/[0.06]" />
          </div>
          <Skeleton className="h-4 w-full bg-gray-100 dark:bg-white/[0.06]" />
          <Skeleton className="h-4 w-2/3 bg-gray-100 dark:bg-white/[0.06]" />
          <Separator className="bg-gray-100 dark:bg-white/[0.06]" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-16 bg-gray-100 dark:bg-white/[0.06]" />
            <Skeleton className="h-7 w-20 bg-gray-100 dark:bg-white/[0.06]" />
            <Skeleton className="h-7 w-16 bg-gray-100 dark:bg-white/[0.06]" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════

interface ModeleListPageProps {
  cabinetId: string;
  onBack: () => void;
}

export default function ModeleListPage({ cabinetId, onBack }: ModeleListPageProps) {
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingModele, setEditingModele] = useState<LMModele | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LMModele | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<MissionCategory>("assurance_comptes");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // OPT-12: Search
  const [searchQuery, setSearchQuery] = useState("");

  // OPT-14: Compact mode
  const [compact, setCompact] = useState(false);

  // OPT-10: Usage counts
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // OPT-49: Preview
  const [previewModele, setPreviewModele] = useState<LMModele | null>(null);

  // OPT-16-25: Create dialog state (3-step)
  const [createStep, setCreateStep] = useState(1);
  const [createNom, setCreateNom] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createMissionType, setCreateMissionType] = useState("");
  const [createSource, setCreateSource] = useState<"grimy" | "empty">("grimy");
  const [creating, setCreating] = useState(false);

  // OPT-40: Last load time
  const [lastLoadTime, setLastLoadTime] = useState<Date | null>(null);

  // ── Data loading ──

  const loadModeles = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getModeles(cabinetId);
      // OPT-46: Assign 'presentation' to modeles without mission_type
      for (const m of data) {
        if (!m.mission_type) {
          m.mission_type = "presentation";
        }
      }
      setModeles(data);
      setLastLoadTime(new Date());

      // OPT-10: Load usage counts
      const ids = data.map((m) => m.id);
      if (ids.length > 0) {
        try {
          const { data: counts } = await supabase
            .from("lettres_mission")
            .select("modele_id")
            .in("modele_id", ids);
          const map: Record<string, number> = {};
          for (const row of counts || []) {
            if (row.modele_id) {
              map[row.modele_id] = (map[row.modele_id] || 0) + 1;
            }
          }
          setUsageCounts(map);
        } catch {
          // Non-critical, ignore
        }
      }
    } catch (err) {
      logger.error("LM_MODELES", "loadModeles error", err);
      toast.error("Impossible de charger les modèles. Vérifiez votre connexion.");
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [cabinetId]);

  useEffect(() => {
    loadModeles();
  }, [loadModeles]);

  // ── Computed data ──

  // OPT-11: Sort — default first, then by updated_at desc
  const sortedModeles = useMemo(() => {
    return [...modeles].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [modeles]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of MISSION_CATEGORIES) {
      counts[cat.category] = modeles.filter((m) =>
        m.mission_type && cat.missions.includes(m.mission_type)
      ).length;
    }
    return counts;
  }, [modeles]);

  // OPT-50: Total stats
  const usedCategories = useMemo(() => {
    return MISSION_CATEGORIES.filter((c) => (categoryCounts[c.category] || 0) > 0).length;
  }, [categoryCounts]);

  // OPT-12-13: Search filtering
  const isSearching = searchQuery.length >= 2;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return sortedModeles.filter((m) => m.nom.toLowerCase().includes(q));
  }, [sortedModeles, searchQuery, isSearching]);

  // Category missions for create dialog
  const getCategoryMissions = useCallback((category: MissionCategory) => {
    const cat = MISSION_CATEGORIES.find((c) => c.category === category);
    if (!cat) return [];
    return cat.missions.map((mId) => {
      const config = (MISSION_TYPES as Record<string, MissionTypeConfig>)[mId];
      return config ? { id: mId, label: config.label, shortLabel: config.shortLabel, normeRef: config.normeRef } : null;
    }).filter(Boolean) as { id: string; label: string; shortLabel: string; normeRef: string }[];
  }, []);

  // Filter by active tab
  const getModelesByCategory = useCallback((category: MissionCategory) => {
    const cat = MISSION_CATEGORIES.find((c) => c.category === category);
    if (!cat) return [];
    return sortedModeles.filter((m) => m.mission_type && cat.missions.includes(m.mission_type));
  }, [sortedModeles]);

  // OPT-23: Check name uniqueness
  const isNameDuplicate = useMemo(() => {
    if (!createNom.trim()) return false;
    return modeles.some((m) => m.nom.toLowerCase() === createNom.trim().toLowerCase());
  }, [modeles, createNom]);

  // ── Actions (OPT-36-37) ──

  const openCreateDialog = (preselectedCategory?: MissionCategory) => {
    const cat = preselectedCategory || activeTab;
    const missions = getCategoryMissions(cat);
    const defaultMission = missions[0]?.id || "";
    const mtConfig = defaultMission ? getMissionTypeConfig(defaultMission) : null;
    setCreateStep(1);
    setCreateNom(mtConfig ? `${mtConfig.shortLabel} — Standard` : "");
    setCreateDescription("");
    setCreateMissionType(defaultMission);
    setCreateSource("grimy");
    setShowCreate(true);
  };

  // OPT-24: Quick create (skip step 1 if type is pre-selected)
  const openQuickCreate = (category: MissionCategory) => {
    const missions = getCategoryMissions(category);
    const defaultMission = missions[0]?.id || "";
    const mtConfig = defaultMission ? getMissionTypeConfig(defaultMission) : null;
    setCreateMissionType(defaultMission);
    setCreateNom(mtConfig ? `${mtConfig.shortLabel} — Standard` : "");
    setCreateDescription("");
    setCreateSource("grimy");
    setCreateStep(2);
    setShowCreate(true);
  };

  const handleCreateNew = async () => {
    if (!createNom.trim() || !createMissionType) {
      toast.error("Veuillez renseigner un nom et un type de mission.");
      return;
    }
    setCreating(true);
    try {
      const sections = createSource === "grimy"
        ? buildSectionsForMissionType(createMissionType)
        : [];
      const m = await createModele({
        cabinet_id: cabinetId,
        nom: createNom.trim(),
        description: createDescription.trim() || undefined,
        mission_type: createMissionType,
        sections,
        cgv_content: createSource === "grimy" ? GRIMY_DEFAULT_CGV : "",
        repartition_taches: createSource === "grimy" ? GRIMY_DEFAULT_REPARTITION : [],
        is_default: modeles.length === 0,
        source: "grimy",
      });
      toast.success("Modele cree.");
      setShowCreate(false);
      // OPT-20: Auto-navigate to editor
      setEditingModele(m);
      await loadModeles();
    } catch {
      toast.error("Impossible de créer le modèle. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (m: LMModele) => {
    setActionLoading(`dup-${m.id}`);
    try {
      await duplicateModele(m.id, `Copie de ${m.nom}`);
      toast.success("Modele duplique.");
      await loadModeles();
    } catch {
      toast.error("Impossible de dupliquer le modèle. Réessayez.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (m: LMModele) => {
    setActionLoading(`def-${m.id}`);
    try {
      await setAsDefault(m.id, cabinetId);
      toast.success(`« ${m.nom} » defini comme modele par defaut.`);
      await loadModeles();
    } catch {
      toast.error("Impossible de mettre à jour le modèle par défaut.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // OPT-50: Check for signed LMs before deleting
      const { count } = await supabase
        .from("lettres_mission")
        .select("id", { count: "exact", head: true })
        .eq("modele_id", deleteTarget.id)
        .eq("statut", "signee");
      if (count && count > 0) {
        toast.warning(
          `Ce modèle est utilisé par ${count} lettre${count > 1 ? "s" : ""} signée${count > 1 ? "s" : ""}. Suppression impossible.`
        );
        setDeleting(false);
        return;
      }
      await deleteModele(deleteTarget.id);
      toast.success("Modele supprime.");
      setDeleteTarget(null);
      await loadModeles();
    } catch {
      toast.error("Impossible de supprimer le modèle. Réessayez.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEditor = async (updated: LMModele) => {
    try {
      await updateModele(updated.id, {
        nom: updated.nom,
        description: updated.description,
        sections: updated.sections,
        cgv_content: updated.cgv_content,
        repartition_taches: updated.repartition_taches,
      });
      setEditingModele(null);
      await loadModeles();
    } catch {
      toast.error("Impossible de sauvegarder les modifications.");
    }
  };

  const handleImportComplete = async () => {
    setShowImport(false);
    await loadModeles();
  };

  // ── Editing mode ──
  if (editingModele) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
        <ModeleEditor
          modele={editingModele}
          onSave={handleSaveEditor}
          onCancel={() => setEditingModele(null)}
        />
      </div>
    );
  }

  // ── Create dialog mission type config ──
  const createMtConfig = createMissionType ? getMissionTypeConfig(createMissionType) : null;
  const createSections = createSource === "grimy" && createMissionType ? buildSectionsForMissionType(createMissionType) : [];

  return (
    <div className="space-y-6">
      {/* ── Header (OPT-50) ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mes modeles de lettre de mission</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {modeles.length} modele{modeles.length > 1 ? "s" : ""} — {usedCategories} categorie{usedCategories > 1 ? "s" : ""} utilisee{usedCategories > 1 ? "s" : ""}
              {lastLoadTime && (
                <span className="ml-2 text-slate-300 dark:text-slate-600">
                  · Mis a jour {lastLoadTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
        </div>
        {/* OPT-14: Compact toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCompact(!compact)}
          className="gap-1.5 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400"
          aria-label={compact ? "Vue etendue" : "Vue compacte"}
        >
          {compact ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {compact ? "Deplier" : "Replier"}
        </Button>
      </div>

      {/* OPT-12: Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <Input
          placeholder="Rechercher un modele..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-300 dark:text-slate-600"
        />
      </div>

      {/* OPT-39: Error state */}
      {loadError && !loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">Impossible de charger les modeles</p>
          <Button variant="outline" onClick={loadModeles} className="gap-2 border-gray-200 dark:border-white/[0.06]">
            <RefreshCw className="h-4 w-4" /> Reessayer
          </Button>
        </div>
      )}

      {/* OPT-15: Loading skeleton */}
      {loading && <ModeleGridSkeleton />}

      {/* OPT-13: Search results (flat list) */}
      {!loading && !loadError && isSearching && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">{searchResults.length} resultat{searchResults.length > 1 ? "s" : ""} pour « {searchQuery} »</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {searchResults.map((m) => {
              const mtConfig = m.mission_type ? getMissionTypeConfig(m.mission_type) : null;
              return (
                <div key={m.id} className="relative">
                  {mtConfig && (
                    <Badge className="absolute -top-2 left-3 z-10 text-[8px] bg-slate-500/10 text-slate-400 dark:text-slate-500 dark:text-slate-400 border-slate-500/20">
                      {mtConfig.categoryLabel}
                    </Badge>
                  )}
                  <ModeleCard
                    modele={m}
                    usageCount={usageCounts[m.id] || 0}
                    compact={compact}
                    actionLoading={actionLoading}
                    onEdit={setEditingModele}
                    onDuplicate={handleDuplicate}
                    onSetDefault={handleSetDefault}
                    onDelete={setDeleteTarget}
                    onExport={exportModeleJson}
                    onPreview={setPreviewModele}
                  />
                </div>
              );
            })}
          </div>
          {searchResults.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500">
              Aucun modele ne correspond a votre recherche
            </div>
          )}
        </div>
      )}

      {/* ── Category Tabs (OPT-1-5) ── */}
      {!loading && !loadError && !isSearching && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MissionCategory)}>
          <TabsList className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] mb-4">
            {MISSION_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.category} value={cat.category} className="text-xs gap-1.5">
                {CATEGORY_TAB_LABELS[cat.category]}
                {/* OPT-2: Counter */}
                <span className="text-[9px] opacity-60">({categoryCounts[cat.category] || 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {MISSION_CATEGORIES.map((cat) => {
            const catModeles = getModelesByCategory(cat.category);
            return (
              <TabsContent key={cat.category} value={cat.category}>
                {/* OPT-3: Subtitle + OPT-4: Action buttons */}
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {CATEGORY_SUBTITLES[cat.category]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImport(true)}
                      className="gap-1.5 border-gray-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300"
                      aria-label="Importer un DOCX"
                    >
                      <Upload className="h-3.5 w-3.5" /> Importer DOCX
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openCreateDialog(cat.category)}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                      aria-label="Creer un nouveau modele"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nouveau modele
                    </Button>
                  </div>
                </div>

                {/* OPT-5: Empty state */}
                {catModeles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50/80 dark:bg-white/[0.04] flex items-center justify-center">
                      <FileText className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">Aucun modele pour cette categorie</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Creez un modele a partir du modele GRIMY ou importez votre DOCX existant</p>
                    </div>
                    <Button
                      onClick={() => openQuickCreate(cat.category)}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" /> Creer mon premier modele
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {catModeles.map((m) => (
                      <ModeleCard
                        key={m.id}
                        modele={m}
                        usageCount={usageCounts[m.id] || 0}
                        compact={compact}
                        actionLoading={actionLoading}
                        onEdit={setEditingModele}
                        onDuplicate={handleDuplicate}
                        onSetDefault={handleSetDefault}
                        onDelete={setDeleteTarget}
                        onExport={exportModeleJson}
                        onPreview={setPreviewModele}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* ── Import dialog ── */}
      <DocxImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        cabinetId={cabinetId}
        onImportComplete={handleImportComplete}
      />

      {/* ── Create dialog (OPT-16-25) ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>
              {createStep === 1 && "Nouveau modele — Type de mission"}
              {createStep === 2 && "Nouveau modele — Informations"}
              {createStep === 3 && "Nouveau modele — Confirmation"}
            </DialogTitle>
            <DialogDescription>
              {createStep === 1 && "Choisissez le type de mission pour lequel creer un modele."}
              {createStep === 2 && "Definissez le nom et la base du modele."}
              {createStep === 3 && "Verifiez les parametres avant de creer le modele."}
            </DialogDescription>
          </DialogHeader>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 py-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s <= createStep ? "bg-blue-500" : "bg-gray-200 dark:bg-white/[0.1]"
                }`}
              />
            ))}
          </div>

          {/* OPT-16: Step 1 — Mission type */}
          {createStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Type de mission *</Label>
                <Select value={createMissionType} onValueChange={(val) => {
                  setCreateMissionType(val);
                  const config = getMissionTypeConfig(val);
                  setCreateNom(`${config.shortLabel} — Standard`);
                }}>
                  <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]">
                    <SelectValue placeholder="Choisir un type de mission" />
                  </SelectTrigger>
                  <SelectContent>
                    {MISSION_CATEGORIES.map((cat) => (
                      <SelectGroup key={cat.category}>
                        <SelectLabel className="text-[10px] text-slate-400 dark:text-slate-500">{cat.label}</SelectLabel>
                        {cat.missions.map((mId) => {
                          const config = (MISSION_TYPES as Record<string, MissionTypeConfig>)[mId];
                          if (!config) return null;
                          return (
                            <SelectItem key={mId} value={mId}>
                              {config.label}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {createMtConfig && (
                <div className="p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] space-y-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{createMtConfig.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">
                      {createMtConfig.normeRef}
                    </Badge>
                    {createMtConfig.honorairesSuccesAutorises ? (
                      <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Succes autorises
                      </Badge>
                    ) : (
                      <Badge className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20">
                        Succes interdits
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OPT-17: Step 2 — Info */}
          {createStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Nom du modele *</Label>
                <Input
                  value={createNom}
                  onChange={(e) => setCreateNom(e.target.value)}
                  placeholder="Ex: Modele presentation TPE"
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]"
                />
                {/* OPT-23: Uniqueness warning */}
                {isNameDuplicate && (
                  <p className="text-xs text-amber-400">Un modele avec ce nom existe deja</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Description</Label>
                <Textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Decrivez l'usage de ce modele..."
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Base du modele</Label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    createSource === "grimy" ? "border-blue-500/30 bg-blue-500/5" : "border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:border-white/[0.1]"
                  }`}>
                    <input
                      type="radio"
                      name="createSource"
                      checked={createSource === "grimy"}
                      onChange={() => setCreateSource("grimy")}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Sections GRIMY adaptees au type</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Recommande — inclut toutes les sections CNOEC obligatoires</span>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    createSource === "empty" ? "border-blue-500/30 bg-blue-500/5" : "border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:border-white/[0.1]"
                  }`}>
                    <input
                      type="radio"
                      name="createSource"
                      checked={createSource === "empty"}
                      onChange={() => setCreateSource("empty")}
                      className="accent-blue-500"
                    />
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Modele vide</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Commencer de zero</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* OPT-18: Step 3 — Confirmation */}
          {createStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] space-y-3">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Resume</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-400 dark:text-slate-500">Type :</span>
                  <span className="text-slate-700 dark:text-slate-300">{createMtConfig?.shortLabel || "—"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Norme :</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{createMtConfig?.normeRef || "—"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Nom :</span>
                  <span className="text-slate-900 dark:text-white font-medium">{createNom || "—"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Base :</span>
                  <span className="text-slate-700 dark:text-slate-300">{createSource === "grimy" ? "Sections GRIMY" : "Vide"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Sections :</span>
                  <span className="text-slate-700 dark:text-slate-300">{createSections.length} section{createSections.length > 1 ? "s" : ""}</span>
                </div>
                {createSource === "grimy" && (
                  <Badge className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20">
                    <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Ce modele sera conforme aux normes CNOEC
                  </Badge>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {createStep > 1 && (
              <Button variant="outline" onClick={() => setCreateStep(createStep - 1)} className="border-gray-200 dark:border-white/[0.06]">
                Retour
              </Button>
            )}
            {createStep === 1 && (
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-gray-200 dark:border-white/[0.06]">
                Annuler
              </Button>
            )}
            {createStep < 3 ? (
              <Button
                onClick={() => setCreateStep(createStep + 1)}
                disabled={createStep === 1 && !createMissionType}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continuer
              </Button>
            ) : (
              <Button
                onClick={handleCreateNew}
                disabled={creating || !createNom.trim() || !createMissionType}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Creer le modele
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation (OPT-38) ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le modele</DialogTitle>
            <DialogDescription>Cette action est irreversible.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
            Supprimer le modele « {deleteTarget?.nom} » ? Les lettres deja generees ne seront pas affectees.
          </p>
          {/* OPT-50: Warning if modele is in use */}
          {deleteTarget && (usageCounts[deleteTarget.id] || 0) > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Ce modèle est utilisé par {usageCounts[deleteTarget.id]} lettre{usageCounts[deleteTarget.id] > 1 ? "s" : ""} de mission.
                Si des lettres signées existent, la suppression sera bloquée.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-gray-200 dark:border-white/[0.06]" autoFocus>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── OPT-49: Preview dialog ── */}
      <Dialog open={!!previewModele} onOpenChange={(open) => !open && setPreviewModele(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Apercu — {previewModele?.nom}</DialogTitle>
            <DialogDescription>
              {previewModele?.sections.length} sections · Lecture seule
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
            <div className="space-y-4 pr-4 py-2">
              {previewModele?.sections.map((s, i) => (
                <div key={`${s.id}-${i}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{String(s.ordre).padStart(2, "0")}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{s.titre}</span>
                    {s.cnoec_obligatoire && (
                      <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400">CNOEC</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 whitespace-pre-line pl-6 line-clamp-4">{s.contenu}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
