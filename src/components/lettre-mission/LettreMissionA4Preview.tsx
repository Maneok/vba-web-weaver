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

type ColorTheme = "navy" | "green" | "red";

const THEME_COLORS: Record<ColorTheme, { primary: string; secondary: string; gradient: string }> = {
  navy: { primary: "#1a1a2e", secondary: "#3b4c8a", gradient: "linear-gradient(90deg, #1a1a2e, #2d2d5e)" },
  green: { primary: "#14532d", secondary: "#166534", gradient: "linear-gradient(90deg, #14532d, #166534)" },
  red: { primary: "#7f1d1d", secondary: "#991b1b", gradient: "linear-gradient(90deg, #7f1d1d, #991b1b)" },
};

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
  // New optional props
  zoom?: number;
  dateDebutExercice?: string;
  dateFinExercice?: string;
  regimeFiscal?: string;
  tvaRegime?: string;
  volumeComptable?: string;
  cac?: boolean;
  outilComptable?: string;
  remise?: number;
  acompte?: number;
  conditionsPaiement?: string;
  referenceExterne?: string;
  dateSignature?: string;
  responsableDossier?: string;
  customWatermark?: string;
  colorTheme?: ColorTheme;
  numeroLettre?: string;
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

/** Format a number as EUR. Returns em-dash for NaN/Infinity. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("fr-FR") + " \u20AC";
}

/** Render a value or an em-dash if falsy, with muted styling. */
function valOrDash(v: string | number | null | undefined): React.ReactNode {
  if (v === null || v === undefined || v === "") {
    return <span style={{ color: "#aaa", fontStyle: "italic" }}>{"\u2014"}</span>;
  }
  return <>{v}</>;
}

export default function LettreMissionA4Preview({
  sections, client, genre, missions, honoraires, cabinet,
  status = "brouillon", signatureExpert, signatureClient,
  objetContrat = "Présentation des comptes annuels",
  zoom = 1,
  dateDebutExercice,
  dateFinExercice,
  regimeFiscal,
  tvaRegime,
  volumeComptable,
  cac,
  outilComptable,
  remise,
  acompte,
  conditionsPaiement,
  referenceExterne,
  dateSignature,
  responsableDossier,
  customWatermark,
  colorTheme = "navy",
  numeroLettre,
}: Props) {
  const theme = THEME_COLORS[colorTheme] || THEME_COLORS.navy;

  const now = useMemo(() => new Date(), []);

  // Exercice dates — use props or sensible defaults
  const exerciceDebut = dateDebutExercice || `01/01/${now.getFullYear()}`;
  const exerciceFin = dateFinExercice || `31/12/${now.getFullYear()}`;

  const variables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    // Fix #9 — date de validité edge case (Dec 31 → next year correctly)
    const validite = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    // If the source date was Feb 29, the target year may not have it — JS auto-adjusts
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
      date_du_jour: dateStr, date_cloture: exerciceFin,
      date_validite: validite.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      nom_cabinet: cabinet.nom, ville_cabinet: cabinet.ville,
      objet_contrat: objetContrat,
    } as Record<string, string>;
  }, [client, genre, cabinet, objetContrat, now, exerciceFin]);

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

  // Honoraires with TVA
  const totalHTBeforeRemise = (honoraires.comptable || 0) + (honoraires.constitution || 0)
    + (missions.juridique ? honoraires.juridique || 0 : 0)
    + (missions.sociale ? honoraires.sociale || 0 : 0)
    + (missions.fiscal ? honoraires.fiscal || 0 : 0);

  const remiseAmount = remise && remise > 0 ? Math.round(totalHTBeforeRemise * (remise / 100) * 100) / 100 : 0;
  const totalHT = totalHTBeforeRemise - remiseAmount;
  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const freqLabel = honoraires.frequence === "MENSUEL" ? "mensuel" : honoraires.frequence === "TRIMESTRIEL" ? "trimestriel" : "annuel";
  const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
  // Fix #1: use totalHT instead of honoraires.comptable
  const montantPeriodique = Math.round((totalHT / divisor) * 100) / 100;

  const showWatermark = status === "brouillon" || status === "en_attente";
  const watermarkText = customWatermark || (status === "en_attente" ? "EN ATTENTE" : "PROJET");

  // Alternating row colors (improved)
  const rowEven = colorTheme === "green" ? "#f0fdf4" : colorTheme === "red" ? "#fef2f2" : "#f5f5f8";
  const rowOdd = "#ffffff";
  const headerBg = theme.primary;

  return (
    <div
      style={{
        maxWidth: 800, margin: "40px auto", background: "#fff",
        boxShadow: "0 4px 30px rgba(0,0,0,0.15)",
        fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, color: "#333", lineHeight: 1.6,
        position: "relative", overflow: "hidden",
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: "top center",
      }}
    >
      {/* Page content with padding — footer sits outside */}
      <div style={{ padding: "60px 60px 40px" }}>
        {/* Filigrane */}
        {showWatermark && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%) rotate(-45deg)",
            fontSize: 90, fontWeight: 900, color: "rgba(180,180,200,0.10)",
            pointerEvents: "none", whiteSpace: "nowrap", zIndex: 0,
            letterSpacing: 24, userSelect: "none",
            textTransform: "uppercase",
          }}>
            {watermarkText}
          </div>
        )}

        {/* En-tete cabinet */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.primary, letterSpacing: 0.3 }}>{cabinet.nom}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 3, fontStyle: "italic" }}>Membre de l'Ordre des Experts-Comptables</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#666", lineHeight: 1.7 }}>
            {referenceExterne && (
              <div style={{ fontWeight: 600, color: theme.primary, marginBottom: 2 }}>Ref. {referenceExterne}</div>
            )}
            {numeroLettre && (
              <div style={{ fontWeight: 600, color: theme.primary, marginBottom: 2 }}>N{"\u00B0"} {numeroLettre}</div>
            )}
            <div>{cabinet.adresse}</div>
            <div>{cabinet.cp} {cabinet.ville}</div>
            <div style={{ color: "#888", marginTop: 3 }}>SIRET : {cabinet.siret} | OEC n{"\u00B0"} {cabinet.numeroOEC}</div>
            <div>{cabinet.email} {"\u2014"} {cabinet.telephone}</div>
          </div>
        </div>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`, marginBottom: 30, borderRadius: 2 }} />

        {/* Title */}
        <div style={{ textAlign: "center", margin: "20px 0 10px", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 4, color: "#888", marginBottom: 6 }}>Document contractuel</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: theme.primary, letterSpacing: 2 }}>LETTRE DE MISSION</div>
          <div style={{ width: 60, height: 3, background: theme.primary, margin: "8px auto", borderRadius: 2 }} />
          <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>{objetContrat}</div>
          {client && (
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
              Exercice du {exerciceDebut} au {exerciceFin}
            </div>
          )}
        </div>

        {/* Sommaire with dotted leaders (#10) */}
        <div style={{ margin: "24px 0 30px", padding: "16px 24px", background: "#f8f9fb", borderRadius: 8, border: "1px solid #e8ecf1", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.primary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 2 }}>Sommaire</div>
          <div style={{ columns: visibleSections.length > 10 ? 2 : 1, columnGap: 24 }}>
            {visibleSections.map((s, i) => (
              <div key={s.id} style={{ fontSize: 11, color: "#555", padding: "2px 0", display: "flex", alignItems: "baseline", breakInside: "avoid" }}>
                <span style={{ color: theme.primary, fontWeight: 600, minWidth: 24, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}.</span>
                <span style={{ flexShrink: 0 }}>{s.title}</span>
                {s.type === "annexe" && <span style={{ fontSize: 9, color: "#888", fontStyle: "italic", marginLeft: 4, flexShrink: 0 }}>(annexe)</span>}
                {/* Dotted leader */}
                <span style={{ flex: 1, borderBottom: "1px dotted #ccc", margin: "0 6px", minWidth: 20, alignSelf: "flex-end", marginBottom: 2 }} />
                <span style={{ color: theme.primary, fontWeight: 600, flexShrink: 0, fontSize: 10 }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {visibleSections.map((section) => {
            if (section.content === "TABLEAU_ENTITE") {
              return (
                <div key={section.id} style={{ marginBottom: 24 }}>
                  <SectionTitle title={section.title} theme={theme} />
                  <EntityTable
                    client={client}
                    rowEven={rowEven}
                    rowOdd={rowOdd}
                    regimeFiscal={regimeFiscal}
                    tvaRegime={tvaRegime}
                    volumeComptable={volumeComptable}
                    cac={cac}
                    outilComptable={outilComptable}
                    responsableDossier={responsableDossier}
                  />
                </div>
              );
            }

            if (section.content === "BLOC_LCBFT") {
              return (
                <div key={section.id} style={{ marginBottom: 24 }}>
                  <SectionTitle title={section.title} theme={theme} />
                  <div style={{ border: `2px solid ${vigilanceColor}`, borderRadius: 8, padding: 20, background: vigilanceBg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontWeight: 700 }}>Score de risque LCB-FT</span>
                      <span style={{ background: vigilanceColor, color: "#fff", padding: "4px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
                        {client?.scoreGlobal ?? 0}/100 {"\u2014"} {client?.nivVigilance ?? "STANDARD"}
                      </span>
                    </div>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>PPE</td>
                          <td style={{ padding: "4px 8px" }}>{client?.ppe ?? "NON"}</td>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>Derni{"\u00E8"}re diligence</td>
                          <td style={{ padding: "4px 8px" }}>{client?.dateDerniereRevue || "\u2014"}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>Pays {"\u00E0"} risque</td>
                          <td style={{ padding: "4px 8px" }}>{client?.paysRisque ?? "NON"}</td>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>Prochaine MAJ</td>
                          <td style={{ padding: "4px 8px" }}>{client?.dateButoir || "\u2014"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
                      CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Conservation 5 ans apr{"\u00E8"}s fin de relation
                    </div>
                  </div>
                </div>
              );
            }

            // Honoraires table with TVA, remise, acompte
            if (section.content === "TABLEAU_HONORAIRES") {
              const rows: { label: string; ht: number }[] = [
                { label: "Forfait comptable annuel", ht: honoraires.comptable },
              ];
              if (honoraires.constitution > 0) rows.push({ label: "Constitution / Reprise dossier", ht: honoraires.constitution });
              if (missions.sociale && honoraires.sociale > 0) rows.push({ label: "Mission sociale annuelle", ht: honoraires.sociale });
              if (missions.juridique && honoraires.juridique > 0) rows.push({ label: "Mission juridique annuelle", ht: honoraires.juridique });
              if (missions.fiscal && honoraires.fiscal > 0) rows.push({ label: "Assistance contr\u00F4le fiscal", ht: honoraires.fiscal });

              return (
                <div key={section.id} style={{ marginBottom: 24 }}>
                  <SectionTitle title={section.title} theme={theme} />
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: headerBg, color: "#fff" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", borderRadius: "4px 0 0 0" }}>D{"\u00E9"}signation</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Montant HT</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>TVA 20%</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", borderRadius: "0 4px 0 0" }}>Montant TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? rowEven : rowOdd }}>
                          <td style={{ padding: "6px 12px" }}>{row.label}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(row.ht)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(Math.round(row.ht * 0.20 * 100) / 100)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmt(Math.round(row.ht * 1.20 * 100) / 100)}</td>
                        </tr>
                      ))}
                      {/* Remise row (#18) */}
                      {remise && remise > 0 && (
                        <tr style={{ background: "#fef9e7", color: "#92400e" }}>
                          <td style={{ padding: "6px 12px", fontStyle: "italic" }}>Remise ({remise}%)</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{"\u2212"}{fmt(remiseAmount)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{"\u2212"}{fmt(Math.round(remiseAmount * 0.20 * 100) / 100)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>{"\u2212"}{fmt(Math.round(remiseAmount * 1.20 * 100) / 100)}</td>
                        </tr>
                      )}
                      <tr style={{ background: "#e0e5f0", fontWeight: 700 }}>
                        <td style={{ padding: "8px 12px" }}>TOTAL</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalHT)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalTVA)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(totalTTC)}</td>
                      </tr>
                      {/* Acompte row (#19) */}
                      {acompte != null && acompte > 0 && (
                        <tr style={{ background: "#f0f7ff" }}>
                          <td style={{ padding: "6px 12px", fontWeight: 600 }}>Acompte {"\u00E0"} la signature</td>
                          <td colSpan={2} />
                          <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(acompte)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0f4f8", borderRadius: 6, fontSize: 12, color: "#555", borderLeft: `3px solid ${theme.primary}` }}>
                    Facturation {freqLabel} : <strong>{fmt(montantPeriodique)} HT</strong> / {freqLabel === "annuel" ? "an" : freqLabel === "mensuel" ? "mois" : "trimestre"}
                  </div>
                  {/* Conditions de paiement (#20) */}
                  {conditionsPaiement && (
                    <div style={{ marginTop: 6, padding: "6px 12px", fontSize: 11, color: "#666", fontStyle: "italic" }}>
                      Conditions de paiement : {conditionsPaiement}
                    </div>
                  )}
                </div>
              );
            }

            if (section.content === "TABLEAU_REPARTITION") {
              return (
                <div key={section.id} style={{ marginBottom: 24 }}>
                  <SectionTitle title={section.title} theme={theme} />
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: headerBg, color: "#fff" }}>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRadius: "4px 0 0 0" }}>T{"\u00E2"}che</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 80 }}>Cabinet</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 80, borderRadius: "0 4px 0 0" }}>Client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {REPARTITION_ROWS.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? rowEven : rowOdd }}>
                          <td style={{ padding: "5px 10px" }}>{row.tache}</td>
                          <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700, color: row.cabinet ? "#38a169" : "#ccc" }}>{row.cabinet ? "\u2713" : ""}</td>
                          <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700, color: row.client ? "#38a169" : "#ccc" }}>{row.client ? "\u2713" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            // Standard text section with signature
            const isSignatureSection = section.id === "signature";
            return (
              <div key={section.id} style={{ marginBottom: 20 }}>
                {section.type === "annexe" && section.id === visibleSections.filter(s => s.type === "annexe")[0]?.id && (
                  <div style={{ borderTop: `2px solid ${theme.primary}`, margin: "30px 0 20px", paddingTop: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: theme.primary, textAlign: "center", marginBottom: 20 }}>ANNEXES</div>
                  </div>
                )}
                <SectionTitle title={section.title} isAnnexe={section.type === "annexe"} theme={theme} />
                <div style={{ whiteSpace: "pre-wrap" }}>{renderContent(section.content)}</div>
                {/* Signature block (#8, #22) */}
                {isSignatureSection && (
                  <div style={{ marginTop: 20 }}>
                    {dateSignature && (
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 10, textAlign: "right" }}>
                        Fait le {dateSignature}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 8 }}>L'Expert-Comptable</div>
                        {signatureExpert ? (
                          <img src={signatureExpert} alt="Signature expert" style={{ maxHeight: 60, margin: "0 auto", display: "block" }} />
                        ) : (
                          <div style={{
                            height: 60, border: "1px dashed #ccc", borderRadius: 6,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#bbb", fontSize: 11, fontStyle: "italic",
                          }}>
                            Signature manquante
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 8 }}>Le Client</div>
                        {signatureClient ? (
                          <img src={signatureClient} alt="Signature client" style={{ maxHeight: 60, margin: "0 auto", display: "block" }} />
                        ) : (
                          <div style={{
                            height: 60, border: "1px dashed #ccc", borderRadius: 6,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#bbb", fontSize: 11, fontStyle: "italic",
                          }}>
                            Signature manquante
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Date de validite */}
        {client && (
          <div style={{ marginTop: 30, padding: "12px 18px", background: "#f8f9fb", borderRadius: 8, fontSize: 12, color: "#555", position: "relative", zIndex: 1, border: "1px solid #e8ecf1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Cette lettre est valable jusqu'au <strong>{(() => {
              // Fix #9: properly handle Dec 31 and leap year edge cases
              const d = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
              return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
            })()}</strong></span>
            {status === "signee" && <span style={{ background: "#38a169", color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>SIGN{"\u00C9"}E</span>}
          </div>
        )}
      </div>

      {/* Footer bar (#4, #27) */}
      <div style={{
        background: theme.primary, color: "rgba(255,255,255,0.85)",
        padding: "10px 24px", fontSize: 10, display: "flex",
        justifyContent: "space-between", alignItems: "center",
        marginTop: 10,
      }}>
        <span>{cabinet.nom} {"\u2014"} {cabinet.cp} {cabinet.ville} {"\u2014"} SIRET {cabinet.siret}</span>
        <span style={{ fontWeight: 600, letterSpacing: 1 }}>Page 1 / 1</span>
      </div>
    </div>
  );
}

// -- Sub-components --

interface SectionTitleProps {
  title: string;
  isAnnexe?: boolean;
  theme: { primary: string; secondary: string; gradient: string };
}

function SectionTitle({ title, isAnnexe, theme }: SectionTitleProps) {
  if (isAnnexe) {
    return (
      <div style={{ fontSize: 15, fontWeight: 700, color: theme.primary, borderBottom: "2px solid #e8ecf1", paddingBottom: 6, marginBottom: 14 }}>
        {title}
      </div>
    );
  }
  return (
    <div style={{
      background: theme.gradient, color: "#fff",
      padding: "8px 16px", fontSize: 13, fontWeight: 600,
      marginBottom: 12, letterSpacing: 0.8,
      borderRadius: 6,
    }}>
      {title.toUpperCase()}
    </div>
  );
}

interface EntityTableProps {
  client: Client | null;
  rowEven: string;
  rowOdd: string;
  regimeFiscal?: string;
  tvaRegime?: string;
  volumeComptable?: string;
  cac?: boolean;
  outilComptable?: string;
  responsableDossier?: string;
}

function EntityTable({ client, rowEven, rowOdd, regimeFiscal, tvaRegime, volumeComptable, cac, outilComptable, responsableDossier }: EntityTableProps) {
  if (!client) return <div style={{ color: "#999" }}>S{"\u00E9"}lectionnez un client</div>;
  const rows: [string, React.ReactNode][] = [
    ["Raison sociale", client.raisonSociale],
    ["Forme juridique", client.forme],
    ["Activit\u00E9", client.domaine],
    ["Code APE", client.ape],
    ["SIREN", client.siren],
    ["Capital social", client.capital ? client.capital.toLocaleString("fr-FR") + " \u20AC" : null],
    ["Date de cr\u00E9ation", client.dateCreation],
    ["Dirigeant", client.dirigeant],
    ["Effectif", client.effectif],
    ["Adresse", client.adresse ? `${client.adresse}, ${client.cp} ${client.ville}` : null],
  ];

  // Append new optional rows (#13-17, #23)
  if (regimeFiscal) rows.push(["R\u00E9gime fiscal", regimeFiscal]);
  if (tvaRegime) rows.push(["R\u00E9gime de TVA", tvaRegime]);
  if (volumeComptable) rows.push(["Volume comptable", volumeComptable]);
  if (cac !== undefined) rows.push(["Commissaire aux comptes", cac ? "Oui" : "Non"]);
  if (outilComptable) rows.push(["Outil comptable", outilComptable]);
  if (responsableDossier) rows.push(["Responsable dossier", responsableDossier]);

  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", fontSize: 13,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      borderRadius: 6, overflow: "hidden",
    }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? rowEven : rowOdd }}>
            <td style={{ padding: "5px 10px", fontWeight: 600, width: "40%" }}>{label}</td>
            <td style={{ padding: "5px 10px" }}>{valOrDash(value as string | number | null | undefined)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
