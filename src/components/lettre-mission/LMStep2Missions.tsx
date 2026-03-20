import { useEffect, useRef, useMemo, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { getMissionsForClientType } from "@/lib/lmClientMissions";
import { CLIENT_TYPES, getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import MissionSpecificFields from "@/components/lettre-mission/MissionSpecificFields";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Landmark, Users, Scale, ShieldCheck, FileWarning, Lightbulb,
  Lock, ChevronDown, AlertTriangle, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

// OPT-14: centralized icon map
const ICON_MAP: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-5 h-5" />,
  landmark: <Landmark className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
  scale: <Scale className="w-5 h-5" />,
  shield: <ShieldCheck className="w-5 h-5" />,
  "shield-check": <ShieldCheck className="w-5 h-5" />,
  "file-warning": <FileWarning className="w-5 h-5" />,
  lightbulb: <Lightbulb className="w-5 h-5" />,
};

// OPT-14: extract color badge helper to eliminate repeated ternary chains
const BADGE_COLORS: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20',
  teal:   'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20',
  amber:  'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
  pink:   'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20',
  gray:   'bg-gray-50 text-gray-600 dark:bg-white/[0.04] dark:text-gray-400 border border-gray-200 dark:border-white/[0.08]',
};

const CATEGORY_ICON_COLORS: Record<string, { active: string; inactive: string }> = {
  blue:   { active: "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
  purple: { active: "bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
  teal:   { active: "bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
  amber:  { active: "bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
  pink:   { active: "bg-pink-50 dark:bg-pink-500/10 text-pink-500 dark:text-pink-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
  gray:   { active: "bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400", inactive: "bg-gray-50 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500" },
};

export default function LMStep2Missions({ data, onChange }: Props) {
  const { clients } = useAppState();
  const suggestionsShown = useRef(false);
  const prevClientTypeRef = useRef(data.client_type_id);

  const client = clients.find((c) => c.ref === data.client_id);
  const clientTypeId = data.client_type_id || 'sas_is';
  const clientConfig = CLIENT_TYPES[clientTypeId];
  const categoryColor = clientConfig?.categoryColor || 'blue';
  const iconColors = CATEGORY_ICON_COLORS[categoryColor] || CATEGORY_ICON_COLORS.blue;
  const badgeColor = BADGE_COLORS[categoryColor] || BADGE_COLORS.blue;

  const clientMissions = useMemo(
    () => getMissionsForClientType(clientTypeId),
    [clientTypeId]
  );

  const convertToMissionSelections = useMemo(() => {
    return clientMissions.map((m) => ({
      section_id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      selected: m.defaultSelected,
      locked: m.locked,
      sous_options: m.sous_options.map((s) => ({
        id: s.id,
        label: s.label,
        selected: s.defaultSelected,
      })),
    }));
  }, [clientMissions]);

  // Initialize missions when client type changes or when none selected
  // If missions_selected already has data (from smart defaults), keep it
  useEffect(() => {
    if (prevClientTypeRef.current !== data.client_type_id) {
      prevClientTypeRef.current = data.client_type_id;
      // If smart defaults already provided missions_selected, just clean stale honoraires keys
      if (data.missions_selected.length > 0) {
        const newMissionIds = new Set(data.missions_selected.map(m => m.section_id));
        const cleanedDetail: Record<string, string> = {};
        if (data.honoraires_detail) {
          for (const [k, v] of Object.entries(data.honoraires_detail)) {
            if (newMissionIds.has(k)) cleanedDetail[k] = v;
          }
        }
        onChange({ honoraires_detail: cleanedDetail });
      } else {
        // Fallback: use basic defaults
        onChange({ missions_selected: convertToMissionSelections });
      }
    } else if (data.missions_selected.length === 0) {
      onChange({ missions_selected: convertToMissionSelections });
    }
  }, [data.client_type_id, convertToMissionSelections]);

  const allMissions = data.missions_selected.length > 0 ? data.missions_selected : convertToMissionSelections;

  const mtId = data.mission_type_id || "presentation";

  // OPT-22: audit-specific sections
  const auditSections: MissionSelection[] = useMemo(() => {
    if (mtId !== "audit_contractuel") return [];
    return [
      { section_id: "equipe_audit", label: "Equipe d'audit", description: "Composition et responsabilites — ISA 210 §10", icon: "users", selected: true, locked: true, sous_options: [{ id: "equipe_composition", label: "Composition de l'equipe", selected: true }] },
      { section_id: "declarations_ecrites", label: "Declarations ecrites", description: "Engagement du client — ISA 580", icon: "file-warning", selected: true, locked: true, sous_options: [{ id: "isa580", label: "Declarations conformes ISA 580", selected: true }] },
      { section_id: "planning_intervention", label: "Planning d'intervention", description: "Calendrier des phases d'audit — ISA 210 §10", icon: "calculator", selected: true, locked: true, sous_options: [{ id: "planning", label: "Planning interimaire et final", selected: true }] },
    ];
  }, [mtId]);

  const missions = useMemo(() => [...allMissions, ...auditSections], [allMissions, auditSections]);

  // OPT-24: adapt suggestion to client type — only suggest social if client type supports it
  useEffect(() => {
    if (suggestionsShown.current || missions.length === 0) return;
    suggestionsShown.current = true;

    const hasSocialSection = missions.some((m) => m.section_id === "social");
    if (hasSocialSection && client?.effectif && parseInt(client.effectif, 10) > 0) {
      const social = missions.find((m) => m.section_id === "social");
      if (social && !social.selected) {
        toast.info(`Ce client a ${client.effectif} salarie(s). Souhaitez-vous ajouter la mission sociale ?`, {
          duration: 6000,
          action: {
            label: "Ajouter",
            onClick: () => {
              const updated = allMissions.map((m) =>
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
  }, [missions.length, client?.effectif]);

  const toggleSection = useCallback((sectionId: string) => {
    const m = allMissions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    if (!m.selected && sectionId === "comptabilite" && data.type_mission === "SURVEILLANCE") {
      toast.error("Tenue et surveillance sont incompatibles");
      return;
    }

    const updated = allMissions.map((x) =>
      x.section_id === sectionId
        ? { ...x, selected: !x.selected, sous_options: x.sous_options.map((s) => ({ ...s, selected: !x.selected })) }
        : x
    );
    onChange({ missions_selected: updated });
  }, [allMissions, data.type_mission, onChange]);

  const toggleSub = useCallback((sectionId: string, optId: string) => {
    const m = allMissions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    const updated = allMissions.map((x) =>
      x.section_id === sectionId
        ? { ...x, sous_options: x.sous_options.map((s) => s.id === optId ? { ...s, selected: !s.selected } : s) }
        : x
    );
    onChange({ missions_selected: updated });
  }, [allMissions, onChange]);

  // OPT-23: toggle all sub-options for a section
  const toggleAllSub = useCallback((sectionId: string, selectAll: boolean) => {
    const m = allMissions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;
    const updated = allMissions.map((x) =>
      x.section_id === sectionId
        ? { ...x, sous_options: x.sous_options.map((s) => ({ ...s, selected: selectAll })) }
        : x
    );
    onChange({ missions_selected: updated });
  }, [allMissions, onChange]);

  const totalSelected = useMemo(() => missions.filter((m) => m.selected).length, [missions]);
  // OPT-17: total sub-options count
  const totalSubSelected = useMemo(
    () => missions.filter((m) => m.selected).reduce((sum, m) => sum + m.sous_options.filter((s) => s.selected).length, 0),
    [missions]
  );

  const hasTenue = allMissions.some((m) => m.section_id === "comptabilite" && m.selected);
  const isSurveillance = data.type_mission === "SURVEILLANCE";
  const hasConflict = hasTenue && isSurveillance;

  // OPT-19: empty state
  if (!clientConfig) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500 text-sm">
        Selectionnez un type de client a l'etape precedente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client type label */}
      <div className="flex items-center gap-2">
        <Badge className={`text-[10px] ${badgeColor}`}>
          {clientConfig.shortLabel}
        </Badge>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Prestations adaptees pour {clientConfig.label}
        </p>
      </div>

      {/* Mission-specific fields for the selected mission type */}
      <MissionSpecificFields
        missionType={data.mission_type_id || "presentation"}
        values={data.specific_variables || {}}
        onChange={(key, value) => {
          const updated = { ...(data.specific_variables || {}), [key]: value };
          onChange({ specific_variables: updated });
        }}
      />

      {/* Incompatibility warning */}
      {hasConflict && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-shake wizard-alert" role="alert">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">
            <strong>Missions incompatibles :</strong> La tenue comptable et la mission de surveillance ne peuvent pas etre combinees.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {missions.map((mission) => {
          const isLocked = !!mission.locked;
          const icon = ICON_MAP[mission.icon] || <Calculator className="w-5 h-5" />;
          const subCount = mission.sous_options.filter((s) => s.selected).length;
          const allSubSelected = subCount === mission.sous_options.length;

          return (
            <div
              key={mission.section_id}
              className={`rounded-xl border-2 transition-all duration-200 ${
                mission.selected
                  ? "wizard-select-card wizard-select-active"
                  : "wizard-select-card"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(mission.section_id)}
                disabled={isLocked}
                aria-expanded={mission.selected}
                aria-label={`${mission.selected ? "Desactiver" : "Activer"} ${mission.label}`}
                className={`w-full flex items-center gap-3 p-4 text-left min-h-[56px] rounded-xl transition-colors ${
                  isLocked ? "cursor-default" : "cursor-pointer active:bg-white dark:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  mission.selected ? iconColors.active : iconColors.inactive
                }`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${mission.selected ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-400"}`}>
                    {mission.label}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{mission.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isLocked && (
                    <Badge variant="outline" className="text-[9px] border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 gap-1">
                      <Lock className="w-3 h-3" /> Obligatoire
                    </Badge>
                  )}
                  {mission.selected && !isLocked && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{subCount}/{mission.sous_options.length}</span>
                  )}
                  <Switch
                    checked={mission.selected}
                    onCheckedChange={() => toggleSection(mission.section_id)}
                    disabled={isLocked}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* OPT-22: rotate chevron */}
                  <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${mission.selected ? "rotate-180" : ""}`} />
                </div>
              </button>

              <div className={`overflow-hidden transition-all duration-200 ${
                mission.selected ? "max-h-[500px] overflow-y-auto opacity-100" : "max-h-0 opacity-0"
              }`}>
                <div className="px-4 pb-4 pt-1 space-y-1 border-t border-gray-100 dark:border-white/[0.04]">
                  {/* OPT-23: select/deselect all button */}
                  {!isLocked && mission.sous_options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => toggleAllSub(mission.section_id, !allSubSelected)}
                      className="flex items-center gap-2 px-2.5 py-1.5 mb-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {allSubSelected
                        ? <><Square className="w-3 h-3" /> Tout decocher</>
                        : <><CheckSquare className="w-3 h-3" /> Tout cocher</>}
                    </button>
                  )}
                  {mission.sous_options.map((opt) => {
                    // OPT-12/20: find matching description from source data
                    const srcMission = clientMissions.find(m => m.id === mission.section_id);
                    const srcOpt = srcMission?.sous_options.find(s => s.id === opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                          isLocked ? "cursor-default opacity-60" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                        }`}
                      >
                        <Checkbox
                          checked={opt.selected}
                          onCheckedChange={() => toggleSub(mission.section_id, opt.id)}
                          disabled={isLocked}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <span className={`text-sm ${opt.selected ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                            {opt.label}
                          </span>
                          {/* OPT-12: show description if available */}
                          {srcOpt?.description && (
                            <p className="text-[10px] text-slate-400/70 dark:text-slate-500/70 mt-0.5">{srcOpt.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* OPT-17: enriched footer badge with sub-option count */}
      <div className="flex justify-center">
        <Badge className={`px-4 py-1.5 ${badgeColor}`}>
          {totalSelected} mission{totalSelected > 1 ? "s" : ""} · {totalSubSelected} prestation{totalSubSelected > 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}
