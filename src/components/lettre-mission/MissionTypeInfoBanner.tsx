import { getMissionTypeConfig, getMissionCategory, getCategoryColorClasses } from "@/lib/lettreMissionTypes";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  missionTypeId: string;
}

export default function MissionTypeInfoBanner({ missionTypeId }: Props) {
  const config = getMissionTypeConfig(missionTypeId);
  const cat = getMissionCategory(missionTypeId);
  const catColors = cat ? getCategoryColorClasses(cat) : null;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border ${catColors ? catColors.border : "border-white/[0.06]"}`}>
      <Info className={`w-5 h-5 shrink-0 mt-0.5 ${catColors ? catColors.text : "text-blue-400"}`} />
      <div className="space-y-2 min-w-0">
        <div>
          <p className="text-sm font-medium text-slate-200">{config.label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-[10px] font-mono ${catColors ? catColors.badge : "border-slate-500/30 text-slate-400"}`}>
            {config.normeRef}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {config.formeRapport}
          </Badge>
          {config.honorairesSuccesAutorises ? (
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Succès autorisés
            </Badge>
          ) : (
            <Badge className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 gap-1">
              <XCircle className="w-3 h-3" /> Succès interdits
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
