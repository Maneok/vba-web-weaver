import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, FileDown, Mail, Upload, Save, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onSave: () => Promise<void>;
}

interface CabinetInfo {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
}

function loadCabinet(): CabinetInfo {
  try {
    const raw = sessionStorage.getItem("cabinet_info") || localStorage.getItem("cabinet_info");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { nom: "Cabinet Comptable", adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: "", telephone: "" };
}

const STATUTS = [
  { value: "BROUILLON" as const, label: "Brouillon", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "ENVOYEE" as const, label: "Envoyee", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "SIGNEE" as const, label: "Signee", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "ARCHIVEE" as const, label: "Archivee", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
];

export default function LMWizardStep10Export({ data, onChange, onSave }: Props) {
  const { clients } = useAppState();
  const cabinet = useMemo(loadCabinet, []);
  const [saving, setSaving] = useState(false);
  const [signatureFile, setSignatureFile] = useState<string | null>(null);
  const [dateSignature, setDateSignature] = useState("");

  const client = useMemo(
    () => clients.find((c) => c.ref === data.client_ref) || null,
    [clients, data.client_ref]
  );

  const handleExportPdf = async () => {
    try {
      const { LMPdfBuilder } = await import("@/lib/lettreMissionPdf");
      const lm = buildLettreMission(data, client, cabinet);
      const builder = new LMPdfBuilder(lm);
      (builder as any).build();
      toast.success("PDF genere avec succes");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erreur lors de la generation du PDF");
    }
  };

  const handleExportDocx = async () => {
    try {
      const { renderLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
      const lm = buildLettreMission(data, client, cabinet);
      await renderLettreMissionDocx(lm);
      toast.success("DOCX genere avec succes");
    } catch (err) {
      console.error("DOCX export error:", err);
      toast.error("Erreur lors de la generation du DOCX");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      toast.success("Lettre de mission sauvegardee");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSignatureFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Export et signature</h2>
        <p className="text-sm text-slate-500">Exportez la lettre et gerez la signature</p>
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={handleExportPdf}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-red-500/5 hover:border-red-500/20 transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-red-400" />
          </div>
          <span className="text-sm font-medium text-white">Export PDF</span>
          <span className="text-xs text-slate-500">Format A4, pret a imprimer</span>
        </button>

        <button
          onClick={handleExportDocx}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-blue-500/5 hover:border-blue-500/20 transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <FileDown className="w-6 h-6 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-white">Export DOCX</span>
          <span className="text-xs text-slate-500">Format Word, modifiable</span>
        </button>

        <button
          onClick={() => toast.info("Fonctionnalite d'envoi par email a venir")}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="text-sm font-medium text-white">Envoyer par email</span>
          <span className="text-xs text-slate-500">Envoi direct au client</span>
        </button>
      </div>

      {/* Signature */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Signature</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Date de signature</Label>
            <Input
              type="date"
              value={dateSignature}
              onChange={(e) => setDateSignature(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Image de signature</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] cursor-pointer hover:bg-white/[0.06] transition-colors text-sm text-slate-400">
                <Upload className="w-3.5 h-3.5" />
                {signatureFile ? "Changer" : "Telecharger"}
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
              {signatureFile && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Signature chargee
                </div>
              )}
            </div>
          </div>
        </div>

        {signatureFile && (
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img src={signatureFile} alt="Signature" className="max-h-20 object-contain" />
          </div>
        )}
      </div>

      {/* Statut */}
      <div className="space-y-3">
        <Label className="text-slate-300 text-sm font-medium">Statut de la lettre</Label>
        <div className="flex flex-wrap gap-2">
          {STATUTS.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => onChange({ statut: value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                data.statut === value
                  ? color + " ring-1 ring-current/20"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 px-8 py-3 text-base"
          size="lg"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Sauvegarde en cours...</>
          ) : (
            <><Save className="w-5 h-5" /> Sauvegarder dans la base</>
          )}
        </Button>
      </div>
    </div>
  );
}

// Helper to build LettreMission object compatible with existing PDF/DOCX generators
function buildLettreMission(data: LMWizardData, client: Client | null, cabinet: CabinetInfo) {
  return {
    cabinet: {
      nom: cabinet.nom,
      adresse: cabinet.adresse,
      cp: cabinet.cp,
      ville: cabinet.ville,
      siret: cabinet.siret,
      numeroOEC: cabinet.numeroOEC || data.numero_oec,
      email: cabinet.email,
      telephone: cabinet.telephone,
    },
    client: client || {
      ref: data.client_ref,
      raisonSociale: data.raison_sociale,
      forme: data.forme_juridique,
      siren: data.siren,
      adresse: data.adresse,
      cp: data.cp,
      ville: data.ville,
      capital: Number(data.capital) || 0,
      ape: data.ape,
      dirigeant: data.dirigeant,
      mail: data.email,
      tel: data.telephone,
      iban: data.iban,
      bic: data.bic,
    },
    options: {
      sociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
      juridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
      fiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
      honoraires: {
        comptable: data.honoraires_ht,
        constitution: 0,
        juridique: 0,
        sociale: 0,
        fiscal: 0,
        frequence: data.frequence_facturation as any,
      },
      associe: data.associe_signataire,
      superviseur: data.chef_mission,
      comptable: data.collaborateurs[0] || "",
    },
    numero: `LM-${new Date().getFullYear()}-001`,
    date: new Date().toLocaleDateString("fr-FR"),
  };
}
