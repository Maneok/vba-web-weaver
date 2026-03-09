import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

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

/** Compact mobile summary band */
function CompactSummary({ data }: { data: LMWizardData }) {
  const missionCount = (data.missions_selected || []).filter((m) => m.selected).length;
  const tva = Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100;
  const ttc = data.honoraires_ht + tva;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-t border-white/[0.06] text-xs">
      <span className="text-slate-400">
        {missionCount > 0 ? `${missionCount} mission${missionCount > 1 ? "s" : ""}` : "Aucune mission"}
      </span>
      {data.honoraires_ht > 0 && (
        <span className="text-white font-semibold">{formatEur(ttc)} TTC</span>
      )}
    </div>
  );
}

/** Full desktop summary panel */
function FullSummary({ data }: { data: LMWizardData }) {
  const tva = Math.round(data.honoraires_ht * (data.taux_tva / 100) * 100) / 100;
  const ttc = data.honoraires_ht + tva;
  const missions = (data.missions_selected || []).filter((m) => m.selected);

  return (
    <div className="sticky top-20 space-y-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resume</h3>

      {/* Client */}
      {data.raison_sociale ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Client</p>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{data.raison_sociale}</p>
              <p className="text-[10px] text-slate-500">{data.siren || "—"} · {data.forme_juridique || "—"}</p>
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
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Missions</p>
          <div className="flex flex-wrap gap-1.5">
            {missions.map((m) => (
              <span
                key={m.section_id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-slate-300"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Durée */}
      {data.duree && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Duree</p>
          <p className="text-sm text-slate-300">{data.duree} an{data.duree !== "1" ? "s" : ""} · {data.frequence_facturation || "—"}</p>
        </div>
      )}

      {/* Honoraires */}
      {data.honoraires_ht > 0 && (
        <div className="space-y-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Honoraires</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">HT</span>
              <span className="text-slate-300">{formatEur(data.honoraires_ht)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">TVA ({data.taux_tva}%)</span>
              <span className="text-slate-300">{formatEur(tva)}</span>
            </div>
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="flex justify-between">
              <span className="text-xs font-medium text-slate-300">TTC</span>
              <span className="text-base font-bold text-white">{formatEur(ttc)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LMSummaryPanel({ data, compact }: Props) {
  if (compact) return <CompactSummary data={data} />;
  return <FullSummary data={data} />;
}
