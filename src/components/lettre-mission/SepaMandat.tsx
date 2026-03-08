import { FileText } from "lucide-react";
import type { Client } from "../../lib/types";

interface SepaMandatProps {
  client: Client;
  cabinetNom: string;
  cabinetIcs: string;
}

function generateRum(refClient: string): string {
  const year = new Date().getFullYear();
  return `RUM-${refClient}-${year}`;
}

function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export default function SepaMandat({
  client,
  cabinetNom,
  cabinetIcs,
}: SepaMandatProps) {
  const rum = generateRum(client.ref);

  return (
    <div className="border border-gray-300 rounded-lg bg-white">
      {/* Header */}
      <div className="bg-[#0f172a] text-white px-6 py-4 rounded-t-lg flex items-center gap-3">
        <FileText className="h-5 w-5" />
        <h3 className="text-lg font-semibold">
          Mandat de prélèvement SEPA
        </h3>
      </div>

      <div className="p-6 space-y-6 text-sm">
        {/* RUM */}
        <div className="bg-gray-50 p-3 rounded border">
          <span className="text-gray-500 text-xs">
            Référence Unique du Mandat (RUM)
          </span>
          <p className="font-mono font-semibold text-gray-800 mt-1">{rum}</p>
        </div>

        {/* Créancier */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2 border-b pb-1">
            Créancier
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500 text-xs">Nom du créancier</span>
              <p className="text-gray-800">{cabinetNom}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">
                Identifiant créancier SEPA (ICS)
              </span>
              <p className="font-mono text-gray-800">{cabinetIcs}</p>
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
              <span className="text-gray-500 text-xs">Nom / Raison sociale</span>
              <p className="text-gray-800">{client.raisonSociale}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Adresse</span>
              <p className="text-gray-800">
                {client.adresse}, {client.cp} {client.ville}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">IBAN</span>
              <p className="font-mono text-gray-800">
                {client.iban ? formatIban(client.iban) : "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">BIC</span>
              <p className="font-mono text-gray-800">{client.bic || "—"}</p>
            </div>
          </div>
        </div>

        {/* Type de paiement */}
        <div className="bg-gray-50 p-3 rounded border">
          <p className="text-gray-600 text-xs">
            Type de paiement : <strong>Récurrent</strong>
          </p>
          <p className="text-gray-500 text-xs mt-1">
            En signant ce formulaire de mandat, vous autorisez{" "}
            <strong>{cabinetNom}</strong> à envoyer des instructions à votre
            banque pour débiter votre compte, et votre banque à débiter votre
            compte conformément aux instructions de{" "}
            <strong>{cabinetNom}</strong>.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Vous bénéficiez du droit d'être remboursé par votre banque selon
            les conditions décrites dans la convention que vous avez passée
            avec elle. Toute demande de remboursement doit être présentée dans
            les 8 semaines suivant la date de débit de votre compte.
          </p>
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
