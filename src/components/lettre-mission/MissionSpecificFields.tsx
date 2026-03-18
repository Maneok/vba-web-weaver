import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { Info } from "lucide-react";

interface Props {
  missionType: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// Choix fermés pour certains champs spécifiques
const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  niveau_assurance: [
    { value: "Assurance raisonnable", label: "Assurance raisonnable" },
    { value: "Assurance modérée", label: "Assurance modérée" },
  ],
  type_diffusion: [
    { value: "Générale", label: "Générale" },
    { value: "Restreinte", label: "Restreinte" },
  ],
  nature_hypotheses: [
    { value: "Estimations les plus plausibles", label: "Estimations les plus plausibles" },
    { value: "Hypothèses théoriques", label: "Hypothèses théoriques" },
  ],
  participation_elaboration: [
    { value: "Le responsable de mission a participé à l'élaboration", label: "A participé à l'élaboration" },
    { value: "Le responsable de mission n'a pas participé à l'élaboration", label: "N'a pas participé à l'élaboration" },
  ],
};

function isDateField(placeholder: string): boolean {
  const lp = placeholder.toLowerCase();
  return lp.includes("jj/mm/aaaa") || lp.includes("date") || (lp.includes("début") && lp.includes("période")) || (lp.includes("fin") && lp.includes("période"));
}

function isTextareaField(label: string, placeholder: string): boolean {
  const ll = label.toLowerCase();
  return ll.includes("détail") || ll.includes("description") || ll.includes("nature des travaux") || placeholder.length > 80;
}

export default function MissionSpecificFields({ missionType, values, onChange }: Props) {
  const config = getMissionTypeConfig(missionType);

  if (config.specificVariables.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Paramètres spécifiques — {config.shortLabel}
        </p>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Ces informations seront injectées dans le corps de la lettre de mission ({config.normeRef}).
      </p>
      <div className="space-y-3">
        {config.specificVariables.map((sv) => {
          const selectOpts = SELECT_OPTIONS[sv.key];

          return (
            <div key={sv.key} className="space-y-1.5">
              <Label className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{sv.label}</Label>

              {/* Select for closed-choice fields */}
              {selectOpts ? (
                <Select
                  value={values[sv.key] || ""}
                  onValueChange={(v) => onChange(sv.key, v)}
                >
                  <SelectTrigger className="h-10 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white text-sm">
                    <SelectValue placeholder={sv.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectOpts.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isDateField(sv.placeholder) ? (
                <Input
                  type="date"
                  value={values[sv.key] || ""}
                  onChange={(e) => onChange(sv.key, e.target.value)}
                  className="h-10 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white text-sm"
                />
              ) : isTextareaField(sv.label, sv.placeholder) ? (
                <Textarea
                  value={values[sv.key] || ""}
                  onChange={(e) => onChange(sv.key, e.target.value)}
                  placeholder={sv.placeholder}
                  rows={3}
                  className="bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-300 dark:text-slate-600 text-sm resize-none"
                />
              ) : (
                <Input
                  value={values[sv.key] || ""}
                  onChange={(e) => onChange(sv.key, e.target.value)}
                  placeholder={sv.placeholder}
                  className="h-10 bg-gray-50/80 dark:bg-white/[0.04] border-gray-300 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-300 dark:text-slate-600 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Examen limité — rappel spécifique */}
      {missionType === "examen_limite" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mt-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-300/80">
            L'examen limité ne comporte pas l'appréciation des procédures de contrôle interne.
            Son objectif est d'obtenir une assurance modérée, niveau inférieur à celui d'un audit.
          </p>
        </div>
      )}

      {/* Audit contractuel — déclarations écrites ISA 580 */}
      {missionType === "audit_contractuel" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 mt-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/80">
            Conformément à la norme ISA 580, le client s'engage à fournir des déclarations écrites
            confirmant les informations communiquées à l'équipe d'audit.
          </p>
        </div>
      )}
    </div>
  );
}
