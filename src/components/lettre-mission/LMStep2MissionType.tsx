import { useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { MISSION_TYPES, MISSION_CATEGORIES, getMissionTypeConfig, getCategoryColorClasses } from "@/lib/lettreMissionTypes";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Eye, CheckSquare, CheckCircle2, XCircle } from "lucide-react";

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
  const selectedId = data.mission_type_id || "presentation";
  const selectedConfig = useMemo(() => getMissionTypeConfig(selectedId), [selectedId]);

  const handleSelectMission = (mId: string) => {
    const config = MISSION_TYPES[mId as keyof typeof MISSION_TYPES];
    if (!config) return;
    const updates: Partial<LMWizardData> = {
      mission_type_id: mId,
      specific_variables: {},
    };
    if (mId !== "presentation" && mId !== "compilation") {
      updates.type_mission = config.shortLabel;
    } else if (!data.type_mission || !["TENUE", "SURVEILLANCE", "REVISION"].includes(data.type_mission)) {
      updates.type_mission = "TENUE";
    }
    onChange(updates);
  };

  const showModeComptable = selectedId === "presentation" || selectedId === "compilation";

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Selectionnez le cadre normatif applicable. Cela determine la structure de la lettre, la forme du rapport et les obligations deontologiques.
      </p>

      {/* Category grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MISSION_CATEGORIES.map((cat) => {
          const colors = getCategoryColorClasses(cat.category);
          const isCatSelected = selectedConfig.category === cat.category;
          return (
            <div
              key={cat.category}
              className={`wizard-card rounded-xl p-4 transition-all duration-300 ${
                isCatSelected
                  ? `${colors.border} ${colors.bg} border-l-4`
                  : ""
              }`}
            >
              <p className={`text-sm font-semibold ${isCatSelected ? colors.text : "text-slate-800 dark:text-slate-200"}`}>
                {cat.label}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {cat.missions.length} type{cat.missions.length > 1 ? "s" : ""} de mission
              </p>

              <div className="mt-3 space-y-1.5">
                {cat.missions.map((mId) => {
                  const config = MISSION_TYPES[mId as keyof typeof MISSION_TYPES];
                  if (!config) return null;
                  const active = selectedId === mId;
                  return (
                    <button
                      key={mId}
                      onClick={() => handleSelectMission(mId)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all duration-200 ${
                        active ? 'wizard-select-active' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          active ? "bg-gradient-to-r from-blue-400 to-indigo-500" : "bg-gray-300 dark:bg-gray-600"
                        }`} />
                        <span className={`text-sm ${active ? `font-medium ${colors.text}` : "text-slate-600 dark:text-slate-400"}`}>
                          {config.shortLabel}
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${active ? colors.badge : ""}`}>
                        {config.normeRef}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info banner for selected type */}
      {selectedConfig && (
        <div className="wizard-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedConfig.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{selectedConfig.description}</p>
            </div>
            <Badge className={`shrink-0 text-xs font-mono ${getCategoryColorClasses(selectedConfig.category).badge}`}>
              {selectedConfig.normeRef}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{selectedConfig.formeRapport}</Badge>
            {selectedConfig.honorairesSuccesAutorises ? (
              <Badge className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Honoraires de succes autorises
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 gap-0.5">
                <XCircle className="w-3 h-3" /> Honoraires de succes interdits
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Referentiel : {selectedConfig.referentielApplicable}
          </p>
        </div>
      )}

      {/* Mode comptable — only for presentation and compilation */}
      {showModeComptable && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Mode d'intervention comptable</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Le mode d'intervention definit comment le cabinet intervient sur la comptabilite en amont de la mission de {selectedId === "presentation" ? "presentation (NP 2300 §A1)" : "compilation (NP 4410)"}.
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
