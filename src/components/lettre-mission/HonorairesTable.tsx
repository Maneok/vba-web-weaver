import { useMemo } from "react";
import type { MissionsConfig } from "./MissionsSelector";
import { CONTROLE_FISCAL_OPTIONS } from "../../lib/lettreMissionContent";

export interface HonorairesValues {
  honoraires: number;
  setup: number;
  honoraires_juridique: number;
  frequence: "mensuel" | "trimestriel";
}

interface HonorairesTableProps {
  values: HonorairesValues;
  onChange: (values: HonorairesValues) => void;
  missions: MissionsConfig;
}

interface LigneHonoraire {
  label: string;
  montant: number;
  suffixe: string;
  editable: boolean;
  editKey?: keyof HonorairesValues;
}

export default function HonorairesTable({
  values,
  onChange,
  missions,
}: HonorairesTableProps) {
  const montantPeriodique = useMemo(() => {
    const safeHonoraires = Math.max(0, values.honoraires || 0);
    const raw = values.frequence === "mensuel" ? safeHonoraires / 12 : safeHonoraires / 4;
    return Math.round(raw * 100) / 100;
  }, [values.honoraires, values.frequence]);

  const controleFiscalMontant = useMemo(() => {
    if (!missions.controleFiscal || !missions.controleFiscalOption) return null;
    const opt = CONTROLE_FISCAL_OPTIONS.find(
      (o) => o.id === missions.controleFiscalOption
    );
    return opt?.montant ?? null;
  }, [missions.controleFiscal, missions.controleFiscalOption]);

  function renderSection(
    titre: string,
    lignes: LigneHonoraire[],
    show: boolean
  ) {
    if (!show) return null;
    return (
      <div>
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {titre}
        </h5>
        <div className="space-y-1">
          {lignes.map((ligne) => (
            <div
              key={ligne.label}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 text-sm"
            >
              <span className="text-gray-700">{ligne.label}</span>
              <div className="flex items-center gap-1">
                {ligne.editable && ligne.editKey ? (
                  <input
                    type="number"
                    min="0"
                    value={values[ligne.editKey]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onChange({
                        ...values,
                        [ligne.editKey!]: val >= 0 ? val : 0,
                      });
                    }}
                    aria-label={`Montant ${ligne.label}`}
                    className="w-24 text-right border rounded px-2 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <span className="font-mono font-medium text-gray-800">
                    {ligne.montant.toLocaleString("fr-FR")}
                  </span>
                )}
                <span className="text-xs text-gray-500 ml-1">
                  {ligne.suffixe}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">Honoraires</h4>

      {renderSection(
        "Mission comptable",
        [
          {
            label: "Forfait annuel de tenue / surveillance",
            montant: values.honoraires,
            suffixe: "€ HT",
            editable: true,
            editKey: "honoraires",
          },
          {
            label: "Constitution du dossier permanent",
            montant: values.setup,
            suffixe: "€ HT",
            editable: true,
            editKey: "setup",
          },
          {
            label: "Honoraires expert-comptable (hors forfait)",
            montant: 200,
            suffixe: "€ HT / h",
            editable: false,
          },
          {
            label: "Honoraires collaborateur (hors forfait)",
            montant: 100,
            suffixe: "€ HT / h",
            editable: false,
          },
        ],
        true
      )}

      {renderSection(
        "Mission sociale",
        [
          {
            label: "Bulletin de paie",
            montant: 32,
            suffixe: "€ HT / bulletin",
            editable: false,
          },
          {
            label: "Fin de contrat (STC + attestations)",
            montant: 30,
            suffixe: "€ HT",
            editable: false,
          },
          {
            label: "Contrat de travail simple (CDI / CDD)",
            montant: 100,
            suffixe: "€ HT",
            editable: false,
          },
          {
            label: "Entrée salarié (DPAE + dossier)",
            montant: 30,
            suffixe: "€ HT",
            editable: false,
          },
          {
            label: "Attestation maladie / AT",
            montant: 30,
            suffixe: "€ HT",
            editable: false,
          },
        ],
        missions.sociale
      )}

      {renderSection(
        "Mission juridique annuelle",
        [
          {
            label: "Forfait annuel juridique",
            montant: values.honoraires_juridique,
            suffixe: "€ HT",
            editable: true,
            editKey: "honoraires_juridique",
          },
        ],
        missions.juridique
      )}

      {missions.controleFiscal && controleFiscalMontant !== null && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Assistance contrôle fiscal
          </h5>
          <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 text-sm">
            <span className="text-gray-700">
              {CONTROLE_FISCAL_OPTIONS.find(
                (o) => o.id === missions.controleFiscalOption
              )?.label ?? ""}
            </span>
            <span className="font-mono font-medium text-gray-800">
              {controleFiscalMontant.toLocaleString("fr-FR")}{" "}
              <span className="text-xs text-gray-500">€ HT</span>
            </span>
          </div>
        </div>
      )}

      {/* Échéancier */}
      <div className="border-t pt-3 mt-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Fréquence de paiement :</span>
          <select
            value={values.frequence}
            onChange={(e) =>
              onChange({
                ...values,
                frequence: e.target.value as "mensuel" | "trimestriel",
              })
            }
            aria-label="Frequence de paiement"
            className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
          >
            <option value="mensuel">Mensuel</option>
            <option value="trimestriel">Trimestriel</option>
          </select>
        </div>
        <div className="flex items-center justify-between text-sm bg-blue-50 p-2 rounded">
          <span className="text-blue-800 font-medium">
            Échéance {values.frequence === "mensuel" ? "mensuelle" : "trimestrielle"}
          </span>
          <span className="font-mono font-bold text-blue-900">
            {montantPeriodique.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            € HT
          </span>
        </div>
      </div>
    </div>
  );
}
