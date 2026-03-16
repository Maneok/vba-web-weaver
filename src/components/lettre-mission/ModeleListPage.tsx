import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SelectItem,
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
  createDefaultModeleForType,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
} from "@/lib/lettreMissionModeles";
import type { LMModele } from "@/lib/lettreMissionModeles";
import { MISSION_TYPES, MISSION_CATEGORIES } from "@/lib/lettreMissionTypes";
import type { MissionCategory } from "@/lib/lettreMissionTypes";
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
} from "lucide-react";

/** Get mission type config from MISSION_TYPES */
function getMissionLabel(missionType?: string): { shortLabel: string; normeRef: string } | null {
  if (!missionType) return null;
  const config = (MISSION_TYPES as Record<string, any>)[missionType];
  if (!config) return null;
  return { shortLabel: config.shortLabel, normeRef: config.normeRef };
}

/** Reusable modele card grid */
function ModeleGrid({
  modeles,
  sourceLabel,
  sourceColor,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
}: {
  modeles: LMModele[];
  sourceLabel: (s: string) => string;
  sourceColor: (s: string) => string;
  onEdit: (m: LMModele) => void;
  onDuplicate: (m: LMModele) => void;
  onSetDefault: (m: LMModele) => void;
  onDelete: (m: LMModele) => void;
}) {
  if (modeles.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-slate-500">
        Aucun modele dans cette categorie
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {modeles.map((m) => {
        const cnoec = validateCnoecCompliance(m.sections, m.mission_type);
        const activeSections = m.sections.length;
        const totalPossible = GRIMY_DEFAULT_SECTIONS.length;
        const missionInfo = getMissionLabel(m.mission_type);

        return (
          <Card
            key={m.id}
            className="bg-white/[0.02] border-white/[0.06] p-4 space-y-3 hover:border-white/[0.12] transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{m.nom}</p>
                {m.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>
                )}
              </div>
              {m.is_default && (
                <Badge className="shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]">
                  <Star className="h-2.5 w-2.5 mr-0.5" /> Par défaut
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {missionInfo && (
                <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
                  <BookOpen className="h-2.5 w-2.5 mr-0.5" /> {missionInfo.shortLabel}
                </Badge>
              )}
              {missionInfo && (
                <Badge variant="outline" className="text-[8px] border-slate-500/30 text-slate-400 font-mono">
                  {missionInfo.normeRef}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[9px] ${sourceColor(m.source)}`}>
                {sourceLabel(m.source)}
              </Badge>
              {cnoec.valid ? (
                <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400">
                  <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Conforme CNOEC
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {cnoec.warnings.length} alerte{cnoec.warnings.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-[10px] text-slate-500">
              <span>{activeSections}/{totalPossible} sections</span>
              <span>
                Modifié le{" "}
                {new Date(m.updated_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <Separator className="bg-white/[0.06]" />

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-slate-400 hover:text-blue-400"
                onClick={() => onEdit(m)}
              >
                <Edit3 className="h-3 w-3" /> Éditer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-slate-400 hover:text-emerald-400"
                onClick={() => onDuplicate(m)}
              >
                <Copy className="h-3 w-3" /> Dupliquer
              </Button>
              {!m.is_default && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-slate-400 hover:text-amber-400"
                  onClick={() => onSetDefault(m)}
                >
                  <Star className="h-3 w-3" /> Défaut
                </Button>
              )}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500 hover:text-red-400 disabled:opacity-30"
                disabled={m.is_default}
                onClick={() => onDelete(m)}
                title={m.is_default ? "Le modèle par défaut ne peut pas être supprimé" : "Supprimer"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Category tab labels */
const CATEGORY_TAB_LABELS: Record<MissionCategory, string> = {
  assurance_comptes: "Comptes historiques",
  autres_assurance: "Autres assurance",
  sans_assurance: "Sans assurance",
  activites: "Activités",
};

interface ModeleListPageProps {
  cabinetId: string;
  onBack: () => void;
}

export default function ModeleListPage({ cabinetId, onBack }: ModeleListPageProps) {
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingModele, setEditingModele] = useState<LMModele | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LMModele | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<MissionCategory>("assurance_comptes");

  // Create dialog state
  const [createNom, setCreateNom] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createMissionType, setCreateMissionType] = useState("");
  const [createSource, setCreateSource] = useState<"grimy" | "empty">("grimy");
  const [creating, setCreating] = useState(false);

  const loadModeles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getModeles(cabinetId);
      setModeles(data);
    } catch (err) {
      logger.error("LM_MODELES", "loadModeles error", err);
      toast.error("Erreur lors du chargement des modèles.");
    } finally {
      setLoading(false);
    }
  }, [cabinetId]);

  useEffect(() => {
    loadModeles();
  }, [loadModeles]);

  /** Get missions available for active category */
  const activeCategoryMissions = useMemo(() => {
    const cat = MISSION_CATEGORIES.find((c) => c.category === activeTab);
    if (!cat) return [];
    return cat.missions.map((mId) => {
      const config = (MISSION_TYPES as Record<string, any>)[mId];
      return config ? { id: mId, label: config.label, shortLabel: config.shortLabel } : null;
    }).filter(Boolean) as { id: string; label: string; shortLabel: string }[];
  }, [activeTab]);

  /** Filter modeles by active category */
  const filteredModeles = useMemo(() => {
    const cat = MISSION_CATEGORIES.find((c) => c.category === activeTab);
    if (!cat) return [];
    return modeles.filter((m) => {
      if (!m.mission_type) return false;
      return cat.missions.includes(m.mission_type);
    });
  }, [modeles, activeTab]);

  /** Count modeles per category */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of MISSION_CATEGORIES) {
      counts[cat.category] = modeles.filter((m) =>
        m.mission_type && cat.missions.includes(m.mission_type)
      ).length;
    }
    return counts;
  }, [modeles]);

  const openCreateDialog = () => {
    const defaultMission = activeCategoryMissions[0]?.id || "";
    setCreateNom("");
    setCreateDescription("");
    setCreateMissionType(defaultMission);
    setCreateSource("grimy");
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
      toast.success("Modèle créé.");
      setShowCreate(false);
      setEditingModele(m);
      await loadModeles();
    } catch {
      toast.error("Erreur lors de la création du modèle.");
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (m: LMModele) => {
    try {
      await duplicateModele(m.id, `${m.nom} (copie)`);
      toast.success("Modèle dupliqué.");
      await loadModeles();
    } catch {
      toast.error("Erreur lors de la duplication.");
    }
  };

  const handleSetDefault = async (m: LMModele) => {
    try {
      await setAsDefault(m.id, cabinetId);
      toast.success(`« ${m.nom} » défini comme modèle par défaut.`);
      await loadModeles();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteModele(deleteTarget.id);
      toast.success("Modèle supprimé.");
      setDeleteTarget(null);
      await loadModeles();
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEditor = async (updated: LMModele) => {
    await updateModele(updated.id, {
      nom: updated.nom,
      description: updated.description,
      sections: updated.sections,
      cgv_content: updated.cgv_content,
      repartition_taches: updated.repartition_taches,
    });
    setEditingModele(null);
    await loadModeles();
  };

  const handleImportComplete = async () => {
    setShowImport(false);
    await loadModeles();
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case "grimy": return "GRIMY";
      case "import_docx": return "Import DOCX";
      case "duplicate": return "Copie";
      default: return source;
    }
  };

  const sourceColor = (source: string) => {
    switch (source) {
      case "grimy": return "border-blue-500/30 text-blue-400";
      case "import_docx": return "border-purple-500/30 text-purple-400";
      case "duplicate": return "border-slate-500/30 text-slate-400";
      default: return "border-slate-500/30 text-slate-400";
    }
  };

  // ── Editing mode ──
  if (editingModele) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ModeleEditor
          modele={editingModele}
          onSave={handleSaveEditor}
          onCancel={() => setEditingModele(null)}
        />
      </div>
    );
  }

  const activeCat = MISSION_CATEGORIES.find((c) => c.category === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white">Mes modèles de lettre de mission</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {modeles.length} modèle{modeles.length > 1 ? "s" : ""} — organisés par catégorie normative OEC
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-slate-400">Chargement…</span>
        </div>
      ) : (
        /* Category tabs */
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MissionCategory)}>
          <TabsList className="bg-white/[0.03] border border-white/[0.06] mb-4">
            {MISSION_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.category} value={cat.category} className="text-xs gap-1.5">
                {CATEGORY_TAB_LABELS[cat.category]}
                <span className="text-[9px] opacity-60">({categoryCounts[cat.category] || 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {MISSION_CATEGORIES.map((cat) => (
            <TabsContent key={cat.category} value={cat.category}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-300">{cat.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Types : {cat.missions.map((mId) => {
                      const c = (MISSION_TYPES as Record<string, any>)[mId];
                      return c?.shortLabel || mId;
                    }).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImport(true)}
                    className="gap-1.5 border-white/[0.06] text-slate-300"
                  >
                    <Upload className="h-3.5 w-3.5" /> Importer DOCX
                  </Button>
                  <Button
                    size="sm"
                    onClick={openCreateDialog}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nouveau modèle
                  </Button>
                </div>
              </div>

              {/* Modeles grid */}
              <ModeleGrid
                modeles={modeles.filter((m) =>
                  m.mission_type && cat.missions.includes(m.mission_type)
                )}
                sourceLabel={sourceLabel}
                sourceColor={sourceColor}
                onEdit={setEditingModele}
                onDuplicate={handleDuplicate}
                onSetDefault={handleSetDefault}
                onDelete={setDeleteTarget}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Import dialog */}
      <DocxImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        cabinetId={cabinetId}
        onImportComplete={handleImportComplete}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau modèle</DialogTitle>
            <DialogDescription>
              Créez un modèle pour la catégorie « {activeCat?.label || ""} »
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Nom du modèle *</Label>
              <Input
                value={createNom}
                onChange={(e) => setCreateNom(e.target.value)}
                placeholder="Ex: Modèle présentation TPE"
                className="bg-white/[0.04] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Type de mission *</Label>
              <Select value={createMissionType} onValueChange={setCreateMissionType}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]">
                  <SelectValue placeholder="Choisir un type de mission" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategoryMissions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Description</Label>
              <Textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Description optionnelle..."
                className="bg-white/[0.04] border-white/[0.08] min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Base du modèle</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="createSource"
                    checked={createSource === "grimy"}
                    onChange={() => setCreateSource("grimy")}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-slate-300">Sections GRIMY adaptées au type</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="createSource"
                    checked={createSource === "empty"}
                    onChange={() => setCreateSource("empty")}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-slate-300">Vide</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-white/[0.06]">
              Annuler
            </Button>
            <Button
              onClick={handleCreateNew}
              disabled={creating || !createNom.trim() || !createMissionType}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le modèle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le modèle</DialogTitle>
            <DialogDescription>Cette action est definitive et ne peut pas etre annulee.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            Êtes-vous sûr de vouloir supprimer le modèle « {deleteTarget?.nom} » ? Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-white/[0.06]">
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
