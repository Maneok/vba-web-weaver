import { useEffect } from "react";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { DEFAULT_MISSIONS, applyFormConditionals } from "@/lib/lmDefaults";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Landmark, Users, Scale, ShieldCheck, FileWarning, Lightbulb,
  Lock, ChevronDown,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-5 h-5" />,
  landmark: <Landmark className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
  scale: <Scale className="w-5 h-5" />,
  shield: <ShieldCheck className="w-5 h-5" />,
  "file-warning": <FileWarning className="w-5 h-5" />,
  lightbulb: <Lightbulb className="w-5 h-5" />,
};

export default function LMStep2Missions({ data, onChange }: Props) {
  // Init missions if empty + apply conditionals
  useEffect(() => {
    if (data.missions_selected.length === 0) {
      const base = DEFAULT_MISSIONS.map((m) => ({
        ...m,
        sous_options: m.sous_options.map((s) => ({ ...s })),
      }));
      const applied = applyFormConditionals(base, data.forme_juridique, "");
      onChange({ missions_selected: applied });
    }
  }, []);

  const missions = data.missions_selected.length > 0 ? data.missions_selected : DEFAULT_MISSIONS;

  const toggleSection = (sectionId: string) => {
    const m = missions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    const updated = missions.map((x) =>
      x.section_id === sectionId
        ? { ...x, selected: !x.selected, sous_options: x.sous_options.map((s) => ({ ...s, selected: !x.selected })) }
        : x
    );
    onChange({ missions_selected: updated });
  };

  const toggleSub = (sectionId: string, optId: string) => {
    const m = missions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    const updated = missions.map((x) =>
      x.section_id === sectionId
        ? { ...x, sous_options: x.sous_options.map((s) => s.id === optId ? { ...s, selected: !s.selected } : s) }
        : x
    );
    onChange({ missions_selected: updated });
  };

  const totalSelected = missions.filter((m) => m.selected).length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {missions.map((mission) => {
          const isLocked = !!mission.locked;
          const icon = ICON_MAP[mission.icon] || <Calculator className="w-5 h-5" />;
          const subCount = mission.sous_options.filter((s) => s.selected).length;

          return (
            <div
              key={mission.section_id}
              className={`rounded-xl border-2 transition-all duration-200 ${
                mission.selected
                  ? "bg-white/[0.04] border-blue-500/20"
                  : "bg-white/[0.01] border-white/[0.04] hover:border-white/[0.08]"
              }`}
            >
              {/* Card header — clickable */}
              <button
                type="button"
                onClick={() => toggleSection(mission.section_id)}
                disabled={isLocked}
                className={`w-full flex items-center gap-3 p-4 text-left min-h-[56px] ${
                  isLocked ? "cursor-default" : "cursor-pointer active:bg-white/[0.02]"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  mission.selected ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.04] text-slate-500"
                }`}>
                  {icon}
                </div>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${mission.selected ? "text-white" : "text-slate-400"}`}>
                    {mission.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{mission.description}</p>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {isLocked && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 gap-1">
                      <Lock className="w-3 h-3" /> Obligatoire
                    </Badge>
                  )}
                  {mission.selected && !isLocked && (
                    <span className="text-[10px] text-slate-500 tabular-nums">{subCount}/{mission.sous_options.length}</span>
                  )}
                  <Switch
                    checked={mission.selected}
                    onCheckedChange={() => toggleSection(mission.section_id)}
                    disabled={isLocked}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {mission.selected && (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Sub-options slide-down */}
              <div className={`overflow-hidden transition-all duration-200 ${
                mission.selected ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
              }`}>
                <div className="px-4 pb-4 pt-1 space-y-1 border-t border-white/[0.04]">
                  {mission.sous_options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                        isLocked ? "cursor-default opacity-60" : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]"
                      }`}
                    >
                      <Checkbox
                        checked={opt.selected}
                        onCheckedChange={() => toggleSub(mission.section_id, opt.id)}
                        disabled={isLocked}
                      />
                      <span className={`text-sm ${opt.selected ? "text-slate-300" : "text-slate-500"}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating badge */}
      <div className="flex justify-center">
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-1.5">
          {totalSelected} mission{totalSelected > 1 ? "s" : ""} selectionnee{totalSelected > 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}
