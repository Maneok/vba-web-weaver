import { FileText } from "lucide-react";
import { MANDAT_SEPA } from "../../lib/lettreMissionAnnexes";
import type { Client } from "../../lib/types";

interface MandatSepaProps {
  client: Client;
}

function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export default function MandatSepa({ client }: MandatSepaProps) {
  const rum = (MANDAT_SEPA?.rum ?? "")
    .replace("{{ref_client}}", client?.ref ?? "")
    .replace("{{annee}}", String(new Date().getFullYear()));

  return (
    <div className="border border-gray-300 rounded-lg bg-white">
      <div className="bg-[#0f172a] text-white px-6 py-4 rounded-t-lg flex items-center gap-3">
        <FileText className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{MANDAT_SEPA?.titre ?? "Mandat SEPA"}</h3>
      </div>

      <div className="p-6 space-y-6 text-sm">
        {/* RUM */}
        <div className="bg-gray-50 p-3 rounded border">
          <span className="text-gray-500 text-xs">
            Référence Unique du Mandat (RUM)
          </span>
          <p className="font-mono font-semibold text-gray-800 mt-1">{rum}</p>
        </div>

        {/* Type */}
        <div className="text-xs text-gray-500">
          Type de prélèvement :{" "}
          <strong>{MANDAT_SEPA?.typePrelevement ?? "Récurrent"}</strong>
        </div>

        {/* Créancier */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 border-b pb-1">
            Créancier
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500 text-xs">Nom du créancier</span>
              <p className="text-gray-800">{MANDAT_SEPA?.creancier?.nom ?? ""}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">ICS</span>
              <p className="font-mono text-gray-800">
                {MANDAT_SEPA?.creancier?.ics ?? ""}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 text-xs">Adresse</span>
              <p className="text-gray-800">
                {MANDAT_SEPA?.creancier?.adresse ?? ""}
              </p>
            </div>
          </div>
        </div>

        {/* Débiteur */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 border-b pb-1">
            Débiteur
          </h4>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <span className="text-gray-500 text-xs">
                Nom / Raison sociale
              </span>
              <p className="text-gray-800">{client?.raisonSociale ?? ""}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Adresse</span>
              <p className="text-gray-800">
                {client?.adresse ?? ""}, {client?.cp ?? ""} {client?.ville ?? ""}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">IBAN</span>
              <p className="font-mono text-gray-800">
                {client?.iban ? formatIban(client.iban) : "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">BIC</span>
              <p className="font-mono text-gray-800">{client?.bic || "—"}</p>
            </div>
          </div>
        </div>

        {/* Autorisation */}
        <div className="bg-gray-50 p-3 rounded border text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {MANDAT_SEPA?.texteAutorisation ?? ""}
        </div>

        {/* Zone de signature */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t">
          <div>
            <p className="text-gray-500 text-xs mb-1">Fait à :</p>
            <div className="border-b border-dashed border-gray-300 h-6" />
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Le :</p>
            <div className="border-b border-dashed border-gray-300 h-6" />
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 text-xs mb-2">
              Signature du débiteur :
            </p>
            <div className="border border-dashed border-gray-300 rounded h-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
