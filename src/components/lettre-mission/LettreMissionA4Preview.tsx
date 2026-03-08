import { useMemo } from "react";
import type { Client } from "@/lib/types";
import type { TemplateSection } from "@/lib/lettreMissionTemplate";
import { replaceTemplateVariables } from "@/lib/lettreMissionTemplate";

interface CabinetInfo {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
}

interface Props {
  sections: TemplateSection[];
  client: Client | null;
  genre: "M" | "Mme";
  missions: { sociale: boolean; juridique: boolean; fiscal: boolean };
  honoraires: {
    comptable: number;
    constitution: number;
    juridique: number;
    frequence: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL";
  };
  cabinet: CabinetInfo;
}

const REPARTITION_ROWS = [
  { tache: "Collecte et classement des pièces comptables", cabinet: false, client: true },
  { tache: "Saisie / Intégration des écritures comptables", cabinet: true, client: false },
  { tache: "Rapprochement bancaire mensuel", cabinet: true, client: false },
  { tache: "Établissement des déclarations de TVA", cabinet: true, client: false },
  { tache: "Établissement de la liasse fiscale", cabinet: true, client: false },
  { tache: "Comptes annuels (bilan, compte de résultat, annexe)", cabinet: true, client: false },
  { tache: "Transmission des relevés bancaires", cabinet: false, client: true },
  { tache: "Transmission des factures fournisseurs/clients", cabinet: false, client: true },
  { tache: "Conservation des pièces justificatives", cabinet: true, client: true },
  { tache: "Déclarations fiscales annuelles (IS, CVAE, CFE)", cabinet: true, client: false },
];

function formatMontant(n: number): string {
  return n.toLocaleString("fr-FR") + " €";
}

export default function LettreMissionA4Preview({
  sections,
  client,
  genre,
  missions,
  honoraires,
  cabinet,
}: Props) {
  const variables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return {
      formule_politesse: formule,
      dirigeant: client.dirigeant || "",
      forme_juridique: client.forme || "",
      raison_sociale: client.raisonSociale || "",
      adresse: client.adresse || "",
      code_postal: client.cp || "",
      ville: client.ville || "",
      siren: client.siren || "",
      ape: client.ape || "",
      capital: client.capital?.toLocaleString("fr-FR") || "0",
      domaine: client.domaine || "",
      effectif: client.effectif || "",
      date_creation: client.dateCreation || "",
      associe: client.associe || "",
      superviseur: client.superviseur || "",
      comptable: client.comptable || "",
      mission: client.mission || "",
      frequence: client.frequence || "",
      honoraires: formatMontant(client.honoraires || 0),
      iban: client.iban
        ? client.iban.replace(/(.{4})/g, "$1 ").trim()
        : "",
      bic: client.bic || "",
      score_global: String(client.scoreGlobal ?? 0),
      niv_vigilance: client.nivVigilance || "STANDARD",
      ppe: client.ppe || "NON",
      date_revue: client.dateDerniereRevue || "",
      date_butoir: client.dateButoir || "",
      date_du_jour: dateStr,
      date_cloture: "31/12/" + now.getFullYear(),
      nom_cabinet: cabinet.nom,
      ville_cabinet: cabinet.ville,
    } as Record<string, string>;
  }, [client, genre, cabinet]);

  const resolveText = (text: string): string => {
    if (!client) return text;
    return replaceTemplateVariables(text, variables);
  };

  // Highlight unresolved variables
  const renderContent = (text: string) => {
    const resolved = resolveText(text);
    const parts = resolved.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        return (
          <span key={i} style={{ color: "#e53e3e", fontWeight: 600 }}>
            [À compléter]
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const visibleSections = useMemo(() => {
    return sections.filter((s) => {
      if (s.type === "conditional") {
        if (s.condition === "sociale" && !missions.sociale) return false;
        if (s.condition === "juridique" && !missions.juridique) return false;
        if (s.condition === "fiscal" && !missions.fiscal) return false;
      }
      return true;
    });
  }, [sections, missions]);

  const vigilanceColor =
    client?.nivVigilance === "SIMPLIFIEE"
      ? "#38a169"
      : client?.nivVigilance === "RENFORCEE"
      ? "#e53e3e"
      : "#d69e2e";

  const vigilanceBg =
    client?.nivVigilance === "SIMPLIFIEE"
      ? "#f0fff4"
      : client?.nivVigilance === "RENFORCEE"
      ? "#fff5f5"
      : "#fffff0";

  // Compute honoraires total
  const totalHT =
    (honoraires.comptable || 0) +
    (honoraires.constitution || 0) +
    (missions.juridique ? honoraires.juridique || 0 : 0);

  const freqLabel =
    honoraires.frequence === "MENSUEL"
      ? "mensuel"
      : honoraires.frequence === "TRIMESTRIEL"
      ? "trimestriel"
      : "annuel";

  const divisor =
    honoraires.frequence === "MENSUEL"
      ? 12
      : honoraires.frequence === "TRIMESTRIEL"
      ? 4
      : 1;

  const montantPeriodique = Math.round((honoraires.comptable / divisor) * 100) / 100;

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "40px auto",
        background: "#fff",
        padding: "60px",
        boxShadow: "0 4px 30px rgba(0,0,0,0.15)",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 14,
        color: "#333",
        lineHeight: 1.6,
      }}
    >
      {/* ── En-tête cabinet ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>
            {cabinet.nom}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            Membre de l'Ordre des Experts-Comptables
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#666" }}>
          <div>{cabinet.adresse}</div>
          <div>
            {cabinet.cp} {cabinet.ville}
          </div>
          <div>SIRET : {cabinet.siret}</div>
          <div>OEC n° {cabinet.numeroOEC}</div>
          <div>
            {cabinet.email} — {cabinet.telephone}
          </div>
        </div>
      </div>
      <hr style={{ border: "none", borderTop: "2px solid #1a1a2e", marginBottom: 30 }} />

      {/* ── Title ── */}
      <div
        style={{
          textAlign: "center",
          margin: "20px 0 30px",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", letterSpacing: 1 }}>
          LETTRE DE MISSION
        </div>
        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
          Présentation des comptes annuels
        </div>
      </div>

      {/* ── Sections ── */}
      {visibleSections.map((section) => {
        // Special renderers
        if (section.content === "TABLEAU_ENTITE") {
          return (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <SectionTitle title={section.title} />
              <EntityTable client={client} />
            </div>
          );
        }

        if (section.content === "BLOC_LCBFT") {
          return (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <SectionTitle title={section.title} />
              <div
                style={{
                  border: `2px solid ${vigilanceColor}`,
                  borderRadius: 8,
                  padding: 20,
                  background: vigilanceBg,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700 }}>Score de risque LCB-FT</span>
                  <span
                    style={{
                      background: vigilanceColor,
                      color: "#fff",
                      padding: "4px 14px",
                      borderRadius: 20,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {client?.scoreGlobal ?? 0}/100 — {client?.nivVigilance ?? "STANDARD"}
                  </span>
                </div>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 8px", fontWeight: 600 }}>PPE</td>
                      <td style={{ padding: "4px 8px" }}>{client?.ppe ?? "NON"}</td>
                      <td style={{ padding: "4px 8px", fontWeight: 600 }}>Dernière diligence</td>
                      <td style={{ padding: "4px 8px" }}>{client?.dateDerniereRevue || "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 8px", fontWeight: 600 }}>Pays à risque</td>
                      <td style={{ padding: "4px 8px" }}>{client?.paysRisque ?? "NON"}</td>
                      <td style={{ padding: "4px 8px", fontWeight: 600 }}>Prochaine MAJ</td>
                      <td style={{ padding: "4px 8px" }}>{client?.dateButoir || "—"}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
                  CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Conservation 5 ans après fin de relation
                </div>
              </div>
            </div>
          );
        }

        if (section.content === "TABLEAU_HONORAIRES") {
          return (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <SectionTitle title={section.title} />
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ background: "#1a1a2e", color: "#fff" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Désignation</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Montant HT annuel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#f5f5f8" }}>
                    <td style={{ padding: "6px 12px" }}>Forfait comptable annuel</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>
                      {formatMontant(honoraires.comptable)}
                    </td>
                  </tr>
                  {honoraires.constitution > 0 && (
                    <tr>
                      <td style={{ padding: "6px 12px" }}>Constitution / Reprise dossier</td>
                      <td style={{ padding: "6px 12px", textAlign: "right" }}>
                        {formatMontant(honoraires.constitution)}
                      </td>
                    </tr>
                  )}
                  {missions.juridique && honoraires.juridique > 0 && (
                    <tr style={{ background: "#f5f5f8" }}>
                      <td style={{ padding: "6px 12px" }}>Mission juridique annuelle</td>
                      <td style={{ padding: "6px 12px", textAlign: "right" }}>
                        {formatMontant(honoraires.juridique)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ background: "#e0e5f0", fontWeight: 700 }}>
                    <td style={{ padding: "8px 12px" }}>TOTAL HT</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {formatMontant(totalHT)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                Facturation {freqLabel} : {formatMontant(montantPeriodique)} HT / {freqLabel === "annuel" ? "an" : freqLabel === "mensuel" ? "mois" : "trimestre"}
              </div>
            </div>
          );
        }

        if (section.content === "TABLEAU_REPARTITION") {
          return (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <SectionTitle title={section.title} />
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "#1a1a2e", color: "#fff" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Tâche</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 80 }}>Cabinet</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 80 }}>Client</th>
                  </tr>
                </thead>
                <tbody>
                  {REPARTITION_ROWS.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#f5f5f8" : "#fff" }}>
                      <td style={{ padding: "5px 10px" }}>{row.tache}</td>
                      <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700 }}>
                        {row.cabinet ? "✓" : ""}
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700 }}>
                        {row.client ? "✓" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Standard text section
        return (
          <div key={section.id} style={{ marginBottom: 20 }}>
            {section.type === "annexe" && section.id === visibleSections.filter(s => s.type === "annexe")[0]?.id && (
              <div style={{ borderTop: "2px solid #1a1a2e", margin: "30px 0 20px", paddingTop: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", textAlign: "center", marginBottom: 20 }}>
                  ANNEXES
                </div>
              </div>
            )}
            <SectionTitle title={section.title} isAnnexe={section.type === "annexe"} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderContent(section.content)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ──

function SectionTitle({ title, isAnnexe }: { title: string; isAnnexe?: boolean }) {
  if (isAnnexe) {
    return (
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#1a1a2e",
          borderBottom: "1px solid #1a1a2e",
          paddingBottom: 4,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#1a1a2e",
        color: "#fff",
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 10,
        letterSpacing: 0.5,
      }}
    >
      {title.toUpperCase()}
    </div>
  );
}

function EntityTable({ client }: { client: Client | null }) {
  if (!client) return <div style={{ color: "#999" }}>Sélectionnez un client</div>;
  const rows = [
    ["Raison sociale", client.raisonSociale],
    ["Forme juridique", client.forme],
    ["Activité", client.domaine],
    ["Code APE", client.ape],
    ["SIREN", client.siren],
    ["Capital social", client.capital ? client.capital.toLocaleString("fr-FR") + " €" : "—"],
    ["Date de création", client.dateCreation || "—"],
    ["Dirigeant", client.dirigeant],
    ["Effectif", client.effectif || "—"],
    ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#f5f5f8" : "#fff" }}>
            <td style={{ padding: "5px 10px", fontWeight: 600, width: "40%" }}>{label}</td>
            <td style={{ padding: "5px 10px" }}>{value || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
