import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CONTROLE_FISCAL_OPTIONS } from "@/lib/lettreMissionContent";

export interface MissionsToggleState {
  sociale: boolean;
  juridique: boolean;
  controleFiscal: boolean;
  controleFiscalOption: "A" | "B" | "RENONCE" | null;
}

interface MissionsToggleProps {
  value: MissionsToggleState;
  onChange: (state: MissionsToggleState) => void;
}

export default function MissionsToggle({ value, onChange }: MissionsToggleProps) {
  const toggle = (key: "sociale" | "juridique" | "controleFiscal") => {
    const next = { ...value, [key]: !value[key] };
    if (key === "controleFiscal") {
      next.controleFiscalOption = !value.controleFiscal ? "A" : null;
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Mission comptable - always on */}
      <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Mission comptable</p>
          <p className="text-xs text-muted-foreground">Tenue / surveillance des comptes</p>
        </div>
        <Badge variant="default" className="bg-blue-600 text-[10px]">Obligatoire</Badge>
      </div>

      {/* Mission sociale */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-card/60 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Mission sociale</p>
          <p className="text-xs text-muted-foreground">Paie, DSN, gestion du personnel</p>
        </div>
        <Switch checked={value.sociale} onCheckedChange={() => toggle("sociale")} />
      </div>

      {/* Mission juridique */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-card/60 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Mission juridique annuelle</p>
          <p className="text-xs text-muted-foreground">AG, PV, depot des comptes</p>
        </div>
        <Switch checked={value.juridique} onCheckedChange={() => toggle("juridique")} />
      </div>

      {/* Controle fiscal */}
      <div className="rounded-lg border border-white/10 bg-card/60 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Assistance controle fiscal</p>
            <p className="text-xs text-muted-foreground">Accompagnement en cas de verification</p>
          </div>
          <Switch checked={value.controleFiscal} onCheckedChange={() => toggle("controleFiscal")} />
        </div>

        {value.controleFiscal && (
          <div className="ml-4 pl-4 border-l-2 border-blue-500/30 space-y-2">
            {CONTROLE_FISCAL_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-white/[0.03] transition-colors"
              >
                <input
                  type="radio"
                  name="controleFiscalOption"
                  checked={value.controleFiscalOption === opt.id}
                  onChange={() => onChange({ ...value, controleFiscalOption: opt.id })}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{opt.label}</span>
                  {opt.montant !== null && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({opt.montant.toLocaleString("fr-FR")} EUR HT)
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
