import { useMemo, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { getClientTypeConfig, getMissionTypeConfig, recommendClientType, isModeComptableApplicable } from "@/lib/lettreMissionTypes";
import { getDefaultSelectedCount, getMissionsForClientType } from "@/lib/lmClientMissions";
import { generateSmartDefaults, getSmartMissionSelections, getContextualQuestions, detectRegimeBenefices } from "@/lib/lmSmartDefaults";
import ClientTypeSelector from "./ClientTypeSelector";
import { BookOpen, Eye, CheckSquare, CheckCircle2, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
      // Reset contextual fields on type change
      gerant_majoritaire: undefined,
      regime_fiscal_detail: undefined,
      regime_fiscal_societe: undefined,
      nombre_biens: undefined,
      president_remunere: undefined,
      nombre_associes_tns: undefined,
      caisse_retraite: undefined,
      holding_type: undefined,
      nombre_filiales: undefined,
      association_activites_lucratives: undefined,
      montant_subventions: undefined,
      type_location: undefined,
    };

    if (config.defaultModeComptable) {
      updates.type_mission = config.defaultModeComptable;
    } else if (!data.type_mission || !["TENUE", "SURVEILLANCE", "REVISION"].includes(data.type_mission)) {
      updates.type_mission = "TENUE";
    }

    // Auto-detect regime_benefices from APE
    if (selectedClient?.ape) {
      updates.regime_benefices = detectRegimeBenefices(selectedClient.ape) || undefined;
    }

    // Smart defaults: pre-fill honoraires, clauses, durée, paiement
    if (selectedClient) {
      const smartDefaults = generateSmartDefaults(clientTypeId, selectedClient, updates);
      Object.assign(updates, smartDefaults);

      // Smart mission pre-selection
      const missions = getMissionsForClientType(clientTypeId);
      updates.missions_selected = getSmartMissionSelections(clientTypeId, selectedClient, missions, updates);
    } else {
      updates.missions_selected = [];
      updates.honoraires_detail = {};
    }

    onChange(updates);
  };

  // Handle contextual question changes — recalculate smart defaults
  const handleContextualChange = useCallback((field: string, value: unknown) => {
    const updates: Partial<LMWizardData> = { [field]: value };

    // Recalculate honoraires with new contextual data
    if (selectedClient && data.client_type_id) {
      const mergedWizard = { ...data, ...updates };
      const smartDefaults = generateSmartDefaults(data.client_type_id, selectedClient, mergedWizard);
      // Only update honoraires estimation, not clauses/duree/etc
      updates.honoraires_ht = smartDefaults.honoraires_ht;
      updates.honoraires_detail = smartDefaults.honoraires_detail;
      updates.honoraires_estimation_label = smartDefaults.honoraires_estimation_label;

      // Recalculate mission selections with new context
      const missions = getMissionsForClientType(data.client_type_id);
      updates.missions_selected = getSmartMissionSelections(data.client_type_id, selectedClient, missions, mergedWizard);
    }

    onChange(updates);
  }, [data, selectedClient, onChange]);

  const showModeComptable = isModeComptableApplicable(data.mission_type_id || "presentation");

  // OPT-45: pre-selected count for current type
  const preselectedCount = useMemo(
    () => data.client_type_id ? getDefaultSelectedCount(data.client_type_id) : null,
    [data.client_type_id]
  );

  // Contextual questions for the selected client type
  const contextualQuestions = useMemo(
    () => data.client_type_id ? getContextualQuestions(data.client_type_id) : [],
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

      {/* Contextual questions — adapt to client type */}
      {contextualQuestions.length > 0 && data.client_type_id && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Precisions sur la mission</p>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
            Ces informations permettent d'affiner les prestations et les honoraires.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contextualQuestions.map((q) => (
              <div key={q.id} className="space-y-1.5 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{q.label}</label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{q.description}</p>
                {q.type === 'boolean' && (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={(data as Record<string, unknown>)[q.field] === true}
                      onCheckedChange={(v) => handleContextualChange(q.field, v)}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {(data as Record<string, unknown>)[q.field] === true ? 'Oui' : 'Non'}
                    </span>
                  </div>
                )}
                {q.type === 'select' && q.options && (
                  <Select
                    value={((data as Record<string, unknown>)[q.field] as string) || ''}
                    onValueChange={(v) => handleContextualChange(q.field, v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {q.type === 'number' && (
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={((data as Record<string, unknown>)[q.field] as number) || ''}
                    onChange={(e) => handleContextualChange(q.field, e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="1"
                    className="h-9 text-xs w-24"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
