import { useMemo } from "react";
import type { Client } from "@/lib/types";
import type { CabinetConfig, LettreMissionTemplate, LettreMissionOptions } from "@/types/lettreMission";
import { DEFAULT_LM_OPTIONS } from "@/types/lettreMission";
import { generateLettreMission, renderToPdf, renderToDocx } from "@/lib/lettreMissionEngine";
import { Button } from "@/components/ui/button";
import { FileDown, FileText } from "lucide-react";

interface LettreMissionPreviewProps {
  client: Client;
  template: LettreMissionTemplate;
  cabinetConfig: CabinetConfig;
  options?: LettreMissionOptions;
}

export default function LettreMissionPreview({
  client,
  template,
  cabinetConfig,
  options = DEFAULT_LM_OPTIONS,
}: LettreMissionPreviewProps) {
  const lettreMission = useMemo(
    () => generateLettreMission(client, template, cabinetConfig, options),
    [client, template, cabinetConfig, options]
  );

  const sortedBlocs = useMemo(
    () => [...lettreMission.blocs].filter((b) => b.visible).sort((a, b) => a.ordre - b.ordre),
    [lettreMission.blocs]
  );

  const handleExportPdf = () => renderToPdf(lettreMission);
  const handleExportDocx = () => renderToDocx(lettreMission);

  const total = (client.honoraires ?? 0) + (client.reprise ?? 0) + (client.juridique ?? 0);
  const primaryColor = cabinetConfig.couleurPrimaire;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b print:hidden">
        <div className="text-sm text-slate-500">
          Prévisualisation — {lettreMission.numero}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportPdf} aria-label="Exporter la lettre de mission en PDF">
            <FileDown className="h-4 w-4 mr-1" />
            Exporter PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportDocx} aria-label="Exporter la lettre de mission en DOCX">
            <FileText className="h-4 w-4 mr-1" />
            Exporter DOCX
          </Button>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto bg-slate-200 p-4 print:bg-white print:p-0">
        <div
          className="mx-auto bg-white shadow-lg print:shadow-none"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "25mm",
            fontFamily: cabinetConfig.police || "system-ui",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between pb-4 mb-6"
            style={{ borderBottom: `2px solid ${primaryColor}` }}
          >
            <div className="flex items-center gap-4">
              {cabinetConfig.logo && (
                <img
                  src={cabinetConfig.logo}
                  alt="Logo"
                  className="h-12 w-auto"
                />
              )}
              <div>
                <div className="font-bold text-lg" style={{ color: primaryColor }}>
                  {cabinetConfig.nom}
                </div>
                <div className="text-xs text-gray-500">
                  {cabinetConfig.adresse}, {cabinetConfig.cp} {cabinetConfig.ville}
                </div>
                <div className="text-xs text-gray-500">
                  SIRET : {cabinetConfig.siret} — OEC : {cabinetConfig.numeroOEC}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>{cabinetConfig.email}</div>
              <div>{cabinetConfig.telephone}</div>
            </div>
          </div>

          {/* Title */}
          <h1
            className="text-2xl font-bold text-center mb-2"
            style={{ color: primaryColor }}
          >
            LETTRE DE MISSION
          </h1>
          <div className="text-right text-sm text-gray-500 mb-1">
            Réf. {lettreMission.numero}
          </div>
          <div className="text-right text-sm mb-8">
            {cabinetConfig.ville}, le {lettreMission.date}
          </div>

          {/* Blocs */}
          {sortedBlocs.map((bloc, idx) => {
            let sectionNum = idx + 1;

            if (bloc.type === "identification") {
              return (
                <div key={bloc.id} className="mb-6">
                  <SectionTitle num={sectionNum} title="Identification du client" color={primaryColor} />
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-1">
                    <Field label="Raison sociale" value={client.raisonSociale} />
                    <Field label="Forme juridique" value={`${client.forme} — Capital : ${client.capital?.toLocaleString("fr-FR") ?? "N/C"} €`} />
                    <Field label="SIREN" value={client.siren} />
                    <Field label="Adresse" value={`${client.adresse}, ${client.cp} ${client.ville}`} />
                    <Field label="Dirigeant" value={client.dirigeant} />
                    <Field label="Activité" value={`${client.domaine} (APE ${client.ape})`} />
                  </div>
                </div>
              );
            }

            if (bloc.type === "honoraires") {
              return (
                <div key={bloc.id} className="mb-6">
                  <SectionTitle num={sectionNum} title="Honoraires" color={primaryColor} />
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: primaryColor }}>
                        <th className="text-left text-white p-2 font-medium">Désignation</th>
                        <th className="text-right text-white p-2 font-medium">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Mission comptable", client.honoraires],
                        ["Reprise comptable", client.reprise],
                        ["Mission juridique", client.juridique],
                      ].map(([label, amount], i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                          <td className="p-2">{label as string}</td>
                          <td className="p-2 text-right">
                            {((amount as number) ?? 0).toLocaleString("fr-FR")} €
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-2">TOTAL HT</td>
                        <td className="p-2 text-right">{total.toLocaleString("fr-FR")} €</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="text-xs text-gray-500 text-right mt-1">
                    Total TTC (TVA 20%) : {(total * 1.2).toLocaleString("fr-FR")} € — Fréquence : {client.frequence}
                  </div>
                </div>
              );
            }

            if (bloc.type === "lcbft") {
              const vigColors: Record<string, string> = {
                SIMPLIFIEE: "#4CAF50",
                STANDARD: "#FF9800",
                RENFORCEE: "#F44336",
              };
              return (
                <div key={bloc.id} className="mb-6">
                  <SectionTitle num={sectionNum} title="Obligations LCB-FT" color={primaryColor} />
                  <div className="bg-slate-800 text-white rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">🔒</span>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: vigColors[client.nivVigilance] ?? "#888" }}
                      >
                        Vigilance {client.nivVigilance.charAt(0) + client.nivVigilance.slice(1).toLowerCase()}
                      </span>
                      <span className="text-sm text-slate-300">
                        Score de risque : {client.scoreGlobal}/100
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {bloc.contenuRendu}
                    </p>
                  </div>
                </div>
              );
            }

            if (bloc.type === "kyc") {
              const checks: [string, boolean][] = [
                ["Pièce d'identité du dirigeant en cours de validité", client.dateExpCni ? new Date(client.dateExpCni) > new Date() : false],
                ["Extrait Kbis / Inscription RCS", !!client.lienKbis],
                ["Statuts à jour", !!client.lienStatuts],
                ["Bénéficiaires effectifs identifiés", !!client.be],
                ["Justificatif de domicile / siège social", !!client.adresse],
                ["Attestation de vigilance", client.etat === "VALIDE"],
              ];
              return (
                <div key={bloc.id} className="mb-6">
                  <SectionTitle num={sectionNum} title="Pièces justificatives (KYC)" color={primaryColor} />
                  <div className="space-y-2">
                    {checks.map(([label, done], i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                            done ? "bg-green-100 border-green-500 text-green-700" : "border-gray-300"
                          }`}
                        >
                          {done && "✓"}
                        </div>
                        <span className={done ? "" : "text-gray-500"}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (bloc.type === "signature") {
              return (
                <div key={bloc.id} className="mb-6">
                  <SectionTitle num={sectionNum} title="Signatures" color={primaryColor} />
                  <p className="text-sm mb-2">
                    Fait en deux exemplaires originaux, à {cabinetConfig.ville}
                  </p>
                  <div className="grid grid-cols-2 gap-8 mt-6">
                    <div>
                      <div className="font-bold text-sm mb-1">Pour le cabinet</div>
                      <div className="text-xs text-gray-500">{cabinetConfig.nom}</div>
                      <div className="text-xs text-gray-500">{client.associe} — Associé signataire</div>
                      <div className="mt-8 border-b border-black w-40" />
                      <div className="text-xs text-gray-400 mt-1">Signature et cachet</div>
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-1">Pour le client</div>
                      <div className="text-xs text-gray-500">{client.raisonSociale}</div>
                      <div className="text-xs text-gray-500">{client.dirigeant} — Gérant / Président</div>
                      <div className="mt-8 border-b border-black w-40" />
                      <div className="text-xs text-gray-400 mt-1">Signature et cachet</div>
                    </div>
                  </div>
                </div>
              );
            }

            if (bloc.type === "sepa" && client.iban) {
              return (
                <div key={bloc.id} className="mb-6 mt-12 pt-6 border-t-2">
                  <h2
                    className="text-lg font-bold text-center mb-6"
                    style={{ color: primaryColor }}
                  >
                    ANNEXE — MANDAT DE PRÉLÈVEMENT SEPA
                  </h2>
                  <div className="bg-gray-50 border rounded-lg p-6 text-sm space-y-2">
                    <Field label="Créancier" value={cabinetConfig.nom} />
                    <Field label="SIRET créancier" value={cabinetConfig.siret} />
                    <Field label="Débiteur" value={client.raisonSociale} />
                    <Field label="IBAN" value={client.iban.replace(/(.{4})/g, "$1 ").trim()} />
                    <Field label="BIC" value={client.bic} />
                    <Field label="Référence unique de mandat" value={`SEPA-${client.ref}`} />
                    <Field label="Type de paiement" value="Récurrent" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-8">
                    <div>
                      <div className="text-sm">Date : ____________________</div>
                    </div>
                    <div>
                      <div className="text-sm">Signature du débiteur :</div>
                      <div className="mt-8 border-b border-black w-40" />
                    </div>
                  </div>
                </div>
              );
            }

            // Generic text bloc (resiliation, rgpd, juridiction, custom, paiement)
            return (
              <div key={bloc.id} className="mb-6">
                <SectionTitle num={sectionNum} title={bloc.titre} color={primaryColor} />
                <div className="text-sm leading-relaxed whitespace-pre-line">
                  {bloc.contenuRendu}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="mt-12 pt-3 border-t border-gray-300 text-center text-xs text-gray-400">
            {cabinetConfig.nom} — Membre de l'Ordre des Experts-Comptables — SIRET {cabinetConfig.siret}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ num, title, color }: { num: number; title: string; color: string }) {
  return (
    <div
      className="text-white text-sm font-bold px-3 py-1.5 rounded mb-3"
      style={{ backgroundColor: color }}
    >
      {num}. {title}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-gray-700 min-w-[140px]">{label} :</span>
      <span>{value}</span>
    </div>
  );
}
