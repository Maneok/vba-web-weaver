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
    sociale: number;
    fiscal: number;
    frequence: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL";
  };
  cabinet: CabinetInfo;
  status?: string;
  signatureExpert?: string;
  signatureClient?: string;
  objetContrat?: string;
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

function fmt(n: number): string {
  return n.toLocaleString("fr-FR") + " €";
}

export default function LettreMissionA4Preview({
  sections, client, genre, missions, honoraires, cabinet,
  status = "brouillon", signatureExpert, signatureClient,
  objetContrat = "Présentation des comptes annuels",
}: Props) {
  const variables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const validite = new Date(now);
    validite.setFullYear(validite.getFullYear() + 1);
    return {
      formule_politesse: formule, dirigeant: client.dirigeant || "", forme_juridique: client.forme || "",
      raison_sociale: client.raisonSociale || "", adresse: client.adresse || "",
      code_postal: client.cp || "", ville: client.ville || "", siren: client.siren || "",
      ape: client.ape || "", capital: client.capital?.toLocaleString("fr-FR") || "0",
      domaine: client.domaine || "", effectif: client.effectif || "",
      date_creation: client.dateCreation || "", associe: client.associe || "",
      superviseur: client.superviseur || "", comptable: client.comptable || "",
      mission: client.mission || "", frequence: client.frequence || "",
      honoraires: fmt(client.honoraires || 0),
      iban: client.iban ? client.iban.replace(/(.{4})/g, "$1 ").trim() : "",
      bic: client.bic || "", score_global: String(client.scoreGlobal ?? 0),
      niv_vigilance: client.nivVigilance || "STANDARD", ppe: client.ppe || "NON",
      date_revue: client.dateDerniereRevue || "", date_butoir: client.dateButoir || "",
      date_du_jour: dateStr, date_cloture: "31/12/" + now.getFullYear(),
      date_validite: validite.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      nom_cabinet: cabinet.nom, ville_cabinet: cabinet.ville,
      objet_contrat: objetContrat,
    } as Record<string, string>;
  }, [client, genre, cabinet, objetContrat]);

  const renderContent = (text: string) => {
    if (!client) return <span>{text}</span>;
    const resolved = replaceTemplateVariables(text, variables);
    const parts = resolved.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        return <span key={i} style={{ color: "#e53e3e", fontWeight: 600 }}>[À compléter]</span>;
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

  const vigilanceColor = client?.nivVigilance === "SIMPLIFIEE" ? "#38a169" : client?.nivVigilance === "RENFORCEE" ? "#e53e3e" : "#d69e2e";
  const vigilanceBg = client?.nivVigilance === "SIMPLIFIEE" ? "#f0fff4" : client?.nivVigilance === "RENFORCEE" ? "#fff5f5" : "#fffff0";

  // Honoraires with TVA (#6, #18)
  const totalHT = (honoraires.comptable || 0) + (honoraires.constitution || 0)
    + (missions.juridique ? honoraires.juridique || 0 : 0)
    + (missions.sociale ? honoraires.sociale || 0 : 0)
    + (missions.fiscal ? honoraires.fiscal || 0 : 0);
  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const freqLabel = honoraires.frequence === "MENSUEL" ? "mensuel" : honoraires.frequence === "TRIMESTRIEL" ? "trimestriel" : "annuel";
  const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
  const montantPeriodique = Math.round((honoraires.comptable / divisor) * 100) / 100;

  const showWatermark = status === "brouillon" || status === "en_attente";

  return (
    <div
      style={{
        maxWidth: 800, margin: "40px auto", background: "#fff", padding: "60px",
        boxShadow: "0 4px 30px rgba(0,0,0,0.15)",
        fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, color: "#333", lineHeight: 1.6,
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Filigrane PROJET */}
      {showWatermark && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-45deg)",
          fontSize: 90, fontWeight: 900, color: "rgba(180,180,200,0.10)",
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 0,
          letterSpacing: 24, userSelect: "none",
          textTransform: "uppercase",
        }}>
          {status === "en_attente" ? "EN ATTENTE" : "PROJET"}
        </div>
      )}

      {/* ── En-tête cabinet ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", letterSpacing: 0.3 }}>{cabinet.nom}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 3, fontStyle: "italic" }}>Membre de l'Ordre des Experts-Comptables</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#666", lineHeight: 1.7 }}>
          <div>{cabinet.adresse}</div>
          <div>{cabinet.cp} {cabinet.ville}</div>
          <div style={{ color: "#888", marginTop: 3 }}>SIRET : {cabinet.siret} | OEC n° {cabinet.numeroOEC}</div>
          <div>{cabinet.email} — {cabinet.telephone}</div>
        </div>
      </div>
      <div style={{ height: 3, background: "linear-gradient(90deg, #1a1a2e, #3b4c8a, #1a1a2e)", marginBottom: 30, borderRadius: 2 }} />

      {/* ── Title ── */}
      <div style={{ textAlign: "center", margin: "20px 0 10px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 4, color: "#888", marginBottom: 6 }}>Document contractuel</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", letterSpacing: 2 }}>LETTRE DE MISSION</div>
        <div style={{ width: 60, height: 3, background: "#1a1a2e", margin: "8px auto", borderRadius: 2 }} />
        <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>{objetContrat}</div>
        {client && (
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Exercice du 01/01/{new Date().getFullYear()} au 31/12/{new Date().getFullYear()}
          </div>
        )}
      </div>

      {/* ── Sommaire ── */}
      <div style={{ margin: "24px 0 30px", padding: "16px 24px", background: "#f8f9fb", borderRadius: 8, border: "1px solid #e8ecf1", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 8, textTransform: "uppercase", letterSpacing: 2 }}>Sommaire</div>
        <div style={{ columns: visibleSections.length > 10 ? 2 : 1, columnGap: 24 }}>
          {visibleSections.map((s, i) => (
            <div key={s.id} style={{ fontSize: 11, color: "#555", padding: "2px 0", display: "flex", alignItems: "baseline", gap: 6, breakInside: "avoid" }}>
              <span style={{ color: "#1a1a2e", fontWeight: 600, minWidth: 20 }}>{String(i + 1).padStart(2, "0")}.</span>
              <span>{s.title}</span>
              {s.type === "annexe" && <span style={{ fontSize: 9, color: "#888", fontStyle: "italic" }}>(annexe)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Sections ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {visibleSections.map((section) => {
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
                <div style={{ border: `2px solid ${vigilanceColor}`, borderRadius: 8, padding: 20, background: vigilanceBg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 700 }}>Score de risque LCB-FT</span>
                    <span style={{ background: vigilanceColor, color: "#fff", padding: "4px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
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

          // Honoraires table with TVA (#6, #18)
          if (section.content === "TABLEAU_HONORAIRES") {
            const rows: { label: string; ht: number }[] = [
              { label: "Forfait comptable annuel", ht: honoraires.comptable },
            ];
            if (honoraires.constitution > 0) rows.push({ label: "Constitution / Reprise dossier", ht: honoraires.constitution });
            if (missions.sociale && honoraires.sociale > 0) rows.push({ label: "Mission sociale annuelle", ht: honoraires.sociale });
            if (missions.juridique && honoraires.juridique > 0) rows.push({ label: "Mission juridique annuelle", ht: honoraires.juridique });
            if (missions.fiscal && honoraires.fiscal > 0) rows.push({ label: "Assistance contrôle fiscal", ht: honoraires.fiscal });

            return (
              <div key={section.id} style={{ marginBottom: 24 }}>
                <SectionTitle title={section.title} />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#1a1a2e", color: "#fff" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Désignation</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Montant HT</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>TVA 20%</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f5f5f8" : "#fff" }}>
                        <td style={{ padding: "6px 12px" }}>{row.label}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(row.ht)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(Math.round(row.ht * 0.20 * 100) / 100)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(Math.round(row.ht * 1.20 * 100) / 100)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#e0e5f0", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px" }}>TOTAL</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalHT)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalTVA)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalTTC)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0f4f8", borderRadius: 6, fontSize: 12, color: "#555", borderLeft: "3px solid #1a1a2e" }}>
                  Facturation {freqLabel} : <strong>{fmt(montantPeriodique)} HT</strong> / {freqLabel === "annuel" ? "an" : freqLabel === "mensuel" ? "mois" : "trimestre"}
                </div>
              </div>
            );
          }

          if (section.content === "TABLEAU_REPARTITION") {
            return (
              <div key={section.id} style={{ marginBottom: 24 }}>
                <SectionTitle title={section.title} />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
                        <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700 }}>{row.cabinet ? "✓" : ""}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700 }}>{row.client ? "✓" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Standard text section with signature images (#5)
          const isSignatureSection = section.id === "signature";
          return (
            <div key={section.id} style={{ marginBottom: 20 }}>
              {section.type === "annexe" && section.id === visibleSections.filter(s => s.type === "annexe")[0]?.id && (
                <div style={{ borderTop: "2px solid #1a1a2e", margin: "30px 0 20px", paddingTop: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", textAlign: "center", marginBottom: 20 }}>ANNEXES</div>
                </div>
              )}
              <SectionTitle title={section.title} isAnnexe={section.type === "annexe"} />
              <div style={{ whiteSpace: "pre-wrap" }}>{renderContent(section.content)}</div>
              {/* Signature images (#5) */}
              {isSignatureSection && (signatureExpert || signatureClient) && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                  <div style={{ textAlign: "center", width: "45%" }}>
                    {signatureExpert && <img src={signatureExpert} alt="Signature expert" style={{ maxHeight: 60, margin: "0 auto" }} />}
                  </div>
                  <div style={{ textAlign: "center", width: "45%" }}>
                    {signatureClient && <img src={signatureClient} alt="Signature client" style={{ maxHeight: 60, margin: "0 auto" }} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Date de validité */}
      {client && (
        <div style={{ marginTop: 30, padding: "12px 18px", background: "#f8f9fb", borderRadius: 8, fontSize: 12, color: "#555", position: "relative", zIndex: 1, border: "1px solid #e8ecf1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Cette lettre est valable jusqu'au <strong>{(() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          })()}</strong></span>
          {status === "signee" && <span style={{ background: "#38a169", color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>SIGNÉE</span>}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function SectionTitle({ title, isAnnexe }: { title: string; isAnnexe?: boolean }) {
  if (isAnnexe) {
    return (
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", borderBottom: "2px solid #e8ecf1", paddingBottom: 6, marginBottom: 14 }}>
        {title}
      </div>
    );
  }
  return (
    <div style={{ background: "linear-gradient(90deg, #1a1a2e, #2d2d5e)", color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 600, marginBottom: 12, letterSpacing: 0.8, borderRadius: 2 }}>
      {title.toUpperCase()}
    </div>
  );
}

function EntityTable({ client }: { client: Client | null }) {
  if (!client) return <div style={{ color: "#999" }}>Sélectionnez un client</div>;
  const rows = [
    ["Raison sociale", client.raisonSociale], ["Forme juridique", client.forme],
    ["Activité", client.domaine], ["Code APE", client.ape],
    ["SIREN", client.siren], ["Capital social", client.capital ? client.capital.toLocaleString("fr-FR") + " €" : "—"],
    ["Date de création", client.dateCreation || "—"], ["Dirigeant", client.dirigeant],
    ["Effectif", client.effectif || "—"], ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
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
