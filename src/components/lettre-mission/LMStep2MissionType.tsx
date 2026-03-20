import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getClientTypeConfig, getMissionTypeConfig, recommendClientType, isModeComptableApplicable } from "@/lib/lettreMissionTypes";
import { getDefaultSelectedCount, getMissionsForClientType } from "@/lib/lmClientMissions";
import { generateSmartDefaults, getSmartMissionSelections } from "@/lib/lmSmartDefaults";
import ClientTypeSelector from "./ClientTypeSelector";
import { BookOpen, Eye, CheckSquare, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const TYPES_MISSION = [
  { value: "TENUE", label: "Tenue", description: "Tenue de comptabilite complete", icon: BookOpen },
  { value: "SURVEILLANCE", label: "Surveillance", description: "Surveillance et conseil", icon: Eye },
  { value: "REVISION", label: "Revision", description: "Revision des comptes", icon: CheckSquare },
];

export default function LMStep2MissionType({ data, onChange }: Props) {
  const { clients } = useAppState();

  const { recommended, alternatives } = useMemo(
    () => data.forme_juridique ? recommendClientType(data.forme_juridique) : { recommended: '', alternatives: [] as string[] },
    [data.forme_juridique]
  );

  const selectedClient = useMemo(() => clients.find((c) => c.ref === data.client_id), [clients, data.client_id]);

  const handleClientTypeChange = (clientTypeId: string) => {
    const config = getClientTypeConfig(clientTypeId);
    if (!config) return;

    const updates: Partial<LMWizardData> = {
      client_type_id: clientTypeId,
      mission_type_id: config.defaultMissionType,
      specific_variables: {},
    };

    if (config.defaultModeComptable) {
      updates.type_mission = config.defaultModeComptable;
    } else if (!data.type_mission || !["TENUE", "SURVEILLANCE", "REVISION"].includes(data.type_mission)) {
      updates.type_mission = "TENUE";
    }

    // Smart defaults: pre-fill honoraires, clauses, durée, paiement
    if (selectedClient) {
      const smartDefaults = generateSmartDefaults(clientTypeId, selectedClient);
      Object.assign(updates, smartDefaults);

      // Smart mission pre-selection
      const missions = getMissionsForClientType(clientTypeId);
      updates.missions_selected = getSmartMissionSelections(clientTypeId, selectedClient, missions);
    } else {
      updates.missions_selected = [];
      updates.honoraires_detail = {};
    }

    onChange(updates);
  };

  const showModeComptable = isModeComptableApplicable(data.mission_type_id || "presentation");

  // OPT-45: pre-selected count for current type
  const preselectedCount = useMemo(
    () => data.client_type_id ? getDefaultSelectedCount(data.client_type_id) : null,
    [data.client_type_id]
  );

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Selectionnez le type de structure de votre client. La norme applicable et les missions sont determinees automatiquement.
      </p>

      {/* Client type selector */}
      <ClientTypeSelector
        value={data.client_type_id || ""}
        onValueChange={handleClientTypeChange}
        recommendedType={recommended}
        alternatives={alternatives}
      />

      {/* OPT-45: pre-selected count */}
      {preselectedCount && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
            {preselectedCount.missions} missions · {preselectedCount.sousOptions} sous-options pre-selectionnees
          </Badge>
          <span>a l'etape suivante</span>
        </div>
      )}

      {/* Mode comptable — only for presentation and compilation */}
      {showModeComptable && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Mode d'intervention comptable</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Le mode d'intervention definit comment le cabinet intervient sur la comptabilite.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TYPES_MISSION.map(({ value, label, description, icon: Icon }) => {
              const active = data.type_mission === value;
              return (
                <button
                  key={value}
                  onClick={() => onChange({ type_mission: value })}
                  className={`relative flex flex-col items-center gap-2 p-5 rounded-xl transition-all duration-200 text-center ${
                    active
                      ? "wizard-select-card wizard-select-active shadow-md shadow-blue-500/8"
                      : "wizard-select-card"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    active ? "bg-blue-50 dark:bg-blue-500/15" : "bg-gray-50 dark:bg-white/[0.04]"
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>{label}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
                  </div>
                  {active && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
