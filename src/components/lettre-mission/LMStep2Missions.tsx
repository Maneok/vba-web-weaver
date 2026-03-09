import { useEffect, useRef, useMemo, useState } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { CATEGORY_COLORS } from "@/lib/lmWizardTypes";
import { DEFAULT_MISSIONS, applyFormConditionals, MISSION_PRESETS, applyMissionPreset, getPresetsForForme } from "@/lib/lmDefaults";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calculator, Landmark, Users, Scale, ShieldCheck, FileWarning, Lightbulb,
  Lock, ChevronDown, AlertTriangle, Sparkles, Package, ToggleLeft, ToggleRight,
  Briefcase, Building2, Building, Home, Heart, User, Info,
} from "lucide-react";
import { toast } from "sonner";

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

const PRESET_ICONS: Record<string, React.ReactNode> = {
  briefcase: <Briefcase className="w-4 h-4" />,
  building2: <Building2 className="w-4 h-4" />,
  building: <Building className="w-4 h-4" />,
  home: <Home className="w-4 h-4" />,
  heart: <Heart className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
};

// (23) Category colors for visual grouping
const CATEGORY_BG: Record<string, string> = {
  core: "bg-blue-500/5",
  obligatoire: "bg-amber-500/5",
  optionnel: "bg-purple-500/5",
};

export default function LMStep2Missions({ data, onChange }: Props) {
  const { clients } = useAppState();
  const suggestionsShown = useRef(false);
  const [showPresets, setShowPresets] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const client = clients.find((c) => c.ref === data.client_id);

  // Init missions if empty + apply conditionals
  useEffect(() => {
    // (F15) Deep copy with sous_options guard
    if (!data.missions_selected || data.missions_selected.length === 0) {
      const base = DEFAULT_MISSIONS.map((m) => ({
        ...m,
        sous_options: (m.sous_options || []).map((s) => ({ ...s })),
      }));
      const applied = applyFormConditionals(base, data.forme_juridique, client?.effectif || "");
      onChange({ missions_selected: applied });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.forme_juridique]);

  const missions = useMemo(
    () => (data.missions_selected || []).length > 0 ? data.missions_selected : DEFAULT_MISSIONS,
    [data.missions_selected]
  );

  // A) Conditional logic toasts — show once
  const missionsRef = useRef(missions);
  missionsRef.current = missions;

  useEffect(() => {
    if (suggestionsShown.current || missions.length === 0) return;
    suggestionsShown.current = true;

    // Effectif > 0 but social not checked
    // (F16) Guard parseInt against NaN
    if (client?.effectif && (parseInt(client.effectif) || 0) > 0) {
      const social = missions.find((m) => m.section_id === "social");
      if (social && !social.selected) {
        toast.info(`Ce client a ${client.effectif} salarie(s). Souhaitez-vous ajouter la mission sociale ?`, {
          duration: 6000,
          action: {
            label: "Ajouter",
            onClick: () => {
              const fresh = missionsRef.current;
              const updated = fresh.map((m) =>
                m.section_id === "social"
                  ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) }
                  : m
              );
              onChange({ missions_selected: updated });
            },
          },
        });
      }
    }

    // SCI without juridique
    if (data.forme_juridique === "SCI") {
      const juridique = missions.find((m) => m.section_id === "juridique");
      if (juridique && !juridique.selected) {
        toast.info("90% des SCI necessitent l'AG annuelle. Ajouter la mission juridique ?", {
          duration: 6000,
          action: {
            label: "Ajouter",
            onClick: () => {
              const fresh = missionsRef.current;
              const updated = fresh.map((m) =>
                m.section_id === "juridique"
                  ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) }
                  : m
              );
              onChange({ missions_selected: updated });
            },
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions.length, client?.effectif, data.forme_juridique]);

  const toggleSection = (sectionId: string) => {
    const m = missions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    // A) Check tenue/surveillance incompatibility
    if (!m.selected) {
      if (sectionId === "comptabilite" && data.type_mission === "SURVEILLANCE") {
        toast.error("Tenue et surveillance sont incompatibles");
        return;
      }
    }

    const updated = missions.map((x) =>
      x.section_id === sectionId
        ? { ...x, selected: !x.selected, sous_options: x.sous_options.map((s) => ({ ...s, selected: !x.selected })) }
        : x
    );
    onChange({ missions_selected: updated });

    // (24) Auto expand when selecting
    if (!m.selected) {
      setExpandedSections((prev) => new Set([...prev, sectionId]));
    }
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

  // (24) Toggle sub-options visibility
  const toggleExpanded = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // (F14) Don't count locked missions in totalSelected; (F13) guard sous_options
  const totalSelected = missions.filter((m) => m.selected && !m.locked).length;
  const totalSubSelected = missions.reduce((acc, m) => acc + (m.selected ? (m.sous_options || []).filter((s) => s.selected).length : 0), 0);
  const totalSubTotal = missions.reduce((acc, m) => acc + (m.selected ? (m.sous_options || []).length : 0), 0);

  // Check for tenue+surveillance conflict
  const hasTenue = missions.some((m) => m.section_id === "comptabilite" && m.selected);
  const isSurveillance = data.type_mission === "SURVEILLANCE";
  const hasConflict = hasTenue && isSurveillance;

  // (17) Recommended presets for current legal form
  const presets = useMemo(() => getPresetsForForme(data.forme_juridique), [data.forme_juridique]);
  const recommendedPresets = useMemo(
    () => presets.filter((p) => p.formes.some((f) => (data.forme_juridique || "").toUpperCase().includes(f))),
    [presets, data.forme_juridique]
  );

  // (17) Apply preset
  const handlePreset = (presetId: string) => {
    const preset = MISSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const applied = applyMissionPreset(preset, missions);
    onChange({ missions_selected: applied });
    setShowPresets(false);
    toast.success(`Pack "${preset.label}" applique`);
  };

  // (20) Select all / deselect all
  const allUnlockedSelected = missions.filter((m) => !m.locked).every((m) => m.selected);
  const handleToggleAll = () => {
    const newState = !allUnlockedSelected;
    const updated = missions.map((m) =>
      m.locked ? m : { ...m, selected: newState, sous_options: m.sous_options.map((s) => ({ ...s, selected: newState })) }
    );
    onChange({ missions_selected: updated });
  };

  return (
    <div className="space-y-5">
      {/* A) Incompatibility warning */}
      {hasConflict && (
        <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-red-300 leading-relaxed">
            <strong>Missions incompatibles :</strong> La tenue comptable et la mission de surveillance ne peuvent pas etre combinees.
          </p>
        </div>
      )}

      {/* (17) Mission presets — one-click packages */}
      {showPresets && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-medium text-slate-300">Packs predefinies</p>
            </div>
            <button onClick={() => setShowPresets(false)} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Masquer
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {presets.slice(0, 6).map((preset) => {
              const isRecommended = recommendedPresets.includes(preset);
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePreset(preset.id)}
                  className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-left active:scale-[0.98] min-h-[72px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none ${
                    isRecommended
                      ? "border-blue-500/30 bg-blue-500/[0.06] hover:bg-blue-500/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`${isRecommended ? "text-blue-400" : "text-slate-500"}`}>
                      {PRESET_ICONS[preset.icon] || <Package className="w-4 h-4" />}
                    </div>
                    {isRecommended && (
                      <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[8px] px-1.5 py-0 ml-auto">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Suggere
                      </Badge>
                    )}
                  </div>
                  <p className={`text-xs font-semibold leading-tight ${isRecommended ? "text-blue-300" : "text-slate-300"}`}>{preset.label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight hidden sm:block">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!showPresets && (
        <button onClick={() => setShowPresets(true)} className="flex items-center gap-1.5 text-xs text-blue-400/60 hover:text-blue-400 transition-colors">
          <Package className="w-3.5 h-3.5" /> Afficher les packs predefinies
        </button>
      )}

      {/* (20) Select all / Deselect all toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">{totalSelected} mission{totalSelected > 1 ? "s" : ""} · {totalSubSelected}/{totalSubTotal} sous-options</span>
        <button
          onClick={handleToggleAll}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded px-2 py-1"
        >
          {allUnlockedSelected ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {allUnlockedSelected ? "Tout desactiver" : "Tout activer"}
        </button>
      </div>

      {/* Mission list */}
      <div className="space-y-3">
        {missions.map((mission) => {
          const isLocked = !!mission.locked;
          const icon = ICON_MAP[mission.icon] || <Calculator className="w-5 h-5" />;
          const subCount = (mission.sous_options || []).filter((s) => s.selected).length;
          const categoryColor = CATEGORY_COLORS[mission.category || "core"] || "";
          const categoryBg = CATEGORY_BG[mission.category || "core"] || "";
          const isExpanded = mission.selected && (isLocked || expandedSections.has(mission.section_id));
          // (18) Is this mission recommended for the current legal form?
          const isRecommendedForForme = recommendedPresets.some((p) => p.sections[mission.section_id]);

          return (
            <div
              key={mission.section_id}
              className={`rounded-xl border-2 border-l-4 transition-all duration-200 ${categoryColor} ${
                mission.selected
                  ? `${categoryBg} border-blue-500/20`
                  : "bg-white/[0.01] border-white/[0.04] hover:border-white/[0.08]"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isLocked) toggleSection(mission.section_id);
                  if (mission.selected) toggleExpanded(mission.section_id);
                }}
                disabled={isLocked && !mission.selected}
                aria-expanded={isExpanded}
                aria-controls={`mission-${mission.section_id}-options`}
                className={`w-full flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 text-left min-h-[56px] focus:ring-2 focus:ring-blue-500/40 focus:outline-none rounded-t-xl ${
                  isLocked ? "cursor-default" : "cursor-pointer active:bg-white/[0.02]"
                }`}
              >
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  mission.selected ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.04] text-slate-500"
                }`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${mission.selected ? "text-white" : "text-slate-400"}`}>
                      {mission.label}
                    </p>
                    {/* (18) Suggested badge */}
                    {isRecommendedForForme && !mission.selected && !isLocked && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-0 text-[8px] px-1.5 py-0">
                        Suggere
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">{mission.description}</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {isLocked && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 gap-1 hidden sm:inline-flex">
                      <Lock className="w-3 h-3" /> Obligatoire
                    </Badge>
                  )}
                  {/* (22) Why-locked tooltip */}
                  {isLocked && (
                    <span className="sm:hidden" title="Mission obligatoire par la reglementation">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                  )}
                  {/* (21) Sub-option count progress */}
                  {mission.selected && !isLocked && (
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(mission.sous_options || []).length > 0 ? (subCount / (mission.sous_options || []).length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums">{subCount}/{(mission.sous_options || []).length}</span>
                    </div>
                  )}
                  <Switch
                    checked={mission.selected}
                    onCheckedChange={() => toggleSection(mission.section_id)}
                    disabled={isLocked}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* (24) Proper chevron rotation */}
                  {mission.selected && (
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </button>

              <div
                id={`mission-${mission.section_id}-options`}
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 space-y-0.5 border-t border-white/[0.04]">
                  {mission.sous_options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-2.5 sm:p-2.5 rounded-lg transition-colors min-h-[44px] ${
                        isLocked ? "cursor-default opacity-60" : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]"
                      }`}
                    >
                      <Checkbox
                        checked={opt.selected}
                        onCheckedChange={() => toggleSub(mission.section_id, opt.id)}
                        disabled={isLocked}
                        className="w-5 h-5 sm:w-4 sm:h-4"
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

      <div className="flex justify-center">
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-1.5">
          {totalSelected} mission{totalSelected > 1 ? "s" : ""} selectionnee{totalSelected > 1 ? "s" : ""} · {totalSubSelected} sous-options
        </Badge>
      </div>
    </div>
  );
}
