import { AUTORISATION_LIASSE } from "../../lib/lettreMissionAnnexes";
import type { Client } from "../../lib/types";
import { formatDateFr } from "@/lib/dateUtils";

interface AutorisationLiasseProps {
  client: Client;
  associe: string;
}

export default function AutorisationLiasse({
  client,
  associe,
}: AutorisationLiasseProps) {
  const rawTexte = AUTORISATION_LIASSE?.texte ?? "";

  // Split to extract numbered points
  const parts = rawTexte.split(/(?=\n\n\d+\.\s)/);
  const introBlock = parts[0] ?? "";

  const replaceVars = (t: string) =>
    t
      .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
      .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")
      .replace(/\{\{raison_sociale\}\}/g, client?.raisonSociale ?? "")
      .replace(/\{\{siren\}\}/g, client?.siren ?? "")
      .replace(/\{\{adresse\}\}/g, client?.adresse ?? "")
      .replace(/\{\{cp\}\}/g, client?.cp ?? "")
      .replace(/\{\{ville\}\}/g, client?.ville ?? "")
      .replace(/\{\{cabinet_nom\}\}/g, "le cabinet")
      .replace(/\{\{associe\}\}/g, associe ?? "")
      .replace(/\{\{region_oec\}\}/g, "")
      .replace(/\{\{exercice_fin\}\}/g, "31/12/" + new Date().getFullYear())
      .replace(/\{\{fin_exercice\}\}/g, "31/12/" + new Date().getFullYear())
      .replace(/\{\{date_jour\}\}/g, formatDateFr(new Date(), "short"))
      .replace(/\{\{date\}\}/g, formatDateFr(new Date(), "short"));

  const fullTexte = replaceVars(rawTexte);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800/60 px-6 py-3">
        <h3 className="text-base font-semibold text-foreground">
          {AUTORISATION_LIASSE?.titre ?? "Autorisation"}
        </h3>
      </div>
      <div className="p-6 space-y-4">
        {/* Client info summary */}
        {(client?.raisonSociale || client?.siren) && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-border/50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {client?.dirigeant && (
              <div><span className="text-muted-foreground">Dirigeant :</span> <span className="font-medium text-foreground">{client.dirigeant}</span></div>
            )}
            {client?.raisonSociale && (
              <div><span className="text-muted-foreground">Raison sociale :</span> <span className="font-medium text-foreground">{client.raisonSociale}</span></div>
            )}
            {client?.siren && (
              <div><span className="text-muted-foreground">SIREN :</span> <span className="font-mono font-medium text-foreground">{client.siren}</span></div>
            )}
            {client?.adresse && (
              <div><span className="text-muted-foreground">Adresse :</span> <span className="font-medium text-foreground">{client.adresse} {client.cp} {client.ville}</span></div>
            )}
          </div>
        )}

        {/* Mention jedeclare.com */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30 rounded-md px-3 py-2">
          <span className="font-medium text-blue-600 dark:text-blue-400">jedeclare.com</span>
          <span>— Plateforme de télétransmission EDI-TDFC / EDI-TVA</span>
        </div>

        {/* Full text */}
        <div className="text-sm text-muted-foreground leading-[1.6] whitespace-pre-line" style={{ fontSize: "13px", textAlign: "justify" }}>
          {fullTexte}
        </div>

        {/* Signature box */}
        <div className="mt-4 rounded-lg border-2 border-dashed border-amber-400/60 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">À signer par le client</p>
          <div className="h-16 rounded border border-amber-300/40 dark:border-amber-600/30 bg-white/50 dark:bg-slate-900/30" />
        </div>
      </div>
    </div>
  );
}
