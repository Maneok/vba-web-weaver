import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import {
  generateFromClient,
  renderToPdf,
  renderToDocx,
  validateLettreMission,
} from "@/lib/lettreMissionEngine";
import type { CabinetConfig } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Save,
  Mail,
  Check,
} from "lucide-react";
import ClientSelector from "@/components/lettre-mission/ClientSelector";
import LettreMissionEditor, {
  buildDefaultEditorState,
  type EditorState,
} from "@/components/lettre-mission/LettreMissionEditor";
import LettreMissionPreviewV2 from "@/components/lettre-mission/LettreMissionPreviewV2";

// ── Constants ──
const DEFAULT_CABINET: CabinetConfig = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
  couleurPrimaire: "#1E3A5F",
  couleurSecondaire: "#3B82F6",
  police: "system-ui",
};

type LetterStatus = "brouillon" | "finalisee" | "envoyee";
type ViewTab = "editeur" | "apercu";

const STATUS_CONFIG: Record<LetterStatus, { label: string; className: string }> = {
  brouillon: { label: "Brouillon", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  finalisee: { label: "Finalisée", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  envoyee: { label: "Envoyée", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
};

const SECTIONS = [
  { id: 1, label: "Introduction" },
  { id: 2, label: "Entité" },
  { id: 3, label: "LCB-FT" },
  { id: 4, label: "Mission" },
  { id: 5, label: "Durée" },
  { id: 6, label: "Missions comp." },
  { id: 7, label: "Honoraires" },
  { id: 8, label: "Paiement" },
  { id: 9, label: "Conclusion" },
  { id: 10, label: "Annexes" },
];

// ── Main Component ──
export default function LettreMissionPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectedRef, setSelectedRef] = useState<string | null>(ref ?? null);
  const [editorState, setEditorState] = useState<EditorState>(() =>
    buildDefaultEditorState(ref ? clients.find((c) => c.ref === ref) : null)
  );
  const [activeTab, setActiveTab] = useState<ViewTab>("editeur");
  const [status, setStatus] = useState<LetterStatus>("brouillon");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [focusedSection, setFocusedSection] = useState<string | undefined>();

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  const validation = useMemo(
    () => (client ? validateLettreMission(client, DEFAULT_CABINET) : null),
    [client]
  );

  const handleClientSelected = useCallback((c: Client) => {
    setSelectedRef(c.ref);
    setEditorState(buildDefaultEditorState(c));
    setStatus("brouillon");
    setLastSaved(null);
  }, []);

  // Build options from editor state for PDF/DOCX export
  const buildOptions = useCallback(() => ({
    genre: editorState.genre === "M" ? ("M" as const) : ("F" as const),
    missionSociale: editorState.missions.sociale,
    missionJuridique: editorState.missions.juridique,
    missionControleFiscal: editorState.missions.controleFiscal,
    honorairesSocial: 0,
    honorairesJuridique: editorState.honoraires.honoraires_juridique,
    honorairesControleFiscal: 0,
    fraisConstitution: editorState.honoraires.setup,
    exerciceDebut: "01/01/2026",
    exerciceFin: "31/12/2026",
    regimeFiscal: "IS — Impôt sur les Sociétés",
    tvaRegime: "Réel normal",
    cac: false,
    volumeComptable: "< 500 écritures/an",
    periodicite: editorState.honoraires.frequence === "mensuel" ? "Mensuelle" : "Trimestrielle",
    outilComptable: "Non précisé",
    controleFiscalOptions: editorState.missions.controleFiscalOption
      ? [editorState.missions.controleFiscalOption]
      : [],
  }), [editorState]);

  // Section completion status based on editor state
  const sectionStatus = useMemo(() => {
    if (!client) return SECTIONS.map(() => "grey" as const);
    const s = editorState.sections;
    return SECTIONS.map((_, i) => {
      const section = s[i];
      if (!section) return "green" as const;
      if (!section.visible) return "grey" as const;
      if (section.editable && (!section.content || section.content.trim().length < 10)) return "orange" as const;
      return "green" as const;
    });
  }, [client, editorState.sections]);

  const completedCount = sectionStatus.filter((s) => s === "green").length;
  const progressPercent = SECTIONS.length > 0 ? Math.round((completedCount / SECTIONS.length) * 100) : 0;

  // ── Export handlers with try/catch ──
  const handleExportPdf = useCallback(() => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    try {
      const opts = buildOptions();
      const lm = generateFromClient(client, DEFAULT_CABINET, opts);
      renderToPdf(lm);
      toast.success("PDF généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    }
  }, [client, validation, buildOptions]);

  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    try {
      const opts = buildOptions();
      const lm = generateFromClient(client, DEFAULT_CABINET, opts);
      await renderToDocx(lm);
      toast.success("DOCX généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du DOCX");
    }
  }, [client, validation, buildOptions]);

  const handleSave = useCallback(() => {
    setLastSaved(new Date());
    setStatus("finalisee");
    toast.success("Lettre sauvegardée");
  }, []);

  const handleEmail = useCallback(() => {
    setStatus("envoyee");
    toast.success("Email envoyé (simulation)");
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (mod && e.key === "p") {
        e.preventDefault();
        handleExportPdf();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, handleExportPdf]);

  // ── Section scroll ──
  const scrollToSection = useCallback((sectionId: number) => {
    const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Time since last save ──
  const timeSinceSave = useMemo(() => {
    if (!lastSaved) return null;
    const diff = Math.round((Date.now() - lastSaved.getTime()) / 60000);
    if (diff < 1) return "à l'instant";
    return `il y a ${diff} min`;
  }, [lastSaved]);

  const statusConf = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ═══ TOOLBAR — Sticky within outlet ═══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 shrink-0">
        {/* Line 1: Back + Title + Status | Tab switcher + Export */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
            <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
            <Badge variant="outline" className={`text-xs ${statusConf.className}`}>
              {statusConf.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex rounded-md border border-white/10 overflow-hidden">
              <button
                onClick={() => setActiveTab("editeur")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "editeur"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Éditeur
              </button>
              <button
                onClick={() => setActiveTab("apercu")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "apercu"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Aperçu
              </button>
            </div>

            <div className="w-px h-5 bg-white/10" />

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={!client}
              className="gap-1 text-xs"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportDocx}
              disabled={!client}
              className="gap-1 text-xs"
            >
              <FileText className="h-3.5 w-3.5" /> DOCX
            </Button>
          </div>
        </div>

        {/* Line 2: Client selector + Validation */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ClientSelector
              selectedRef={selectedRef}
              onClientSelected={handleClientSelected}
            />

            {validation && (
              <Badge
                variant="outline"
                className={`text-xs h-6 ${
                  validation.valid
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-amber-500/30 text-amber-400"
                }`}
              >
                {validation.valid ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Dossier complet</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 mr-1" /> {validation.champsManquants.length} champ(s) manquant(s)</>
                )}
              </Badge>
            )}
          </div>
        </div>

        {/* Line 3: Save + Email + last saved | Progress */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!client}
              className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7"
            >
              <Save className="h-3.5 w-3.5" /> Sauvegarder
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              disabled={!client}
              className="gap-1 text-xs h-7"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            {timeSinceSave && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" />
                Dernière sauvegarde : {timeSinceSave}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {completedCount}/{SECTIONS.length} sections — {progressPercent}%
            </span>
            <Progress value={progressPercent} className="w-32 h-1.5" />
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 overflow-hidden">
        {/* ── APERÇU MODE ── */}
        {activeTab === "apercu" && (
          <div className="h-full overflow-auto">
            <LettreMissionPreviewV2
              state={editorState}
              client={client}
              activeSectionId={focusedSection}
            />
          </div>
        )}

        {/* ── ÉDITEUR MODE ── */}
        {activeTab === "editeur" && (
          <div className="flex h-full">
            {/* Section nav sidebar — compact, does NOT overlap content */}
            <div className="w-8 shrink-0 bg-slate-900/50 border-r border-white/[0.06] overflow-y-auto">
              <div className="flex flex-col items-center py-3 gap-1.5">
                {SECTIONS.map((s, i) => {
                  const st = sectionStatus[i];
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      title={s.label}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110 ${
                        st === "green"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : st === "orange"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-slate-700/30 text-slate-500 border border-white/[0.06]"
                      }`}
                    >
                      {st === "green" ? "✓" : s.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editor content */}
            <div ref={contentRef} className="flex-1 overflow-hidden">
              {!client ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  Sélectionnez un client pour générer une lettre de mission
                </div>
              ) : (
                <LettreMissionEditor
                  client={client}
                  state={editorState}
                  onChange={setEditorState}
                  onSectionFocus={setFocusedSection}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
