import { useEffect } from "react";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
}

const DEFAULT_MISSIONS: MissionSelection[] = [
  {
    section_id: "comptabilite",
    label: "Tenue et presentation des comptes",
    selected: true,
    sous_options: [
      { id: "saisie", label: "Saisie des ecritures comptables", selected: true },
      { id: "rapprochement", label: "Rapprochement bancaire", selected: true },
      { id: "revision", label: "Revision des comptes", selected: true },
      { id: "bilan", label: "Etablissement du bilan et compte de resultat", selected: true },
      { id: "liasse", label: "Etablissement de la liasse fiscale", selected: true },
    ],
  },
  {
    section_id: "fiscal",
    label: "Missions fiscales",
    selected: true,
    sous_options: [
      { id: "tva", label: "Declarations de TVA", selected: true },
      { id: "is", label: "Declaration d'IS / IR", selected: true },
      { id: "cfe", label: "CFE / CVAE", selected: false },
      { id: "das2", label: "DAS2 — Declaration des honoraires", selected: false },
    ],
  },
  {
    section_id: "social",
    label: "Missions sociales",
    selected: false,
    sous_options: [
      { id: "paie", label: "Etablissement des bulletins de paie", selected: false },
      { id: "dsn", label: "Declarations sociales (DSN)", selected: false },
      { id: "contrats", label: "Redaction des contrats de travail", selected: false },
      { id: "solde", label: "Solde de tout compte", selected: false },
    ],
  },
  {
    section_id: "juridique",
    label: "Missions juridiques",
    selected: false,
    sous_options: [
      { id: "ag", label: "Redaction PV d'AG", selected: false },
      { id: "approbation", label: "Approbation des comptes", selected: false },
      { id: "modifications", label: "Modifications statutaires", selected: false },
    ],
  },
  {
    section_id: "lcbft",
    label: "Obligations LCB-FT",
    selected: true,
    sous_options: [
      { id: "kyc", label: "Identification et verification du client", selected: true },
      { id: "vigilance", label: "Mesures de vigilance", selected: true },
      { id: "declaration", label: "Declaration de soupcon (Tracfin)", selected: true },
    ],
  },
  {
    section_id: "travail_dissimule",
    label: "Attestation travail dissimule",
    selected: true,
    sous_options: [
      { id: "attestation_td", label: "Attestation de vigilance travail dissimule", selected: true },
    ],
  },
  {
    section_id: "conseil",
    label: "Conseil et accompagnement",
    selected: false,
    sous_options: [
      { id: "gestion", label: "Conseil en gestion", selected: false },
      { id: "previsionnel", label: "Budget previsionnel", selected: false },
      { id: "tableau_bord", label: "Tableau de bord periodique", selected: false },
    ],
  },
];

const LOCKED_SECTIONS = ["lcbft", "travail_dissimule"];

export default function LMWizardStep4Missions({ data, onChange }: Props) {
  // Initialize missions if empty
  useEffect(() => {
    if (data.missions_selected.length === 0) {
      onChange({ missions_selected: DEFAULT_MISSIONS });
    }
  }, []);

  const missions = data.missions_selected.length > 0 ? data.missions_selected : DEFAULT_MISSIONS;

  const toggleSection = (sectionId: string) => {
    if (LOCKED_SECTIONS.includes(sectionId)) return;
    const updated = missions.map((m) =>
      m.section_id === sectionId
        ? {
            ...m,
            selected: !m.selected,
            sous_options: m.sous_options.map((s) => ({ ...s, selected: !m.selected })),
          }
        : m
    );
    onChange({ missions_selected: updated });
  };

  const toggleSubOption = (sectionId: string, optionId: string) => {
    if (LOCKED_SECTIONS.includes(sectionId)) return;
    const updated = missions.map((m) =>
      m.section_id === sectionId
        ? {
            ...m,
            sous_options: m.sous_options.map((s) =>
              s.id === optionId ? { ...s, selected: !s.selected } : s
            ),
          }
        : m
    );
    onChange({ missions_selected: updated });
  };

  const totalSelected = missions.filter((m) => m.selected).length;
  const totalSubSelected = missions.reduce(
    (acc, m) => acc + m.sous_options.filter((s) => s.selected).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Missions a inclure</h2>
          <p className="text-sm text-slate-500">Selectionnez les prestations couvertes par la lettre</p>
        </div>
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {totalSelected} sections — {totalSubSelected} prestations
        </Badge>
      </div>

      <div className="space-y-3">
        {missions.map((mission) => {
          const isLocked = LOCKED_SECTIONS.includes(mission.section_id);
          return (
            <div
              key={mission.section_id}
              className={`rounded-xl border transition-all duration-200 ${
                mission.selected
                  ? "bg-white/[0.04] border-white/[0.1]"
                  : "bg-white/[0.01] border-white/[0.04]"
              }`}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 p-4">
                <Switch
                  checked={mission.selected}
                  onCheckedChange={() => toggleSection(mission.section_id)}
                  disabled={isLocked}
                />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${mission.selected ? "text-white" : "text-slate-500"}`}>
                    {mission.label}
                  </p>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 gap-1">
                    <Lock className="w-3 h-3" /> Obligatoire
                  </Badge>
                )}
              </div>

              {/* Sub-options */}
              {mission.selected && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/[0.04]">
                  {mission.sous_options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                        isLocked ? "cursor-default opacity-70" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <Checkbox
                        checked={opt.selected}
                        onCheckedChange={() => toggleSubOption(mission.section_id, opt.id)}
                        disabled={isLocked}
                      />
                      <span className={`text-sm ${opt.selected ? "text-slate-300" : "text-slate-500"}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
