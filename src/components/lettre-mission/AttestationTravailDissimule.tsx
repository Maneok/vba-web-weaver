import { LETTRE_MISSION_TEMPLATE } from "../../lib/lettreMissionContent";
import type { Client } from "../../lib/types";

interface AttestationTravailDissimuleProps {
  client: Client;
}

export default function AttestationTravailDissimule({
  client,
}: AttestationTravailDissimuleProps) {
  const texte = LETTRE_MISSION_TEMPLATE.attestationTravailDissimule.texte
    .replace(/\{\{ville\}\}/g, client.ville)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("fr-FR"))
    .replace(/\{\{dirigeant\}\}/g, client.dirigeant)
    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal");

  return (
    <div className="border rounded-lg bg-white">
      <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-base font-semibold">
          {LETTRE_MISSION_TEMPLATE.attestationTravailDissimule.titre}
        </h3>
      </div>
      <div className="p-6 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
        {texte}
      </div>
    </div>
  );
}
