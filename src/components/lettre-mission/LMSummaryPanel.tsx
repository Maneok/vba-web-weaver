import { useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { CLIENT_TYPES } from "@/lib/lettreMissionTypes";
import { formatEur } from "@/lib/lmUtils";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

interface Props {
  data: LMWizardData;
  compact?: boolean;
  cabinetLogo?: string;
}

/** Compact mobile summary band */
function CompactSummary({ data }: { data: LMWizardData }) {
  const missionCount = useMemo(() => data.missions_selected.filter((m) => m.selected).length, [data.missions_selected]);
  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = data.honoraires_ht + tva;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-white/[0.03] border-t border-gray-200 dark:border-white/[0.06] text-xs">
      <span className="text-slate-400 dark:text-slate-500">
        {missionCount > 0 ? `${missionCount} mission${missionCount > 1 ? "s" : ""}` : "Aucune mission"}
      </span>
      {data.honoraires_ht > 0 && (
        <span className="text-slate-900 dark:text-white font-semibold">{formatEur(ttc)} TTC</span>
      )}
    </div>
  );
}

/** Full desktop summary panel */
function FullSummary({ data, cabinetLogo }: { data: LMWizardData; cabinetLogo?: string }) {
  const tva = useMemo(() => Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100, [data.honoraires_ht, data.taux_tva]);
  const ttc = data.honoraires_ht + tva;
  const missions = useMemo(() => data.missions_selected.filter((m) => m.selected), [data.missions_selected]);

  // Modele label
  const modeleLabel = useMemo(() => {
    if (!data.client_type_id) return null;
    const config = CLIENT_TYPES[data.client_type_id];
    return config?.label || data.client_type_id;
  }, [data.client_type_id]);

  return (
    <div className="sticky top-20 space-y-5">
      {/* Cabinet logo */}
      {cabinetLogo && (
        <div className="flex justify-center">
          <img src={cabinetLogo} alt="Logo" className="max-h-10 object-contain opacity-60" />
        </div>
      )}

      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Resume</h3>

      {/* Client */}
      {data.raison_sociale ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client</p>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{data.raison_sociale}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{data.siren || "—"} · {data.forme_juridique || "—"}</p>
            </div>
          </div>
          {/* Modele */}
          {modeleLabel && (
            <div className="mt-1">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Modele</p>
              <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {modeleLabel}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-300 dark:text-slate-600 italic">Aucun client selectionne</div>
      )}

      {/* Missions */}
      {missions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Missions</p>
          <div className="flex flex-wrap gap-1.5">
            {missions.map((m) => (
              <span
                key={m.section_id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-[10px] text-slate-700 dark:text-slate-300"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Honoraires */}
      {data.honoraires_ht > 0 && (
        <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Honoraires</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500">HT</span>
              <span className="text-slate-700 dark:text-slate-300">{formatEur(data.honoraires_ht)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500">TVA ({data.taux_tva}%)</span>
              <span className="text-slate-700 dark:text-slate-300">{formatEur(tva)}</span>
            </div>
            <div className="h-px bg-gray-100 dark:bg-white/[0.06] my-1" />
            <div className="flex justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">TTC</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">{formatEur(ttc)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LMSummaryPanel({ data, compact, cabinetLogo }: Props) {
  if (compact) return <CompactSummary data={data} />;
  return <FullSummary data={data} cabinetLogo={cabinetLogo} />;
}
