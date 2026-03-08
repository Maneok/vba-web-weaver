import { useState, useRef, useCallback, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Save, FileDown, FileText, Mail,
  CheckCircle2, AlertCircle, MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/types";
import { LETTRE_MISSION_TEMPLATE, getFormulePolitesse, type Genre } from "@/lib/lettreMissionContent";
import GenreSelector from "./GenreSelector";
import MissionsToggle, { type MissionsToggleState } from "./MissionsToggle";
import type { HonorairesValues } from "./HonorairesTable";
import HonorairesTable from "./HonorairesTable";
import type { MissionsConfig } from "./MissionsSelector";
import AnnexesPreview from "./AnnexesPreview";

/* ---- Types ---- */
export interface EditorSection {
  id: string;
  title: string;
  visible: boolean;
  content: string;
  editable: boolean;
}

export interface EditorState {
  genre: Genre;
  sections: EditorSection[];
  missions: MissionsToggleState;
  honoraires: HonorairesValues;
}

/* ---- Variable highlighting ---- */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("{{") ? (
          <span key={i} className="bg-blue-500/20 text-blue-300 rounded px-0.5 font-mono text-[11px]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/* ---- Section status ---- */
function getSectionStatus(content: string, visible: boolean): "complete" | "partial" | "empty" {
  if (!visible) return "empty";
  if (!content || content.trim().length < 10) return "partial";
  const unresolvedVars = content.match(/{{[^}]+}}/g);
  if (unresolvedVars && unresolvedVars.length > 5) return "partial";
  return "complete";
}

function StatusIcon({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "partial") return <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />;
  return <MinusCircle className="h-4 w-4 text-slate-500 shrink-0" />;
}

/* ---- Default state builder ---- */
export function buildDefaultEditorState(client?: Client | null): EditorState {
  const tpl = LETTRE_MISSION_TEMPLATE;

  const sections: EditorSection[] = [
    { id: "introduction", title: "Introduction", visible: true, editable: true, content: tpl.introduction.salutation },
    { id: "entite", title: "Votre entite", visible: true, editable: false, content: "" },
    { id: "lcbft", title: "Obligations LCB-FT", visible: true, editable: false, content: "" },
    { id: "mission", title: "Notre mission", visible: true, editable: true, content: tpl.mission.texte },
    { id: "duree", title: "Duree de la mission", visible: true, editable: true, content: tpl.duree.texte },
    { id: "nature", title: "Nature et limites de la mission", visible: true, editable: true, content: tpl.nature.texte },
    { id: "mission_sociale", title: "Mission sociale", visible: false, editable: true, content: tpl.missionSociale.texte },
    { id: "mission_juridique", title: "Mission juridique", visible: false, editable: true, content: tpl.missionJuridique.texte },
    { id: "mission_controle_fiscal", title: "Assistance controle fiscal", visible: false, editable: true, content: tpl.missionControleFiscal.texte },
    { id: "honoraires", title: "Honoraires", visible: true, editable: false, content: tpl.honoraires.introduction },
    { id: "paiement", title: "Modalites de paiement", visible: true, editable: true, content: tpl.honoraires.paiement },
    { id: "conclusion", title: "Conclusion et signatures", visible: true, editable: true, content: tpl.conclusion.texte },
    { id: "annexes", title: "Annexes", visible: true, editable: false, content: "" },
  ];

  return {
    genre: "M",
    sections,
    missions: {
      sociale: false,
      juridique: false,
      controleFiscal: false,
      controleFiscalOption: null,
    },
    honoraires: {
      honoraires: client?.honoraires ?? 0,
      setup: 0,
      honoraires_juridique: client?.juridique ?? 0,
      frequence: "mensuel",
    },
  };
}

/* ---- Main component ---- */
interface LettreMissionEditorProps {
  client: Client | null;
  state: EditorState;
  onChange: (state: EditorState) => void;
  onSectionFocus?: (sectionId: string) => void;
}

export default function LettreMissionEditor({ client, state, onChange, onSectionFocus }: LettreMissionEditorProps) {
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const updateSection = useCallback((id: string, updates: Partial<EditorSection>) => {
    onChange({
      ...state,
      sections: state.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  }, [state, onChange]);

  const handleMissionsChange = useCallback((missions: MissionsToggleState) => {
    onChange({
      ...state,
      missions,
      sections: state.sections.map((s) => {
        if (s.id === "mission_sociale") return { ...s, visible: missions.sociale };
        if (s.id === "mission_juridique") return { ...s, visible: missions.juridique };
        if (s.id === "mission_controle_fiscal") return { ...s, visible: missions.controleFiscal };
        return s;
      }),
    });
  }, [state, onChange]);

  const handleHonorairesChange = useCallback((honoraires: HonorairesValues) => {
    onChange({ ...state, honoraires });
  }, [state, onChange]);

  const handleGenreChange = useCallback((genre: Genre) => {
    onChange({ ...state, genre });
  }, [state, onChange]);

  // Missions config adapter for HonorairesTable
  const missionsConfig: MissionsConfig = useMemo(() => ({
    comptable: true as const,
    sociale: state.missions.sociale,
    juridique: state.missions.juridique,
    controleFiscal: state.missions.controleFiscal,
    controleFiscalOption: state.missions.controleFiscalOption,
  }), [state.missions]);

  // Progress
  const visibleSections = state.sections.filter((s) => s.visible);
  const completeSections = visibleSections.filter((s) => getSectionStatus(s.content, s.visible) === "complete").length;
  const progressPercent = visibleSections.length > 0 ? Math.round((completeSections / visibleSections.length) * 100) : 0;

  const handleAccordionChange = (value: string) => {
    if (value) onSectionFocus?.(value);
  };

  const tpl = LETTRE_MISSION_TEMPLATE;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-white/[0.06] px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20"
            onClick={() => toast.success("Lettre sauvegardee en brouillon")}
          >
            <Save className="h-4 w-4" /> Sauvegarder
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20"
            onClick={() => toast.info("Export PDF via le module de generation")}
          >
            <FileDown className="h-4 w-4" /> Exporter PDF
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
            onClick={() => toast.info("Export DOCX bientot disponible")}
          >
            <FileText className="h-4 w-4" /> Exporter DOCX
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Envoi par email bientot disponible")}>
            <Mail className="h-4 w-4" /> Email
          </Button>
          <div className="flex-1" />
          <GenreSelector value={state.genre} onChange={handleGenreChange} />
        </div>
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completeSections}/{visibleSections.length} sections — {progressPercent}%
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <Accordion type="single" collapsible onValueChange={handleAccordionChange} defaultValue="introduction">

          {/* Introduction */}
          <AccordionItem value="introduction" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(state.sections[0].content, true)} />
                <span className="font-medium">1. Introduction</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <textarea
                ref={(el) => { textareaRefs.current["introduction"] = el; }}
                value={state.sections[0].content}
                onChange={(e) => updateSection("introduction", { content: e.target.value })}
                rows={6}
                className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                <HighlightedText text={state.sections[0].content.slice(0, 200)} />
                {state.sections[0].content.length > 200 && "..."}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Entite */}
          <AccordionItem value="entite" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={client ? "complete" : "empty"} />
                <span className="font-medium">2. {tpl.entite.titre}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {client ? (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {([
                        ["Raison sociale", client.raisonSociale],
                        ["Forme juridique", client.forme],
                        ["Capital social", `${client.capital?.toLocaleString("fr-FR") ?? "N/C"} EUR`],
                        ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
                        ["SIREN", client.siren],
                        ["Code APE", client.ape],
                        ["Dirigeant", client.dirigeant],
                        ["Activite", client.domaine],
                        ["Effectif", client.effectif],
                        ["Date de creation", client.dateCreation],
                        ["Mission", client.mission],
                        ["Periodicite", client.frequence],
                      ]).map(([label, value]) => (
                        <tr key={label} className="border-b border-white/[0.04] last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground w-40">{label}</td>
                          <td className="px-3 py-2 text-sm font-medium">{value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  Selectionnez un client pour remplir cette section
                </p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* LCB-FT */}
          <AccordionItem value="lcbft" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={client ? "complete" : "empty"} />
                <span className="font-medium">3. {tpl.lcbft.titre}</span>
                {client && (
                  <Badge variant={client.nivVigilance === "RENFORCEE" ? "destructive" : client.nivVigilance === "SIMPLIFIEE" ? "secondary" : "default"} className="text-[10px]">
                    {client.nivVigilance}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <p className="text-[10px] text-muted-foreground mb-3">{tpl.lcbft.soustitre}</p>
              {client ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border border-white/10 p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Score de risque</span>
                      <span className="text-lg font-bold">{client.scoreGlobal}<span className="text-xs text-muted-foreground">/100</span></span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Vigilance</span>
                      <Badge variant={client.nivVigilance === "RENFORCEE" ? "destructive" : "default"}>{client.nivVigilance}</Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">PPE</span>
                      <Badge variant={client.ppe === "OUI" ? "destructive" : "secondary"}>{client.ppe}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Pays a risque</span>
                      <Badge variant={client.paysRisque === "OUI" ? "destructive" : "secondary"}>{client.paysRisque}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Derniere revue</span>
                      <span>{client.dateDerniereRevue || "—"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  Selectionnez un client pour voir les donnees LCB-FT
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-2 mt-3">
                <p>{tpl.lcbft.engagements}</p>
                <p>{tpl.lcbft.conservation}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                Ces valeurs sont calculees depuis le dossier client et ne sont pas editables.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Mission */}
          <AccordionItem value="mission" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(state.sections[3].content, true)} />
                <span className="font-medium">4. {tpl.mission.titre}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <textarea
                value={state.sections[3].content}
                onChange={(e) => updateSection("mission", { content: e.target.value })}
                rows={10}
                className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </AccordionContent>
          </AccordionItem>

          {/* Duree */}
          <AccordionItem value="duree" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(state.sections[4].content, true)} />
                <span className="font-medium">5. {tpl.duree.titre}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <textarea
                value={state.sections[4].content}
                onChange={(e) => updateSection("duree", { content: e.target.value })}
                rows={5}
                className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </AccordionContent>
          </AccordionItem>

          {/* Missions complementaires */}
          <AccordionItem value="missions_complementaires" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status="complete" />
                <span className="font-medium">6. Missions complementaires</span>
                {(state.missions.sociale || state.missions.juridique || state.missions.controleFiscal) && (
                  <Badge variant="secondary" className="text-[10px]">
                    {[state.missions.sociale && "Social", state.missions.juridique && "Juridique", state.missions.controleFiscal && "Fiscal"].filter(Boolean).join(", ")}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <MissionsToggle value={state.missions} onChange={handleMissionsChange} />
              {/* Show editable textarea for each active complementary mission */}
              {state.missions.sociale && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contenu mission sociale :</p>
                  <textarea
                    value={state.sections.find((s) => s.id === "mission_sociale")?.content ?? ""}
                    onChange={(e) => updateSection("mission_sociale", { content: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              {state.missions.juridique && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contenu mission juridique :</p>
                  <textarea
                    value={state.sections.find((s) => s.id === "mission_juridique")?.content ?? ""}
                    onChange={(e) => updateSection("mission_juridique", { content: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              {state.missions.controleFiscal && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contenu controle fiscal :</p>
                  <textarea
                    value={state.sections.find((s) => s.id === "mission_controle_fiscal")?.content ?? ""}
                    onChange={(e) => updateSection("mission_controle_fiscal", { content: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Honoraires */}
          <AccordionItem value="honoraires" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={state.honoraires.honoraires > 0 ? "complete" : "partial"} />
                <span className="font-medium">7. {tpl.honoraires.titre}</span>
                {state.honoraires.honoraires > 0 && (
                  <Badge variant="outline" className="text-[10px]">{state.honoraires.honoraires.toLocaleString("fr-FR")} EUR HT</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <HonorairesTable
                values={state.honoraires}
                onChange={handleHonorairesChange}
                missions={missionsConfig}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Paiement */}
          <AccordionItem value="paiement" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(state.sections[10].content, true)} />
                <span className="font-medium">8. Modalites de paiement</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <textarea
                value={state.sections[10].content}
                onChange={(e) => updateSection("paiement", { content: e.target.value })}
                rows={6}
                className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </AccordionContent>
          </AccordionItem>

          {/* Conclusion & Signature */}
          <AccordionItem value="conclusion" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(state.sections[11].content, true)} />
                <span className="font-medium">9. Conclusion et signatures</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <textarea
                value={state.sections[11].content}
                onChange={(e) => updateSection("conclusion", { content: e.target.value })}
                rows={5}
                className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </AccordionContent>
          </AccordionItem>

          {/* Annexes */}
          <AccordionItem value="annexes" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status="complete" />
                <span className="font-medium">Annexes</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <AnnexesPreview />
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );
}
