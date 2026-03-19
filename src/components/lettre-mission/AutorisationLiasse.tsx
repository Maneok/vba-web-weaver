import { AUTORISATION_LIASSE } from "../../lib/lettreMissionAnnexes";
import type { Client } from "../../lib/types";

interface AutorisationLiasseProps {
  client: Client;
  associe: string;
}

export default function AutorisationLiasse({
  client,
  associe,
}: AutorisationLiasseProps) {
  const texte = (AUTORISATION_LIASSE?.texte ?? "")
    .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")
    .replace(/\{\{raison_sociale\}\}/g, client?.raisonSociale ?? "")
    .replace(/\{\{siren\}\}/g, client?.siren ?? "")
    .replace(/\{\{adresse\}\}/g, client?.adresse ?? "")
    .replace(/\{\{cp\}\}/g, client?.cp ?? "")
    .replace(/\{\{cabinet_nom\}\}/g, "le cabinet")
    .replace(/\{\{associe\}\}/g, associe ?? "")
    .replace(/\{\{fin_exercice\}\}/g, "31/12/" + new Date().getFullYear())
    .replace(/\{\{ville\}\}/g, client?.ville ?? "")
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("fr-FR"));

  return (
    <div className="border border-slate-600 rounded-lg">
      <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-sm font-semibold">
          {AUTORISATION_LIASSE?.titre ?? "Autorisation"}
        </h3>
      </div>
      <div className="p-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
        {texte}
      </div>
    </div>
  );
}
