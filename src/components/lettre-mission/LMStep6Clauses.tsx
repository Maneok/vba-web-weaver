import { useState, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle2, XCircle, Info, ChevronDown, AlertTriangle } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

export default function LMStep6Clauses({ data, onChange }: Props) {
  const [showCgv, setShowCgv] = useState(false);

  const mtConfig = useMemo(() => getMissionTypeConfig(data.mission_type_id || "presentation"), [data.mission_type_id]);

  const inputCls = "bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white";

  return (
    <div className="space-y-6">
      {/* Mission description info */}
      <div className="wizard-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Cadre de la mission — {mtConfig.shortLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">{mtConfig.normeRef}</Badge>
          <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400 dark:text-slate-400">{mtConfig.formeRapport}</Badge>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed line-clamp-3">{mtConfig.missionText.split('\n')[0]}</p>
      </div>

      {/* Honoraires de succes badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.06]">
        {mtConfig.honorairesSuccesAutorises ? (
          <Badge className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Honoraires de succes autorises
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 gap-1">
            <XCircle className="w-3 h-3" /> Honoraires de succes interdits (art. 24 ord. 1945)
          </Badge>
        )}
      </div>

      {/* Clauses obligatoires */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Clauses obligatoires</p>
        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-sm text-slate-800 dark:text-slate-200">LCB-FT</span>
          <Switch checked={data.clause_lcbft} disabled />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-sm text-slate-800 dark:text-slate-200">Travail dissimule</span>
          <Switch checked={data.clause_travail_dissimule} disabled />
        </div>
      </div>

      {/* Clauses optionnelles */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Clauses optionnelles</p>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <span className="text-sm text-slate-800 dark:text-slate-200">RGPD</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Protection des donnees personnelles</p>
          </div>
          <Switch checked={data.clause_rgpd} onCheckedChange={(v) => onChange({ clause_rgpd: v })} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.02] border border-gray-150 dark:border-white/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <span className="text-sm text-slate-800 dark:text-slate-200">Conciliation CROEC</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Clause de conciliation aupres du Conseil Regional</p>
          </div>
          <Switch checked={data.clause_conciliation_croec ?? true} onCheckedChange={(v) => onChange({ clause_conciliation_croec: v })} />
        </div>
      </div>

      {/* Nature et limites */}
      {mtConfig.natureLimiteText && (
        <div className="wizard-card p-3 space-y-1.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nature et limites de la mission</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed line-clamp-3">{mtConfig.natureLimiteText.split('\n')[0]}</p>
        </div>
      )}

      {/* Clauses supplementaires */}
      <div className="space-y-1.5">
        <Label className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">Clauses supplementaires</Label>
        <Textarea
          value={data.clauses_supplementaires}
          onChange={(e) => onChange({ clauses_supplementaires: e.target.value })}
          className="wizard-input min-h-[80px]"
          placeholder="Clauses additionnelles..."
        />
      </div>

      {/* CGV compact */}
      <div className="wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCgv(!showCgv)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white dark:hover:bg-white/[0.02] transition-colors"
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Conditions Generales d'Intervention</p>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showCgv ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${showCgv ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">
            <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed pt-3">
              Les conditions generales d'intervention du cabinet seront jointes automatiquement en annexe de la lettre de mission.
              Elles couvrent les responsabilites respectives, les conditions de resiliation, les dispositions relatives au secret professionnel
              et les obligations de chaque partie.
            </p>
            {mtConfig.cgvSpecificClauses.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clauses specifiques ({mtConfig.shortLabel})</p>
                {mtConfig.cgvSpecificClauses.map((clause, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/[0.04] border border-amber-200/60 dark:border-amber-500/10">
                    <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 dark:text-amber-300/80">{clause}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
