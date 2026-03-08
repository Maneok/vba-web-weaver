import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Maximize2, Minimize2 } from "lucide-react";
import { loadCabinetConfig } from "./CabinetConfigForm";
import type { LettreMissionData } from "./LettreMissionEditor";

interface LettreMissionPreviewV2Props {
  data: LettreMissionData;
  activeSectionId?: string | null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function LettreMissionPreviewV2({ data, activeSectionId }: LettreMissionPreviewV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [fullscreen, setFullscreen] = useState(false);

  const config = loadCabinetConfig();

  // Scroll sync
  useEffect(() => {
    if (activeSectionId && sectionRefs.current[activeSectionId]) {
      sectionRefs.current[activeSectionId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [activeSectionId]);

  const vigilanceColor =
    data.nivVigilance === "RENFORCEE" ? "#dc2626" :
    data.nivVigilance === "SIMPLIFIEE" ? "#16a34a" : "#2563eb";

  return (
    <div className={`relative ${fullscreen ? "fixed inset-0 z-50 bg-slate-900/95 p-8 overflow-auto" : "h-full overflow-y-auto"}`} ref={containerRef}>
      {/* Fullscreen toggle */}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 backdrop-blur"
        onClick={() => setFullscreen(!fullscreen)}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>

      {/* Paper */}
      <div
        className={`bg-white text-gray-800 shadow-2xl border border-gray-200 mx-auto ${fullscreen ? "max-w-[800px]" : ""}`}
        style={{
          fontFamily: `"${config.police || "Times New Roman"}", serif`,
          padding: "48px 56px",
          minHeight: fullscreen ? "auto" : "900px",
          fontSize: "12px",
          lineHeight: "1.7",
        }}
      >
        {/* Header */}
        <div ref={(el) => { sectionRefs.current["entete"] = el; }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              {config.logo && (
                <img src={config.logo} alt="Logo" className="h-14 w-14 object-contain" />
              )}
              <div>
                <h2 className="text-base font-bold" style={{ color: config.couleurPrimaire }}>
                  {config.nom || "Cabinet d'Expertise Comptable"}
                </h2>
                <p className="text-[11px] text-gray-500">
                  {config.adresse && `${config.adresse}, `}{config.cp} {config.ville}
                </p>
                <p className="text-[11px] text-gray-500">
                  {config.email}{config.telephone && ` — ${config.telephone}`}
                </p>
                {config.siret && (
                  <p className="text-[10px] text-gray-400">
                    SIRET : {config.siret} | N° OEC : {config.numeroOec}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="h-[2px] w-full mb-6" style={{ background: `linear-gradient(to right, ${config.couleurPrimaire}, ${config.couleurSecondaire || "#94a3b8"})` }} />

          {/* Lieu et date */}
          <p className="text-right text-[11px] text-gray-500 mb-6">
            {data.lieuLettre && `${data.lieuLettre}, `}
            {data.dateLettre ? `le ${formatDate(data.dateLettre)}` : ""}
          </p>

          {/* Destinataire */}
          {data.destinataireNom && (
            <div className="mb-8 ml-auto" style={{ maxWidth: "260px" }}>
              <p className="font-semibold">{data.destinataireNom}</p>
              {data.destinataireAdresse && <p className="text-[11px]">{data.destinataireAdresse}</p>}
              {data.destinataireCpVille && <p className="text-[11px]">{data.destinataireCpVille}</p>}
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-center text-lg font-bold uppercase tracking-wider mb-6" style={{ color: config.couleurPrimaire }}>
          Lettre de Mission
        </h1>

        {/* Introduction */}
        {data.introduction && (
          <div ref={(el) => { sectionRefs.current["introduction"] = el; }} className="mb-6">
            <p>{data.introduction}</p>
          </div>
        )}

        {/* Entite */}
        {data.raisonSociale && (
          <div ref={(el) => { sectionRefs.current["entite"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Votre entite
            </h3>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                {([
                  ["Raison sociale", data.raisonSociale],
                  ["Forme juridique", data.formeJuridique],
                  ["SIREN", data.siren],
                  data.capital ? ["Capital social", `${data.capital} EUR`] : null,
                  ["Adresse", `${data.adresse}${data.cpVille ? `, ${data.cpVille}` : ""}`],
                  data.ape ? ["Code APE", data.ape] : null,
                  ["Dirigeant", data.dirigeant],
                  data.effectif ? ["Effectif", `${data.effectif} salaries`] : null,
                  data.domaine ? ["Domaine d'activite", data.domaine] : null,
                ].filter(Boolean) as [string, string][]).map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100">
                    <td className="py-1 pr-4 text-gray-500 w-36">{label}</td>
                    <td className="py-1 font-medium">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LCB-FT */}
        {data.nivVigilance && (
          <div ref={(el) => { sectionRefs.current["lcbft"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Obligations au titre de la lutte contre le blanchiment
            </h3>
            <p className="mb-2">
              Conformement aux articles L.561-1 et suivants du Code monetaire et financier,
              le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux
              et le financement du terrorisme.
            </p>
            <div className="flex gap-4 my-3">
              <div className="rounded border px-3 py-2 text-center" style={{ borderColor: vigilanceColor }}>
                <p className="text-[10px] text-gray-500">Vigilance</p>
                <p className="font-bold text-sm" style={{ color: vigilanceColor }}>{data.nivVigilance}</p>
              </div>
              <div className="rounded border border-gray-200 px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">Score</p>
                <p className="font-bold text-sm">{data.scoreGlobal}/100</p>
              </div>
              <div className="rounded border border-gray-200 px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">PPE</p>
                <p className="font-bold text-sm">{data.ppe || "NON"}</p>
              </div>
            </div>
            {data.be && (
              <p className="text-[11px]">
                <span className="text-gray-500">Beneficiaire(s) effectif(s) :</span> {data.be}
              </p>
            )}
          </div>
        )}

        {/* Mission */}
        {data.missionPrincipale && (
          <div ref={(el) => { sectionRefs.current["mission"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Notre mission : {data.missionPrincipale}
            </h3>
            <p className="whitespace-pre-wrap">{data.missionDescription}</p>
          </div>
        )}

        {/* Missions complementaires */}
        {(data.missionSocial || data.missionJuridique || data.missionControleFiscal) && (
          <div ref={(el) => { sectionRefs.current["complementaires"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Missions complementaires
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              {data.missionSocial && <li>Social / Paie : prise en charge de la gestion sociale et de l'etablissement des bulletins de paie</li>}
              {data.missionJuridique && <li>Juridique annuel : approbation des comptes, PV d'AG, secretariat juridique courant</li>}
              {data.missionControleFiscal && <li>Assistance controle fiscal : assistance et representation en cas de controle fiscal</li>}
            </ul>
          </div>
        )}

        {/* Honoraires */}
        {data.honorairesHT && (
          <div ref={(el) => { sectionRefs.current["honoraires"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Honoraires
            </h3>
            <table className="w-full text-[11px] border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-1.5 border border-gray-200 text-gray-600">Designation</th>
                  <th className="text-right px-3 py-1.5 border border-gray-200 text-gray-600">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-1.5 border border-gray-200">Honoraires annuels HT</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right font-medium">{data.honorairesHT} EUR</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-gray-200">Periodicite</td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right">{data.frequencePaiement}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Modalites */}
        {data.modalites && (
          <div ref={(el) => { sectionRefs.current["modalites"] = el; }} className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Modalites relationnelles
            </h3>
            <p className="whitespace-pre-wrap">{data.modalites}</p>
          </div>
        )}

        {/* Signature */}
        <div ref={(el) => { sectionRefs.current["signature"] = el; }} className="mt-10 mb-6">
          <div className="flex justify-between">
            <div className="text-center w-[45%]">
              <p className="text-[11px] font-bold mb-1">Le Cabinet</p>
              <p className="text-[11px] text-gray-500">{config.nom}</p>
              {config.signature && (
                <img src={config.signature} alt="Signature" className="h-16 mx-auto mt-2" />
              )}
              {data.signataireNom && (
                <div className="mt-8">
                  <p className="text-[11px]">{data.signataireNom}</p>
                  <p className="text-[10px] text-gray-500">{data.signataireFonction}</p>
                </div>
              )}
            </div>
            <div className="text-center w-[45%]">
              <p className="text-[11px] font-bold mb-1">Le Client</p>
              <p className="text-[11px] text-gray-500">{data.destinataireNom || data.raisonSociale}</p>
              <p className="text-[10px] text-gray-400 mt-16">
                Signature precedee de la mention<br />"Lu et approuve"
              </p>
            </div>
          </div>
          {data.lieuSignature && (
            <p className="text-[10px] text-gray-400 text-center mt-4">
              Fait a {data.lieuSignature}, le {formatDate(data.dateLettre)}
            </p>
          )}
        </div>

        {/* Annexes list */}
        {(data.annexeRepartition || data.annexeAttestation || data.annexeSepa || data.annexeLiasse || data.annexeCgv) && (
          <div ref={(el) => { sectionRefs.current["annexes"] = el; }} className="mt-8 border-t border-gray-200 pt-4">
            <h3 className="font-bold text-sm mb-2 uppercase" style={{ color: config.couleurPrimaire }}>
              Annexes
            </h3>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-gray-600">
              {data.annexeRepartition && <li>Annexe 1 — Repartition des travaux</li>}
              {data.annexeAttestation && <li>Annexe 2 — Attestation relative au travail dissimule</li>}
              {data.annexeSepa && <li>Annexe 3 — Mandat de prelevement SEPA</li>}
              {data.annexeLiasse && <li>Annexe 4 — Autorisation de tele-transmission de la liasse fiscale</li>}
              {data.annexeCgv && <li>Annexe 5 — Conditions generales</li>}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-3 border-t border-gray-200 text-center">
          <p className="text-[9px] text-gray-400">
            {config.piedDePage || "Membre de l'Ordre des Experts-Comptables"}
          </p>
          {config.siteWeb && (
            <p className="text-[9px] text-gray-400">{config.siteWeb}</p>
          )}
        </div>
      </div>
    </div>
  );
}
