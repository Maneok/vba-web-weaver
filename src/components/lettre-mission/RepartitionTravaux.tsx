import { useState } from "react";
import { REPARTITION_TRAVAUX } from "../../lib/lettreMissionAnnexes";

type Periodicite = "Mensuel" | "Trimestriel" | "Annuel" | "Semestriel" | "NA";

interface LigneRepartition {
  id: string;
  label: string;
  cabinet: boolean;
  client: boolean;
  periodicite: Periodicite;
}

interface RepartitionTravauxProps {
  value?: LigneRepartition[];
  onChange?: (lignes: LigneRepartition[]) => void;
  readOnly?: boolean;
}

const PERIODICITES: Periodicite[] = [
  "Mensuel",
  "Trimestriel",
  "Semestriel",
  "Annuel",
  "NA",
];

function getDefaultLignes(): LigneRepartition[] {
  return (REPARTITION_TRAVAUX?.lignes || []).map((l) => ({
    id: l.id,
    label: l.label,
    cabinet: l.defautCabinet,
    client: l.defautClient,
    periodicite: l.periodicite as Periodicite,
  }));
}

export default function RepartitionTravaux({
  value,
  onChange,
  readOnly = false,
}: RepartitionTravauxProps) {
  const [lignes, setLignes] = useState<LigneRepartition[]>(
    value ?? getDefaultLignes()
  );

  function update(index: number, patch: Partial<LigneRepartition>) {
    const next = lignes.map((l, i) => (i === index ? { ...l, ...patch } : l));
    setLignes(next);
    onChange?.(next);
  }

  return (
    <div className="overflow-x-auto">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        {REPARTITION_TRAVAUX?.titre ?? "Répartition des travaux"}
      </h4>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left py-2 px-3 border font-medium text-gray-700">
              Répartition des travaux
            </th>
            <th className="text-center py-2 px-3 border font-medium text-gray-700 w-20">
              Cabinet
            </th>
            <th className="text-center py-2 px-3 border font-medium text-gray-700 w-20">
              Client
            </th>
            <th className="text-center py-2 px-3 border font-medium text-gray-700 w-32">
              Périodicité
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr key={ligne.id} className="hover:bg-gray-50">
              <td className="py-1.5 px-3 border text-gray-700">
                {ligne.label}
              </td>
              <td className="text-center py-1.5 px-3 border">
                {readOnly ? (
                  ligne.cabinet ? (
                    <span className="font-semibold text-blue-700">X</span>
                  ) : null
                ) : (
                  <input
                    type="checkbox"
                    checked={ligne.cabinet}
                    onChange={(e) =>
                      update(i, { cabinet: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                )}
              </td>
              <td className="text-center py-1.5 px-3 border">
                {readOnly ? (
                  ligne.client ? (
                    <span className="font-semibold text-blue-700">X</span>
                  ) : null
                ) : (
                  <input
                    type="checkbox"
                    checked={ligne.client}
                    onChange={(e) =>
                      update(i, { client: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                )}
              </td>
              <td className="text-center py-1.5 px-3 border">
                {readOnly ? (
                  <span className="text-gray-600">{ligne.periodicite}</span>
                ) : (
                  <select
                    value={ligne.periodicite}
                    onChange={(e) =>
                      update(i, {
                        periodicite: e.target.value as Periodicite,
                      })
                    }
                    className="border rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 w-full"
                  >
                    {PERIODICITES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
