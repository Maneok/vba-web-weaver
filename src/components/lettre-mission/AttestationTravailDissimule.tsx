import { ATTESTATION_TRAVAIL_DISSIMULE } from "../../lib/lettreMissionAnnexes";
import type { Client } from "../../lib/types";
import { formatDateFr } from "@/lib/dateUtils";

interface AttestationTravailDissimuleProps {
  client: Client;
}

export default function AttestationTravailDissimule({
  client,
}: AttestationTravailDissimuleProps) {
  const texte = (ATTESTATION_TRAVAIL_DISSIMULE?.texte ?? "")
    .replace(/\{\{ville\}\}/g, client?.ville ?? "")
    .replace(/\{\{date\}\}/g, formatDateFr(new Date(), "short"))
    .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal");

  return (
    <div className="border border-slate-600 rounded-lg">
      <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg">
        <h3 className="text-base font-semibold">
          {ATTESTATION_TRAVAIL_DISSIMULE?.titre ?? "Attestation"}
        </h3>
      </div>
      <div className="p-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
        {texte}
      </div>
    </div>
  );
}
