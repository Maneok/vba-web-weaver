import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client } from "@/lib/types";
import { buildClientFromWizardData } from "@/lib/lmUtils";
import { computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
import LettreMissionA4Preview from "@/components/lettre-mission/LettreMissionA4Preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Maximize2, X, Paperclip, FileText, BookOpen, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onGoToStep: (step: number) => void;
  isMobile: boolean;
}


export default function LMStep5Preview({ data, onChange, onGoToStep, isMobile }: Props) {
  const { profile } = useAuth();
  const [fullscreen, setFullscreen] = useState(false);

  const client = useMemo(() => buildClientFromWizardData(data), [data]);
  const annexes = useMemo(() => computeAnnexes(data), [data]);
  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  const missions = {
    sociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
    juridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
    fiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
  };

  const honoraires = {
    comptable: data.honoraires_ht,
    constitution: 0,
    juridique: 0,
    sociale: 0,
    fiscal: 0,
    frequence: (data.frequence_facturation || "MENSUEL") as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
  };

  // Cabinet info from profile
  const cabinet = useMemo(() => ({
    nom: profile?.full_name ? `Cabinet ${profile.full_name}` : "Cabinet Expertise Comptable",
    adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: profile?.email || "", telephone: "",
  }), [profile?.full_name, profile?.email]);

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
        client={client as Client}
        genre="M"
        missions={missions}
        honoraires={honoraires}
        cabinet={cabinet}
        status="brouillon"
        signatureExpert={data.signature_expert}
        signatureClient={data.signature_client}
        customWatermark="BROUILLON"
        numeroLettre={numero}
        zoom={isMobile && !fullscreen ? 0.55 : 0.75}
        responsableDossier={data.chef_mission}
        dateSignature={data.date_signature}
      />
    </div>
  );

  // Fullscreen modal for mobile
  if (fullscreen) {
    // OPT-22: Fullscreen modal with entrance animation
    return (
      <div className="fixed inset-0 z-[100] bg-background overflow-auto overscroll-contain animate-step-in">
        <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/95 backdrop-blur-lg border-b border-white/[0.06]">
          <p className="text-sm font-medium text-white">{numero}</p>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)} className="text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 pb-20">
          {previewContent}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick edit bar */}
      <div className="flex flex-wrap gap-2">
        {editButtons.map((b) => (
          <button
            key={b.step}
            onClick={() => onGoToStep(b.step)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-colors"
          >
            <Edit3 className="w-3 h-3" /> {b.label}
          </button>
        ))}
      </div>

      {/* OPT-14/15/17/18: Mission type info panel */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">{mtConfig.label}</span>
          </div>
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
            {mtConfig.normeRef}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500">Referentiel : </span>
            <span className="text-slate-300">{mtConfig.referentielApplicable}</span>
          </div>
          <div>
            <span className="text-slate-500">Forme du rapport : </span>
            <span className="text-slate-300">{mtConfig.formeRapport}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mtConfig.honorairesSuccesAutorises ? (
            <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Honoraires de succes autorises
            </Badge>
          ) : (
            <Badge className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 gap-0.5">
              <XCircle className="w-2.5 h-2.5" /> Honoraires de succes interdits
            </Badge>
          )}
        </div>
      </div>

      {/* Numero */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Numero :</span>
        <span className="text-white font-mono font-medium">{numero}</span>
      </div>

      {/* Preview — constrained height with internal scroll */}
      <div className="relative max-h-[55vh] overflow-y-auto rounded-lg border border-white/[0.06]">
        {previewContent}

        {/* Mobile: fullscreen button */}
        {isMobile && (
          <button
            onClick={() => setFullscreen(true)}
            className="sticky bottom-4 float-right mr-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/90 backdrop-blur text-white text-xs font-medium shadow-lg z-10"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Plein ecran
          </button>
        )}
      </div>

      {/* E) Auto annexes */}
      {annexes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-medium text-slate-300">Annexes jointes</p>
            <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px]">{annexes.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {annexes.map((id) => (
              <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-400">{ANNEXE_LABELS[id] || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center space-y-2 pt-2">
        <p className="text-sm text-slate-400">Tout est correct ?</p>
      </div>
    </div>
  );
}
