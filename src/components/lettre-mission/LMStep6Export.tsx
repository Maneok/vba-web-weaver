import { useState, useRef, useCallback } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { sanitizeWizardData } from "@/lib/lmValidation";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, FileText, Send, CheckCircle2, Upload, RotateCcw, ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
}

const STATUTS = [
  { value: "brouillon", label: "Brouillon", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "envoyee", label: "Envoyee", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "signee", label: "Signee", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
];

function buildClientForExport(data: LMWizardData): Client {
  return {
    ref: data.client_ref,
    raisonSociale: data.raison_sociale,
    forme: data.forme_juridique,
    siren: data.siren,
    dirigeant: data.dirigeant,
    adresse: data.adresse,
    cp: data.cp,
    ville: data.ville,
    capital: Number(data.capital) || 0,
    ape: data.ape,
    mail: data.email,
    tel: data.telephone,
    iban: data.iban,
    bic: data.bic,
    etat: "EN_COURS" as any,
    comptable: "",
    mission: data.type_mission as any,
    domaine: "",
    effectif: "",
    dateCreation: "",
    dateReprise: "",
    honoraires: data.honoraires_ht,
    reprise: 0,
    juridique: 0,
    frequence: data.frequence_facturation,
    associe: data.associe_signataire,
    superviseur: data.chef_mission,
    ppe: "NON" as any,
    paysRisque: "NON" as any,
    atypique: "NON" as any,
    distanciel: "NON" as any,
    cash: "NON" as any,
    pression: "NON" as any,
    scoreActivite: 0, scorePays: 0, scoreMission: 0, scoreMaturite: 0, scoreStructure: 0,
    malus: 0, scoreGlobal: 0,
    nivVigilance: "STANDARD" as any,
    dateCreationLigne: "", dateDerniereRevue: "", dateButoir: "",
    etatPilotage: "A JOUR" as any,
    dateExpCni: "",
    statut: "ACTIF" as any,
    be: "",
  };
}

export default function LMStep6Export({ data, onChange, onSave, onReset }: Props) {
  const [showSignature, setShowSignature] = useState(false);
  const [emailTo, setEmailTo] = useState(data.email || "");
  const [showEmail, setShowEmail] = useState(false);
  const lockRef = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const withLock = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setGenerating(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation");
    } finally {
      setGenerating(null);
      setTimeout(() => { lockRef.current = false; }, 3000);
    }
  }, []);

  const handlePDF = () => withLock("pdf", async () => {
    const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
    const sanitized = sanitizeWizardData(data);
    const client = buildClientForExport(sanitized);
    const lm = {
      numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
      date: new Date().toLocaleDateString("fr-FR"),
      client,
      cabinet: {
        nom: "Cabinet Expertise Comptable",
        adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "",
      },
      options: {
        genre: "M" as const,
        missionSociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        missionJuridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        missionControleFiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
        regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
        tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
        periodicite: data.frequence_facturation,
      },
    };
    await renderLettreMissionPdf(lm);
    toast.success("PDF genere avec succes");
  });

  const handleDOCX = () => withLock("docx", async () => {
    const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
    const sanitized = sanitizeWizardData(data);
    const client = buildClientForExport(sanitized);
    await renderNewLettreMissionDocx({
      sections: DEFAULT_TEMPLATE,
      client,
      genre: "M",
      missions: {
        sociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        juridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        fiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
      },
      honoraires: {
        comptable: data.honoraires_ht,
        constitution: 0,
        juridique: 0,
        frequence: (data.frequence_facturation || "MENSUEL") as any,
      },
      cabinet: {
        nom: "Cabinet Expertise Comptable",
        adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "",
      },
      variables: {},
      status: data.statut,
      signatureExpert: data.signature_expert,
      signatureClient: data.signature_client,
    });
    toast.success("DOCX genere avec succes");
  });

  const handleEmail = () => {
    if (!emailTo) {
      toast.error("Adresse email requise");
      return;
    }
    window.location.href = `mailto:${emailTo}?subject=Lettre de mission - ${data.raison_sociale}&body=Veuillez trouver ci-joint la lettre de mission.`;
    toast.success("Client email ouvert");
  };

  const handleSave = async () => {
    try {
      await onSave();
      toast.success("Lettre sauvegardee");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ signature_expert: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      {/* Success animation */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center animate-bounce-once">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">{data.raison_sociale}</span> · {data.type_mission}
        </p>
      </div>

      {/* ── Export buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handlePDF}
          disabled={!!generating}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 disabled:opacity-50"
        >
          {generating === "pdf" ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" /> : <FileDown className="w-6 h-6 text-blue-400" />}
          <span className="text-sm font-medium text-slate-300">Telecharger PDF</span>
        </button>

        <button
          onClick={handleDOCX}
          disabled={!!generating}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-200 disabled:opacity-50"
        >
          {generating === "docx" ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" /> : <FileText className="w-6 h-6 text-purple-400" />}
          <span className="text-sm font-medium text-slate-300">Telecharger DOCX</span>
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200"
        >
          <Send className="w-6 h-6 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">Envoyer par email</span>
        </button>
      </div>

      {/* Email field */}
      {showEmail && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 text-xs">Adresse email</Label>
            <Input
              type="email"
              inputMode="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white"
              placeholder="client@exemple.fr"
            />
          </div>
          <Button onClick={handleEmail} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </Button>
        </div>
      )}

      {/* ── Signature (collapsible) ── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSignature(!showSignature)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <p className="text-sm font-medium text-slate-300">Signature</p>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showSignature ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${showSignature ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04]">
            <div className="space-y-1.5 pt-3">
              <Label className="text-slate-400 text-xs">Image de signature</Label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] cursor-pointer hover:border-white/[0.15] transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-400">
                  {data.signature_expert ? "Signature chargee ✓" : "Cliquez pour charger"}
                </span>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Date de signature</Label>
              <Input
                type="date"
                value={data.date_signature}
                onChange={(e) => onChange({ date_signature: e.target.value })}
                className="bg-white/[0.04] border-white/[0.08] text-white w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Statut ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Statut</p>
        <div className="flex gap-2">
          {STATUTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ statut: s.value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.statut === s.value ? s.color : "bg-white/[0.02] border-white/[0.06] text-slate-500"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Save + Reset ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 h-11 gap-2">
          <CheckCircle2 className="w-4 h-4" /> Sauvegarder
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 border-white/[0.06] text-slate-400 hover:text-white">
          <RotateCcw className="w-4 h-4" /> Nouvelle lettre
        </Button>
      </div>
    </div>
  );
}
