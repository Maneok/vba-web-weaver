import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  parseDocxToHtml,
  mapHtmlToSections,
  detectMissingSections,
  autoFillFromGrimy,
  ALL_SECTION_IDS,
} from "@/lib/lettreMissionDocxImport";
import type { ParsedDocxResult } from "@/lib/lettreMissionDocxImport";
import {
  createModele,
  GRIMY_DEFAULT_SECTIONS,
  GRIMY_DEFAULT_CGV,
  GRIMY_DEFAULT_REPARTITION,
} from "@/lib/lettreMissionModeles";
import type { LMModele, LMSection } from "@/lib/lettreMissionModeles";
import { MISSION_TYPES, MISSION_CATEGORIES } from "@/lib/lettreMissionTypes";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  File,
} from "lucide-react";

interface DocxImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabinetId: string;
  onImportComplete: (modele: LMModele) => void;
}

type Step = "upload" | "mapping" | "confirm";

export default function DocxImportDialog({
  open,
  onOpenChange,
  cabinetId,
  onImportComplete,
}: DocxImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedDocxResult | null>(null);
  const [sections, setSections] = useState<LMSection[]>([]);
  const [cgvContent, setCgvContent] = useState<string | null>(null);
  const [modeleName, setModeleName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // OPT-34: Mission type selection
  const [missionType, setMissionType] = useState("presentation");
  // OPT-28: Simulated progress
  const [parseProgress, setParseProgress] = useState(0);
  // OPT-32: CGV tab
  const [mappingTab, setMappingTab] = useState<"sections" | "cgv">("sections");

  const reset = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setFileName("");
    setParsed(null);
    setSections([]);
    setCgvContent(null);
    setModeleName("");
    setIsDefault(false);
    setDragOver(false);
    setMissionType("presentation");
    setParseProgress(0);
    setMappingTab("sections");
  }, []);

  const handleOpenChange = useCallback(
    (val: boolean) => {
      if (!val) reset();
      onOpenChange(val);
    },
    [onOpenChange, reset]
  );

  // ── Step 1: File handling ──

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".docx") && !file.name.endsWith(".doc")) {
      toast.error("Seuls les fichiers .docx sont acceptes.");
      return;
    }
    setLoading(true);
    setFileName(file.name);
    setParseProgress(0);

    // OPT-28: Simulated progress
    const progressInterval = setInterval(() => {
      setParseProgress((prev) => Math.min(prev + 15, 85));
    }, 400);

    try {
      const html = await parseDocxToHtml(file);
      setParseProgress(90);
      const result = await mapHtmlToSections(html);
      setParseProgress(100);
      setParsed(result);
      setSections(result.sections);
      setCgvContent(result.detectedCgv);
      // OPT-33: Pre-fill name from filename
      setModeleName(file.name.replace(/\.(docx|doc)$/i, ""));
      setStep("mapping");
    } catch (err) {
      toast.error("Erreur lors du parsing du fichier DOCX.");
      console.error(err);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setParseProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Step 2: Mapping ──

  const handleSectionIdChange = (index: number, newId: string) => {
    setSections((prev) => {
      const updated = [...prev];
      const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === newId);
      updated[index] = {
        ...updated[index],
        id: newId,
        cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
        cnoec_reference: grimyRef?.cnoec_reference,
        cnoec_warning: grimyRef?.cnoec_warning,
      };
      return updated;
    });
  };

  // OPT-31: Add missing CNOEC sections
  const addMissingSections = () => {
    if (!parsed) return;
    const missingIds = detectMissingSections({ ...parsed, sections });
    const toAdd = GRIMY_DEFAULT_SECTIONS.filter((s) =>
      missingIds.includes(s.id)
    ).map((s, i) => ({
      ...s,
      ordre: sections.length + i + 1,
    }));
    setSections((prev) => [...prev, ...toAdd]);
    toast.success(`${toAdd.length} section(s) CNOEC ajoutee(s).`);
  };

  const missingCount = parsed
    ? detectMissingSections({ ...parsed, sections }).length
    : 0;

  const recognizedCount = sections.filter(
    (s) => !s.id.startsWith("custom_")
  ).length;

  // OPT-31: List missing section names
  const missingSectionNames = parsed
    ? detectMissingSections({ ...parsed, sections }).map((id) => {
        const ref = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === id);
        return ref?.titre || id;
      })
    : [];

  // ── Step 3: Confirm ──

  const handleCreate = async () => {
    setLoading(true);
    try {
      const modele = await createModele({
        cabinet_id: cabinetId,
        nom: modeleName || fileName.replace(/\.(docx|doc)$/i, ""),
        description: `Importe depuis ${fileName}`,
        mission_type: missionType,
        sections: sections.map((s, i) => ({ ...s, ordre: i + 1 })),
        cgv_content: cgvContent ?? GRIMY_DEFAULT_CGV,
        repartition_taches: GRIMY_DEFAULT_REPARTITION,
        is_default: isDefault,
        source: "import_docx",
        original_filename: fileName,
      });
      toast.success("Modele importe avec succes !");
      onImportComplete(modele);
      handleOpenChange(false);
    } catch (err) {
      toast.error("Erreur lors de la creation du modele.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cnoecCovered = sections.filter((s) => s.cnoec_obligatoire).length;
  const cnoecTotal = GRIMY_DEFAULT_SECTIONS.filter(
    (s) => s.cnoec_obligatoire
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* OPT-25: Responsive */}
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importer un modele DOCX"}
            {step === "mapping" && "Verification du mapping"}
            {step === "confirm" && "Confirmer l'import"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selectionnez un fichier .docx pour importer un modele de lettre de mission."}
            {step === "mapping" && `${recognizedCount}/${ALL_SECTION_IDS.length} sections reconnues — Verifiez la correspondance.`}
            {step === "confirm" && "Confirmez les parametres du modele avant de finaliser l'import."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {(["upload", "mapping", "confirm"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                (["upload", "mapping", "confirm"].indexOf(step) >= i) ? "bg-blue-500" : "bg-white/[0.1]"
              }`}
            />
          ))}
        </div>

        {/* ── STEP 1: Upload (OPT-27-28) ── */}
        {step === "upload" && (
          <div className="flex-1 flex items-center justify-center py-8">
            {loading ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-slate-400">Analyse du document en cours...</p>
                {/* OPT-28: Progress bar */}
                <Progress value={parseProgress} className="w-full h-2" />
                <p className="text-[10px] text-slate-500">{fileName}</p>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/5 scale-[1.01]"
                    : "border-blue-500/20 hover:border-blue-500/40 hover:bg-white/[0.02]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                  <Upload className="h-7 w-7 text-blue-400" />
                </div>
                <p className="text-sm font-medium text-slate-300">
                  Glissez votre DOCX ici ou cliquez pour selectionner
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formats acceptes : .docx, .doc
                </p>
                <input
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            )}
          </div>
        )}

        {/* ── STEP 2: Mapping review (OPT-29-32) ── */}
        {step === "mapping" && parsed && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* OPT-29: Confidence bar */}
            <div className="flex items-center gap-3">
              <Progress value={parsed.confidence} className="flex-1 h-2" />
              <span className="text-sm font-medium whitespace-nowrap text-slate-300">
                {recognizedCount}/{ALL_SECTION_IDS.length} — {parsed.confidence}%
              </span>
            </div>

            {/* OPT-31: Missing sections warning */}
            {missingCount > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs text-orange-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Sections manquantes : {missingSectionNames.join(", ")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addMissingSections}
                    className="gap-1 text-xs border-orange-500/20 text-orange-300 hover:bg-orange-500/10"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter {missingCount} section(s) manquante(s) depuis GRIMY
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const filled = autoFillFromGrimy(sections);
                      setSections(filled);
                      toast.success("Sections completees depuis GRIMY.");
                    }}
                    className="gap-1 text-xs border-white/[0.06] text-slate-300"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-completer
                  </Button>
                </div>
              </div>
            )}

            {/* OPT-32: Tabs for sections vs CGV */}
            <Tabs value={mappingTab} onValueChange={(v) => setMappingTab(v as "sections" | "cgv")}>
              <TabsList className="bg-white/[0.03] border border-white/[0.06]">
                <TabsTrigger value="sections" className="text-xs gap-1">
                  <FileText className="h-3 w-3" /> Sections ({sections.length})
                </TabsTrigger>
                <TabsTrigger value="cgv" className="text-xs gap-1">
                  <File className="h-3 w-3" /> CGV {cgvContent ? "✓" : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sections">
                <ScrollArea className="max-h-[35vh]">
                  <div className="space-y-2 pr-3">
                    {/* OPT-29: Recognized sections first, then unrecognized */}
                    {[...sections]
                      .sort((a, b) => {
                        const aCustom = a.id.startsWith("custom_") ? 1 : 0;
                        const bCustom = b.id.startsWith("custom_") ? 1 : 0;
                        return aCustom - bCustom;
                      })
                      .map((section, idx) => {
                        const realIdx = sections.indexOf(section);
                        const isCustom = section.id.startsWith("custom_");
                        return (
                          <div
                            key={`${section.id}-${idx}`}
                            className={`rounded-lg border p-3 space-y-2 ${
                              isCustom ? "border-orange-500/20 bg-orange-500/5" : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                <span className="text-xs font-medium text-slate-300 truncate">
                                  {section.titre || "(Sans titre)"}
                                </span>
                              </div>
                              {isCustom ? (
                                <Badge variant="outline" className="shrink-0 text-[9px] text-orange-400 border-orange-500/30">
                                  Section personnalisee
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0 text-[9px] text-green-400 border-green-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Reconnu
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-slate-500 shrink-0">
                                Mapper vers :
                              </Label>
                              <Select
                                value={section.id}
                                onValueChange={(val) => handleSectionIdChange(realIdx, val)}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white/[0.04] border-white/[0.08]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRIMY_DEFAULT_SECTIONS.map((gs) => (
                                    <SelectItem key={gs.id} value={gs.id}>
                                      {gs.titre} {gs.cnoec_obligatoire ? "★" : ""}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={section.id.startsWith("custom_") ? section.id : `custom_${realIdx + 1}`}>
                                    (section personnalisee)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {/* OPT-29: 2-line preview */}
                            {section.contenu && (
                              <p className="text-[10px] text-slate-500 line-clamp-2 whitespace-pre-line pl-5">
                                {section.contenu.slice(0, 200)}
                                {section.contenu.length > 200 ? "..." : ""}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* OPT-32: CGV tab */}
              <TabsContent value="cgv">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  {cgvContent ? (
                    <div className="space-y-2">
                      <Badge className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20">
                        CGV detectees dans le document
                      </Badge>
                      <p className="text-xs text-slate-400 whitespace-pre-line line-clamp-10">
                        {cgvContent.slice(0, 1000)}
                        {cgvContent.length > 1000 ? "..." : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-500">Aucune CGV detectee — les CGV GRIMY par defaut seront utilisees</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ── STEP 3: Confirmation (OPT-33-35) ── */}
        {step === "confirm" && (
          <div className="flex-1 space-y-4 py-2">
            {/* OPT-33: Model name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Nom du modele</Label>
              <Input
                value={modeleName}
                onChange={(e) => setModeleName(e.target.value)}
                placeholder="Mon modele importe"
                className="bg-white/[0.04] border-white/[0.08]"
              />
            </div>

            {/* OPT-34: Mission type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Type de mission</Label>
              <Select value={missionType} onValueChange={setMissionType}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_CATEGORIES.map((cat) => (
                    <SelectGroup key={cat.category}>
                      <SelectLabel className="text-[10px] text-slate-500">{cat.label}</SelectLabel>
                      {cat.missions.map((mId) => {
                        const config = (MISSION_TYPES as Record<string, any>)[mId];
                        if (!config) return null;
                        return (
                          <SelectItem key={mId} value={mId}>
                            {config.shortLabel} — {config.normeRef}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300 accent-blue-500"
              />
              <span className="text-sm text-slate-300">
                Definir comme modele par defaut
              </span>
            </label>

            {/* OPT-35: Summary */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <p className="text-sm font-medium text-white">Resume de l'import</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-slate-500">Sections :</span>
                <span className="text-slate-300">{sections.length}</span>
                <span className="text-slate-500">CNOEC couvertes :</span>
                <span className="text-slate-300">{cnoecCovered}/{cnoecTotal}</span>
                <span className="text-slate-500">CGV :</span>
                <span className="text-slate-300">{cgvContent ? "Detectees" : "GRIMY par defaut"}</span>
                <span className="text-slate-500">Source :</span>
                <span className="text-slate-300 truncate">{fileName}</span>
              </div>
              {cnoecCovered < cnoecTotal && (
                <div className="flex items-start gap-2 mt-2 text-xs text-orange-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {cnoecTotal - cnoecCovered} section(s) CNOEC obligatoire(s) manquante(s).
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer navigation ── */}
        <DialogFooter className="gap-2">
          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => { reset(); setStep("upload"); }}
                className="border-white/[0.06]"
              >
                Retour
              </Button>
              <Button onClick={() => setStep("confirm")} className="bg-blue-600 hover:bg-blue-700">
                Continuer
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                className="border-white/[0.06]"
              >
                Retour
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading || !modeleName.trim()}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Creer le modele
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
