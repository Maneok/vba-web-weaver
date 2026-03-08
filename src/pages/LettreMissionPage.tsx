import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import {
  generateFromClient,
  getDefaultTemplate,
  renderToPdf,
  renderToDocx,
  validateLettreMission,
} from "@/lib/lettreMissionEngine";
import type { CabinetConfig } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Edit3,
} from "lucide-react";
import ClientSelector from "@/components/lettre-mission/ClientSelector";
import LettreMissionEditor, {
  buildDefaultEditorState,
  type EditorState,
} from "@/components/lettre-mission/LettreMissionEditor";
import LettreMissionPreview from "@/components/lettre-mission/LettreMissionPreview";

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

export default function LettreMissionPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();

  const [selectedRef, setSelectedRef] = useState<string | null>(ref ?? null);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [editorState, setEditorState] = useState<EditorState>(() =>
    buildDefaultEditorState(ref ? clients.find((c) => c.ref === ref) : null)
  );

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  const validation = useMemo(
    () => (client ? validateLettreMission(client, DEFAULT_CABINET) : null),
    [client]
  );

  const handleClientSelected = useCallback(
    (c: Client) => {
      setSelectedRef(c.ref);
      setEditorState(buildDefaultEditorState(c));
    },
    []
  );

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

  const handleExportPdf = useCallback(() => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    const options = buildOptions();
    const lm = generateFromClient(client, DEFAULT_CABINET, options);
    renderToPdf(lm);
    toast.success("PDF généré avec succès");
  }, [client, validation, buildOptions]);

  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    if (validation && !validation.valid) {
      toast.error(`Champs manquants : ${validation.champsManquants.join(", ")}`);
      return;
    }
    const options = buildOptions();
    const lm = generateFromClient(client, DEFAULT_CABINET, options);
    await renderToDocx(lm);
    toast.success("DOCX généré avec succès");
  }, [client, validation, buildOptions]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(client ? `/client/${client.ref}` : "/bdd")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-white/10 overflow-hidden mr-2">
            <Button
              size="sm"
              variant={view === "editor" ? "default" : "ghost"}
              onClick={() => setView("editor")}
              className="rounded-none gap-1 text-xs"
            >
              <Edit3 className="h-3 w-3" /> Éditeur
            </Button>
            <Button
              size="sm"
              variant={view === "preview" ? "default" : "ghost"}
              onClick={() => setView("preview")}
              className="rounded-none gap-1 text-xs"
            >
              <Eye className="h-3 w-3" /> Aperçu
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            disabled={!client}
            className="gap-1"
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportDocx}
            disabled={!client}
            className="gap-1"
          >
            <FileText className="h-4 w-4" /> DOCX
          </Button>
        </div>
      </div>

      {/* Client selector bar */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-white/10 flex items-center gap-4">
        <ClientSelector
          selectedRef={selectedRef}
          onClientSelected={handleClientSelected}
        />
        {/* Validation badge */}
        {client && validation && (
          <div className="flex items-center gap-2">
            {validation.valid ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">Dossier complet</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400">
                  {validation.champsManquants.length} champ(s) manquant(s)
                </span>
                <div className="flex flex-wrap gap-1 ml-1">
                  {validation.champsManquants.slice(0, 3).map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="text-[10px] border-amber-500/30 text-amber-300"
                    >
                      {c}
                    </Badge>
                  ))}
                  {validation.champsManquants.length > 3 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/30 text-amber-300"
                    >
                      +{validation.champsManquants.length - 3}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!client && !ref ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            Sélectionnez un client pour générer une lettre de mission
          </div>
        ) : view === "editor" ? (
          <LettreMissionEditor
            client={client}
            state={editorState}
            onChange={setEditorState}
          />
        ) : (
          <LettreMissionPreview
            client={client!}
            template={getDefaultTemplate()}
            cabinetConfig={DEFAULT_CABINET}
            options={buildOptions()}
          />
        )}
      </div>
    </div>
  );
}
