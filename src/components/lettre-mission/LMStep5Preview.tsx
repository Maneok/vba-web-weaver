import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
import LettreMissionA4Preview from "@/components/lettre-mission/LettreMissionA4Preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Maximize2, X, Paperclip, FileText } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onGoToStep: (step: number) => void;
  isMobile: boolean;
}

/** Build Client-like object from wizard data */
function buildClientFromData(data: LMWizardData) {
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
    // Fill required fields with defaults
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
    scoreActivite: 0,
    scorePays: 0,
    scoreMission: 0,
    scoreMaturite: 0,
    scoreStructure: 0,
    malus: 0,
    scoreGlobal: 0,
    nivVigilance: "STANDARD" as any,
    dateCreationLigne: "",
    dateDerniereRevue: "",
    dateButoir: "",
    etatPilotage: "A JOUR" as any,
    dateExpCni: "",
    statut: "ACTIF" as any,
    be: "",
  };
}

export default function LMStep5Preview({ data, onChange, onGoToStep, isMobile }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  // Escape key closes fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setFullscreen(false); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [fullscreen]);

  const client = useMemo(() => buildClientFromData(data), [
    data.client_ref, data.raison_sociale, data.forme_juridique, data.siren,
    data.dirigeant, data.adresse, data.cp, data.ville, data.capital,
    data.ape, data.email, data.telephone, data.iban, data.bic,
    data.type_mission, data.honoraires_ht, data.frequence_facturation,
    data.associe_signataire, data.chef_mission,
  ]);

  const missionsList = data.missions_selected || [];
  const missions = {
    sociale: missionsList.some((m) => m.section_id === "social" && m.selected),
    juridique: missionsList.some((m) => m.section_id === "juridique" && m.selected),
    fiscal: missionsList.some((m) => m.section_id === "fiscal" && m.selected),
  };

  const honoraires = {
    comptable: data.honoraires_ht,
    constitution: 0,
    juridique: 0,
    sociale: 0,
    fiscal: 0,
    frequence: (data.frequence_facturation || "MENSUEL") as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
  };

  const cabinet = {
    nom: "Cabinet Expertise Comptable",
    adresse: "",
    cp: "",
    ville: "",
    siret: "",
    numeroOEC: "",
    email: "",
    telephone: "",
  };

  const numero = data.numero_lettre || `LM-${new Date().getFullYear()}-XXX`;

  // Quick edit buttons
  const editButtons = [
    { label: "Client", step: 0 },
    { label: "Missions", step: 1 },
    { label: "Details", step: 2 },
    { label: "Honoraires", step: 3 },
  ];

  const previewContent = (
    <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
      <LettreMissionA4Preview
        sections={DEFAULT_TEMPLATE}
        client={client as any}
        genre="M"
        missions={missions}
        honoraires={honoraires}
        cabinet={cabinet}
        status="brouillon"
        signatureExpert={data.signature_expert}
        signatureClient={data.signature_client}
        customWatermark="BROUILLON"
        numeroLettre={numero}
        zoom={isMobile && !fullscreen ? 0.5 : fullscreen ? 0.65 : 0.75}
        responsableDossier={data.chef_mission}
        dateSignature={data.date_signature}
      />
    </div>
  );

  // Fullscreen modal for mobile
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background overflow-auto overscroll-contain" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-background/95 backdrop-blur-lg border-b border-white/[0.06]">
          <p className="text-sm font-medium text-white truncate mr-2">{numero}</p>
          <Button variant="ghost" onClick={() => setFullscreen(false)} className="text-slate-400 h-10 w-10 p-0 shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-3 sm:p-4 pb-20 overflow-x-auto">
          {previewContent}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick edit bar */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Modifier une section">
        {editButtons.map((b) => (
          <button
            key={b.step}
            aria-label={`Modifier ${b.label}`}
            onClick={() => onGoToStep(b.step)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-colors"
          >
            <Edit3 className="w-3 h-3" /> {b.label}
          </button>
        ))}
      </div>

      {/* Numero */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Numero :</span>
        <span className="text-white font-mono font-medium">{numero}</span>
      </div>

      {/* Preview */}
      <div className="relative">
        {previewContent}

        {/* Mobile: fullscreen button */}
        {isMobile && (
          <button
            onClick={() => setFullscreen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600/90 backdrop-blur text-white text-sm font-medium shadow-lg active:scale-95 transition-transform min-h-[44px]"
          >
            <Maximize2 className="w-4 h-4" /> Plein ecran
          </button>
        )}
      </div>

      {/* E) Auto annexes */}
      {(() => {
        const annexeIds = missionsList.length > 0 ? computeAnnexes({ ...data, missions_selected: missionsList }) : [];
        if (annexeIds.length === 0) return null;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-300">Annexes jointes</p>
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px]">{annexeIds.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {annexeIds.map((id) => (
                <div key={id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] min-h-[40px]">
                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs sm:text-sm text-slate-400">{ANNEXE_LABELS[id] || id}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CTA */}
      <div className="text-center space-y-2 pt-2">
        <p className="text-sm text-slate-400">Tout est correct ?</p>
      </div>
    </div>
  );
}
