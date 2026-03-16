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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  validateCnoecCompliance,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
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
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  Circle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

interface ModeleEditorProps {
  modele: LMModele;
  onSave: (modele: LMModele) => Promise<void>;
  onCancel: () => void;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function ModeleEditor({ modele, onSave, onCancel }: ModeleEditorProps) {
  const [sections, setSections] = useState<LMSection[]>(() => [...modele.sections]);
  const [cgvContent, setCgvContent] = useState(modele.cgv_content ?? "");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cnoecExpanded, setCnoecExpanded] = useState(false);
  const [editorTab, setEditorTab] = useState("sections");
  const [sectionSearch, setSectionSearch] = useState("");
  const [repartition, setRepartition] = useState<any[]>(() => [...(modele.repartition_taches ?? GRIMY_DEFAULT_REPARTITION)]);

  // Drag state (simple swap-based reorder)
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Original snapshot for unsaved changes detection ──
  const originalRef = useRef({
    sections: JSON.stringify(modele.sections),
    cgv: modele.cgv_content ?? "",
    repartition: JSON.stringify(modele.repartition_taches ?? GRIMY_DEFAULT_REPARTITION),
  });

  const hasUnsavedChanges = useMemo(() => {
    return (
      JSON.stringify(sections) !== originalRef.current.sections ||
      cgvContent !== originalRef.current.cgv ||
      JSON.stringify(repartition) !== originalRef.current.repartition
    );
  }, [sections, cgvContent, repartition]);

  // ── CNOEC validation ──
  const cnoecResult = useMemo(
    () => validateCnoecCompliance(sections.filter((s) => s.type === "fixed" || !s.condition || s.editable)),
    [sections]
  );

  // ── Section visibility (toggle) — init from hidden flag ──
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    modele.sections.forEach((s) => {
      if ((s as any).hidden) ids.add(s.id);
    });
    return ids;
  });

  const toggleSection = useCallback((id: string, cnoecObligatoire: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const visibleSections = useMemo(
    () => sections.filter((s) => !hiddenIds.has(s.id)),
    [sections, hiddenIds]
  );

  // ── Section filtering ──
  const filteredSectionIndices = useMemo(() => {
    if (!sectionSearch.trim()) return sections.map((_, i) => i);
    const q = sectionSearch.toLowerCase();
    return sections.reduce<number[]>((acc, s, i) => {
      if (s.titre.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [sections, sectionSearch]);

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

  const resetAllToGrimy = useCallback(() => {
    setSections(GRIMY_DEFAULT_SECTIONS.map((s, i) => ({ ...s, ordre: i + 1 })));
    setCgvContent(GRIMY_DEFAULT_CGV);
    setRepartition([...GRIMY_DEFAULT_REPARTITION]);
    setHiddenIds(new Set());
    setSelectedIdx(0);
    toast.success("Toutes les sections réinitialisées aux valeurs GRIMY par défaut.");
  }, []);

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

  // ── Delete custom section ──
  const deleteCustomSection = useCallback((idx: number) => {
    const section = sections[idx];
    if (!section?.id.startsWith("custom_")) return;
    setSections((prev) => {
      const updated = prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordre: i + 1 }));
      return updated;
    });
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(section.id);
      return next;
    });
    if (selectedIdx >= sections.length - 1) setSelectedIdx(Math.max(0, sections.length - 2));
    else if (selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
    toast.success("Section personnalisée supprimée.");
  }, [sections, selectedIdx]);

  // ── Move up/down ──
  const moveSection = useCallback((idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    setSections((prev) => {
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
      return updated.map((s, i) => ({ ...s, ordre: i + 1 }));
    });
    if (selectedIdx === idx) setSelectedIdx(targetIdx);
    else if (selectedIdx === targetIdx) setSelectedIdx(idx);
  }, [selectedIdx]);

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

  // ── Save (BUG FIX: save ALL sections, mark hidden ones) ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const allSections = sections.map((s, i) => ({
        ...s,
        ordre: i + 1,
        hidden: hiddenIds.has(s.id),
      }));
      await onSave({
        ...modele,
        sections: allSections as any,
        cgv_content: cgvContent,
        repartition_taches: repartition,
      });
      originalRef.current = {
        sections: JSON.stringify(sections),
        cgv: cgvContent,
        repartition: JSON.stringify(repartition),
      };
      toast.success("Modèle sauvegardé.");
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  // ── Keyboard shortcut: Ctrl+S ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ── Preview assembly (with CGV + section numbers) ──
  const previewText = useMemo(() => {
    const sectionText = visibleSections
      .map((s, i) => `${i + 1}. ═══ ${s.titre} ═══\n\n${s.contenu}`)
      .join("\n\n\n");
    const cgvPart = cgvContent.trim()
      ? `\n\n${"═".repeat(40)}\nCONDITIONS GÉNÉRALES D'INTERVENTION\n${"═".repeat(40)}\n\n${cgvContent}`
      : "";
    return sectionText + cgvPart;
  }, [visibleSections, cgvContent]);

  // ── Auto-resize textarea ──
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${Math.max(200, el.scrollHeight)}px`;
    }
  }, [selectedSection?.contenu]);

  // ── Repartition helpers ──
  const addTache = useCallback(() => {
    setRepartition((prev) => [
      ...prev,
      { id: `tache_${Date.now()}`, label: "", cabinet: true, client: false, periodicite: "Mensuel" },
    ]);
  }, []);

  const updateTache = useCallback((idx: number, field: string, value: any) => {
    setRepartition((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const removeTache = useCallback((idx: number) => {
    setRepartition((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Recalculate cnoecCoverage with hiddenIds (need to reference after hiddenIds is declared)
  const cnoecCov = useMemo(() => {
    const obligatoire = GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire);
    const present = obligatoire.filter((o) => sections.some((s) => s.id === o.id && !hiddenIds.has(s.id)));
    return { total: obligatoire.length, covered: present.length };
  }, [sections, hiddenIds]);

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
        <div className="w-[280px] border-r border-white/[0.06] flex flex-col min-h-0">
          <div className="p-3 border-b border-white/[0.06] space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sections</p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
              <Input
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                placeholder="Filtrer les sections..."
                className="h-7 pl-7 text-xs bg-white/[0.04] border-white/[0.08]"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredSectionIndices.map((idx) => {
                const section = sections[idx];
                const isHidden = hiddenIds.has(section.id);
                const isSelected = idx === selectedIdx;
                const showCnoecWarning = isHidden && section.cnoec_obligatoire;
                const isEmpty = !section.contenu.trim();
                const wc = wordCount(section.contenu);

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
                      className={`flex items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-blue-500/15 border border-blue-500/30"
                          : dragOverIdx === idx
                          ? "bg-white/[0.06] border border-dashed border-white/20"
                          : "hover:bg-white/[0.04] border border-transparent"
                      } ${isHidden ? "opacity-50" : ""}`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-slate-600 shrink-0 cursor-grab" />
                      {/* Empty content warning dot */}
                      {isEmpty && !isHidden && (
                        <Circle className="h-2 w-2 text-orange-400 fill-orange-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {section.titre}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {section.cnoec_obligatoire && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[8px] px-1 py-0 border-blue-500/30 text-blue-400 cursor-help">
                                  CNOEC
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px] text-xs">
                                {section.cnoec_reference ?? "Référence CNOEC"}{section.cnoec_warning ? ` — ${section.cnoec_warning}` : ""}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Badge variant="outline" className={`text-[7px] px-1 py-0 ${section.type === "fixed" ? "border-slate-500/30 text-slate-400" : "border-violet-500/30 text-violet-400"}`}>
                            {section.type === "fixed" ? "fixe" : "cond."}
                          </Badge>
                          <span className="text-[9px] text-slate-500">{wc} mot{wc !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      {/* Move up/down */}
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, "up"); }}
                          className="p-0.5 hover:text-slate-200 text-slate-500 disabled:opacity-30"
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, "down"); }}
                          className="p-0.5 hover:text-slate-200 text-slate-500 disabled:opacity-30"
                          disabled={idx === sections.length - 1}
                        >
                          <ArrowDown className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <Switch
                        checked={!isHidden}
                        onCheckedChange={() =>
                          toggleSection(section.id, section.cnoec_obligatoire)
                        }
                        className="shrink-0 scale-75"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {/* Delete custom section */}
                      {section.id.startsWith("custom_") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCustomSection(idx); }}
                          className="p-0.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
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
          <div className="p-2 border-t border-white/[0.06] space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs border-white/[0.06]"
              onClick={addCustomSection}
            >
              <Plus className="h-3 w-3" /> Ajouter une section
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-[10px] text-slate-500 hover:text-orange-300"
              onClick={resetAllToGrimy}
            >
              <RotateCcw className="h-3 w-3" /> Tout réinitialiser
            </Button>
          </div>
        </div>

        {/* ── Central editor ── */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={editorTab} onValueChange={setEditorTab} className="flex flex-col flex-1 min-h-0">
            <div className="px-4 pt-3 border-b border-white/[0.06] flex items-center justify-between">
              <TabsList className="bg-white/[0.04]">
                <TabsTrigger value="sections" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
                  Section
                </TabsTrigger>
                <TabsTrigger value="cgv" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
                  CGV
                </TabsTrigger>
                <TabsTrigger value="repartition" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 gap-1">
                  <ListChecks className="h-3 w-3" /> Répartition
                </TabsTrigger>
              </TabsList>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400 animate-pulse">
                  Modifications non sauvegardées
                </Badge>
              )}
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
                    <div className="flex justify-end gap-3 text-[10px] text-slate-500">
                      <span>{selectedSection.contenu.length} caractère{selectedSection.contenu.length !== 1 ? "s" : ""}</span>
                      <span>{wordCount(selectedSection.contenu)} mot{wordCount(selectedSection.contenu) !== 1 ? "s" : ""}</span>
                    </div>
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
              <div className="flex justify-end text-[10px] text-slate-500">
                <span>{cgvContent.length} caractères</span>
              </div>
            </TabsContent>

            <TabsContent value="repartition" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Répartition des tâches cabinet / client</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                    onClick={() => {
                      setRepartition([...GRIMY_DEFAULT_REPARTITION]);
                      toast.success("Répartition réinitialisée.");
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Réinitialiser
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] border-white/[0.06]" onClick={addTache}>
                    <Plus className="h-3 w-3" /> Ajouter
                  </Button>
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_70px_70px_100px_36px] gap-0 bg-white/[0.04] px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  <span>Tâche</span>
                  <span className="text-center">Cabinet</span>
                  <span className="text-center">Client</span>
                  <span className="text-center">Périodicité</span>
                  <span></span>
                </div>
                {repartition.map((t, idx) => (
                  <div key={t.id || idx} className="grid grid-cols-[1fr_70px_70px_100px_36px] gap-0 px-3 py-1.5 border-t border-white/[0.06] items-center">
                    <Input
                      value={t.label}
                      onChange={(e) => updateTache(idx, "label", e.target.value)}
                      className="h-7 text-xs bg-transparent border-none px-0 text-white"
                      placeholder="Description de la tâche..."
                    />
                    <div className="flex justify-center">
                      <Switch
                        checked={t.cabinet}
                        onCheckedChange={(v) => updateTache(idx, "cabinet", v)}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={t.client}
                        onCheckedChange={(v) => updateTache(idx, "client", v)}
                        className="scale-75"
                      />
                    </div>
                    <select
                      value={t.periodicite}
                      onChange={(e) => updateTache(idx, "periodicite", e.target.value)}
                      className="h-7 text-xs bg-white/[0.04] border border-white/[0.08] rounded px-1 text-slate-300"
                    >
                      <option value="Mensuel">Mensuel</option>
                      <option value="Trimestriel">Trimestriel</option>
                      <option value="Annuel">Annuel</option>
                      <option value="Permanent">Permanent</option>
                      <option value="Ponctuel">Ponctuel</option>
                    </select>
                    <button
                      onClick={() => removeTache(idx)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="gap-1.5 border-white/[0.06] text-slate-400"
          >
            <X className="h-4 w-4" /> Annuler
          </Button>
          <span className="text-[10px] text-slate-500">
            {visibleSections.length}/{sections.length} sections actives · CNOEC {cnoecCov.covered}/{cnoecCov.total}
          </span>
        </div>
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
            <Save className="h-4 w-4" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
            <span className="text-[10px] opacity-60 ml-1">⌘S</span>
          </Button>
        </div>
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Aperçu du modèle</DialogTitle>
            <DialogDescription>Visualisez le contenu genere par le modele avant enregistrement.</DialogDescription>
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
