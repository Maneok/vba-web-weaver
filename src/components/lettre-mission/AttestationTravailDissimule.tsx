import { CheckCircle2 } from "lucide-react";
import { ATTESTATION_TRAVAIL_DISSIMULE } from "../../lib/lettreMissionAnnexes";
import type { Client } from "../../lib/types";
import { formatDateFr } from "@/lib/dateUtils";

interface AttestationTravailDissimuleProps {
  client: Client;
}

export default function AttestationTravailDissimule({
  client,
}: AttestationTravailDissimuleProps) {
  const rawTexte = ATTESTATION_TRAVAIL_DISSIMULE?.texte ?? "";

  // Split at numbered points (1. 2. 3. 4.) to extract structured sections
  const parts = rawTexte.split(/(?=\n\n\d+\.\s)/);
  const introTexte = (parts[0] ?? "")
    .replace(/\{\{ville\}\}/g, client?.ville ?? "")
    .replace(/\{\{date\}\}/g, formatDateFr(new Date(), "short"))
    .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")
    .replace(/\{\{date_jour\}\}/g, formatDateFr(new Date(), "short"));

  // Extract the closing paragraph (starts with "Le client reconnaît") and signature block
  const closingIdx = rawTexte.indexOf("Le client reconnaît");
  const closingTexte = closingIdx >= 0
    ? rawTexte.substring(closingIdx)
        .replace(/\{\{ville\}\}/g, client?.ville ?? "")
        .replace(/\{\{date_jour\}\}/g, formatDateFr(new Date(), "short"))
        .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
        .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")
    : "";

  // Extract the numbered attestation points
  const pointsRaw = rawTexte.substring(parts[0]?.length ?? 0, closingIdx >= 0 ? closingIdx : undefined);
  const points = pointsRaw.split(/\n\n(?=\d+\.\s)/).filter(p => p.trim());

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800/60 px-6 py-3">
        <h3 className="text-base font-semibold text-foreground">
          {ATTESTATION_TRAVAIL_DISSIMULE?.titre ?? "Attestation"}
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

        {/* Intro text */}
        <div className="text-sm text-muted-foreground leading-[1.6] whitespace-pre-line" style={{ fontSize: "13px", textAlign: "justify" }}>
          {introTexte}
        </div>

        {/* Numbered attestation points with green check icons */}
        {points.length > 0 && (
          <div className="space-y-3">
            {points.map((point, idx) => (
              <div key={idx} className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground leading-[1.6] whitespace-pre-line" style={{ fontSize: "13px", textAlign: "justify" }}>
                  {point.trim()
                    .replace(/\{\{ville\}\}/g, client?.ville ?? "")
                    .replace(/\{\{date_jour\}\}/g, formatDateFr(new Date(), "short"))
                    .replace(/\{\{dirigeant\}\}/g, client?.dirigeant ?? "")
                    .replace(/\{\{qualite_dirigeant\}\}/g, "Représentant légal")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Closing paragraph */}
        {closingTexte && (
          <div className="text-sm text-muted-foreground leading-[1.6] whitespace-pre-line" style={{ fontSize: "13px", textAlign: "justify" }}>
            {closingTexte}
          </div>
        )}

        {/* Signature box */}
        <div className="mt-4 rounded-lg border-2 border-dashed border-amber-400/60 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">À signer par le client</p>
          <div className="h-16 rounded border border-amber-300/40 dark:border-amber-600/30 bg-white/50 dark:bg-slate-900/30" />
        </div>
      </div>
    </div>
  );
}
