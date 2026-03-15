import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { toast } from "sonner";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
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
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setFileName("");
    setParsed(null);
    setSections([]);
    setCgvContent(null);
    setModeleName("");
    setSetAsDefault(false);
    setDragOver(false);
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
    if (!file.name.endsWith(".docx")) {
      toast.error("Seuls les fichiers .docx sont acceptés.");
      return;
    }
    setLoading(true);
    setFileName(file.name);
    try {
      const html = await parseDocxToHtml(file);
      const result = await mapHtmlToSections(html);
      setParsed(result);
      setSections(result.sections);
      setCgvContent(result.detectedCgv);
      setModeleName(file.name.replace(/\.docx$/i, ""));
      setStep("mapping");
    } catch (err) {
      toast.error("Erreur lors du parsing du fichier DOCX.");
      console.error(err);
    } finally {
      setLoading(false);
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
    toast.success(`${toAdd.length} section(s) CNOEC ajoutée(s).`);
  };

  const missingCount = parsed
    ? detectMissingSections({ ...parsed, sections }).length
    : 0;

  const recognizedCount = sections.filter(
    (s) => !s.id.startsWith("custom_")
  ).length;

  // ── Step 3: Confirm ──

  const handleCreate = async () => {
    setLoading(true);
    try {
      const modele = await createModele({
        cabinet_id: cabinetId,
        nom: modeleName || fileName.replace(/\.docx$/i, ""),
        description: `Importé depuis ${fileName}`,
        sections: sections.map((s, i) => ({ ...s, ordre: i + 1 })),
        cgv_content: cgvContent ?? GRIMY_DEFAULT_CGV,
        repartition_taches: GRIMY_DEFAULT_REPARTITION,
        is_default: setAsDefault,
        source: "import_docx",
        original_filename: fileName,
      });
      toast.success("Modèle importé avec succès !");
      onImportComplete(modele);
      handleOpenChange(false);
    } catch (err) {
      toast.error("Erreur lors de la création du modèle.");
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importer un modèle DOCX"}
            {step === "mapping" && "Vérification du mapping"}
            {step === "confirm" && "Confirmer l'import"}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div className="flex-1 flex items-center justify-center py-8">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyse du document en cours…
                </p>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Glissez-déposez votre fichier .docx ici
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou cliquez pour sélectionner
                </p>
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            )}
          </div>
        )}

        {/* ── STEP 2: Mapping review ── */}
        {step === "mapping" && parsed && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Confidence bar */}
            <div className="flex items-center gap-3">
              <Progress value={parsed.confidence} className="flex-1 h-2" />
              <span className="text-sm font-medium whitespace-nowrap">
                {recognizedCount}/{ALL_SECTION_IDS.length} sections
                reconnues — {parsed.confidence}%
              </span>
            </div>

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-3 space-y-1">
                {parsed.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addMissingSections}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter {missingCount} section(s) manquante(s)
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const filled = autoFillFromGrimy(sections);
                      setSections(filled);
                      toast.success("Sections complétées depuis le modèle GRIMY.");
                    }}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Auto-compléter depuis GRIMY
                  </Button>
                </div>
              </div>
            )}

            {/* Sections list */}
            <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
              <div className="space-y-3 pr-3">
                {sections.map((section, idx) => (
                  <div
                    key={`${section.id}-${idx}`}
                    className="rounded-md border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">
                          {section.titre || "(Sans titre)"}
                        </span>
                      </div>
                      {section.id.startsWith("custom_") ? (
                        <Badge variant="outline" className="shrink-0 text-orange-600 border-orange-300">
                          Non reconnu
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-green-600 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Reconnu
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">
                        Section GRIMY :
                      </Label>
                      <Select
                        value={section.id}
                        onValueChange={(val) =>
                          handleSectionIdChange(idx, val)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRIMY_DEFAULT_SECTIONS.map((gs) => (
                            <SelectItem key={gs.id} value={gs.id}>
                              {gs.titre} {gs.cnoec_obligatoire ? "★" : ""}
                            </SelectItem>
                          ))}
                          <SelectItem value={section.id.startsWith("custom_") ? section.id : `custom_${idx + 1}`}>
                            (section personnalisée)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {section.contenu && (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {section.contenu.slice(0, 200)}
                        {section.contenu.length > 200 ? "…" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ── STEP 3: Confirmation ── */}
        {step === "confirm" && (
          <div className="flex-1 space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="modele-name">Nom du modèle</Label>
              <Input
                id="modele-name"
                value={modeleName}
                onChange={(e) => setModeleName(e.target.value)}
                placeholder="Mon modèle importé"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">
                Définir comme modèle par défaut
              </span>
            </label>

            <div className="rounded-md border p-4 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Résumé de l'import</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span>Sections :</span>
                <span className="font-medium text-foreground">
                  {sections.length}
                </span>
                <span>Sections CNOEC couvertes :</span>
                <span className="font-medium text-foreground">
                  {cnoecCovered}/{cnoecTotal}
                </span>
                <span>CGV détectées :</span>
                <span className="font-medium text-foreground">
                  {cgvContent ? "Oui" : "Non (CGV GRIMY par défaut)"}
                </span>
                <span>Fichier source :</span>
                <span className="font-medium text-foreground truncate">
                  {fileName}
                </span>
              </div>
              {cnoecCovered < cnoecTotal && (
                <div className="flex items-start gap-2 mt-2 text-sm text-orange-600">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {cnoecTotal - cnoecCovered} section(s) CNOEC obligatoire(s)
                    manquante(s). Le modèle ne sera pas 100% conforme.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer navigation ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  setStep("upload");
                }}
              >
                Retour
              </Button>
              <Button onClick={() => setStep("confirm")}>
                Continuer
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
              >
                Retour
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Créer le modèle
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
