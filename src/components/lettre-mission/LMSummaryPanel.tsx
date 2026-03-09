import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getStepCompletion, LM_STEP_LABELS } from "@/lib/lmWizardTypes";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  data: LMWizardData;
  compact?: boolean;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function vigilanceColor(niv: string) {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

/** (50) Compact mobile summary band — enriched with step progress */
function CompactSummary({ data }: { data: LMWizardData }) {
  // (F44) Guard against undefined sous_options and null missions_selected
  const missions = Array.isArray(data.missions_selected) ? data.missions_selected : [];
  const missionCount = missions.filter((m) => m?.selected).length;
  const ht = data.honoraires_ht || 0;
  const tva = Math.round(ht * (data.taux_tva || 0)) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  const completion = getStepCompletion(data);
  const completedCount = completion.filter(Boolean).length;

  return (
    <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white/[0.03] border-t border-white/[0.06] text-xs min-h-[40px]">
      <div className="flex items-center gap-2 truncate mr-2">
        {/* (50) Step completion dots — (F45) accessible aria-label */}
        <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Progression des etapes">
          {completion.map((done, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                done ? "bg-emerald-500" : "bg-white/[0.1]"
              }`}
              role="img"
              aria-label={`${LM_STEP_LABELS[i] || `Etape ${i + 1}`}: ${done ? "Complet" : "Incomplet"}`}
            />
          ))}
        </div>
        <span className="text-slate-400 truncate">
          {/* (F46) Truncate long company names */}
          {data.raison_sociale
            ? <><span className="text-white font-medium max-w-[120px] sm:max-w-[180px] truncate inline-block align-bottom">{data.raison_sociale}</span> · {missionCount} mission{missionCount > 1 ? "s" : ""}</>
            : missionCount > 0 ? `${missionCount} mission${missionCount > 1 ? "s" : ""}` : "Aucune mission"
          }
        </span>
      </div>
      {data.honoraires_ht > 0 && (
        <span className="text-white font-semibold whitespace-nowrap">{formatEur(ttc)} TTC</span>
      )}
    </div>
  );
}

/** (49) Full desktop summary panel — with validation indicators per section */
function FullSummary({ data }: { data: LMWizardData }) {
  // (F47) Safer TVA calculation + guard against undefined
  const ht = data.honoraires_ht || 0;
  const tva = Math.round(ht * (data.taux_tva || 0)) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  const missionsList = Array.isArray(data.missions_selected) ? data.missions_selected : [];
  const missions = missionsList.filter((m) => m?.selected);
  const completion = getStepCompletion(data);

  return (
    <div className="sticky top-20 space-y-4 lg:space-y-5" aria-label="Resume de la lettre de mission" role="complementary">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resume</h3>

      {/* (49) Section validation indicators */}
      <div className="flex items-center gap-1.5">
        {LM_STEP_LABELS.slice(0, 4).map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${
              completion[i]
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
            title={`${label}: ${completion[i] ? "Complet" : "Incomplet"}`}
          >
            {completion[i] ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
            {label}
          </div>
        ))}
      </div>

      {/* Client */}
      {data.raison_sociale ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Client</p>
          <div className="flex items-center gap-2 p-2.5 lg:p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs lg:text-sm font-medium text-white truncate">{data.raison_sociale}</p>
              <p className="text-[10px] text-slate-500 truncate">{data.siren || "—"} · {data.forme_juridique || "—"}</p>
            </div>
          </div>
          {data.type_mission && (
            <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
              {data.type_mission}
            </Badge>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-600 italic">Aucun client selectionne</div>
      )}

      {/* Missions */}
      {missions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Missions ({missions.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {missions.map((m) => (
              <span
                key={m.section_id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] lg:text-[11px] text-slate-300"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[100px] lg:max-w-none">{m.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Durée */}
      {data.duree && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Duree</p>
          <p className="text-xs lg:text-sm text-slate-300">{data.duree} an{data.duree !== "1" ? "s" : ""} · {data.frequence_facturation || "—"}</p>
        </div>
      )}

      {/* Honoraires */}
      {data.honoraires_ht > 0 && (
        <div className="space-y-2 p-2.5 lg:p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Honoraires</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">HT</span>
              <span className="text-slate-300">{formatEur(data.honoraires_ht)}</span>
            </div>
            {data.taux_tva > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">TVA ({data.taux_tva}%)</span>
                <span className="text-slate-300">{formatEur(tva)}</span>
              </div>
            )}
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-slate-300">TTC</span>
              <span className="text-sm lg:text-base font-bold text-white truncate max-w-[140px]">{formatEur(ttc)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Intervenants */}
      {(data.associe_signataire || data.chef_mission) && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Intervenants</p>
          {data.associe_signataire && (
            <p className="text-[11px] text-slate-400">Signataire : <span className="text-slate-300">{data.associe_signataire}</span></p>
          )}
          {data.chef_mission && (
            <p className="text-[11px] text-slate-400">Chef mission : <span className="text-slate-300">{data.chef_mission}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LMSummaryPanel({ data, compact }: Props) {
  if (compact) return <CompactSummary data={data} />;
  return <FullSummary data={data} />;
}
