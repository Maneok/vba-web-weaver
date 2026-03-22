import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import type { VigilanceLevel, Client } from "../../lib/types";

interface KycDocument {
  id: string;
  label: string;
  requiredFor: VigilanceLevel[];
  getStatus: (client: Client) => "ok" | "missing" | "expired";
  getDetail?: (client: Client) => string | null;
}

const KYC_DOCUMENTS: KycDocument[] = [
  {
    id: "kbis",
    label: "Extrait Kbis (< 3 mois)",
    requiredFor: ["SIMPLIFIEE", "STANDARD", "RENFORCEE"],
    getStatus: (client) => (client.lienKbis ? "ok" : "missing"),
  },
  {
    id: "statuts",
    label: "Statuts à jour",
    requiredFor: ["STANDARD", "RENFORCEE"],
    getStatus: (client) => (client.lienStatuts ? "ok" : "missing"),
  },
  {
    id: "cni_dirigeant",
    label: "CNI du dirigeant",
    requiredFor: ["SIMPLIFIEE", "STANDARD", "RENFORCEE"],
    getStatus: (client) => {
      if (!client.lienCni) return "missing";
      if (client.dateExpCni) {
        const exp = new Date(client.dateExpCni);
        if (exp < new Date()) return "expired";
      }
      return "ok";
    },
    getDetail: (client) =>
      client.dateExpCni ? `Exp: ${client.dateExpCni}` : null,
  },
  {
    id: "cni_be",
    label: "CNI des bénéficiaires effectifs",
    requiredFor: ["RENFORCEE"],
    getStatus: () => "missing",
  },
  {
    id: "rib",
    label: "Relevé d'identité bancaire (RIB)",
    requiredFor: ["STANDARD", "RENFORCEE"],
    getStatus: (client) => (client.iban ? "ok" : "missing"),
  },
  {
    id: "justificatif_domicile",
    label: "Justificatif de domicile du siège (< 3 mois)",
    requiredFor: ["RENFORCEE"],
    getStatus: () => "missing",
  },
  {
    id: "organigramme",
    label: "Organigramme de la structure",
    requiredFor: ["RENFORCEE"],
    getStatus: () => "missing",
  },
  {
    id: "origine_fonds",
    label: "Justificatifs d'origine des fonds",
    requiredFor: ["RENFORCEE"],
    getStatus: () => "missing",
  },
];

interface KycChecklistProps {
  vigilanceLevel: VigilanceLevel;
  client: Client;
}

export default function KycChecklist({
  vigilanceLevel,
  client,
}: KycChecklistProps) {
  const requiredDocs = KYC_DOCUMENTS.filter((doc) =>
    doc.requiredFor.includes(vigilanceLevel)
  );

  return (
    <div className="space-y-2" role="list" aria-label="Documents KYC requis">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Documents KYC requis
      </h4>
      <div className="space-y-1.5">
        {requiredDocs.map((doc) => {
          const status = doc.getStatus(client);
          const detail = doc.getDetail?.(client);
          const statusLabel = status === "ok" ? "fourni" : status === "missing" ? "a fournir" : "expire";

          return (
            <div
              key={doc.id}
              role="listitem"
              aria-label={`${doc.label} — ${statusLabel}`}
              className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-gray-50"
            >
              {status === "ok" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              {status === "missing" && (
                <Circle className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              )}
              {status === "expired" && (
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              )}
              <span
                className={
                  status === "ok"
                    ? "text-gray-700"
                    : status === "expired"
                      ? "text-amber-700"
                      : "text-gray-600 dark:text-gray-500"
                }
              >
                {doc.label}
              </span>
              {status === "ok" && (
                <span className="text-xs text-green-600 ml-auto">
                  Auto-récupéré
                </span>
              )}
              {status === "missing" && (
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-auto">
                  À fournir
                </span>
              )}
              {status === "expired" && (
                <span className="text-xs text-amber-500 ml-auto">Expiré</span>
              )}
              {detail && (
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">({detail})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
