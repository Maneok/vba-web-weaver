import { useState } from "react";
import { CONTROLE_FISCAL_OPTIONS } from "../../lib/lettreMissionContent";
import type { ControleFiscalOption } from "../../lib/lettreMissionContent";

export interface MissionsConfig {
  comptable: true;
  sociale: boolean;
  juridique: boolean;
  controleFiscal: boolean;
  controleFiscalOption: ControleFiscalOption["id"] | null;
}

interface MissionsSelectorProps {
  value: MissionsConfig;
  onChange: (config: MissionsConfig) => void;
}

export default function MissionsSelector({
  value,
  onChange,
}: MissionsSelectorProps) {
  const [expanded, setExpanded] = useState(value.controleFiscal);

  function toggle(key: "sociale" | "juridique" | "controleFiscal") {
    const next = { ...value, [key]: !value[key] };
    if (key === "controleFiscal") {
      next.controleFiscalOption = !value.controleFiscal ? "A" : null;
      setExpanded(!value.controleFiscal);
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">
        Missions incluses
      </h4>

      {/* Mission comptable — toujours active */}
      <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded border border-blue-200">
        <span className="text-sm font-medium text-blue-900">
          Mission comptable
        </span>
        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
          Obligatoire
        </span>
      </div>

      {/* Toggles */}
      {(
        [
          { key: "sociale" as const, label: "Mission sociale" },
          { key: "juridique" as const, label: "Mission juridique annuelle" },
          {
            key: "controleFiscal" as const,
            label: "Assistance contrôle fiscal",
          },
        ] as const
      ).map(({ key, label }) => (
        <div key={key}>
          <label className="flex items-center justify-between py-2 px-3 rounded border hover:bg-gray-50 cursor-pointer">
            <span className="text-sm text-gray-700">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={value[key]}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                value[key] ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  value[key] ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </label>

          {/* Options contrôle fiscal */}
          {key === "controleFiscal" && expanded && value.controleFiscal && (
            <div className="ml-6 mt-2 space-y-2 border-l-2 border-blue-200 pl-4">
              {CONTROLE_FISCAL_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="controleFiscalOption"
                    checked={value.controleFiscalOption === opt.id}
                    onChange={() =>
                      onChange({ ...value, controleFiscalOption: opt.id })
                    }
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-gray-700 font-medium">
                      {opt.label}
                    </span>
                    {opt.montant !== null && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({opt.montant.toLocaleString("fr-FR")} € HT)
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
