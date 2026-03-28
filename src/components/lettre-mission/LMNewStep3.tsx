import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { vigilanceColor } from "@/lib/lmUtils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FileText, Euro, ShieldAlert,
  Download, Loader2, Edit3, Mail, Save, AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------

interface Props {
  data: LMWizardData;
  onGenerate: () => void;
  onSave: () => void;
  onGoToStep: (step: number) => void;
  generating: boolean;
}

export default function LMNewStep3({ data, onGenerate, onSave, onGoToStep, generating }: Props) {
  const { clients } = useAppState();
  const selectedClient = useMemo(
    () => clients.find((c) => c.ref === data.client_id),
    [clients, data.client_id]
  );

  const canGenerate = !!data.volume_comptable && data.honoraires_annuels > 0;
  const mensualite = data.honoraires_annuels > 0 ? (data.honoraires_annuels / 12).toFixed(2) : "0";

  // Compute total mensualité estimate
  let totalMensuel = data.honoraires_annuels > 0 ? data.honoraires_annuels / 12 : 0;
  if (data.mission_juridique && data.honoraires_juridique > 0) totalMensuel += data.honoraires_juridique / 12;

  return (
    <div className="space-y-5">
      {/* ── CLIENT ── */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Client
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onGoToStep(0)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div><span className="text-muted-foreground">Raison sociale : </span><span className="font-medium">{data.raison_sociale}</span></div>
            <div><span className="text-muted-foreground">Forme : </span><span className="font-medium">{data.forme_juridique}</span></div>
            <div><span className="text-muted-foreground">SIREN : </span><span className="font-medium">{data.siren}</span></div>
            <div><span className="text-muted-foreground">Dirigeant : </span><span className="font-medium">{data.dirigeant}</span></div>
            <div><span className="text-muted-foreground">Régime fiscal : </span><span className="font-medium">{data.regime_fiscal || "—"}</span></div>
            <div><span className="text-muted-foreground">Clôture : </span><span className="font-medium">{data.date_cloture_exercice || "—"}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* ── MISSION ── */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Mission
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onGoToStep(0)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm font-medium">{data.type_mission || "Présentation des comptes"}</p>
          <div className="flex flex-wrap gap-2">
            <MissionPill label="Sociale" active={data.mission_sociale} />
            <MissionPill label="Juridique" active={data.mission_juridique} />
            <MissionPill label="Contrôle fiscal" active={data.mission_controle_fiscal} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Volume : <span className="text-foreground font-medium">{data.volume_comptable || "—"}</span></span>
            <span>Transmission : <span className="text-foreground font-medium">{data.outil_transmission || "—"}</span></span>
            <span>Périodicité : <span className="text-foreground font-medium">{
              data.frequence_facturation === "MENSUEL" ? "Mensuellement"
              : data.frequence_facturation === "TRIMESTRIEL" ? "Trimestriellement"
              : data.frequence_facturation === "ANNUEL" ? "Annuellement"
              : "—"
            }</span></span>
          </div>
        </CardContent>
      </Card>

      {/* ── HONORAIRES ── */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Euro className="w-4 h-4" /> Honoraires
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onGoToStep(1)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Forfait annuel</span>
              <span className="font-medium">{data.honoraires_annuels > 0 ? `${data.honoraires_annuels} € HT` : "—"}</span>
            </div>
            {data.forfait_constitution > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Constitution dossier</span>
                <span className="font-medium">{data.forfait_constitution} € HT</span>
              </div>
            )}
            {data.mission_juridique && data.honoraires_juridique > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Juridique annuel</span>
                <span className="font-medium">{data.honoraires_juridique} € HT</span>
              </div>
            )}
            {data.mission_sociale && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bulletin de paie</span>
                <span className="font-medium">{data.tarifs_sociaux?.prix_bulletin ?? 32} € HT</span>
              </div>
            )}
          </div>
          <div className="border-t pt-2 flex justify-between text-sm font-bold">
            <span>Mensualité estimée HT</span>
            <span>{totalMensuel.toFixed(2)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* ── LCB-FT ── */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> LCB-FT
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">Score : </span>
              <span className="font-medium">{(selectedClient as any)?.scoreRisque ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vigilance : </span>
              <Badge variant="outline" className={`text-[10px] ${vigilanceColor((selectedClient as any)?.niveauVigilance)}`}>
                {(selectedClient as any)?.niveauVigilance || "—"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">PPE : </span>
              <span className="font-medium">{(selectedClient as any)?.statutPpe || "Non PPE"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── GENERATE BUTTON ── */}
      {!canGenerate && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Renseignez le volume comptable et les honoraires annuels pour générer la lettre.
        </div>
      )}

      <Button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-40"
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Génération en cours...
          </>
        ) : (
          <>
            <Download className="w-5 h-5 mr-2" />
            Générer la lettre de mission
          </>
        )}
      </Button>
      {!generating && canGenerate && (
        <p className="text-[10px] text-center text-muted-foreground -mt-2">Document Word conforme à votre modèle</p>
      )}

      {/* ── SECONDARY ACTIONS ── */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" disabled className="gap-1.5 text-xs">
          <Mail className="w-4 h-4" /> Envoyer par email
        </Button>
        <Button variant="outline" onClick={onSave} className="gap-1.5 text-xs">
          <Save className="w-4 h-4" /> Sauvegarder brouillon
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MissionPill({ label, active }: { label: string; active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
      }`}
    >
      {active ? "✓" : "✗"} {label}
    </Badge>
  );
}
