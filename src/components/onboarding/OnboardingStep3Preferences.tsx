import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings2, ArrowLeft } from "lucide-react";

export interface PreferencesData {
  vigilanceDefaut: "STANDARD" | "RENFORCEE";
  frequenceRevue: "ANNUELLE" | "SEMESTRIELLE" | "TRIMESTRIELLE";
}

interface Step3Props {
  data: PreferencesData;
  onChange: (data: PreferencesData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function RadioOption({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? "border-blue-500/50 bg-blue-500/10"
          : "border-gray-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-white/[0.15]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? "border-blue-500" : "border-white/20"
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function OnboardingStep3Preferences({ data, onChange, onNext, onBack, onSkip }: Step3Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <Settings2 className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-semibold">Vos preferences</h2>
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">
          Ces parametres sont modifiables a tout moment
        </p>
      </div>

      {/* Vigilance level */}
      <div className="space-y-3">
        <Label className="text-sm text-slate-700 dark:text-slate-300">
          Niveau de vigilance par defaut
        </Label>
        <div className="space-y-2">
          <RadioOption
            selected={data.vigilanceDefaut === "STANDARD"}
            onClick={() => onChange({ ...data, vigilanceDefaut: "STANDARD" })}
            label="Standard"
            description="Adapte a la majorite des dossiers courants"
          />
          <RadioOption
            selected={data.vigilanceDefaut === "RENFORCEE"}
            onClick={() => onChange({ ...data, vigilanceDefaut: "RENFORCEE" })}
            label="Renforcee"
            description="Pour les cabinets traitant des secteurs a risque"
          />
        </div>
      </div>

      {/* Review frequency */}
      <div className="space-y-3">
        <Label className="text-sm text-slate-700 dark:text-slate-300">
          Frequence de revue des dossiers
        </Label>
        <div className="space-y-2">
          <RadioOption
            selected={data.frequenceRevue === "ANNUELLE"}
            onClick={() => onChange({ ...data, frequenceRevue: "ANNUELLE" })}
            label="Annuelle"
            description="Revue periodique tous les 12 mois"
          />
          <RadioOption
            selected={data.frequenceRevue === "SEMESTRIELLE"}
            onClick={() => onChange({ ...data, frequenceRevue: "SEMESTRIELLE" })}
            label="Semestrielle"
            description="Revue periodique tous les 6 mois"
          />
          <RadioOption
            selected={data.frequenceRevue === "TRIMESTRIELLE"}
            onClick={() => onChange({ ...data, frequenceRevue: "TRIMESTRIELLE" })}
            label="Trimestrielle"
            description="Revue periodique tous les 3 mois (vigilance renforcee)"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
          <button
            onClick={onSkip}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
          >
            Passer
          </button>
        </div>
        <Button onClick={onNext} className="px-6">
          Terminer la configuration
        </Button>
      </div>
    </div>
  );
}
