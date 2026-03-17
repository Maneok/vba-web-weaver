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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  validateCnoecCompliance,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
  buildSectionsForMissionType,
} from "@/lib/lettreMissionModeles";
import type { LMModele, LMSection, CnoecWarning } from "@/lib/lettreMissionModeles";
import { MISSION_TYPES, getMissionTypeConfig } from "@/lib/lettreMissionTypes";
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
  ChevronRight,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Circle,
  ListChecks,
  Copy,
  Download,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Info,
  BookOpen,
  Undo2,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  Minus as MinusIcon,
  Plus as PlusIcon,
  EyeOff,
  Variable,
  FileJson,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──
interface ModeleEditorProps {
  modele: LMModele;
  onSave: (modele: LMModele) => Promise<void>;
  onCancel: () => void;
  onDuplicate?: (modele: LMModele) => void;
  onDelete?: (modele: LMModele) => void;
  usedInCount?: number;
}

// ── Constants ──
const SECTION_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Sections principales", ids: ["introduction", "destinataire", "entite", "mission", "nature_limite", "duree", "honoraires"] },
  { label: "Obligations", ids: ["lcbft", "responsable_mission", "referentiel_comptable", "forme_rapport"] },
  { label: "Missions complementaires", ids: ["mission_sociale", "mission_juridique", "mission_controle_fiscal"] },
  { label: "Clauses optionnelles", ids: ["clause_resolutoire", "mandat_fiscal", "informations_client", "equipe_audit", "planning_audit", "declarations_ecrites", "objet_attestation", "nature_travaux_attestation", "utilisation_prevue", "destinataires_info", "nature_hypotheses", "periode_couverte", "contexte_mission", "informations_examinees", "procedures_detail", "calendrier_procedures", "diffusion_rapport"] },
];

const VARIABLE_GROUPS: { label: string; vars: string[] }[] = [
  { label: "Client", vars: ["raison_sociale", "siren", "dirigeant", "forme_juridique", "adresse", "ville", "cp", "capital", "ape", "effectif", "date_creation", "domaine"] },
  { label: "Mission", vars: ["responsable_mission", "exercice_debut", "exercice_fin", "date_cloture", "type_mission", "duree_mission", "mode_comptable"] },
  { label: "Cabinet", vars: ["nom_cabinet", "adresse_cabinet", "ville_cabinet", "siret_cabinet", "oec_numero", "associe", "assureur_nom", "email_cabinet", "telephone_cabinet"] },
  { label: "Honoraires", vars: ["honoraires", "setup", "frequence", "honoraires_juridique", "honoraires_social", "taux_tva"] },
  { label: "Dates", vars: ["date_du_jour", "date_signature", "date_debut_exercice", "date_fin_exercice"] },
];

const TABLE_SECTION_IDS = new Set(["entite", "honoraires", "repartition"]);
const FONT_SIZES = [13, 15, 17] as const;

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getSectionGroup(id: string): string {
  for (const g of SECTION_GROUPS) {
    if (g.ids.includes(id)) return g.label;
  }
  return "Clauses optionnelles";
}

// ── Main Component ──
export default function ModeleEditor({
  modele,
  onSave,
  onCancel,
  onDuplicate,
  onDelete,
  usedInCount,
}: ModeleEditorProps) {
  // ── Core state ──
  const [sections, setSections] = useState<LMSection[]>(() => [...modele.sections]);
  const [cgvContent, setCgvContent] = useState(modele.cgv_content ?? "");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<"saved" | "unsaved" | "saving">("saved");
  const [showPreview, setShowPreview] = useState(false);
  const [cnoecExpanded, setCnoecExpanded] = useState(false);
  const [editorTab, setEditorTab] = useState("sections");
  const [sectionSearch, setSectionSearch] = useState("");
  const [repartition, setRepartition] = useState<any[]>(() => [...(modele.repartition_taches ?? GRIMY_DEFAULT_REPARTITION)]);

  // OPT-7: Unsaved changes leave confirmation
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // OPT-9: Right panel responsive
  const [showRightPanel, setShowRightPanel] = useState(false);

  // OPT-10: Fullscreen editor
  const [fullscreen, setFullscreen] = useState(false);

  // OPT-16: Add section dialog
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");

  // OPT-21: Collapsible groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  // OPT-31: Reset confirmation
  const [showResetDialog, setShowResetDialog] = useState(false);

  // OPT-36: Preview mode
  const [previewMode, setPreviewMode] = useState(false);

  // OPT-37: Font size
  const [fontSizeIdx, setFontSizeIdx] = useState(1);

  // OPT-46: Export JSON
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Original snapshot for unsaved changes detection (OPT-4) ──
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

  // Update save indicator
  useEffect(() => {
    if (hasUnsavedChanges && lastSaved !== "saving") setLastSaved("unsaved");
    else if (!hasUnsavedChanges && lastSaved !== "saving") setLastSaved("saved");
  }, [hasUnsavedChanges]);

  // ── Section visibility (OPT-14/15) ──
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    modele.sections.forEach((s) => {
      if (s.hidden) ids.add(s.id);
    });
    return ids;
  });

  // ── CNOEC validation (OPT-42: pass mission_type) ──
  const cnoecResult = useMemo(
    () => {
      const activeSections = sections.filter((s) => !hiddenIds.has(s.id));
      return validateCnoecCompliance(activeSections, modele.mission_type);
    },
    [sections, hiddenIds, modele.mission_type]
  );

  const toggleSection = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  // ── OPT-20: Group sections ──
  const groupedFilteredIndices = useMemo(() => {
    const groups: { label: string; indices: number[] }[] = [];
    const groupMap = new Map<string, number[]>();
    for (const idx of filteredSectionIndices) {
      const section = sections[idx];
      const groupLabel = section.id.startsWith("custom_") ? "Sections personnalisees" : getSectionGroup(section.id);
      if (!groupMap.has(groupLabel)) groupMap.set(groupLabel, []);
      groupMap.get(groupLabel)!.push(idx);
    }
    // Preserve group order
    const orderedLabels = [...SECTION_GROUPS.map((g) => g.label), "Sections personnalisees"];
    for (const label of orderedLabels) {
      const indices = groupMap.get(label);
      if (indices && indices.length > 0) groups.push({ label, indices });
    }
    return groups;
  }, [filteredSectionIndices, sections]);

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

  // OPT-31: Reset with confirmation
  const resetSectionToGrimy = useCallback(() => {
    if (!selectedSection) return;
    const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === selectedSection.id)
      ?? buildSectionsForMissionType(modele.mission_type || "presentation").find((s) => s.id === selectedSection.id);
    if (grimyRef) {
      setSections((prev) => {
        const updated = [...prev];
        updated[selectedIdx] = { ...grimyRef, ordre: updated[selectedIdx].ordre };
        return updated;
      });
      toast.success("Section reinitialisee au texte GRIMY par defaut.");
    } else {
      toast.info("Aucun texte GRIMY de reference pour cette section personnalisee.");
    }
  }, [selectedSection, selectedIdx, modele.mission_type]);

  const resetAllToGrimy = useCallback(() => {
    const base = modele.mission_type
      ? buildSectionsForMissionType(modele.mission_type)
      : GRIMY_DEFAULT_SECTIONS;
    setSections(base.map((s, i) => ({ ...s, ordre: i + 1 })));
    setCgvContent(GRIMY_DEFAULT_CGV);
    setRepartition([...GRIMY_DEFAULT_REPARTITION]);
    setHiddenIds(new Set());
    setSelectedIdx(0);
    toast.success("Toutes les sections reinitialisees aux valeurs GRIMY par defaut.");
  }, [modele.mission_type]);

  // ── OPT-16: Add custom section via dialog ──
  const addCustomSection = useCallback(() => {
    if (!newSectionTitle.trim()) {
      toast.error("Titre requis");
      return;
    }
    const id = `custom_${Date.now()}`;
    setSections((prev) => [
      ...prev,
      {
        id,
        titre: newSectionTitle.trim(),
        contenu: newSectionContent,
        type: "conditional",
        editable: true,
        cnoec_obligatoire: false,
        ordre: prev.length + 1,
      },
    ]);
    setSelectedIdx(sections.length);
    setShowAddSection(false);
    setNewSectionTitle("");
    setNewSectionContent("");
    toast.success("Section ajoutee.");
  }, [newSectionTitle, newSectionContent, sections.length]);

  // ── Delete custom section (OPT-17) ──
  const deleteCustomSection = useCallback((idx: number) => {
    const section = sections[idx];
    if (section.cnoec_obligatoire) return;
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
    toast.success("Section supprimee.");
  }, [sections, selectedIdx]);

  // ── OPT-18: Duplicate section ──
  const duplicateSection = useCallback((idx: number) => {
    const section = sections[idx];
    const id = `custom_${Date.now()}`;
    const dupe: LMSection = {
      ...section,
      id,
      titre: `${section.titre} (copie)`,
      cnoec_obligatoire: false,
      editable: true,
      ordre: sections.length + 1,
    };
    setSections((prev) => [...prev, dupe]);
    setSelectedIdx(sections.length);
    toast.success("Section dupliquee.");
  }, [sections]);

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

  // ── Drag reorder (OPT-13) ──
  const handleDragStart = (idx: number) => { dragIdx.current = idx; };

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
    if (selectedIdx === dragIdx.current) setSelectedIdx(idx);
    else if (selectedIdx > dragIdx.current! && selectedIdx <= idx) setSelectedIdx(selectedIdx - 1);
    else if (selectedIdx < dragIdx.current! && selectedIdx >= idx) setSelectedIdx(selectedIdx + 1);
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  // ── Variables detected (OPT-28) ──
  const detectedVars = useMemo(() => {
    if (!selectedSection) return [];
    const matches = selectedSection.contenu.matchAll(/\{\{(\w+)\}\}/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }, [selectedSection]);

  // ── OPT-44: All variables across all sections ──
  const allDetectedVars = useMemo(() => {
    const vars = new Set<string>();
    for (const s of sections) {
      for (const m of s.contenu.matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1]);
    }
    if (cgvContent) {
      for (const m of cgvContent.matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1]);
    }
    return [...vars].sort();
  }, [sections, cgvContent]);

  // ── OPT-29: Insert variable at cursor ──
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertVariable = useCallback((varName: string) => {
    const el = textareaRef.current;
    if (!el || !selectedSection) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = selectedSection.contenu;
    const insert = `{{${varName}}}`;
    const newText = text.slice(0, start) + insert + text.slice(end);
    updateSection("contenu", newText);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + insert.length;
        textareaRef.current.selectionEnd = start + insert.length;
        textareaRef.current.focus();
      }
    });
  }, [selectedSection, updateSection]);

  // ── Save (OPT-4/5) ──
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setLastSaved("saving");
    try {
      const allSections = sections.map((s, i) => ({
        ...s,
        ordre: i + 1,
        hidden: hiddenIds.has(s.id),
      }));
      await onSave({
        ...modele,
        sections: allSections,
        cgv_content: cgvContent,
        repartition_taches: repartition,
      });
      originalRef.current = {
        sections: JSON.stringify(sections),
        cgv: cgvContent,
        repartition: JSON.stringify(repartition),
      };
      setLastSaved("saved");
      toast.success("Modele sauvegarde.");
    } catch {
      setLastSaved("unsaved");
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }, [sections, cgvContent, repartition, hiddenIds, modele, onSave, saving]);

  // ── OPT-5: Auto-save debounce (5s) ──
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [sections, cgvContent, repartition, hasUnsavedChanges]);

  // ── OPT-6: Keyboard shortcut Ctrl+S ──
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

  // ── OPT-25: Arrow key navigation ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowUp" && selectedIdx > 0) {
        e.preventDefault();
        setSelectedIdx(selectedIdx - 1);
      } else if (e.key === "ArrowDown" && selectedIdx < sections.length - 1) {
        e.preventDefault();
        setSelectedIdx(selectedIdx + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdx, sections.length]);

  // ── OPT-7: Beforeunload warning ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveDialog(true);
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${Math.max(150, Math.min(500, el.scrollHeight))}px`;
    }
  }, [selectedSection?.contenu, fontSizeIdx]);

  // ── OPT-24: Scroll to section on click ──
  const editorAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    editorAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedIdx]);

  // ── Preview assembly ──
  const previewText = useMemo(() => {
    const sectionText = visibleSections
      .map((s, i) => `${i + 1}. ${"═".repeat(3)} ${s.titre} ${"═".repeat(3)}\n\n${s.contenu}`)
      .join("\n\n\n");
    const cgvPart = cgvContent.trim()
      ? `\n\n${"═".repeat(40)}\nCONDITIONS GENERALES D'INTERVENTION\n${"═".repeat(40)}\n\n${cgvContent}`
      : "";
    return sectionText + cgvPart;
  }, [visibleSections, cgvContent]);

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

  // ── OPT-32: Copy text ──
  const copyContent = useCallback(() => {
    if (!selectedSection) return;
    navigator.clipboard.writeText(selectedSection.contenu);
    toast.success("Copie !");
  }, [selectedSection]);

  // ── Computed values ──
  const cnoecCov = useMemo(() => {
    const obligatoire = GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire);
    const present = obligatoire.filter((o) => sections.some((s) => s.id === o.id && !hiddenIds.has(s.id)));
    return { total: obligatoire.length, covered: present.length };
  }, [sections, hiddenIds]);

  const missionTypeConfig = useMemo(() =>
    getMissionTypeConfig(modele.mission_type || "presentation"),
    [modele.mission_type]
  );

  // OPT-22: Progress bar
  const filledCount = useMemo(() =>
    visibleSections.filter((s) => s.contenu.trim().length > 0).length,
    [visibleSections]
  );

  // OPT-45: Checklist auto
  const checklist = useMemo(() => [
    { label: "Toutes les sections obligatoires sont actives", done: cnoecCov.covered === cnoecCov.total },
    { label: "Les CGV sont personnalisees", done: cgvContent.trim().length > 50 },
    { label: "Le tableau de repartition est rempli", done: repartition.length > 0 && repartition.every((t: any) => t.label.trim()) },
    { label: "Les honoraires types sont definis", done: sections.some((s) => s.id === "honoraires" && s.contenu.trim().length > 0 && !hiddenIds.has(s.id)) },
  ], [cnoecCov, cgvContent, repartition, sections, hiddenIds]);

  // OPT-46: Export JSON
  const exportJSON = useCallback(() => {
    const data = {
      nom: modele.nom,
      mission_type: modele.mission_type,
      source: modele.source,
      sections: sections.map((s, i) => ({ ...s, ordre: i + 1, hidden: hiddenIds.has(s.id) })),
      cgv_content: cgvContent,
      repartition_taches: repartition,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele_${modele.nom.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Modele exporte en JSON.");
  }, [modele, sections, hiddenIds, cgvContent, repartition]);

  // ── Known resolved variables ──
  const RESOLVED_VARS = new Set(["date_du_jour", "date_signature", "nom_cabinet", "adresse_cabinet", "ville_cabinet", "siret_cabinet", "oec_numero", "email_cabinet", "telephone_cabinet"]);

  // ── RENDER ──
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ═══ OPT-2: Header ═══ */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center gap-3 flex-wrap">
        {/* OPT-2: Breadcrumb */}
        <button onClick={handleCancel} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Modeles
        </button>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <span className="text-sm font-medium text-white truncate max-w-[200px]">{modele.nom}</span>

        {/* OPT-2/3: Mission type badge (read-only with tooltip) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">
                {missionTypeConfig.shortLabel}
              </Badge>
              <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400 font-mono">
                {missionTypeConfig.normeRef}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[300px] text-xs">
            Le type de mission ne peut pas etre modifie apres creation. Pour un autre type, creez un nouveau modele.
          </TooltipContent>
        </Tooltip>

        {/* OPT-2: CNOEC badge */}
        {cnoecResult.warnings.length === 0 ? (
          <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Conforme
          </Badge>
        ) : (
          <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] gap-1 cursor-pointer"
            onClick={() => setCnoecExpanded(!cnoecExpanded)}>
            <AlertTriangle className="h-3 w-3" /> {cnoecResult.warnings.length} avert.
          </Badge>
        )}

        {/* OPT-4: Save indicator */}
        <div className="flex items-center gap-1.5 ml-auto">
          {lastSaved === "saved" && !hasUnsavedChanges && (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Sauvegarde
            </span>
          )}
          {lastSaved === "unsaved" && hasUnsavedChanges && (
            <span className="text-[10px] text-yellow-400 animate-pulse">Modifications non sauvegardees</span>
          )}
          {lastSaved === "saving" && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1">
              <RotateCcw className="h-3 w-3 animate-spin" /> Sauvegarde en cours...
            </span>
          )}
        </div>

        {/* OPT-9: Info button (mobile) */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden h-7 w-7 p-0 text-slate-400"
          onClick={() => setShowRightPanel(!showRightPanel)}
        >
          <Info className="h-4 w-4" />
        </Button>

        {/* OPT-10: Fullscreen toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400"
          onClick={() => setFullscreen(!fullscreen)}
          title={fullscreen ? "Quitter le plein ecran" : "Plein ecran"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        {/* OPT-2: Action buttons */}
        <Button variant="outline" onClick={() => setShowPreview(true)} className="h-8 gap-1.5 text-xs border-white/[0.06] text-slate-300">
          <Eye className="h-3.5 w-3.5" /> Previsualiser
        </Button>
        <Button onClick={handleSave} disabled={saving} className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
          <Save className="h-3.5 w-3.5" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          <span className="text-[9px] opacity-60 ml-0.5">⌘S</span>
        </Button>
      </div>

      {/* ═══ CNOEC expanded warnings ═══ */}
      {cnoecExpanded && cnoecResult.warnings.length > 0 && (
        <div className="border-b border-orange-500/20 bg-orange-500/5 px-4 py-2 space-y-1">
          {cnoecResult.warnings.map((w) => (
            <button
              key={w.sectionId}
              onClick={() => {
                const idx = sections.findIndex((s) => s.id === w.sectionId);
                if (idx >= 0) { setSelectedIdx(idx); setEditorTab("sections"); setCnoecExpanded(false); }
              }}
              className="flex items-start gap-2 text-left w-full p-1.5 rounded hover:bg-orange-500/10 transition-colors"
            >
              <AlertTriangle className="h-3 w-3 text-orange-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-orange-400/80">{w.reference} — {w.message}</span>
            </button>
          ))}
        </div>
      )}

      {/* ═══ OPT-1: Main 3-column layout ═══ */}
      <div className="flex flex-1 min-h-0">

        {/* ═══ OPT-11-25: Sidebar ═══ */}
        {!fullscreen && (
          <div className="w-[240px] border-r border-white/[0.06] flex flex-col min-h-0 shrink-0">
            <div className="p-3 border-b border-white/[0.06] space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sections</p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                <Input
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="Filtrer..."
                  className="h-7 pl-7 text-xs bg-white/[0.04] border-white/[0.08]"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {/* OPT-20/21: Grouped sections with accordion */}
                {groupedFilteredIndices.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.label);
                  return (
                    <div key={group.label}>
                      {/* OPT-20: Group separator */}
                      <button
                        onClick={() => setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.label)) next.delete(group.label);
                          else next.add(group.label);
                          return next;
                        })}
                        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                      >
                        {isCollapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        {group.label}
                        <span className="text-slate-600 ml-auto">{group.indices.length}</span>
                      </button>

                      {/* OPT-21: Collapsible content */}
                      {!isCollapsed && group.indices.map((idx) => {
                        const section = sections[idx];
                        const isHidden = hiddenIds.has(section.id);
                        const isSelected = idx === selectedIdx;
                        const showCnoecWarning = isHidden && section.cnoec_obligatoire;
                        const isEmpty = !section.contenu.trim();

                        return (
                          <div key={section.id}>
                            <div
                              draggable
                              onDragStart={() => handleDragStart(idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={() => handleDrop(idx)}
                              onDragEnd={() => setDragOverIdx(null)}
                              onClick={() => { setSelectedIdx(idx); setEditorTab("sections"); }}
                              className={`flex items-center gap-1 p-1.5 rounded-lg cursor-pointer transition-colors group ${
                                isSelected
                                  ? "bg-blue-500/15 border-l-2 border-l-blue-500 border border-blue-500/30"
                                  : dragOverIdx === idx
                                  ? "bg-white/[0.06] border-l-2 border-l-transparent border border-dashed border-white/20"
                                  : "hover:bg-white/[0.04] border-l-2 border-l-transparent border border-transparent"
                              } ${isHidden ? "opacity-50" : ""}`}
                            >
                              {/* OPT-11: Drag handle */}
                              <GripVertical className="h-3 w-3 text-slate-600 shrink-0 cursor-grab" />

                              {/* OPT-11: Content indicator dot */}
                              <Circle className={`h-1.5 w-1.5 shrink-0 ${
                                isHidden ? "text-slate-600" : isEmpty ? "text-slate-600" : "text-green-400 fill-green-400"
                              }`} />

                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-slate-200 truncate">{section.titre}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {/* OPT-11: CNOEC badge */}
                                  {section.cnoec_obligatoire && (
                                    <Badge variant="outline" className="text-[7px] px-1 py-0 border-blue-500/30 text-blue-400">
                                      CNOEC
                                    </Badge>
                                  )}
                                  {isHidden && (
                                    <Badge variant="outline" className="text-[7px] px-1 py-0 border-orange-500/30 text-orange-400">
                                      Desactive
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* OPT-11: Switch on/off */}
                              <Switch
                                checked={!isHidden}
                                onCheckedChange={() => toggleSection(section.id)}
                                className="shrink-0 scale-[0.6]"
                                onClick={(e) => e.stopPropagation()}
                              />

                              {/* OPT-18: Context menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => duplicateSection(idx)} className="text-xs gap-2">
                                    <Copy className="h-3 w-3" /> Dupliquer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => moveSection(idx, "up")} disabled={idx === 0} className="text-xs gap-2">
                                    <ArrowUp className="h-3 w-3" /> Monter
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => moveSection(idx, "down")} disabled={idx === sections.length - 1} className="text-xs gap-2">
                                    <ArrowDown className="h-3 w-3" /> Descendre
                                  </DropdownMenuItem>
                                  {/* OPT-17: Delete only non-CNOEC */}
                                  {!section.cnoec_obligatoire && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => deleteCustomSection(idx)} className="text-xs gap-2 text-red-400 focus:text-red-400">
                                        <Trash2 className="h-3 w-3" /> Supprimer
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* OPT-14: CNOEC warning when disabled */}
                            {showCnoecWarning && (
                              <div className="mx-1 mt-0.5 mb-1 px-2 py-1.5 rounded bg-orange-500/5 border border-orange-500/20 text-[9px] text-orange-400/80 leading-tight">
                                ⚠ Section requise par {section.cnoec_reference}. La suppression peut engager votre responsabilite.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* OPT-22: Progress bar */}
            <div className="px-3 py-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>{filledCount}/{visibleSections.length} sections remplies</span>
              </div>
              <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${visibleSections.length ? (filledCount / visibleSections.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* OPT-16/19: Footer buttons + counter */}
            <div className="p-2 border-t border-white/[0.06] space-y-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs border-white/[0.06]"
                onClick={() => setShowAddSection(true)}
              >
                <Plus className="h-3 w-3" /> Ajouter une section
              </Button>
              <div className="text-center text-[10px] text-slate-500">
                {visibleSections.length}/{sections.length} sections actives
              </div>
            </div>
          </div>
        )}

        {/* ═══ OPT-26-40: Central Editor ═══ */}
        <div className="flex-1 flex flex-col min-h-0" style={{ minHeight: "500px" }}>
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
                  <ListChecks className="h-3 w-3" /> Repartition
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Sections tab ── */}
            <TabsContent value="sections" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0" ref={editorAreaRef}>
              {selectedSection ? (
                <>
                  {/* OPT-26: Section header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={selectedSection.titre}
                        onChange={(e) => updateSection("titre", e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] text-white font-medium"
                        disabled={!selectedSection.editable}
                      />
                      {selectedSection.cnoec_obligatoire && (
                        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] shrink-0 whitespace-nowrap">
                          Requis par {selectedSection.cnoec_reference || missionTypeConfig.normeRef}
                        </Badge>
                      )}
                    </div>
                    {/* OPT-26: Contextual help */}
                    {selectedSection.cnoec_warning && (
                      <p className="text-[11px] text-slate-500 italic">{selectedSection.cnoec_warning}</p>
                    )}
                  </div>

                  {/* OPT-38: Table section special message */}
                  {TABLE_SECTION_IDS.has(selectedSection.id) && selectedSection.contenu.startsWith("TABLEAU_") ? (
                    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-sm text-blue-300/80">
                      <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Section generee automatiquement</p>
                        <p className="text-[11px] text-blue-400/60 mt-1">
                          Cette section est generee automatiquement depuis les donnees client et les honoraires saisis. Le contenu ne peut pas etre modifie manuellement.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* OPT-33: Empty + obligatory warning */}
                      {!selectedSection.contenu.trim() && selectedSection.cnoec_obligatoire && !hiddenIds.has(selectedSection.id) && (
                        <Alert className="border-orange-500/30 bg-orange-500/5">
                          <AlertTriangle className="h-4 w-4 text-orange-400" />
                          <AlertDescription className="text-xs text-orange-400">
                            Cette section est vide mais obligatoire. Remplissez-la ou reinitialisez au texte GRIMY.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* OPT-29: Variable insert + OPT-37: Font size + OPT-32: Copy + OPT-36: Preview toggle */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Variable insert dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] border-white/[0.06] text-slate-400">
                              <Variable className="h-3 w-3" /> Inserer une variable
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56 max-h-[300px] overflow-auto">
                            {VARIABLE_GROUPS.map((group) => (
                              <div key={group.label}>
                                <DropdownMenuLabel className="text-[10px] text-slate-500">{group.label}</DropdownMenuLabel>
                                {group.vars.map((v) => (
                                  <DropdownMenuItem
                                    key={v}
                                    onClick={() => insertVariable(v)}
                                    className="text-xs font-mono gap-2"
                                  >
                                    <span className="text-purple-400">{`{{${v}}}`}</span>
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                              </div>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* OPT-31: Reset */}
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                          onClick={() => setShowResetDialog(true)}
                        >
                          <RotateCcw className="h-3 w-3" /> Reinitialiser
                        </Button>

                        {/* OPT-32: Copy */}
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[10px] text-slate-500 hover:text-slate-300" onClick={copyContent}>
                          <Copy className="h-3 w-3" /> Copier
                        </Button>

                        {/* OPT-36: Preview toggle */}
                        <Button
                          variant="ghost" size="sm"
                          className={`h-7 gap-1 text-[10px] ${previewMode ? "text-blue-400" : "text-slate-500"}`}
                          onClick={() => setPreviewMode(!previewMode)}
                        >
                          {previewMode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {previewMode ? "Editer" : "Apercu"}
                        </Button>

                        {/* OPT-37: Font size */}
                        <div className="flex items-center gap-0.5 ml-auto">
                          <button
                            onClick={() => setFontSizeIdx(Math.max(0, fontSizeIdx - 1))}
                            disabled={fontSizeIdx === 0}
                            className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                          >
                            <MinusIcon className="h-3 w-3" />
                          </button>
                          <span className="text-[9px] text-slate-500 w-5 text-center">{FONT_SIZES[fontSizeIdx]}</span>
                          <button
                            onClick={() => setFontSizeIdx(Math.min(FONT_SIZES.length - 1, fontSizeIdx + 1))}
                            disabled={fontSizeIdx === FONT_SIZES.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                          >
                            <PlusIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* OPT-36: Preview or Textarea */}
                      {previewMode ? (
                        <div
                          className="min-h-[150px] max-h-[500px] overflow-auto p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] text-slate-300 leading-relaxed whitespace-pre-wrap"
                          style={{ fontSize: `${FONT_SIZES[fontSizeIdx]}px` }}
                        >
                          {selectedSection.contenu.split(/(\{\{\w+\}\})/).map((part, i) => {
                            if (/^\{\{\w+\}\}$/.test(part)) {
                              return (
                                <Badge key={i} variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-400 mx-0.5 inline">
                                  {part}
                                </Badge>
                              );
                            }
                            // Convert dashes to bullet points
                            return part.split("\n").map((line, j) => {
                              if (/^[—\-•▪]\s/.test(line.trim())) {
                                return <span key={`${i}-${j}`}>{"  • " + line.trim().replace(/^[—\-•▪]\s*/, "")}{"\n"}</span>;
                              }
                              return <span key={`${i}-${j}`}>{line}{j < part.split("\n").length - 1 ? "\n" : ""}</span>;
                            });
                          })}
                        </div>
                      ) : (
                        <Textarea
                          ref={textareaRef}
                          value={selectedSection.contenu}
                          onChange={(e) => updateSection("contenu", e.target.value)}
                          className="font-mono bg-white/[0.04] border-white/[0.08] text-white min-h-[150px] max-h-[500px] resize-none"
                          style={{ fontSize: `${FONT_SIZES[fontSizeIdx]}px` }}
                          disabled={!selectedSection.editable}
                        />
                      )}

                      {/* OPT-30: Character count */}
                      <div className="flex justify-end gap-3 text-[10px] text-slate-500">
                        <span>{selectedSection.contenu.length.toLocaleString("fr-FR")} caracteres</span>
                        <span>{wordCount(selectedSection.contenu)} mots</span>
                      </div>
                    </>
                  )}

                  {/* OPT-26: CNOEC info block */}
                  {selectedSection.cnoec_obligatoire && selectedSection.cnoec_reference && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <ShieldCheck className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-300 space-y-0.5">
                        <p className="font-medium">{selectedSection.cnoec_reference}</p>
                        {selectedSection.cnoec_warning && <p className="text-blue-400/70">{selectedSection.cnoec_warning}</p>}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-white/[0.06]" />

                  {/* OPT-28: Detected variables */}
                  {detectedVars.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Variables detectees ({detectedVars.length})</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedVars.map((v) => (
                          <Badge key={v} variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-400 cursor-pointer hover:bg-purple-500/10"
                            onClick={() => insertVariable(v)}>
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  Selectionnez une section a editer
                </div>
              )}
            </TabsContent>

            {/* ── OPT-39: CGV tab ── */}
            <TabsContent value="cgv" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Conditions Generales d'Intervention</Label>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                  onClick={() => {
                    setCgvContent(GRIMY_DEFAULT_CGV);
                    toast.success("CGV reinitialisees au texte GRIMY par defaut.");
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Reinitialiser aux CGV GRIMY
                </Button>
              </div>
              <Textarea
                value={cgvContent}
                onChange={(e) => setCgvContent(e.target.value)}
                className="font-mono bg-white/[0.04] border-white/[0.08] text-white min-h-[500px] resize-none"
                style={{ fontSize: "9.5pt" }}
              />
              <div className="flex justify-end text-[10px] text-slate-500">
                <span>{cgvContent.length.toLocaleString("fr-FR")} caracteres</span>
              </div>
            </TabsContent>

            {/* ── OPT-40: Repartition tab ── */}
            <TabsContent value="repartition" className="flex-1 min-h-0 overflow-auto p-4 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Repartition des taches cabinet / client</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                    onClick={() => { setRepartition([...GRIMY_DEFAULT_REPARTITION]); toast.success("Repartition reinitialisee."); }}>
                    <RotateCcw className="h-3 w-3" /> Reinitialiser
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] border-white/[0.06]" onClick={addTache}>
                    <Plus className="h-3 w-3" /> Ajouter
                  </Button>
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_70px_70px_100px_36px] gap-0 bg-white/[0.04] px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  <span>Tache</span>
                  <span className="text-center">Cabinet</span>
                  <span className="text-center">Client</span>
                  <span className="text-center">Periodicite</span>
                  <span></span>
                </div>
                {repartition.map((t: any, idx: number) => (
                  <div key={t.id || idx} className="grid grid-cols-[1fr_70px_70px_100px_36px] gap-0 px-3 py-1.5 border-t border-white/[0.06] items-center">
                    <Input
                      value={t.label}
                      onChange={(e) => updateTache(idx, "label", e.target.value)}
                      className="h-7 text-xs bg-transparent border-none px-0 text-white"
                      placeholder="Description de la tache..."
                    />
                    <div className="flex justify-center">
                      <Switch checked={t.cabinet} onCheckedChange={(v) => updateTache(idx, "cabinet", v)} className="scale-75" />
                    </div>
                    <div className="flex justify-center">
                      <Switch checked={t.client} onCheckedChange={(v) => updateTache(idx, "client", v)} className="scale-75" />
                    </div>
                    <select
                      value={t.periodicite}
                      onChange={(e) => updateTache(idx, "periodicite", e.target.value)}
                      className="h-7 text-xs bg-white/[0.04] border border-white/[0.08] rounded px-1 text-slate-300"
                    >
                      <option value="Mensuel">M</option>
                      <option value="Trimestriel">T</option>
                      <option value="Annuel">A</option>
                      <option value="Permanent">P</option>
                      <option value="Non defini">ND</option>
                    </select>
                    <button onClick={() => removeTache(idx)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ═══ OPT-41-50: Right Panel ═══ */}
        {!fullscreen && (
          <div className={`w-[280px] border-l border-white/[0.06] flex flex-col min-h-0 shrink-0 overflow-auto ${
            showRightPanel ? "fixed right-0 top-0 bottom-0 z-50 bg-background shadow-2xl lg:static lg:shadow-none" : "hidden lg:flex"
          }`}>
            {/* Mobile close button */}
            {showRightPanel && (
              <div className="lg:hidden flex items-center justify-between p-3 border-b border-white/[0.06]">
                <span className="text-xs font-medium text-slate-400">Informations</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowRightPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-5">
                {/* OPT-41: Modele info */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Informations</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-slate-500">Nom</span><span className="text-slate-300 truncate ml-2">{modele.nom}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-300">{missionTypeConfig.shortLabel} · {missionTypeConfig.normeRef}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Source</span>
                      <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400">
                        {modele.source === "grimy" ? "GRIMY" : modele.source === "import_docx" ? "Import DOCX" : "Copie"}
                      </Badge>
                    </div>
                    <div className="flex justify-between"><span className="text-slate-500">Cree le</span><span className="text-slate-300">{new Date(modele.created_at).toLocaleDateString("fr-FR")}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Modifie le</span><span className="text-slate-300">{new Date(modele.updated_at).toLocaleDateString("fr-FR")}</span></div>
                    {typeof usedInCount === "number" && (
                      <div className="flex justify-between"><span className="text-slate-500">Utilise dans</span><span className="text-slate-300">{usedInCount} lettre{usedInCount !== 1 ? "s" : ""}</span></div>
                    )}
                    {/* OPT-49: Original filename */}
                    {modele.source === "import_docx" && modele.original_filename && (
                      <div className="flex justify-between"><span className="text-slate-500">Fichier</span><span className="text-slate-300 truncate ml-2 text-[10px]">{modele.original_filename}</span></div>
                    )}
                  </div>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* OPT-42: Conformite CNOEC */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Conformite CNOEC</p>
                  {cnoecResult.warnings.length === 0 ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                      <ShieldCheck className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-300">Conforme aux normes</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cnoecResult.warnings.map((w) => (
                        <button
                          key={w.sectionId}
                          onClick={() => {
                            const idx = sections.findIndex((s) => s.id === w.sectionId);
                            if (idx >= 0) { setSelectedIdx(idx); setEditorTab("sections"); }
                          }}
                          className="flex items-start gap-2 w-full text-left p-2 rounded-lg bg-orange-500/5 border border-orange-500/15 hover:bg-orange-500/10 transition-colors"
                        >
                          <AlertTriangle className="h-3 w-3 text-orange-400 mt-0.5 shrink-0" />
                          <div className="text-[10px]">
                            <span className="text-orange-300 font-medium">{w.reference}</span>
                            <p className="text-orange-400/70 mt-0.5">{w.message}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    CNOEC {cnoecCov.covered}/{cnoecCov.total} sections obligatoires
                  </div>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* OPT-44: Variables utilisees */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Variables utilisees ({allDetectedVars.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {allDetectedVars.map((v) => (
                      <Badge key={v} variant="outline" className={`text-[9px] font-mono ${
                        RESOLVED_VARS.has(v) ? "border-green-500/30 text-green-400" : "border-purple-500/30 text-purple-400"
                      }`}>
                        {v}
                        {RESOLVED_VARS.has(v) && <CheckCircle2 className="h-2 w-2 ml-0.5" />}
                      </Badge>
                    ))}
                    {allDetectedVars.length === 0 && <span className="text-[10px] text-slate-600 italic">Aucune variable</span>}
                  </div>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* OPT-45: Checklist */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Checklist</p>
                  <div className="space-y-1.5">
                    {checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {item.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className={item.done ? "text-slate-300" : "text-slate-500"}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* OPT-50: Documentation link */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Documentation</p>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-[11px] text-slate-300 font-medium">{missionTypeConfig.normeRef}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{missionTypeConfig.description}</p>
                    <p className="text-[10px] text-slate-500">
                      Forme du rapport : {missionTypeConfig.formeRapport}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Referentiel : {missionTypeConfig.referentielApplicable}
                    </p>
                  </div>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* OPT-46/47/48: Action buttons */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs border-white/[0.06]" onClick={exportJSON}>
                    <FileJson className="h-3.5 w-3.5" /> Exporter en JSON
                  </Button>
                  {onDuplicate && (
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs border-white/[0.06]"
                      onClick={() => onDuplicate(modele)}>
                      <Copy className="h-3.5 w-3.5" /> Dupliquer ce modele
                    </Button>
                  )}
                  {onDelete && !modele.is_default && (
                    <Button variant="outline" size="sm"
                      className="w-full gap-1.5 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer ce modele
                    </Button>
                  )}
                  {modele.is_default && (
                    <p className="text-[10px] text-slate-600 text-center italic">Modele par defaut — suppression desactivee</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* ═══ Dialogs ═══ */}

      {/* OPT-7: Leave confirmation */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifications non sauvegardees</DialogTitle>
            <DialogDescription>Vous avez des modifications non sauvegardees. Quitter quand meme ?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => { setShowLeaveDialog(false); onCancel(); }}>Quitter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPT-16: Add section dialog */}
      <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une section</DialogTitle>
            <DialogDescription>Creez une nouvelle section personnalisee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Titre de la section</Label>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white"
                placeholder="Ex: Clause de non-concurrence"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Contenu initial (optionnel)</Label>
              <Textarea
                value={newSectionContent}
                onChange={(e) => setNewSectionContent(e.target.value)}
                className="font-mono text-xs bg-white/[0.04] border-white/[0.08] text-white min-h-[100px] resize-none"
                placeholder="Saisissez le contenu..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSection(false)}>Annuler</Button>
            <Button onClick={addCustomSection} className="bg-blue-600 hover:bg-blue-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPT-31: Reset confirmation */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reinitialiser la section</DialogTitle>
            <DialogDescription>Remettre le texte par defaut ? Vos modifications seront perdues.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => { setShowResetDialog(false); resetSectionToGrimy(); }}>Reinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPT-48: Delete confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le modele</DialogTitle>
            <DialogDescription>Cette action est irreversible. Le modele "{modele.nom}" sera definitivement supprime.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => { setShowDeleteDialog(false); onDelete?.(modele); }}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Apercu du modele</DialogTitle>
            <DialogDescription>
              {missionTypeConfig.label} — {missionTypeConfig.normeRef} · {visibleSections.length} sections actives
            </DialogDescription>
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
