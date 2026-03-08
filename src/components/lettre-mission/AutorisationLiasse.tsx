import { LETTRE_MISSION_TEMPLATE } from "../../lib/lettreMissionContent";
import type { Client } from "../../lib/types";

interface AutorisationLiasseProps {
  client: Client;
  cabinetNom: string;
  associe: string;
}

export default function AutorisationLiasse({
  client,
  cabinetNom,
  associe,
}: AutorisationLiasseProps) {
  const texte = LETTRE_MISSION_TEMPLATE.autorisationLiasse.texte
    .replace(/\{\{dirigeant\}\}/g, client.dirigeant)
    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")
    .replace(/\{\{raison_sociale\}\}/g, client.raisonSociale)
    .replace(/\{\{cabinet_nom\}\}/g, cabinetNom)
    .replace(/\{\{associe\}\}/g, associe)
    .replace(/\{\{fin_exercice\}\}/g, "31/12/" + new Date().getFullYear())
    .replace(/\{\{ville\}\}/g, client.ville)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("fr-FR"));

  return (
    <div className="border rounded-lg bg-white">
      <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-sm font-semibold">
          {LETTRE_MISSION_TEMPLATE.autorisationLiasse.titre}
        </h3>
      </div>
      <div className="p-6 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
        {texte}
      </div>
    </div>
  );
}
