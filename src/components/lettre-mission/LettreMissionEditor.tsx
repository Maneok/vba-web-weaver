import { useState, useRef, useCallback } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Save, FileDown, FileText, Mail, BookOpen,
  CheckCircle2, AlertCircle, MinusCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/types";
import { loadCabinetConfig } from "./CabinetConfigForm";
import VariableInserter from "./VariableInserter";
import ClauseLibrary, { type Clause } from "./ClauseLibrary";

/* ---------- types ---------- */
export interface LettreMissionData {
  // En-tete
  lieuLettre: string;
  dateLettre: string;
  // Destinataire
  destinataireNom: string;
  destinataireAdresse: string;
  destinataireCpVille: string;
  // Introduction
  introduction: string;
  // Entite
  raisonSociale: string;
  formeJuridique: string;
  siren: string;
  capital: string;
  adresse: string;
  cpVille: string;
  ape: string;
  dirigeant: string;
  effectif: string;
  domaine: string;
  dateCreation: string;
  // LCB-FT (read-only computed)
  nivVigilance: string;
  scoreGlobal: number;
  ppe: string;
  paysRisque: string;
  be: string;
  // Mission
  missionPrincipale: string;
  missionDescription: string;
  // Missions complementaires
  missionSocial: boolean;
  missionJuridique: boolean;
  missionControleFiscal: boolean;
  // Honoraires
  honorairesHT: string;
  frequencePaiement: string;
  // Modalites
  modalites: string;
  // Signature
  signataireNom: string;
  signataireFonction: string;
  lieuSignature: string;
  // Annexes
  annexeRepartition: boolean;
  annexeAttestation: boolean;
  annexeSepa: boolean;
  annexeLiasse: boolean;
  annexeCgv: boolean;
}

const DEFAULT_DATA: LettreMissionData = {
  lieuLettre: "",
  dateLettre: new Date().toISOString().split("T")[0],
  destinataireNom: "",
  destinataireAdresse: "",
  destinataireCpVille: "",
  introduction: "Nous avons l'honneur de vous confirmer les termes et objectifs de notre mission ainsi que la nature et les limites de celle-ci.",
  raisonSociale: "",
  formeJuridique: "",
  siren: "",
  capital: "",
  adresse: "",
  cpVille: "",
  ape: "",
  dirigeant: "",
  effectif: "",
  domaine: "",
  dateCreation: "",
  nivVigilance: "",
  scoreGlobal: 0,
  ppe: "",
  paysRisque: "",
  be: "",
  missionPrincipale: "",
  missionDescription: "Conformement aux normes professionnelles applicables, notre mission comprend la tenue et/ou la surveillance de votre comptabilite, l'etablissement des comptes annuels et des declarations fiscales correspondantes.",
  missionSocial: false,
  missionJuridique: false,
  missionControleFiscal: false,
  honorairesHT: "",
  frequencePaiement: "Mensuel",
  modalites: "Les relations entre le cabinet et le client s'inscrivent dans un cadre de confiance mutuelle. Le client s'engage a fournir tous les documents et informations necessaires a la bonne execution de la mission dans les delais convenus.",
  signataireNom: "",
  signataireFonction: "Expert-Comptable",
  lieuSignature: "",
  annexeRepartition: true,
  annexeAttestation: true,
  annexeSepa: true,
  annexeLiasse: false,
  annexeCgv: true,
};

/* ---------- section defs ---------- */
interface SectionDef {
  id: string;
  title: string;
  required: (keyof LettreMissionData)[];
}

const SECTIONS: SectionDef[] = [
  { id: "entete", title: "En-tete et destinataire", required: ["lieuLettre", "dateLettre", "destinataireNom"] },
  { id: "introduction", title: "Introduction", required: ["introduction"] },
  { id: "entite", title: "Votre entite", required: ["raisonSociale", "siren", "formeJuridique", "dirigeant"] },
  { id: "lcbft", title: "Obligations LCB-FT", required: ["nivVigilance"] },
  { id: "mission", title: "Notre mission", required: ["missionPrincipale", "missionDescription"] },
  { id: "complementaires", title: "Missions complementaires", required: [] },
  { id: "honoraires", title: "Honoraires", required: ["honorairesHT", "frequencePaiement"] },
  { id: "modalites", title: "Modalites relationnelles", required: ["modalites"] },
  { id: "signature", title: "Signature", required: ["signataireNom"] },
  { id: "annexes", title: "Annexes", required: [] },
];

/* ---------- helpers ---------- */
function getSectionStatus(data: LettreMissionData, section: SectionDef): "complete" | "partial" | "empty" {
  if (section.required.length === 0) return "complete";
  const filled = section.required.filter((k) => {
    const v = data[k];
    return v !== "" && v !== 0 && v !== false;
  });
  if (filled.length === section.required.length) return "complete";
  if (filled.length > 0) return "partial";
  return "empty";
}

function StatusIcon({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "partial") return <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />;
  return <MinusCircle className="h-4 w-4 text-slate-500 shrink-0" />;
}

/* ---------- component ---------- */
interface LettreMissionEditorProps {
  data: LettreMissionData;
  onChange: (data: LettreMissionData) => void;
  onScrollToSection?: (sectionId: string) => void;
}

export { DEFAULT_DATA };
export type { SectionDef };

export default function LettreMissionEditor({ data, onChange, onScrollToSection }: LettreMissionEditorProps) {
  const [clauseLibraryOpen, setClauseLibraryOpen] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const update = useCallback(<K extends keyof LettreMissionData>(field: K, value: LettreMissionData[K]) => {
    onChange({ ...data, [field]: value });
  }, [data, onChange]);

  const completeSections = SECTIONS.filter((s) => getSectionStatus(data, s) === "complete").length;
  const totalSections = SECTIONS.length;
  const progressPercent = Math.round((completeSections / totalSections) * 100);

  const handleInsertVariable = useCallback((variable: string) => {
    if (!activeField) return;
    const textarea = textareaRefs.current[activeField];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const newValue = currentValue.slice(0, start) + variable + currentValue.slice(end);
    update(activeField as keyof LettreMissionData, newValue as never);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    });
  }, [activeField, update]);

  const handleAddClause = (clause: Clause) => {
    update("missionDescription", data.missionDescription + "\n\n" + clause.content);
    toast.success(`Clause "${clause.title}" ajoutee`);
  };

  const handleAccordionChange = (value: string) => {
    if (value && onScrollToSection) {
      onScrollToSection(value);
    }
  };

  const config = loadCabinetConfig();

  const renderTextarea = (field: keyof LettreMissionData, placeholder: string, rows = 3) => (
    <Textarea
      ref={(el) => { textareaRefs.current[field] = el; }}
      value={data[field] as string}
      onChange={(e) => update(field, e.target.value as never)}
      onFocus={() => setActiveField(field)}
      placeholder={placeholder}
      rows={rows}
      className="bg-background/50 border-white/10 resize-y"
    />
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar sticky */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-white/[0.06] px-4 py-3">
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
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
            onClick={() => toast.info("Export DOCX bientot disponible")}
          >
            <FileText className="h-4 w-4" /> DOCX
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => toast.info("Envoi par email bientot disponible")}
          >
            <Mail className="h-4 w-4" /> Email
          </Button>
          <div className="flex-1" />
          <VariableInserter onInsert={handleInsertVariable} />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setClauseLibraryOpen(true)}>
            <BookOpen className="h-4 w-4" /> Clauses
          </Button>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3 mt-3">
          <Progress value={progressPercent} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completeSections}/{totalSections} sections — {progressPercent}%
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <Accordion type="single" collapsible onValueChange={handleAccordionChange} defaultValue="entete">
          {/* 1. En-tete et destinataire */}
          <AccordionItem value="entete" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[0])} />
                <span className="font-medium">1. En-tete et destinataire</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Lieu</Label>
                  <Input value={data.lieuLettre} onChange={(e) => update("lieuLettre", e.target.value)} placeholder={config.ville || "Paris"} className="bg-background/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={data.dateLettre} onChange={(e) => update("dateLettre", e.target.value)} className="bg-background/50 border-white/10" />
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinataire</p>
                <div>
                  <Label className="text-xs text-muted-foreground">Nom / Raison sociale</Label>
                  <Input value={data.destinataireNom} onChange={(e) => update("destinataireNom", e.target.value)} placeholder="M. / Mme ou Societe..." className="bg-background/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Adresse</Label>
                  <Input value={data.destinataireAdresse} onChange={(e) => update("destinataireAdresse", e.target.value)} placeholder="12 rue..." className="bg-background/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CP, Ville</Label>
                  <Input value={data.destinataireCpVille} onChange={(e) => update("destinataireCpVille", e.target.value)} placeholder="75001 Paris" className="bg-background/50 border-white/10" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Introduction */}
          <AccordionItem value="introduction" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[1])} />
                <span className="font-medium">2. Introduction</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {renderTextarea("introduction", "Texte d'introduction de la lettre de mission...", 4)}
            </AccordionContent>
          </AccordionItem>

          {/* 3. Votre entite */}
          <AccordionItem value="entite" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[2])} />
                <span className="font-medium">3. Votre entite</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {([
                      ["Raison sociale", "raisonSociale", ""],
                      ["Forme juridique", "formeJuridique", ""],
                      ["SIREN", "siren", ""],
                      ["Capital", "capital", "EUR"],
                      ["Adresse", "adresse", ""],
                      ["CP / Ville", "cpVille", ""],
                      ["Code APE", "ape", ""],
                      ["Dirigeant", "dirigeant", ""],
                      ["Effectif", "effectif", "salaries"],
                      ["Domaine d'activite", "domaine", ""],
                      ["Date de creation", "dateCreation", ""],
                    ] as [string, keyof LettreMissionData, string][]).map(([label, field, suffix]) => (
                      <tr key={field} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-3 py-2 text-xs text-muted-foreground w-40">{label}</td>
                        <td className="px-3 py-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={String(data[field] || "")}
                              onChange={(e) => update(field, e.target.value as never)}
                              className="h-8 bg-background/50 border-white/10 text-sm"
                            />
                            {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4. LCB-FT */}
          <AccordionItem value="lcbft" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[3])} />
                <span className="font-medium">4. Obligations LCB-FT</span>
                {data.nivVigilance && (
                  <Badge variant={data.nivVigilance === "RENFORCEE" ? "destructive" : data.nivVigilance === "STANDARD" ? "default" : "secondary"} className="text-[10px]">
                    {data.nivVigilance}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Niveau de vigilance</span>
                    <Badge variant={data.nivVigilance === "RENFORCEE" ? "destructive" : data.nivVigilance === "STANDARD" ? "default" : "secondary"}>
                      {data.nivVigilance || "Non defini"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Score global</span>
                    <span className="text-lg font-bold">{data.scoreGlobal}<span className="text-xs text-muted-foreground">/100</span></span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">PPE</span>
                    <Badge variant={data.ppe === "OUI" ? "destructive" : "secondary"}>{data.ppe || "—"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pays a risque</span>
                    <Badge variant={data.paysRisque === "OUI" ? "destructive" : "secondary"}>{data.paysRisque || "—"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Beneficiaire(s) effectif(s)</span>
                    <span className="text-xs">{data.be || "—"}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                Ces valeurs sont calculees automatiquement depuis le dossier client et ne sont pas editables.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Notre mission */}
          <AccordionItem value="mission" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[4])} />
                <span className="font-medium">5. Notre mission</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Type de mission principal</Label>
                <Input value={data.missionPrincipale} onChange={(e) => update("missionPrincipale", e.target.value)} placeholder="TENUE COMPTABLE" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description de la mission</Label>
                {renderTextarea("missionDescription", "Description detaillee de la mission...", 5)}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Missions complementaires */}
          <AccordionItem value="complementaires" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[5])} />
                <span className="font-medium">6. Missions complementaires</span>
                {(data.missionSocial || data.missionJuridique || data.missionControleFiscal) && (
                  <Badge variant="secondary" className="text-[10px]">
                    {[data.missionSocial && "Social", data.missionJuridique && "Juridique", data.missionControleFiscal && "Fiscal"].filter(Boolean).join(", ")}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3">
              {([
                ["missionSocial", "Social / Paie", "Prise en charge de la gestion sociale et de l'etablissement des bulletins de paie"],
                ["missionJuridique", "Juridique annuel", "Approbation des comptes, PV d'AG, secretariat juridique courant"],
                ["missionControleFiscal", "Assistance controle fiscal", "Assistance et representation en cas de controle fiscal"],
              ] as [keyof LettreMissionData, string, string][]).map(([field, label, desc]) => (
                <div key={field} className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
                  <Switch
                    checked={data[field] as boolean}
                    onCheckedChange={(v) => update(field, v as never)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* 7. Honoraires */}
          <AccordionItem value="honoraires" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[6])} />
                <span className="font-medium">7. Honoraires</span>
                {data.honorairesHT && (
                  <Badge variant="outline" className="text-[10px]">{data.honorairesHT} EUR HT</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Element</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.04]">
                      <td className="px-3 py-2 text-xs">Honoraires annuels HT</td>
                      <td className="px-3 py-1 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            value={data.honorairesHT}
                            onChange={(e) => update("honorairesHT", e.target.value)}
                            className="h-8 w-32 text-right bg-background/50 border-white/10"
                            placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground">EUR</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-xs">Frequence de paiement</td>
                      <td className="px-3 py-1 text-right">
                        <select
                          value={data.frequencePaiement}
                          onChange={(e) => update("frequencePaiement", e.target.value)}
                          className="h-8 rounded-md border border-white/10 bg-background/50 px-2 text-sm"
                        >
                          <option value="Mensuel">Mensuel</option>
                          <option value="Trimestriel">Trimestriel</option>
                          <option value="Annuel">Annuel</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 8. Modalites relationnelles */}
          <AccordionItem value="modalites" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[7])} />
                <span className="font-medium">8. Modalites relationnelles</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {renderTextarea("modalites", "Modalites de la relation entre le cabinet et le client...", 5)}
            </AccordionContent>
          </AccordionItem>

          {/* 9. Signature */}
          <AccordionItem value="signature" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[8])} />
                <span className="font-medium">9. Signature</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nom du signataire</Label>
                  <Input value={data.signataireNom} onChange={(e) => update("signataireNom", e.target.value)} placeholder="Nom Prenom" className="bg-background/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fonction</Label>
                  <Input value={data.signataireFonction} onChange={(e) => update("signataireFonction", e.target.value)} placeholder="Expert-Comptable" className="bg-background/50 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lieu de signature</Label>
                  <Input value={data.lieuSignature} onChange={(e) => update("lieuSignature", e.target.value)} placeholder={config.ville || "Paris"} className="bg-background/50 border-white/10" />
                </div>
              </div>
              {config.signature && (
                <div>
                  <Label className="text-xs text-muted-foreground">Signature numerisee</Label>
                  <img src={config.signature} alt="Signature" className="h-16 mt-1 opacity-70" />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* 10. Annexes */}
          <AccordionItem value="annexes" className="border rounded-lg bg-card/80 backdrop-blur px-4 mb-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <StatusIcon status={getSectionStatus(data, SECTIONS[9])} />
                <span className="font-medium">Annexes</span>
                <Badge variant="secondary" className="text-[10px]">
                  {[data.annexeRepartition, data.annexeAttestation, data.annexeSepa, data.annexeLiasse, data.annexeCgv].filter(Boolean).length} active(s)
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3">
              {([
                ["annexeRepartition", "Repartition des travaux", "Tableau de repartition des travaux entre le cabinet et le client"],
                ["annexeAttestation", "Attestation de travail dissimule", "Attestation relative a la lutte contre le travail dissimule"],
                ["annexeSepa", "Mandat de prelevement SEPA", "Autorisation de prelevement bancaire"],
                ["annexeLiasse", "Autorisation liasse fiscale", "Mandat pour la tele-transmission de la liasse fiscale"],
                ["annexeCgv", "Conditions generales", "Conditions generales de vente du cabinet"],
              ] as [keyof LettreMissionData, string, string][]).map(([field, label, desc]) => (
                <div key={field} className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
                  <Switch
                    checked={data[field] as boolean}
                    onCheckedChange={(v) => update(field, v as never)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <ClauseLibrary
        open={clauseLibraryOpen}
        onOpenChange={setClauseLibraryOpen}
        onAddClause={handleAddClause}
      />
    </div>
  );
}
