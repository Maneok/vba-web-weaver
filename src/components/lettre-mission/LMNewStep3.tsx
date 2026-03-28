import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { vigilanceColor } from "@/lib/lmUtils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FileText, Euro, ShieldAlert,
  Download, Loader2, Edit3, Mail, Save, AlertTriangle,
  Briefcase, Scale, Shield, CheckCircle2,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onGenerate: () => void;
  onSave: () => void;
  onGoToStep: (step: number) => void;
  generating: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function LMNewStep3({ data, onGenerate, onSave, onGoToStep, generating }: Props) {
  const { clients } = useAppState();
  const selectedClient = useMemo(() => clients.find((c) => c.ref === data.client_id), [clients, data.client_id]);

  const canGenerate = !!data.volume_comptable && data.honoraires_annuels > 0;

  let totalMensuel = data.honoraires_annuels > 0 ? data.honoraires_annuels / 12 : 0;
  if (data.mission_juridique && data.honoraires_juridique > 0) totalMensuel += data.honoraires_juridique / 12;
  if (data.mission_controle_fiscal && data.option_controle_fiscal === "A") totalMensuel += 5000 / 12;
  else if (data.mission_controle_fiscal && data.option_controle_fiscal === "B") totalMensuel += 2500 / 12;

  return (
    <div className="space-y-4">
      {/* ── CLIENT ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-transparent dark:from-blue-500/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">{data.raison_sociale}</p>
              <p className="text-[11px] text-muted-foreground">{data.siren} · {data.forme_juridique}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => onGoToStep(0)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </div>
        <div className="px-4 py-2.5 grid grid-cols-3 gap-2 text-[11px] border-t border-gray-100 dark:border-white/[0.04]">
          <span className="text-muted-foreground">Dirigeant : <span className="text-foreground font-medium">{data.dirigeant || "—"}</span></span>
          <span className="text-muted-foreground">Régime : <span className="text-foreground font-medium">{data.regime_fiscal || "—"}</span></span>
          <span className="text-muted-foreground">Clôture : <span className="text-foreground font-medium">{data.date_cloture_exercice || "—"}</span></span>
        </div>
      </div>

      {/* ── MISSION ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-transparent dark:from-indigo-500/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10"><FileText className="w-4 h-4 text-indigo-400" /></div>
            <h3 className="text-sm font-semibold">Mission</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => onGoToStep(0)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </div>
        <div className="px-4 py-3 space-y-2.5 border-t border-gray-100 dark:border-white/[0.04]">
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">
            <Briefcase className="w-3 h-3 mr-1.5" /> {data.type_mission || "Présentation des comptes"}
          </Badge>
          <div className="flex flex-wrap gap-1.5">
            <MissionPill label="Sociale" active={data.mission_sociale} icon={Scale} />
            <MissionPill label="Juridique" active={data.mission_juridique} icon={Briefcase} />
            <MissionPill label="Contrôle fiscal" active={data.mission_controle_fiscal} icon={Shield} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <span className="text-muted-foreground">Volume : <span className="text-foreground font-medium">{data.volume_comptable?.split("(")[0]?.trim() || "—"}</span></span>
            <span className="text-muted-foreground">Transmission : <span className="text-foreground font-medium">{data.outil_transmission || "—"}</span></span>
            <span className="text-muted-foreground">Facturation : <span className="text-foreground font-medium">{
              data.frequence_facturation === "MENSUEL" ? "Mensuelle" : data.frequence_facturation === "TRIMESTRIEL" ? "Trimestrielle" : data.frequence_facturation === "ANNUEL" ? "Annuelle" : "—"
            }</span></span>
          </div>
        </div>
      </div>

      {/* ── HONORAIRES ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-500/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10"><Euro className="w-4 h-4 text-emerald-500" /></div>
            <h3 className="text-sm font-semibold">Honoraires</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => onGoToStep(1)}>
            <Edit3 className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </div>
        <div className="px-4 py-3 space-y-1.5 border-t border-gray-100 dark:border-white/[0.04]">
          <Row label="Forfait annuel" value={data.honoraires_annuels > 0 ? `${fmt(data.honoraires_annuels)} € HT` : "—"} />
          {data.forfait_constitution > 0 && <Row label="Constitution dossier" value={`${fmt(data.forfait_constitution)} € HT`} />}
          {data.mission_juridique && data.honoraires_juridique > 0 && <Row label="Juridique annuel" value={`${fmt(data.honoraires_juridique)} € HT`} />}
          {data.mission_sociale && <Row label="Bulletin de paie" value={`${data.tarifs_sociaux?.prix_bulletin ?? 32} € HT`} muted />}
          {data.mission_controle_fiscal && data.option_controle_fiscal !== "none" && (
            <Row label={`Contrôle fiscal (${data.option_controle_fiscal})`} value={data.option_controle_fiscal === "A" ? "5 000 € HT/an" : "2 500 € HT/an"} muted />
          )}

          <div className="border-t border-gray-200 dark:border-white/10 pt-2 mt-2 flex justify-between items-baseline">
            <span className="text-sm font-bold">Mensualité estimée HT</span>
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{fmt(totalMensuel)} €</span>
          </div>
        </div>
      </div>

      {/* ── LCB-FT ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3.5 flex items-center gap-4">
        <div className="p-1.5 rounded-lg bg-slate-500/10"><ShieldAlert className="w-3.5 h-3.5 text-slate-400" /></div>
        <div className="flex items-center gap-4 text-[11px] flex-1">
          <span className="text-muted-foreground">Score <span className="text-foreground font-semibold ml-0.5">{(selectedClient as any)?.scoreRisque ?? "—"}</span></span>
          <Badge variant="outline" className={`text-[10px] py-0 ${vigilanceColor((selectedClient as any)?.niveauVigilance)}`}>
            {(selectedClient as any)?.niveauVigilance || "—"}
          </Badge>
          <span className="text-muted-foreground">PPE <span className="text-foreground font-medium ml-0.5">{(selectedClient as any)?.statutPpe || "Non"}</span></span>
        </div>
      </div>

      {/* ── GENERATE ── */}
      {!canGenerate && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Renseignez le volume comptable et les honoraires annuels pour générer la lettre.
        </div>
      )}

      <button onClick={onGenerate} disabled={!canGenerate || generating}
        className={`w-full h-14 rounded-xl font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg ${
          canGenerate && !generating
            ? "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
            : "bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed opacity-60"
        }`}>
        {generating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours...</>
        ) : (
          <><Download className="w-5 h-5" /> Générer la lettre de mission</>
        )}
      </button>
      {!generating && canGenerate && (
        <p className="text-[10px] text-center text-muted-foreground -mt-2 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Document Word conforme à votre modèle
        </p>
      )}

      {/* ── SECONDARY ── */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" disabled className="gap-1.5 text-xs h-10 rounded-xl border-gray-200 dark:border-white/10">
          <Mail className="w-4 h-4" /> Envoyer par email
        </Button>
        <Button variant="outline" onClick={onSave} className="gap-1.5 text-xs h-10 rounded-xl border-gray-200 dark:border-white/10 hover:bg-blue-50 dark:hover:bg-blue-500/5 hover:border-blue-200 dark:hover:border-blue-500/20">
          <Save className="w-4 h-4" /> Sauvegarder brouillon
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-medium ${muted ? "text-muted-foreground" : ""}`}>{value}</span>
    </div>
  );
}

function MissionPill({ label, active, icon: Icon }: { label: string; active: boolean; icon: any }) {
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${
      active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-slate-500/5 text-slate-400 border-slate-500/10"
    }`}>
      <Icon className="w-3 h-3" /> {label}
    </Badge>
  );
}
