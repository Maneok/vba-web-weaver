import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Save, Upload, FileDown, FileText, Mail, GripVertical,
  Trash2, Eye, EyeOff, Plus, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import VariableInserter from "./VariableInserter";
import ClauseLibrary, { type Clause } from "./ClauseLibrary";
import { type Template, type TemplateBlock } from "./TemplateManager";
import { loadCabinetConfig } from "./CabinetConfigForm";

interface EditorBlock {
  id: string;
  title: string;
  content: string;
  visible: boolean;
  type: string;
}

const BLOCK_TYPES = [
  "Mission", "Honoraires", "LCB-FT", "RGPD",
  "Resiliation", "Juridiction", "Custom",
];

const TEMPLATE_STORAGE_KEY = "lcb-templates";

function highlightVariables(text: string): React.ReactNode[] {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) =>
    part.startsWith("{{") ? (
      <span key={i} className="bg-blue-500/20 text-blue-300 rounded px-0.5">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function resolveVariables(text: string): string {
  const config = loadCabinetConfig();
  const vars: Record<string, string> = {
    cabinet_nom: config.nom,
    cabinet_adresse: `${config.adresse}, ${config.cp} ${config.ville}`,
    cabinet_siret: config.siret,
    cabinet_oec: config.numeroOec,
    date_jour: new Date().toLocaleDateString("fr-FR"),
    annee: String(new Date().getFullYear()),
    date_lettre: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  };
  return text.replace(/{{(\w+)}}/g, (match, key) => vars[key] || match);
}

export default function LettreMissionEditor() {
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    { id: "b-1", title: "Objet de la mission", content: "Le cabinet {{cabinet_nom}} est charge de la mission de {{mission}} pour le compte de {{raison_sociale}}, SIREN {{siren}}.", visible: true, type: "Mission" },
    { id: "b-2", title: "Honoraires", content: "Les honoraires annuels sont fixes a {{honoraires}} EUR HT, payables {{frequence}}.", visible: true, type: "Honoraires" },
    { id: "b-3", title: "Obligations LCB-FT", content: "Niveau de vigilance : {{niv_vigilance}}. Score de risque : {{score_global}}/100.", visible: true, type: "LCB-FT" },
  ]);

  const [clauseLibraryOpen, setClauseLibraryOpen] = useState(false);
  const [activeTextarea, setActiveTextarea] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const updateBlock = (id: string, field: keyof EditorBlock, value: string | boolean) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const addBlock = (type: string) => {
    const newBlock: EditorBlock = {
      id: `b-${Date.now()}`,
      title: "Nouveau bloc",
      content: "",
      visible: true,
      type,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleAddClause = (clause: Clause) => {
    const newBlock: EditorBlock = {
      id: `b-${Date.now()}`,
      title: clause.title,
      content: clause.content,
      visible: true,
      type: clause.category,
    };
    setBlocks((prev) => [...prev, newBlock]);
    toast.success(`Clause "${clause.title}" ajoutee`);
  };

  const handleInsertVariable = useCallback((variable: string) => {
    if (!activeTextarea) return;
    const textarea = textareaRefs.current[activeTextarea];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const newValue = currentValue.slice(0, start) + variable + currentValue.slice(end);
    updateBlock(activeTextarea, "content", newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    });
  }, [activeTextarea]);

  // Save template
  const handleSaveTemplate = () => {
    const name = prompt("Nom du template :");
    if (!name) return;
    const templates: Template[] = (() => {
      try {
        const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    })();
    const tpl: Template = {
      id: `tpl-${Date.now()}`,
      name,
      description: `Template sauvegarde le ${new Date().toLocaleDateString("fr-FR")}`,
      blocks: blocks.map((b) => ({ ...b })),
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    templates.push(tpl);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    toast.success("Template sauvegarde");
  };

  // Load template
  const handleLoadTemplate = () => {
    const templates: Template[] = (() => {
      try {
        const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    })();
    if (templates.length === 0) {
      toast.error("Aucun template sauvegarde");
      return;
    }
    const name = prompt(`Templates disponibles :\n${templates.map((t) => `- ${t.name}`).join("\n")}\n\nEntrez le nom du template :`);
    if (!name) return;
    const tpl = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tpl) {
      toast.error("Template non trouve");
      return;
    }
    setBlocks(tpl.blocks.map((b) => ({ ...b, id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })));
    toast.success(`Template "${tpl.name}" charge`);
  };

  // Load template from TemplateManager
  const loadTemplate = (template: Template) => {
    setBlocks(template.blocks.map((b) => ({ ...b, id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })));
    toast.success(`Template "${template.name}" charge`);
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setBlocks((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((b) => b.id === draggedId);
      const toIdx = arr.findIndex((b) => b.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const visibleBlocks = blocks.filter((b) => b.visible);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b flex-wrap">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveTemplate}>
          <Save className="h-4 w-4" /> Sauvegarder
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleLoadTemplate}>
          <Upload className="h-4 w-4" /> Charger
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Export PDF via le module de preview")}>
          <FileDown className="h-4 w-4" /> PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Export DOCX bientot disponible")}>
          <FileText className="h-4 w-4" /> DOCX
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Envoi par email bientot disponible")}>
          <Mail className="h-4 w-4" /> Email
        </Button>
        <div className="flex-1" />
        <VariableInserter onInsert={handleInsertVariable} />
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setClauseLibraryOpen(true)}>
          <BookOpen className="h-4 w-4" /> Clauses
        </Button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor - left 60% */}
        <div className="w-[60%] border-r overflow-y-auto p-4 space-y-3">
          {blocks.map((block) => (
            <Card
              key={block.id}
              draggable
              onDragStart={(e) => handleDragStart(e, block.id)}
              onDragOver={(e) => handleDragOver(e, block.id)}
              onDrop={(e) => handleDrop(e, block.id)}
              onDragEnd={handleDragEnd}
              className={`transition-all ${
                draggedId === block.id ? "opacity-50" : ""
              } ${dragOverId === block.id && draggedId !== block.id ? "ring-2 ring-blue-500" : ""}`}
            >
              <CardHeader className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <Input
                    value={block.title}
                    onChange={(e) => updateBlock(block.id, "title", e.target.value)}
                    className="h-7 text-sm font-medium border-none shadow-none px-1 focus-visible:ring-1"
                  />
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {block.type}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={block.visible}
                      onCheckedChange={(v) => updateBlock(block.id, "visible", v)}
                      className="scale-75"
                    />
                    {block.visible ? (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="relative">
                  <textarea
                    ref={(el) => { textareaRefs.current[block.id] = el; }}
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                    onFocus={() => setActiveTextarea(block.id)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {/* Variable highlight overlay (read-only visual) */}
                  {block.content.includes("{{") && (
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-1">
                      {Array.from(block.content.matchAll(/{{(\w+)}}/g)).map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {m[0]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add block */}
          <div className="flex items-center gap-2 pt-2">
            <Select onValueChange={addBlock}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ajouter un bloc..." />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => addBlock("Custom")}>
              <Plus className="h-4 w-4" /> Bloc libre
            </Button>
          </div>
        </div>

        {/* Preview - right 40% */}
        <div className="w-[40%] overflow-y-auto p-4 bg-muted/30">
          <div className="bg-white text-black rounded-lg shadow-sm p-8 min-h-[600px] text-sm leading-relaxed" style={{ fontFamily: loadCabinetConfig().police || "Inter" }}>
            {/* Header */}
            {(() => {
              const config = loadCabinetConfig();
              return (
                <div className="mb-6">
                  <div className="flex items-start gap-3 mb-3">
                    {config.logo && (
                      <img src={config.logo} alt="Logo" className="h-12 w-12 object-contain" />
                    )}
                    <div>
                      <h2 className="text-base font-bold" style={{ color: config.couleurPrimaire }}>
                        {config.nom || "Cabinet"}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {config.adresse && `${config.adresse}, `}{config.cp} {config.ville}
                      </p>
                    </div>
                  </div>
                  <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, ${config.couleurPrimaire}, ${config.couleurSecondaire})` }} />
                </div>
              );
            })()}

            <h1 className="text-center text-lg font-bold mb-6 uppercase tracking-wide">
              Lettre de Mission
            </h1>

            <p className="text-right text-xs text-gray-500 mb-6">
              {resolveVariables("{{date_lettre}}")}
            </p>

            {visibleBlocks.map((block) => (
              <div key={block.id} className="mb-4">
                <h3 className="font-semibold text-sm mb-1" style={{ color: loadCabinetConfig().couleurPrimaire }}>
                  {block.title}
                </h3>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">
                  {highlightVariables(resolveVariables(block.content))}
                </p>
              </div>
            ))}

            {visibleBlocks.length === 0 && (
              <p className="text-center text-gray-400 py-12">
                Ajoutez des blocs pour voir la previsualisation
              </p>
            )}

            {/* Footer */}
            <div className="mt-12 pt-3 border-t text-center text-[10px] text-gray-400">
              {loadCabinetConfig().piedDePage}
            </div>
          </div>
        </div>
      </div>

      {/* Clause Library Drawer */}
      <ClauseLibrary
        open={clauseLibraryOpen}
        onOpenChange={setClauseLibraryOpen}
        onAddClause={handleAddClause}
      />
    </div>
  );
}
