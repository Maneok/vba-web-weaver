import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getModeles,
  createModele,
  deleteModele,
  duplicateModele,
  setAsDefault,
  updateModele,
  validateCnoecCompliance,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
} from "@/lib/lettreMissionModeles";
import type { LMModele } from "@/lib/lettreMissionModeles";
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
} from "lucide-react";

interface ModeleListPageProps {
  cabinetId: string;
  onBack: () => void;
}

export default function ModeleListPage({ cabinetId, onBack }: ModeleListPageProps) {
  const [modeles, setModeles] = useState<LMModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [editingModele, setEditingModele] = useState<LMModele | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LMModele | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleCreateNew = async () => {
    try {
      const m = await createModele({
        cabinet_id: cabinetId,
        nom: "Nouveau modèle",
        description: "Créé depuis le modèle GRIMY par défaut",
        sections: GRIMY_DEFAULT_SECTIONS,
        cgv_content: GRIMY_DEFAULT_CGV,
        repartition_taches: GRIMY_DEFAULT_REPARTITION,
        is_default: modeles.length === 0,
        source: "grimy",
      });
      toast.success("Modèle créé.");
      setEditingModele(m);
      await loadModeles();
    } catch {
      toast.error("Erreur lors de la création du modèle.");
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
              {modeles.length} modèle{modeles.length > 1 ? "s" : ""}
            </p>
          </div>
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
            onClick={handleCreateNew}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau modèle
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-slate-400">Chargement…</span>
        </div>
      ) : modeles.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Aucun modèle</p>
          <p className="text-slate-500 text-xs mt-1">
            Créez votre premier modèle ou importez un fichier DOCX existant
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="gap-1.5 border-white/[0.06]"
            >
              <Upload className="h-3.5 w-3.5" /> Importer DOCX
            </Button>
            <Button
              size="sm"
              onClick={handleCreateNew}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Créer un modèle GRIMY
            </Button>
          </div>
        </div>
      ) : (
        /* Modeles grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modeles.map((m) => {
            const cnoec = validateCnoecCompliance(m.sections);
            const activeSections = m.sections.length;
            const totalPossible = GRIMY_DEFAULT_SECTIONS.length;

            return (
              <Card
                key={m.id}
                className="bg-white/[0.02] border-white/[0.06] p-4 space-y-3 hover:border-white/[0.12] transition-colors"
              >
                {/* Top row */}
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

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
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

                {/* Stats */}
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

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-slate-400 hover:text-blue-400"
                    onClick={() => setEditingModele(m)}
                  >
                    <Edit3 className="h-3 w-3" /> Éditer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-slate-400 hover:text-emerald-400"
                    onClick={() => handleDuplicate(m)}
                  >
                    <Copy className="h-3 w-3" /> Dupliquer
                  </Button>
                  {!m.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-slate-400 hover:text-amber-400"
                      onClick={() => handleSetDefault(m)}
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
                    onClick={() => setDeleteTarget(m)}
                    title={m.is_default ? "Le modèle par défaut ne peut pas être supprimé" : "Supprimer"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import dialog */}
      <DocxImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        cabinetId={cabinetId}
        onImportComplete={handleImportComplete}
      />

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
