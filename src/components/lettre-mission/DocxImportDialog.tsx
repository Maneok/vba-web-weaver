import { useState, useCallback, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  parseDocxToHtml,
  mapHtmlToSections,
  detectMissingSections,
  autoFillFromGrimy,
  ALL_SECTION_IDS,
} from "@/lib/lettreMissionDocxImport";
import type { ParsedDocxResult, DetectedVariable } from "@/lib/lettreMissionDocxImport";
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
  ArrowRight,
  ArrowLeft,
  Zap,
  Variable,
} from "lucide-react";

interface DocxImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabinetId: string;
  onImportComplete: (modele: LMModele) => void;
}

type Step = "upload" | "sections" | "variables" | "confirm";

const STEP_ORDER: Step[] = ["upload", "sections", "variables", "confirm"];
const STEP_LABELS: Record<Step, string> = {
  upload: "Upload",
  sections: "Sections",
  variables: "Variables",
  confirm: "Confirmation",
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${bytes} o`;
}

export default function DocxImportDialog({
  open,
  onOpenChange,
  cabinetId,
  onImportComplete,
}: DocxImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [parsed, setParsed] = useState<ParsedDocxResult | null>(null);
  const [sections, setSections] = useState<LMSection[]>([]);
  const [cgvContent, setCgvContent] = useState<string | null>(null);
  const [varOverrides, setVarOverrides] = useState<Record<string, string | null>>({});
  const [modeleName, setModeleName] = useState("");
  const [modeleDescription, setModeleDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [missionType, setMissionType] = useState("presentation");
  const [parseProgress, setParseProgress] = useState(0);
  const [mappingTab, setMappingTab] = useState<"sections" | "cgv">("sections");
  // Post-creation state
  const [createdModele, setCreatedModele] = useState<LMModele | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setError(null);
    setFileName("");
    setFileSize(0);
    setParsed(null);
    setSections([]);
    setCgvContent(null);
    setVarOverrides({});
    setModeleName("");
    setModeleDescription("");
    setIsDefault(false);
    setDragOver(false);
    setMissionType("presentation");
    setParseProgress(0);
    setMappingTab("sections");
    setCreatedModele(null);
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
    // OPT-43: Client-side validation
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Seuls les fichiers .docx sont acceptés. Les fichiers .doc ne sont pas supportés.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 10 Mo).");
      return;
    }
    const validMime = !file.type || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!validMime) {
      setError("Type MIME invalide. Veuillez sélectionner un fichier .docx valide.");
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setParseProgress(0);

    const progressInterval = setInterval(() => {
      setParseProgress((prev) => Math.min(prev + 15, 85));
    }, 400);

    try {
      const html = await parseDocxToHtml(file);
      setParseProgress(90);
      const result = await mapHtmlToSections(html, file.name);
      setParseProgress(100);
      setParsed(result);
      setSections(result.sections);
      setCgvContent(result.detectedCgv);
      setModeleName(file.name.replace(/\.docx$/i, ""));
      setModeleDescription(`Importé depuis ${file.name}`);
      setStep("sections");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du parsing du fichier DOCX.";
      setError(msg);
      console.error("[DOCX Import]", err);
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

  // ── Step 2: Section mapping ──

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

  const missingSectionNames = parsed
    ? detectMissingSections({ ...parsed, sections }).map((id) => {
        const ref = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === id);
        return ref?.titre || id;
      })
    : [];

  // ── Step 3: Variable mapping ──

  const effectiveVars = useMemo(() => {
    if (!parsed) return [];
    return parsed.detectedVars.map((v) => ({
      ...v,
      mapped: varOverrides[v.original] !== undefined ? varOverrides[v.original] : v.mapped,
    }));
  }, [parsed, varOverrides]);

  const mappedVarCount = effectiveVars.filter((v) => v.mapped).length;

  const groupedVars = useMemo(() => {
    const groups: Record<string, typeof effectiveVars> = {
      client: [], cabinet: [], mission: [], dates: [], divers: [],
    };
    for (const v of effectiveVars) {
      groups[v.category]?.push(v) || groups.divers.push(v);
    }
    return groups;
  }, [effectiveVars]);

  const GROUP_LABELS: Record<string, string> = {
    client: "Client", cabinet: "Cabinet", mission: "Mission",
    dates: "Dates", divers: "Divers",
  };

  // All GRIMY variable options for the Select
  const grimyVarOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const [_, grimyVar] of Object.entries(
      Object.fromEntries(Object.entries({
        raison_sociale: 'Raison sociale', siren: 'SIREN', dirigeant: 'Dirigeant',
        forme_juridique: 'Forme juridique', adresse: 'Adresse', cp: 'Code postal',
        ville: 'Ville', capital: 'Capital', ape: 'Code APE', email: 'Email',
        telephone: 'Téléphone', effectif: 'Effectif', qualite_dirigeant: 'Qualité dirigeant',
        nom_cabinet: 'Nom du cabinet', associe: 'Associé', associe_signataire: 'Signataire',
        numero_oec: 'N° OEC', croec: 'CROEC',
        honoraires: 'Honoraires', setup: 'Frais de setup', frequence: 'Fréquence',
        frequence_facturation: 'Fréquence facturation',
        responsable_mission: 'Responsable mission', chef_mission: 'Chef de mission',
        regime_fiscal: 'Régime fiscal', tva: 'TVA', regime_tva: 'Régime TVA',
        date_du_jour: "Date du jour", date_signature: 'Date signature',
        date_cloture: 'Date clôture', exercice_debut: 'Début exercice', exercice_fin: 'Fin exercice',
        iban: 'IBAN', bic: 'BIC', banque: 'Banque',
      }))
    )) {
      const [key, label] = [_, grimyVar];
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ value: key, label: label as string });
      }
    }
    return options;
  }, []);

  const handleVarOverride = (original: string, grimyVar: string | null) => {
    setVarOverrides((prev) => ({ ...prev, [original]: grimyVar }));
  };

  // ── Step 4: Create modele ──

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const modele = await createModele({
        cabinet_id: cabinetId,
        nom: modeleName || fileName.replace(/\.docx$/i, ""),
        description: modeleDescription || `Importé depuis ${fileName}`,
        mission_type: missionType,
        sections: sections.map((s, i) => ({ ...s, ordre: i + 1 })),
        cgv_content: cgvContent ?? GRIMY_DEFAULT_CGV,
        repartition_taches: GRIMY_DEFAULT_REPARTITION,
        is_default: isDefault,
        source: "import_docx",
        original_filename: fileName,
      });
      toast.success("Modèle importé avec succès !");
      setCreatedModele(modele);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création du modèle.";
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // OPT-35: Quick import
  const handleQuickImport = () => {
    setStep("confirm");
  };

  const cnoecCovered = sections.filter((s) => s.cnoec_obligatoire).length;
  const cnoecTotal = GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire).length;
  const stepIndex = STEP_ORDER.indexOf(step);

  const canGoNext = () => {
    if (step === "upload") return !!parsed && !loading;
    if (step === "sections") return sections.length > 0;
    if (step === "variables") return true;
    return false;
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const goPrev = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* OPT-39: Responsive */}
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {createdModele
              ? "Import terminé"
              : step === "upload" ? "Importer un modèle DOCX"
              : step === "sections" ? "Vérification des sections"
              : step === "variables" ? "Mapping des variables"
              : "Confirmer l'import"}
          </DialogTitle>
          <DialogDescription>
            {createdModele
              ? "Le modèle a été créé avec succès."
              : step === "upload" ? "Sélectionnez un fichier .docx pour importer un modèle de lettre de mission."
              : step === "sections" ? `${recognizedCount}/${sections.length} sections reconnues — Vérifiez la correspondance.`
              : step === "variables" ? `${mappedVarCount}/${effectiveVars.length} variables reconnues — Vérifiez le mapping.`
              : "Confirmez les paramètres du modèle avant de finaliser l'import."}
          </DialogDescription>
        </DialogHeader>

        {/* OPT-26: Stepper */}
        {!createdModele && (
          <div className="flex items-center justify-center gap-1.5" role="navigation" aria-label="Étapes d'import">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
                    stepIndex >= i
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 dark:bg-white/[0.1] text-gray-400"
                  }`}
                  aria-current={step === s ? "step" : undefined}
                >
                  {i + 1}
                </div>
                <span className={`text-[10px] hidden sm:inline ${
                  stepIndex >= i ? "text-blue-500 font-medium" : "text-gray-400"
                }`}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEP_ORDER.length - 1 && (
                  <div className={`w-6 h-px ${stepIndex > i ? "bg-blue-500" : "bg-gray-200 dark:bg-white/[0.1]"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══ POST-CREATION ══ */}
        {createdModele && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Modèle « {createdModele.nom} » créé !
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Souhaitez-vous l'éditer maintenant ?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-gray-200 dark:border-white/[0.06]"
              >
                Fermer
              </Button>
              <Button
                onClick={() => {
                  onImportComplete(createdModele);
                  handleOpenChange(false);
                }}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                Éditer le modèle
              </Button>
            </div>
          </div>
        )}

        {/* ══ STEP 1: Upload ══ */}
        {!createdModele && step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
            {loading ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Analyse du document en cours...</p>
                <Progress value={parseProgress} className="w-full h-2" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{fileName}</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="w-full max-w-md rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p>{error}</p>
                      <Button variant="ghost" size="sm" className="mt-1 h-6 text-[10px] text-red-400 hover:text-red-300 px-2"
                        onClick={() => setError(null)}>
                        Réessayer
                      </Button>
                    </div>
                  </div>
                )}
                <label
                  className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? "border-blue-500 bg-blue-500/5 scale-[1.01]"
                      : "border-blue-500/20 hover:border-blue-500/40 hover:bg-white dark:hover:bg-white/[0.02]"
                  }`}
                  role="button"
                  aria-label="Zone de dépôt de fichier DOCX"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                    <Upload className="h-7 w-7 text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Glissez votre DOCX ici ou cliquez pour sélectionner
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Format accepté : .docx — Max 10 Mo
                  </p>
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFileInput}
                    aria-label="Sélectionner un fichier DOCX"
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* ══ STEP 2: Section mapping ══ */}
        {!createdModele && step === "sections" && parsed && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Confidence bar */}
            <div className="flex items-center gap-3">
              <Progress value={parsed.confidence} className="flex-1 h-2" />
              <span className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">
                {recognizedCount}/{sections.length} — {parsed.confidence}%
              </span>
            </div>

            {/* OPT-44: File info */}
            {fileName && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {fileName} ({formatFileSize(fileSize)})
                {parsed.metadata.totalWords > 0 && ` — ~${parsed.metadata.totalWords} mots`}
                {parsed.metadata.language === 'en' && ' — ⚠️ Anglais détecté'}
              </p>
            )}

            {/* OPT-35: Quick import */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickImport}
              className="self-end gap-1.5 text-xs border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
              aria-label="Import rapide — accepter tous les mappings automatiques"
            >
              <Zap className="h-3 w-3" /> Import rapide
            </Button>

            {/* Missing sections warning */}
            {missingCount > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs text-orange-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Sections manquantes : {missingSectionNames.join(", ")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline" size="sm" onClick={addMissingSections}
                    className="gap-1 text-xs border-orange-500/20 text-orange-300 hover:bg-orange-500/10"
                    aria-label={`Ajouter ${missingCount} sections manquantes`}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter {missingCount} section(s) CNOEC
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      const filled = autoFillFromGrimy(sections);
                      setSections(filled);
                      toast.success("Sections complétées depuis GRIMY.");
                    }}
                    className="gap-1 text-xs border-gray-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300"
                  >
                    <Sparkles className="h-3 w-3" /> Auto-compléter
                  </Button>
                </div>
              </div>
            )}

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="space-y-1">
                {parsed.warnings.slice(0, 3).map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-400 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Tabs: Sections / CGV */}
            <Tabs value={mappingTab} onValueChange={(v) => setMappingTab(v as "sections" | "cgv")}>
              <TabsList className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                <TabsTrigger value="sections" className="text-xs gap-1">
                  <FileText className="h-3 w-3" /> Sections ({sections.length})
                </TabsTrigger>
                <TabsTrigger value="cgv" className="text-xs gap-1">
                  <File className="h-3 w-3" /> CGV {cgvContent ? "✓" : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sections">
                {/* OPT-34: Scrollable */}
                <ScrollArea className="max-h-[35vh]">
                  <div className="space-y-2 pr-3">
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
                              isCustom ? "border-orange-500/20 bg-orange-500/5" : "border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {section.titre || "(Sans titre)"}
                                </span>
                              </div>
                              {isCustom ? (
                                <Badge variant="outline" className="shrink-0 text-[9px] text-orange-400 border-orange-500/30">
                                  Personnalisée
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0 text-[9px] text-green-400 border-green-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Auto
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-slate-400 shrink-0">
                                Mapper vers :
                              </Label>
                              <Select
                                value={section.id}
                                onValueChange={(val) => handleSectionIdChange(realIdx, val)}
                              >
                                <SelectTrigger className="h-7 text-xs bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRIMY_DEFAULT_SECTIONS.map((gs) => (
                                    <SelectItem key={gs.id} value={gs.id}>
                                      {gs.titre} {gs.cnoec_obligatoire ? "★" : ""}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={section.id.startsWith("custom_") ? section.id : `custom_${realIdx + 1}`}>
                                    (section personnalisée)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {section.contenu && (
                              <p className="text-[10px] text-slate-400 line-clamp-2 whitespace-pre-line pl-5">
                                {section.contenu.slice(0, 200)}
                                {section.contenu.length > 200 ? "…" : ""}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="cgv">
                <div className="rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3">
                  {cgvContent ? (
                    <div className="space-y-2">
                      <Badge className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20">
                        CGV détectées dans le document
                      </Badge>
                      <p className="text-xs text-slate-400 whitespace-pre-line line-clamp-10">
                        {cgvContent.slice(0, 1000)}
                        {cgvContent.length > 1000 ? "…" : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400">Aucune CGV détectée — les CGV GRIMY par défaut seront utilisées</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ══ STEP 3: Variable mapping ══ */}
        {!createdModele && step === "variables" && parsed && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center gap-3">
              <Progress
                value={effectiveVars.length > 0 ? (mappedVarCount / effectiveVars.length) * 100 : 100}
                className="flex-1 h-2"
              />
              <span className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">
                {mappedVarCount}/{effectiveVars.length} variables
              </span>
            </div>

            {/* Duplicate warnings */}
            {parsed.duplicateVarWarnings.length > 0 && (
              <div className="text-[10px] text-amber-400 space-y-0.5">
                {parsed.duplicateVarWarnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}

            {effectiveVars.length === 0 ? (
              <div className="text-center py-8">
                <Variable className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400">Aucune variable de publipostage détectée.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Le document semble être une lettre finalisée.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-4 pr-3">
                  {Object.entries(groupedVars).map(([groupKey, vars]) => {
                    if (vars.length === 0) return null;
                    return (
                      <div key={groupKey}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          {GROUP_LABELS[groupKey] || groupKey} ({vars.length})
                        </p>
                        <div className="space-y-1.5">
                          {vars.map((v, i) => (
                            <div
                              key={`${v.original}-${i}`}
                              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-2"
                            >
                              {/* Original variable */}
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <code className="text-[10px] bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-300 truncate">
                                  {v.format === '«»' ? `«${v.original}»` :
                                   v.format === '<<>>' ? `<<${v.original}>>` :
                                   v.format === '{{}}' ? `{{${v.original}}}` :
                                   v.format === '{}' ? `{${v.original}}` :
                                   v.format === '[]' ? `[${v.original}]` :
                                   v.format === '*AUTO*' ? `*${v.original}*` :
                                   v.original}
                                </code>
                                {v.count > 1 && (
                                  <span className="text-[9px] text-slate-400">×{v.count}</span>
                                )}
                              </div>

                              <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />

                              {/* Mapped GRIMY variable */}
                              <Select
                                value={v.mapped || "__ignore__"}
                                onValueChange={(val) =>
                                  handleVarOverride(v.original, val === "__ignore__" ? null : val)
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-[160px] bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]">
                                  <SelectValue placeholder="Assigner à..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__ignore__">
                                    <span className="text-slate-400">Ignorer</span>
                                  </SelectItem>
                                  {grimyVarOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Auto/Manual badge */}
                              {v.mapped ? (
                                varOverrides[v.original] !== undefined ? (
                                  <Badge variant="outline" className="shrink-0 text-[8px] text-blue-400 border-blue-500/30">
                                    Manuel
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="shrink-0 text-[8px] text-green-400 border-green-500/30">
                                    Auto
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="shrink-0 text-[8px] text-orange-400 border-orange-500/30">
                                  ?
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* ══ STEP 4: Confirmation ══ */}
        {!createdModele && step === "confirm" && (
          <div className="flex-1 space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Nom du modèle</Label>
              <Input
                value={modeleName}
                onChange={(e) => setModeleName(e.target.value)}
                placeholder="Mon modèle importé"
                className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]"
                aria-label="Nom du modèle"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Type de mission</Label>
              <Select value={missionType} onValueChange={setMissionType}>
                <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_CATEGORIES.map((cat) => (
                    <SelectGroup key={cat.category}>
                      <SelectLabel className="text-[10px] text-slate-400">{cat.label}</SelectLabel>
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

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Description (optionnel)</Label>
              <Textarea
                value={modeleDescription}
                onChange={(e) => setModeleDescription(e.target.value)}
                placeholder="Description du modèle..."
                className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] min-h-[60px]"
                aria-label="Description du modèle"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
              <Label htmlFor="is-default" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                Définir comme modèle par défaut
              </Label>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 space-y-2">
              <p className="text-sm font-medium text-slate-900 dark:text-white">Résumé de l'import</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                <span className="text-slate-400">Sections :</span>
                <span className="text-slate-700 dark:text-slate-300">{sections.length}</span>
                <span className="text-slate-400">CNOEC couvertes :</span>
                <span className="text-slate-700 dark:text-slate-300">{cnoecCovered}/{cnoecTotal}</span>
                <span className="text-slate-400">Variables mappées :</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {parsed ? `${mappedVarCount}/${effectiveVars.length}` : '—'}
                </span>
                <span className="text-slate-400">CGV :</span>
                <span className="text-slate-700 dark:text-slate-300">{cgvContent ? "Détectées" : "GRIMY par défaut"}</span>
                <span className="text-slate-400">Source :</span>
                <span className="text-slate-700 dark:text-slate-300 truncate">{fileName} ({formatFileSize(fileSize)})</span>
                {parsed?.metadata.language && parsed.metadata.language !== 'unknown' && (
                  <>
                    <span className="text-slate-400">Langue :</span>
                    <span className="text-slate-700 dark:text-slate-300">{parsed.metadata.language === 'fr' ? 'Français' : 'Anglais'}</span>
                  </>
                )}
              </div>
              {cnoecCovered < cnoecTotal && (
                <div className="flex items-start gap-2 mt-2 text-xs text-orange-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{cnoecTotal - cnoecCovered} section(s) CNOEC obligatoire(s) manquante(s).</span>
                </div>
              )}
            </div>

            {/* Error in confirmation */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>{error}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-6 text-[10px] text-red-400 px-2"
                    onClick={() => { setError(null); handleCreate(); }}>
                    Réessayer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ Footer navigation ══ */}
        {!createdModele && (
          <DialogFooter className="gap-2">
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={step === "sections" ? () => { reset(); } : goPrev}
                className="border-gray-200 dark:border-white/[0.06] gap-1"
                aria-label="Étape précédente"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {step === "sections" ? "Nouveau fichier" : "Précédent"}
              </Button>
            )}
            {step !== "confirm" && step !== "upload" && (
              <Button
                onClick={goNext}
                disabled={!canGoNext()}
                className="bg-blue-600 hover:bg-blue-700 gap-1"
                aria-label="Étape suivante"
              >
                Suivant
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === "confirm" && (
              <Button
                onClick={handleCreate}
                disabled={loading || !modeleName.trim()}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                aria-label="Créer le modèle"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer le modèle
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
