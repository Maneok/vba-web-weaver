import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { DEFAULT_TEMPLATE, type TemplateSection } from "@/lib/lettreMissionTemplate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit3 } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onGoToStep: (step: number) => void;
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

export default function LMWizardStep9Preview({ data, onGoToStep }: Props) {
  const { clients } = useAppState();
  const cabinet = useMemo(loadCabinet, []);

  const client = useMemo(
    () => clients.find((c) => c.ref === data.client_ref) || null,
    [clients, data.client_ref]
  );

  const sections = DEFAULT_TEMPLATE;

  const missionsLabels = useMemo(
    () =>
      data.missions_selected
        .filter((m) => m.selected)
        .map((m) => m.label),
    [data.missions_selected]
  );

  const formatEur = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const tva = Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100;
  const ttc = Math.round((data.honoraires_ht + tva) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Previsualisation</h2>
          <p className="text-sm text-slate-500">Verifiez le contenu de la lettre avant export</p>
        </div>
        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1.5">
          <Eye className="w-3 h-3" /> BROUILLON
        </Badge>
      </div>

      {/* A4-like preview */}
      <div className="bg-white rounded-lg shadow-2xl mx-auto max-w-[800px] overflow-hidden" style={{ minHeight: 600 }}>
        {/* Header navy */}
        <div className="bg-[#1a1a2e] px-10 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{cabinet.nom || "Cabinet Comptable"}</h3>
              <p className="text-xs text-blue-200 mt-1">{cabinet.adresse} {cabinet.cp} {cabinet.ville}</p>
              {cabinet.numeroOEC && <p className="text-[10px] text-blue-300 mt-0.5">OEC n° {cabinet.numeroOEC}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200">LETTRE DE MISSION</p>
              <p className="text-lg font-bold mt-1">LM-{new Date().getFullYear()}-001</p>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-6 text-[#1a1a2e] text-sm leading-relaxed">
          {/* Watermark */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 text-6xl font-black text-gray-500 rotate-[-30deg] select-none" style={{ zIndex: 0 }}>
              BROUILLON
            </div>
          </div>

          {/* Destinataire */}
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Destinataire</p>
            <p className="font-medium">{data.qualite_dirigeant} {data.dirigeant}</p>
            <p>{data.forme_juridique} {data.raison_sociale}</p>
            <p>{data.adresse}</p>
            <p>{data.cp} {data.ville}</p>
            {data.siren && <p className="text-xs text-gray-500 mt-1">SIREN : {data.siren}</p>}
          </div>

          <hr className="border-gray-200" />

          {/* Type de mission */}
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Objet</p>
            <p>
              Lettre de mission — {data.type_mission === "TENUE" ? "Tenue et presentation des comptes" :
                data.type_mission === "SURVEILLANCE" ? "Surveillance des comptes" :
                data.type_mission === "REVISION" ? "Revision contractuelle" :
                "Commissariat aux comptes"}
            </p>
          </div>

          {/* Missions */}
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Missions incluses</p>
            <ul className="list-disc list-inside space-y-1">
              {missionsLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>

          {/* Modalités */}
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Modalites</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-gray-500">Duree :</span> {data.duree}</p>
              <p><span className="text-gray-500">Debut :</span> {data.date_debut}</p>
              <p><span className="text-gray-500">Reconduction :</span> {data.tacite_reconduction ? "Tacite" : "Non"}</p>
              <p><span className="text-gray-500">RDV :</span> {data.frequence_rdv}</p>
              <p><span className="text-gray-500">Lieu :</span> {data.lieu_execution === "cabinet" ? "Au cabinet" : data.lieu_execution === "client" ? "Chez le client" : "Mixte"}</p>
            </div>
          </div>

          {/* Honoraires */}
          <div className="relative z-10 bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Honoraires</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">{formatEur(data.honoraires_ht)} <span className="text-sm font-normal text-gray-500">HT/an</span></p>
                <p className="text-xs text-gray-500 mt-1">TVA {data.taux_tva}% : {formatEur(tva)} — TTC : {formatEur(ttc)}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Facturation {data.frequence_facturation.toLowerCase()}</p>
                <p>Paiement par {data.mode_paiement}</p>
              </div>
            </div>
          </div>

          {/* Intervenants */}
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Intervenants</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.associe_signataire && <p><span className="text-gray-500">Associe :</span> {data.associe_signataire}</p>}
              {data.chef_mission && <p><span className="text-gray-500">Chef de mission :</span> {data.chef_mission}</p>}
              {data.collaborateurs.length > 0 && <p><span className="text-gray-500">Collaborateurs :</span> {data.collaborateurs.join(", ")}</p>}
              {data.referent_lcb && <p><span className="text-gray-500">Referent LCB :</span> {data.referent_lcb}</p>}
            </div>
          </div>

          {/* Signatures */}
          <div className="relative z-10 grid grid-cols-2 gap-8 pt-8 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-8">L'expert-comptable</p>
              <div className="border-b border-gray-300 w-48" />
              <p className="text-xs text-gray-500 mt-1">{data.associe_signataire || "Associe signataire"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-8">Le client</p>
              <div className="border-b border-gray-300 w-48" />
              <p className="text-xs text-gray-500 mt-1">{data.dirigeant || "Dirigeant"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick edit buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {["Client", "Type", "Infos", "Missions", "Modalites", "Honoraires", "Equipe", "Clauses"].map((label, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="gap-1 border-white/[0.06] text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 text-xs"
            onClick={() => onGoToStep(i)}
          >
            <Edit3 className="w-3 h-3" /> {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
