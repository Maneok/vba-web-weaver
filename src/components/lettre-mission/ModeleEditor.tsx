import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  validateCnoecCompliance,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
} from "@/lib/lettreMissionModeles";
import type { LMModele, LMSection, CnoecWarning } from "@/lib/lettreMissionModeles";
import {
  Save,
  X,
  Eye,
  Plus,
  GripVertical,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface ModeleEditorProps {
  modele: LMModele;
  onSave: (modele: LMModele) => Promise<void>;
  onCancel: () => void;
}

export default function ModeleEditor({ modele, onSave, onCancel }: ModeleEditorProps) {
  const [sections, setSections] = useState<LMSection[]>(() => [...modele.sections]);
  const [cgvContent, setCgvContent] = useState(modele.cgv_content ?? "");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cnoecExpanded, setCnoecExpanded] = useState(false);
  const [editorTab, setEditorTab] = useState("sections");

  // Drag state (simple swap-based reorder)
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── CNOEC validation ──
  const cnoecResult = useMemo(
    () => validateCnoecCompliance(sections.filter((s) => s.type === "fixed" || !s.condition || s.editable)),
    [sections]
  );

  // ── Section visibility (toggle) ──
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const toggleSection = useCallback((id: string, cnoecObligatoire: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (cnoecObligatoire) {
          // Warning shown inline — don't block
        }
      }
      return next;
    });
  }, []);

  const visibleSections = useMemo(
    () => sections.filter((s) => !hiddenIds.has(s.id)),
    [sections, hiddenIds]
  );

  // ── Section editing ──
  const selectedSection = sections[selectedIdx] ?? null;

  const updateSection = useCallback(
    (field: keyof LMSection, value: string) => {
      setSections((prev) => {
        const updated = [...prev];
        updated[selectedIdx] = { ...updated[selectedIdx], [field]: value };
        return updated;
      });
    },
    [selectedIdx]
  );

  const resetSectionToGrimy = useCallback(() => {
    if (!selectedSection) return;
    const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === selectedSection.id);
    if (grimyRef) {
      setSections((prev) => {
        const updated = [...prev];
        updated[selectedIdx] = { ...grimyRef, ordre: updated[selectedIdx].ordre };
        return updated;
      });
      toast.success("Section réinitialisée au texte GRIMY par défaut.");
    } else {
      toast.info("Aucun texte GRIMY de référence pour cette section personnalisée.");
    }
  }, [selectedSection, selectedIdx]);

  // ── Add custom section ──
  const addCustomSection = useCallback(() => {
    const id = `custom_${Date.now()}`;
    setSections((prev) => [
      ...prev,
      {
        id,
        titre: "Nouvelle section",
        contenu: "",
        type: "conditional",
        editable: true,
        cnoec_obligatoire: false,
        ordre: prev.length + 1,
      },
    ]);
    setSelectedIdx(sections.length);
  }, [sections.length]);

  // ── Drag reorder ──
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx.current === null || dragIdx.current === idx) {
      setDragOverIdx(null);
      dragIdx.current = null;
      return;
    }
    setSections((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIdx.current!, 1);
      updated.splice(idx, 0, moved);
      return updated.map((s, i) => ({ ...s, ordre: i + 1 }));
    });
    if (selectedIdx === dragIdx.current) {
      setSelectedIdx(idx);
    } else if (selectedIdx > dragIdx.current! && selectedIdx <= idx) {
      setSelectedIdx(selectedIdx - 1);
    } else if (selectedIdx < dragIdx.current! && selectedIdx >= idx) {
      setSelectedIdx(selectedIdx + 1);
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  // ── Variables detected ──
  const detectedVars = useMemo(() => {
    if (!selectedSection) return [];
    const matches = selectedSection.contenu.matchAll(/\{\{(\w+)\}\}/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }, [selectedSection]);

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...modele,
        sections: visibleSections.map((s, i) => ({ ...s, ordre: i + 1 })),
        cgv_content: cgvContent,
      });
      toast.success("Modèle sauvegardé.");
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  // ── Preview assembly ──
  const previewText = useMemo(
    () =>
      visibleSections
        .map((s) => `═══ ${s.titre} ═══\n\n${s.contenu}`)
        .join("\n\n\n"),
    [visibleSections]
  );

  // Auto-resize textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [selectedSection?.contenu]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── CNOEC banner ── */}
      {cnoecResult.warnings.length > 0 ? (
        <div className="border-b border-orange-500/20 bg-orange-500/5 px-4 py-2">
          <button
            onClick={() => setCnoecExpanded(!cnoecExpanded)}
            className="flex items-center gap-2 w-full text-left"
          >
            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
            <span className="text-sm text-orange-300 flex-1">
              {cnoecResult.warnings.length} section(s) obligatoire(s) désactivée(s) ou modifiée(s). Votre modèle peut ne pas être conforme aux normes CNOEC.
            </span>
            {cnoecExpanded ? (
              <ChevronUp className="h-4 w-4 text-orange-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-orange-400" />
            )}
          </button>
          {cnoecExpanded && (
            <div className="mt-2 space-y-1 pl-6">
              {cnoecResult.warnings.map((w) => (
                <p key={w.sectionId} className="text-xs text-orange-400/80">
                  • {w.reference} — {w.message}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="border-b border-green-500/20 bg-green-500/5 px-4 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-400" />
          <span className="text-sm text-green-300">Conforme CNOEC</span>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ── */}
        <div className="w-[260px] border-r border-white/[0.06] flex flex-col min-h-0">
          <div className="p-3 border-b border-white/[0.06]">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sections</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sections.map((section, idx) => {
                const isHidden = hiddenIds.has(section.id);
                const isSelected = idx === selectedIdx;
                const showCnoecWarning = isHidden && section.cnoec_obligatoire;

                return (
                  <div key={section.id}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => setDragOverIdx(null)}
                      onClick={() => {
                        setSelectedIdx(idx);
                        setEditorTab("sections");
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-blue-500/15 border border-blue-500/30"
                          : dragOverIdx === idx
                          ? "bg-white/[0.06] border border-dashed border-white/20"
                          : "hover:bg-white/[0.04] border border-transparent"
                      } ${isHidden ? "opacity-50" : ""}`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-slate-600 shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {section.titre}
                        </p>
                        {section.cnoec_obligatoire && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5 border-blue-500/30 text-blue-400">
                            CNOEC
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={!isHidden}
                        onCheckedChange={() =>
                          toggleSection(section.id, section.cnoec_obligatoire)
                        }
                        className="shrink-0 scale-75"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {showCnoecWarning && (
                      <Alert className="mt-1 mb-1 mx-1 border-orange-500/30 bg-orange-500/5">
                        <AlertTriangle className="h-3 w-3 text-orange-400" />
                        <AlertDescription className="text-[10px] text-orange-400 leading-tight">
                          Section requise — {section.cnoec_reference} : {section.cnoec_warning} La suppression de cette section peut engager votre responsabilité professionnelle.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-2 border-t border-white/[0.06]">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs border-white/[0.06]"
              onClick={addCustomSection}
            >
              <Plus className="h-3 w-3" /> Ajouter une section
            </Button>
          </div>
        </div>

        {/* ── Central editor ── */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={editorTab} onValueChange={setEditorTab} className="flex flex-col flex-1 min-h-0">
            <div className="px-4 pt-3 border-b border-white/[0.06]">
              <TabsList className="bg-white/[0.04]">
                <TabsTrigger value="sections" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
                  Section
                </TabsTrigger>
                <TabsTrigger value="cgv" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
                  CGV
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="sections" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0">
              {selectedSection ? (
                <>
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Titre de la section</Label>
                    <Input
                      value={selectedSection.titre}
                      onChange={(e) => updateSection("titre", e.target.value)}
                      className="bg-white/[0.04] border-white/[0.08] text-white"
                      disabled={!selectedSection.editable}
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-400">Contenu</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                        onClick={resetSectionToGrimy}
                      >
                        <RotateCcw className="h-3 w-3" /> Réinitialiser au texte GRIMY
                      </Button>
                    </div>
                    <Textarea
                      ref={textareaRef}
                      value={selectedSection.contenu}
                      onChange={(e) => updateSection("contenu", e.target.value)}
                      className="font-mono text-xs bg-white/[0.04] border-white/[0.08] text-white min-h-[200px] resize-none"
                      disabled={!selectedSection.editable}
                    />
                  </div>

                  {/* CNOEC info */}
                  {selectedSection.cnoec_obligatoire && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <ShieldCheck className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-300 space-y-0.5">
                        <p className="font-medium">{selectedSection.cnoec_reference}</p>
                        <p className="text-blue-400/70">{selectedSection.cnoec_warning}</p>
                      </div>
                    </div>
                  )}

                  <Separator className="bg-white/[0.06]" />

                  {/* Detected variables */}
                  {detectedVars.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">
                        Variables détectées ({detectedVars.length})
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedVars.map((v) => (
                          <Badge
                            key={v}
                            variant="outline"
                            className="text-[10px] font-mono border-purple-500/30 text-purple-400"
                          >
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  Sélectionnez une section à éditer
                </div>
              )}
            </TabsContent>

            <TabsContent value="cgv" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Conditions Générales d'Intervention</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                  onClick={() => {
                    setCgvContent(GRIMY_DEFAULT_CGV);
                    toast.success("CGV réinitialisées au texte GRIMY par défaut.");
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Réinitialiser aux CGV GRIMY
                </Button>
              </div>
              <Textarea
                value={cgvContent}
                onChange={(e) => setCgvContent(e.target.value)}
                className="font-mono text-xs bg-white/[0.04] border-white/[0.08] text-white min-h-[500px] resize-none"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-1.5 border-white/[0.06] text-slate-400"
        >
          <X className="h-4 w-4" /> Annuler
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="gap-1.5 border-white/[0.06] text-slate-300"
          >
            <Eye className="h-4 w-4" /> Prévisualiser
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4" /> Sauvegarder
          </Button>
        </div>
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Aperçu du modèle</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono p-4 leading-relaxed">
              {previewText}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
