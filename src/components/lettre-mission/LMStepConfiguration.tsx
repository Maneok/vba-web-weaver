import { useState, useEffect, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Edit3,
  Settings2,
  Briefcase,
  DollarSign,
  ChevronDown,
} from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

// ── Options des Selects ──

const REGIME_FISCAL_OPTIONS = [
  "IS Réel Simplifié",
  "IS Réel Normal",
  "IR Réel Simplifié",
  "IR Réel Normal",
  "Micro-entreprise",
];

const VOLUME_COMPTABLE_OPTIONS = [
  "Volume faible (< 20 pièces/mois)",
  "50 factures d'achats et de ventes par mois",
  "100 factures par mois",
  "Volume important (> 300 pièces/mois)",
];

const OUTIL_TRANSMISSION_OPTIONS = [
  "Idépôt",
  "Inqom",
  "Pennylane",
  "Dext",
  "Email",
  "Autre",
];

const OPTION_CONTROLE_FISCAL = ["Option A", "Option B", "Renonce"] as const;

// ── Helpers ──

function deduceFormulePolitesse(genre: "M" | "Mme" | string): string {
  if (genre === "Mme") return "Chère Madame";
  if (genre === "M") return "Cher Monsieur";
  return "Madame, Monsieur";
}

function formatMontant(value: string): string {
  const num = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const [intPart, decPart] = num.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

export default function LMStepConfiguration({ data, onChange }: Props) {
  // ── Local state for missions complémentaires ──
  const [missionSociale, setMissionSociale] = useState(true);
  const [missionJuridique, setMissionJuridique] = useState(true);
  const [missionControleFiscal, setMissionControleFiscal] = useState(false);
  const [optionControleFiscal, setOptionControleFiscal] = useState("");
  const [forceEdit, setForceEdit] = useState(false);

  // ── Honoraires local state ──
  const [forfaitAnnuel, setForfaitAnnuel] = useState(
    data.honoraires_detail?.comptabilite || ""
  );
  const [forfaitConstitution, setForfaitConstitution] = useState(
    data.honoraires_detail?.constitution || ""
  );
  const [honorairesSocial, setHonorairesSocial] = useState(
    data.honoraires_detail?.social || ""
  );
  const [honorairesJuridique, setHonorairesJuridique] = useState(
    data.honoraires_detail?.juridique || ""
  );

  // ── Pre-fill logic on mount ──
  useEffect(() => {
    const updates: Partial<LMWizardData> = {};
    const vars: Record<string, string> = { ...data.specific_variables };

    // Formule de politesse
    if (!vars.formule_politesse) {
      vars.formule_politesse = deduceFormulePolitesse(data.genre);
      updates.specific_variables = vars;
    }

    // Regime fiscal
    if (!data.regime_fiscal && data.specific_variables?.regime_fiscal) {
      updates.regime_fiscal = data.specific_variables.regime_fiscal;
    }

    // Exercice fin (date_cloture)
    if (!vars.exercice_fin && data.date_cloture) {
      vars.exercice_fin = data.date_cloture;
      updates.specific_variables = vars;
    }

    // TVA
    // (tva_assujetti is already in wizard data from step 1)

    // CAC
    // (cac is already in wizard data from step 1)

    // Outil transmission — default from specific_variables if set
    if (!vars.outil_transmission) {
      vars.outil_transmission = ""; // never pre-fill, user must choose or accept default
      updates.specific_variables = vars;
    }

    // Volume comptable — NEVER pre-fill
    // (left empty intentionally)

    // Sync mission checkboxes from existing missions_selected
    if (data.missions_selected?.length > 0) {
      setMissionSociale(
        data.missions_selected.some(
          (m) => m.section_id === "social" && m.selected
        )
      );
      setMissionJuridique(
        data.missions_selected.some(
          (m) => m.section_id === "juridique" && m.selected
        )
      );
      setMissionControleFiscal(
        data.missions_selected.some(
          (m) => m.section_id === "fiscal" && m.selected
        )
      );
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detect which auto-fill fields are complete ──
  const autoFields = useMemo(() => {
    const fields: { key: string; label: string; value: string; filled: boolean }[] = [
      {
        key: "formule_politesse",
        label: "Formule de politesse",
        value: data.specific_variables?.formule_politesse || deduceFormulePolitesse(data.genre),
        filled: true, // always deducible
      },
      {
        key: "regime_fiscal",
        label: "Régime fiscal",
        value: data.regime_fiscal,
        filled: !!data.regime_fiscal,
      },
      {
        key: "exercice_fin",
        label: "Fin d'exercice",
        value: data.specific_variables?.exercice_fin || data.date_cloture || "",
        filled: !!(data.specific_variables?.exercice_fin || data.date_cloture),
      },
      {
        key: "tva_assujetti",
        label: "Assujetti TVA",
        value: data.tva_assujetti ? "Oui" : "Non",
        filled: true, // boolean always has value
      },
      {
        key: "cac",
        label: "CAC désigné",
        value: data.cac ? "Oui" : "Non",
        filled: true,
      },
    ];
    return fields;
  }, [data.genre, data.regime_fiscal, data.date_cloture, data.tva_assujetti, data.cac, data.specific_variables]);

  const allAutoFilled = autoFields.every((f) => f.filled);
  const missingFields = autoFields.filter((f) => !f.filled);
  const showReadonly = allAutoFilled && !forceEdit;

  // ── Sync missions back to wizard data ──
  const syncMissions = (
    sociale: boolean,
    juridique: boolean,
    fiscal: boolean
  ) => {
    const existing = [...(data.missions_selected || [])];

    const ensureMission = (
      sectionId: string,
      label: string,
      selected: boolean
    ) => {
      const idx = existing.findIndex((m) => m.section_id === sectionId);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], selected };
      } else if (selected) {
        existing.push({
          section_id: sectionId,
          label,
          description: "",
          icon: "briefcase",
          selected: true,
          sous_options: [],
        });
      }
    };

    ensureMission("social", "Mission sociale", sociale);
    ensureMission("juridique", "Mission juridique", juridique);
    ensureMission("fiscal", "Assistance contrôle fiscal", fiscal);

    onChange({ missions_selected: existing });
  };

  // ── Sync honoraires to wizard data ──
  const updateHonoraires = (key: string, value: string) => {
    const detail = { ...data.honoraires_detail, [key]: value };
    // Compute total
    let total = 0;
    for (const v of Object.values(detail)) {
      const n = parseFloat(String(v).replace(/\s/g, ""));
      if (Number.isFinite(n)) total += n;
    }
    onChange({ honoraires_detail: detail, honoraires_ht: total });
  };

  return (
    <div className="space-y-8">
      {/* ── Section: Informations client ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Informations client
            </h3>
          </div>
          {allAutoFilled && !forceEdit && (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Données complètes
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForceEdit(true)}
                className="text-xs text-slate-400 hover:text-slate-600 gap-1 h-7"
              >
                <Edit3 className="w-3 h-3" /> Modifier
              </Button>
            </div>
          )}
        </div>

        {showReadonly ? (
          <div className="wizard-card p-4 space-y-2">
            {autoFields.map((f) => (
              <div key={f.key} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {f.label}
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {f.value || "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="wizard-card p-4 space-y-4">
            {/* Show only missing fields in edit mode, unless forceEdit */}
            {(forceEdit ? autoFields : missingFields).map((f) => {
              if (f.key === "regime_fiscal") {
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-slate-400 dark:text-slate-500 text-xs">
                      Régime fiscal
                    </Label>
                    <Select
                      value={data.regime_fiscal}
                      onValueChange={(v) => onChange({ regime_fiscal: v })}
                    >
                      <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white">
                        <SelectValue placeholder="Sélectionnez..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIME_FISCAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              if (f.key === "exercice_fin") {
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-slate-400 dark:text-slate-500 text-xs">
                      Fin d'exercice
                    </Label>
                    <Input
                      type="date"
                      lang="fr"
                      value={
                        data.specific_variables?.exercice_fin ||
                        data.date_cloture ||
                        ""
                      }
                      onChange={(e) =>
                        onChange({
                          specific_variables: {
                            ...data.specific_variables,
                            exercice_fin: e.target.value,
                          },
                        })
                      }
                      className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white w-48"
                    />
                  </div>
                );
              }
              if (f.key === "formule_politesse") {
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-slate-400 dark:text-slate-500 text-xs">
                      Formule de politesse
                    </Label>
                    <Input
                      value={
                        data.specific_variables?.formule_politesse ||
                        deduceFormulePolitesse(data.genre)
                      }
                      onChange={(e) =>
                        onChange({
                          specific_variables: {
                            ...data.specific_variables,
                            formule_politesse: e.target.value,
                          },
                        })
                      }
                      className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white"
                    />
                  </div>
                );
              }
              if (f.key === "tva_assujetti") {
                return (
                  <div key={f.key} className="flex items-center gap-3 py-1">
                    <Checkbox
                      id="tva_assujetti"
                      checked={data.tva_assujetti}
                      onCheckedChange={(v) =>
                        onChange({ tva_assujetti: v === true })
                      }
                    />
                    <Label
                      htmlFor="tva_assujetti"
                      className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      Assujetti à la TVA
                    </Label>
                  </div>
                );
              }
              if (f.key === "cac") {
                return (
                  <div key={f.key} className="flex items-center gap-3 py-1">
                    <Checkbox
                      id="cac_designe"
                      checked={data.cac}
                      onCheckedChange={(v) => onChange({ cac: v === true })}
                    />
                    <Label
                      htmlFor="cac_designe"
                      className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      CAC désigné
                    </Label>
                  </div>
                );
              }
              return null;
            })}
            {forceEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForceEdit(false)}
                className="text-xs text-blue-500 hover:text-blue-600 h-7"
              >
                Terminé
              </Button>
            )}
          </div>
        )}
      </section>

      {/* ── Section: Configuration mission ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Configuration mission
          </h3>
        </div>

        <div className="wizard-card p-4 space-y-4">
          {/* Volume comptable (obligatoire) */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">
              Volume comptable <span className="text-red-400">*</span>
            </Label>
            <Select
              value={data.volume_comptable}
              onValueChange={(v) => onChange({ volume_comptable: v })}
            >
              <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white">
                <SelectValue placeholder="Sélectionnez le volume comptable..." />
              </SelectTrigger>
              <SelectContent>
                {VOLUME_COMPTABLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outil de transmission */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">
              Outil de transmission
            </Label>
            <Select
              value={
                data.specific_variables?.outil_transmission || ""
              }
              onValueChange={(v) =>
                onChange({
                  specific_variables: {
                    ...data.specific_variables,
                    outil_transmission: v,
                  },
                })
              }
            >
              <SelectTrigger className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white">
                <SelectValue placeholder="Sélectionnez l'outil..." />
              </SelectTrigger>
              <SelectContent>
                {OUTIL_TRANSMISSION_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── Section: Missions complémentaires ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Missions complémentaires
          </h3>
        </div>

        <div className="wizard-card p-4 space-y-3">
          {/* Mission sociale */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="mission_sociale"
              checked={missionSociale}
              onCheckedChange={(v) => {
                const val = v === true;
                setMissionSociale(val);
                syncMissions(val, missionJuridique, missionControleFiscal);
              }}
            />
            <Label
              htmlFor="mission_sociale"
              className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              Mission sociale
            </Label>
            {missionSociale && (
              <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9px]">
                Incluse
              </Badge>
            )}
          </div>

          {/* Mission juridique */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="mission_juridique"
              checked={missionJuridique}
              onCheckedChange={(v) => {
                const val = v === true;
                setMissionJuridique(val);
                syncMissions(missionSociale, val, missionControleFiscal);
              }}
            />
            <Label
              htmlFor="mission_juridique"
              className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              Mission juridique
            </Label>
            {missionJuridique && (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px]">
                Incluse
              </Badge>
            )}
          </div>

          {/* Assistance contrôle fiscal */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="mission_controle_fiscal"
                checked={missionControleFiscal}
                onCheckedChange={(v) => {
                  const val = v === true;
                  setMissionControleFiscal(val);
                  if (!val) setOptionControleFiscal("");
                  syncMissions(missionSociale, missionJuridique, val);
                }}
              />
              <Label
                htmlFor="mission_controle_fiscal"
                className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Assistance contrôle fiscal
              </Label>
            </div>

            {/* Option A / B / Renonce */}
            {missionControleFiscal && (
              <div className="ml-7 space-y-2">
                {OPTION_CONTROLE_FISCAL.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="option_controle_fiscal"
                      value={opt}
                      checked={optionControleFiscal === opt}
                      onChange={() => {
                        setOptionControleFiscal(opt);
                        onChange({
                          specific_variables: {
                            ...data.specific_variables,
                            option_controle_fiscal: opt,
                          },
                        });
                      }}
                      className="w-3.5 h-3.5 text-blue-500 accent-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Section: Honoraires ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Honoraires
          </h3>
        </div>

        <div className="wizard-card p-4 space-y-4">
          {/* Forfait annuel comptable */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">
              Forfait annuel comptable HT <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={forfaitAnnuel}
                onChange={(e) => {
                  const v = formatMontant(e.target.value);
                  setForfaitAnnuel(v);
                  updateHonoraires("comptabilite", v);
                }}
                placeholder="Ex : 3 600"
                className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                € HT
              </span>
            </div>
          </div>

          {/* Forfait constitution dossier */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">
              Forfait constitution dossier
            </Label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={forfaitConstitution}
                onChange={(e) => {
                  const v = formatMontant(e.target.value);
                  setForfaitConstitution(v);
                  updateHonoraires("constitution", v);
                }}
                placeholder="Ex : 500"
                className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                € HT
              </span>
            </div>
          </div>

          {/* Honoraires sociaux (si mission sociale cochée) */}
          {missionSociale && (
            <div className="space-y-1.5 pl-3 border-l-2 border-teal-500/20">
              <Label className="text-teal-500 dark:text-teal-400 text-xs font-medium">
                Honoraires mission sociale
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={honorairesSocial}
                  onChange={(e) => {
                    const v = formatMontant(e.target.value);
                    setHonorairesSocial(v);
                    updateHonoraires("social", v);
                  }}
                  placeholder="Ex : 32 € / bulletin"
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  € HT
                </span>
              </div>
            </div>
          )}

          {/* Honoraires juridique (si mission juridique cochée) */}
          {missionJuridique && (
            <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/20">
              <Label className="text-amber-500 dark:text-amber-400 text-xs font-medium">
                Honoraires mission juridique
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={honorairesJuridique}
                  onChange={(e) => {
                    const v = formatMontant(e.target.value);
                    setHonorairesJuridique(v);
                    updateHonoraires("juridique", v);
                  }}
                  placeholder="Ex : 1 200"
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  € HT
                </span>
              </div>
            </div>
          )}

          {/* Total */}
          {data.honoraires_ht > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-white/[0.04] flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Total honoraires HT
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(data.honoraires_ht)}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
