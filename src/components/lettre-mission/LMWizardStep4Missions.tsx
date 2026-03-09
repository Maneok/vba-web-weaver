import { useEffect } from "react";
import type { LMWizardData, MissionSelection } from "@/lib/lmWizardTypes";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Lock, Calculator, Landmark, Users, Scale, ShieldCheck, FileWarning, Lightbulb, ChevronDown } from "lucide-react";

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

const SECTION_ICONS: Record<string, React.ReactNode> = {
  comptabilite: <Calculator className="w-4 h-4" />,
  fiscal: <Landmark className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  juridique: <Scale className="w-4 h-4" />,
  lcbft: <ShieldCheck className="w-4 h-4" />,
  travail_dissimule: <FileWarning className="w-4 h-4" />,
  conseil: <Lightbulb className="w-4 h-4" />,
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  comptabilite: "Saisie, rapprochement, bilan, liasse fiscale",
  fiscal: "TVA, IS/IR, CFE, DAS2",
  social: "Paie, DSN, contrats de travail",
  juridique: "PV d'AG, approbation, modifications",
  lcbft: "KYC, vigilance, declaration Tracfin",
  travail_dissimule: "Attestation de vigilance",
  conseil: "Gestion, previsionnel, tableau de bord",
};

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
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Missions a inclure</h2>
          <p className="text-sm text-slate-500">Selectionnez les prestations couvertes par la lettre</p>
        </div>
        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 self-start">
          {totalSelected} sections — {totalSubSelected} prestations
        </Badge>
      </div>

      <div className="space-y-3">
        {missions.map((mission) => {
          const isLocked = LOCKED_SECTIONS.includes(mission.section_id);
          const icon = SECTION_ICONS[mission.section_id];
          const desc = SECTION_DESCRIPTIONS[mission.section_id];
          const subCount = mission.sous_options.filter((s) => s.selected).length;

          return (
            <div
              key={mission.section_id}
              className={`rounded-xl border transition-all duration-200 ${
                mission.selected
                  ? "bg-white/[0.04] border-white/[0.1]"
                  : "bg-white/[0.01] border-white/[0.04]"
              }`}
            >
              {/* Section header — clickable card */}
              <button
                type="button"
                onClick={() => toggleSection(mission.section_id)}
                disabled={isLocked}
                className={`w-full flex items-center gap-3 p-3 sm:p-4 text-left ${
                  isLocked ? "cursor-default" : "cursor-pointer active:bg-white/[0.02]"
                }`}
              >
                {/* Icon container */}
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  mission.selected
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-white/[0.04] text-slate-500"
                }`}>
                  {icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${mission.selected ? "text-white" : "text-slate-500"}`}>
                    {mission.label}
                  </p>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{desc}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isLocked && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 gap-1 hidden sm:flex">
                      <Lock className="w-3 h-3" /> Obligatoire
                    </Badge>
                  )}
                  {isLocked && (
                    <Lock className="w-3.5 h-3.5 text-amber-400 sm:hidden" />
                  )}
                  {mission.selected && !isLocked && (
                    <span className="text-[10px] text-slate-500">{subCount}/{mission.sous_options.length}</span>
                  )}
                  <Switch
                    checked={mission.selected}
                    onCheckedChange={() => toggleSection(mission.section_id)}
                    disabled={isLocked}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {mission.selected && (
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200`} />
                  )}
                </div>
              </button>

              {/* Sub-options — animated expand */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  mission.selected ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 space-y-1 border-t border-white/[0.04]">
                  {mission.sous_options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-2 sm:p-2.5 rounded-lg transition-colors ${
                        isLocked ? "cursor-default opacity-70" : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]"
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
