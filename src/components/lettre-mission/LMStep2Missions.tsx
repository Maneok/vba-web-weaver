import { useEffect, useRef, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { DEFAULT_MISSIONS, applyFormConditionals } from "@/lib/lmDefaults";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Landmark, Users, Scale, ShieldCheck, FileWarning, Lightbulb,
  Lock, ChevronDown, AlertTriangle, EyeOff,
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

export default function LMStep2Missions({ data, onChange }: Props) {
  const { clients } = useAppState();
  const suggestionsShown = useRef(false);

  const client = clients.find((c) => c.ref === data.client_id);

  // Init missions if empty + apply conditionals
  useEffect(() => {
    if (data.missions_selected.length === 0) {
      const base = DEFAULT_MISSIONS.map((m) => ({
        ...m,
        sous_options: m.sous_options.map((s) => ({ ...s })),
      }));
      const applied = applyFormConditionals(base, data.forme_juridique, client?.effectif || "");
      onChange({ missions_selected: applied });
    }
  }, [data.missions_selected.length, data.forme_juridique, client?.effectif, onChange]);

  const allMissions = data.missions_selected.length > 0 ? data.missions_selected : DEFAULT_MISSIONS;

  // Filter missions based on mission type config
  const mtId = (data as any).mission_type_id || "presentation";
  const mtConfig = useMemo(() => getMissionTypeConfig(mtId), [mtId]);

  // Visibility rules per section based on mission type
  const missions = useMemo(() => {
    return allMissions.filter((m) => {
      // LCB-FT + travail_dissimule → always visible (mandatory)
      if (m.section_id === "lcbft" || m.section_id === "travail_dissimule") return true;
      // Conseil → always visible (optional)
      if (m.section_id === "conseil") return true;
      // Comptabilité → ONLY for présentation (NP 2300)
      if (m.section_id === "comptabilite") return mtId === "presentation";
      // Fiscal → visible if not in hiddenSections
      if (m.section_id === "fiscal") return !mtConfig.hiddenSections.includes("mission_controle_fiscal");
      // Social → visible if optionalSections includes 'mission_sociale'
      if (m.section_id === "social") return mtConfig.optionalSections.includes("mission_sociale");
      // Juridique → visible if optionalSections includes 'mission_juridique'
      if (m.section_id === "juridique") return mtConfig.optionalSections.includes("mission_juridique");
      return true;
    });
  }, [allMissions, mtId, mtConfig.hiddenSections, mtConfig.optionalSections]);

  const hiddenCount = allMissions.length - missions.length;

  // Check if mission type has no complementary services
  const hasNoComplementary = useMemo(() => {
    const complementary = missions.filter(
      (m) => !["lcbft", "travail_dissimule"].includes(m.section_id) && !m.locked
    );
    return complementary.length === 0;
  }, [missions]);

  // A) Conditional logic toasts — show once
  useEffect(() => {
    if (suggestionsShown.current || missions.length === 0) return;
    suggestionsShown.current = true;

    // Effectif > 0 but social not checked
    if (client?.effectif && parseInt(client.effectif, 10) > 0) {
      const social = missions.find((m) => m.section_id === "social");
      if (social && !social.selected) {
        toast.info(`Ce client a ${client.effectif} salarie(s). Souhaitez-vous ajouter la mission sociale ?`, {
          duration: 6000,
          action: {
            label: "Ajouter",
            onClick: () => {
              const updated = missions.map((m) =>
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
              const updated = missions.map((m) =>
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
  }, [missions.length, client?.effectif, data.forme_juridique, missions, onChange]);

  const toggleSection = (sectionId: string) => {
    const m = allMissions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    // A) Check tenue/surveillance incompatibility
    if (!m.selected) {
      if (sectionId === "comptabilite" && data.type_mission === "SURVEILLANCE") {
        toast.error("Tenue et surveillance sont incompatibles");
        return;
      }
    }

    const updated = allMissions.map((x) =>
      x.section_id === sectionId
        ? { ...x, selected: !x.selected, sous_options: x.sous_options.map((s) => ({ ...s, selected: !x.selected })) }
        : x
    );
    onChange({ missions_selected: updated });
  };

  const toggleSub = (sectionId: string, optId: string) => {
    const m = allMissions.find((x) => x.section_id === sectionId);
    if (!m || m.locked) return;

    const updated = allMissions.map((x) =>
      x.section_id === sectionId
        ? { ...x, sous_options: x.sous_options.map((s) => s.id === optId ? { ...s, selected: !s.selected } : s) }
        : x
    );
    onChange({ missions_selected: updated });
  };

  const totalSelected = useMemo(() => missions.filter((m) => m.selected).length, [missions]);

  // Check for tenue+surveillance conflict
  const hasTenue = allMissions.some((m) => m.section_id === "comptabilite" && m.selected);
  const isSurveillance = data.type_mission === "SURVEILLANCE";
  const hasConflict = hasTenue && isSurveillance;

  return (
    <div className="space-y-6">
      {/* A) Incompatibility warning */}
      {hasConflict && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-shake" role="alert">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">
            <strong>Missions incompatibles :</strong> La tenue comptable et la mission de surveillance ne peuvent pas etre combinees.
          </p>
        </div>
      )}

      {/* Hidden sections info */}
      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-500/5 border border-white/[0.06] text-xs text-slate-500">
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
          {hiddenCount} section{hiddenCount > 1 ? "s masquées" : " masquée"} (non applicable pour {mtConfig.shortLabel})
        </div>
      )}

      {/* No complementary services message */}
      {hasNoComplementary && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300/80">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            Cette mission ({mtConfig.shortLabel}) ne comporte pas de prestations complémentaires standard.
            Les obligations LCB-FT s'appliquent.
          </p>
        </div>
      )}

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
              <button
                type="button"
                onClick={() => toggleSection(mission.section_id)}
                disabled={isLocked}
                aria-label={`${mission.selected ? "Desactiver" : "Activer"} ${mission.label}`}
                className={`w-full flex items-center gap-3 p-4 text-left min-h-[56px] ${
                  isLocked ? "cursor-default" : "cursor-pointer active:bg-white/[0.02]"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  mission.selected ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.04] text-slate-500"
                }`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${mission.selected ? "text-white" : "text-slate-400"}`}>
                    {mission.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{mission.description}</p>
                </div>
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
                  {mission.selected && <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

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

      <div className="flex justify-center">
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-1.5">
          {totalSelected} mission{totalSelected > 1 ? "s" : ""} selectionnee{totalSelected > 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}
