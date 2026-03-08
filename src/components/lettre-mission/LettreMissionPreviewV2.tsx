import { useRef, useEffect, useMemo } from "react";
import { Shield } from "lucide-react";
import { loadCabinetConfig } from "./CabinetConfigForm";
import type { EditorSection } from "./LettreMissionEditor";
import type { Client } from "@/lib/types";
import {
  LETTRE_MISSION_TEMPLATE,
  getFormulePolitesse,
  CONTROLE_FISCAL_OPTIONS,
  type Genre,
} from "@/lib/lettreMissionContent";

/* ═══════════════════════════════════════════════════════
   Props — interface stable pour le bouton "Aperçu"
   ═══════════════════════════════════════════════════════ */
export interface MissionsActives {
  sociale?: boolean;
  juridique?: boolean;
  controleFiscal?: boolean;
  controleFiscalOption?: "A" | "B" | "RENONCE" | null;
}

export interface LettreMissionPreviewV2Props {
  clientData?: Client | null;
  sections?: EditorSection[];
  missionsActives?: MissionsActives;
  genre?: Genre;
  honoraires?: {
    honoraires?: number;
    setup?: number;
    honoraires_juridique?: number;
    frequence?: "mensuel" | "trimestriel";
  };
  activeSectionId?: string | null;
}

/* ═══════════════════════════════════════════════════════
   Variable replacement engine
   ═══════════════════════════════════════════════════════ */
function buildVarMap(
  c: Client | null | undefined,
  cabinetNom: string,
  cabinetAdresse: string,
  cabinetIcs: string,
  genre: Genre,
  honoraires?: LettreMissionPreviewV2Props["honoraires"],
  missionsActives?: MissionsActives,
): Record<string, string> {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const year = new Date().getFullYear().toString();
  const freq = honoraires?.frequence ?? "mensuel";
  const div = freq === "mensuel" ? 12 : 4;
  const montantPeriodique = honoraires?.honoraires
    ? (honoraires.honoraires / div).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
    : "";

  const cfOpt = CONTROLE_FISCAL_OPTIONS.find((o) => o.id === missionsActives?.controleFiscalOption);

  return {
    formule_politesse: getFormulePolitesse(genre),
    dirigeant: c?.dirigeant ?? "",
    raison_sociale: c?.raisonSociale ?? "",
    forme_juridique: c?.forme ?? "",
    capital: c?.capital != null && c.capital > 0
      ? `${Number(c.capital).toLocaleString("fr-FR")} €`
      : c?.capital === 0 && (c?.forme === "ENTREPRISE INDIVIDUELLE" || c?.typePersonne === "physique")
        ? "N/A (entreprise individuelle)"
        : c?.capital === 0 ? "0 €" : "Non renseigné",
    adresse: c?.adresse ?? "",
    adresse_complete: c ? `${c?.adresse ?? ""}, ${c?.cp ?? ""} ${c?.ville ?? ""}` : "",
    cp: c?.cp ?? "",
    ville: c?.ville ?? "",
    siren: c?.siren ?? "",
    ape: c?.ape ?? "",
    date_creation: c?.dateCreation ?? "",
    date_cloture: "",
    date_effet: today,
    debut_exercice: `01/01/${year}`,
    fin_exercice: `31/12/${year}`,
    date: today,
    annee: year,
    effectif: c?.effectif?.toString() ?? "",
    domaine: c?.domaine ?? "",
    qualite_dirigeant:
      c?.forme === "SAS" || c?.forme === "SASU" ? "Président" : "Gérant",
    associe: c?.associe ?? "",
    honoraires: honoraires?.honoraires ? honoraires.honoraires.toLocaleString("fr-FR") : "",
    setup: honoraires?.setup ? honoraires.setup.toLocaleString("fr-FR") : "",
    honoraires_juridique: honoraires?.honoraires_juridique ? honoraires.honoraires_juridique.toLocaleString("fr-FR") : "",
    controle_fiscal_montant: cfOpt?.montant ? cfOpt.montant.toLocaleString("fr-FR") : "",
    frequence_paiement: freq === "mensuel" ? "mensuellement" : "trimestriellement",
    montant_periodique: montantPeriodique,
    cabinet_nom: cabinetNom,
    cabinet_adresse: cabinetAdresse,
    cabinet_ics: cabinetIcs,
    ref_client: c?.ref ?? "",
    iban: c?.iban ?? "",
    bic: c?.bic ?? "",
  };
}

function replaceVars(text: string, vars: Record<string, string>): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (!part.startsWith("{{")) return <span key={i}>{part}</span>;
    const key = part.slice(2, -2).trim();
    const val = vars[key];
    if (val) return <span key={i} style={{ fontWeight: 500 }}>{val}</span>;
    return (
      <span
        key={i}
        style={{
          color: "#dc2626",
          backgroundColor: "#fef2f2",
          padding: "0 3px",
          borderRadius: "2px",
          fontSize: "0.85em",
          fontFamily: "monospace",
        }}
      >
        [À compléter]
      </span>
    );
  });
}

function renderTextBlock(text: string, vars: Record<string, string>): React.ReactNode {
  if (!text) return null;
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>
      {replaceVars(line, vars)}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

/* ═══════════════════════════════════════════════════════
   Couleurs / styles
   ═══════════════════════════════════════════════════════ */
const C = {
  navy: "#1a1a2e",
  body: "#333333",
  lightBg: "#f0f4ff",
  accent: "#1e40af",
  border: "#dddddd",
  muted: "#6b7280",
  altRow: "#f9f9f9",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "18px",
  fontWeight: 700,
  color: C.navy,
  margin: "0 0 6px",
  lineHeight: 1.3,
};

const thinRuleStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: C.navy,
  opacity: 0.25,
  marginBottom: "14px",
};

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
export default function LettreMissionPreviewV2({
  clientData,
  sections,
  missionsActives,
  genre = "M",
  honoraires,
  activeSectionId,
}: LettreMissionPreviewV2Props) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cabinet = useMemo(() => loadCabinetConfig(), []);
  const tpl = LETTRE_MISSION_TEMPLATE;

  const vars = useMemo(
    () =>
      buildVarMap(
        clientData,
        cabinet?.nom ?? "",
        `${cabinet?.adresse ?? ""}, ${cabinet?.cp ?? ""} ${cabinet?.ville ?? ""}`,
        cabinet?.icsSepa ?? "",
        genre,
        honoraires,
        missionsActives,
      ),
    [clientData, cabinet, genre, honoraires, missionsActives],
  );

  // Scroll sync
  useEffect(() => {
    if (activeSectionId && sectionRefs.current[activeSectionId]) {
      sectionRefs.current[activeSectionId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [activeSectionId]);

  // Helper: find section by id
  const sec = (id: string): EditorSection | undefined =>
    sections?.find((s) => s.id === id);

  const isVisible = (id: string): boolean => {
    const s = sec(id);
    return s ? s.visible : false;
  };

  // ─── Empty state ───
  if (!clientData && (!sections || sections.length === 0)) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: "400px",
          padding: "40px",
          textAlign: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: C.muted,
        }}
      >
        <div>
          <p style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📄</p>
          <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px", color: C.navy }}>
            Sélectionnez un client pour voir l'aperçu
          </p>
          <p style={{ fontSize: "13px" }}>
            L'aperçu du document se mettra à jour automatiquement.
          </p>
        </div>
      </div>
    );
  }

  // Vigilance colors
  const vigColor =
    clientData?.nivVigilance === "RENFORCEE"
      ? "#dc2626"
      : clientData?.nivVigilance === "SIMPLIFIEE"
        ? "#16a34a"
        : "#2563eb";

  const scoreColor = (s?: number) =>
    !s ? C.muted : s >= 70 ? "#dc2626" : s >= 40 ? "#f59e0b" : "#16a34a";

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ height: "100%", overflowY: "auto", backgroundColor: "#f1f5f9", padding: "16px" }}>
      {/* ═══════ A4 DOCUMENT ═══════ */}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #dddddd",
          boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "60px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "14px",
          lineHeight: 1.6,
          color: C.body,
        }}
      >
        {/* ═══════ 3. EN-TÊTE ═══════ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0" }}>
          {/* Left: COMPTADEC */}
          <div>
            <h1
              style={{
                fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: "20px",
                fontWeight: 800,
                color: C.navy,
                margin: 0,
                letterSpacing: "0.04em",
              }}
            >
              COMPTADEC
            </h1>
          </div>
          {/* Right: coordonnées */}
          <div style={{ textAlign: "right", fontSize: "10px", color: C.muted, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>{cabinet?.adresse || ""}{cabinet?.cp || cabinet?.ville ? `, ${cabinet?.cp ?? ""} ${cabinet?.ville ?? ""}` : ""}</p>
            <p style={{ margin: 0 }}>{cabinet?.email || ""}{cabinet?.telephone ? ` — ${cabinet?.telephone}` : ""}</p>
            {cabinet?.siret && <p style={{ margin: 0 }}>SIRET : {cabinet?.siret} | N° OEC : {cabinet?.numeroOec || ""}</p>}
          </div>
        </div>
        {/* Trait horizontal bleu */}
        <div style={{ height: "2px", backgroundColor: C.navy, margin: "12px 0 28px" }} />

        {/* ═══════ 6. INFOS MISSION ═══════ */}
        <div style={{ textAlign: "right", fontSize: "11px", color: C.muted, marginBottom: "24px", lineHeight: 1.8 }}>
          <p style={{ margin: 0 }}>Marseille, le {today}</p>
          <p style={{ margin: 0 }}>Réf. mission n° LM-{new Date().getFullYear()}-{(clientData?.ref ?? "XXX").slice(-3).padStart(3, "0")}</p>
          {clientData?.mail && <p style={{ margin: 0 }}>{clientData?.mail}</p>}
          {clientData?.tel && <p style={{ margin: 0 }}>{clientData?.tel}</p>}
        </div>

        {/* ═══════ 4. BLOC DESTINATAIRE ═══════ */}
        {clientData && (
          <div style={{ marginBottom: "32px", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 4px", fontStyle: "italic" }}>
              À l'attention de {getFormulePolitesse(genre)} {clientData?.dirigeant || "[À compléter]"},
            </p>
            <p style={{ margin: "0 0 2px" }}>
              Mandataire social de la société
            </p>
            <p style={{ margin: "0 0 2px", fontWeight: 700 }}>
              {clientData?.forme || ""} {clientData?.raisonSociale || ""}
            </p>
            <p style={{ margin: "0 0 2px" }}>
              {clientData?.adresse || ""}
            </p>
            <p style={{ margin: 0 }}>
              {clientData?.cp || ""} {clientData?.ville || ""}
            </p>
          </div>
        )}

        {/* ═══════ 5. TITRE ═══════ */}
        <h1
          style={{
            textAlign: "center",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: C.navy,
            margin: "0 0 4px",
            fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            textTransform: "uppercase",
          }}
        >
          Lettre de Mission
        </h1>
        <p
          style={{
            textAlign: "center",
            fontSize: "16px",
            fontWeight: 600,
            color: C.muted,
            margin: "0 0 36px",
            fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Présentation des comptes annuels
        </p>

        {/* ═══════ 7. SECTIONS DU CORPS ═══════ */}

        {/* Introduction */}
        {isVisible("introduction") && (
          <div ref={(el) => { sectionRefs.current["introduction"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {renderTextBlock(sec("introduction")?.content ?? "", vars)}
            </div>
          </div>
        )}

        {/* ═══════ 8. VOTRE ENTITÉ — tableau ═══════ */}
        {isVisible("entite") && clientData && (
          <div ref={(el) => { sectionRefs.current["entite"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.entite.titre}</h2>
            <div style={thinRuleStyle} />
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                border: `1px solid ${C.border}`,
              }}
            >
              <tbody>
                {([
                  ["Raison sociale", clientData?.raisonSociale || ""],
                  ["Forme juridique", clientData?.forme || ""],
                  ["Dirigeant / Représentant légal", clientData?.dirigeant || ""],
                  ["Objet social / Activité", clientData?.domaine || ""],
                  clientData?.ape ? ["Code APE / NAF", clientData?.ape] : null,
                  ["N° SIREN", clientData?.siren || ""],
                  ["Capital social",
                    clientData?.capital != null && clientData.capital > 0
                      ? `${Number(clientData.capital).toLocaleString("fr-FR")} €`
                      : clientData?.capital === 0 && (clientData?.forme === "ENTREPRISE INDIVIDUELLE" || clientData?.typePersonne === "physique")
                        ? "N/A (entreprise individuelle)"
                        : clientData?.capital === 0 ? "0 €" : "Non renseigné"
                  ],
                  ["Adresse du siège social", `${clientData?.adresse || ""}, ${clientData?.cp || ""} ${clientData?.ville || ""}`],
                  clientData?.dateCreation ? ["Date de création", clientData?.dateCreation] : null,
                  ["Date de clôture", "31/12"],
                  clientData?.effectif ? ["Effectif", `${clientData?.effectif} salarié(s)`] : null,
                  clientData?.tel ? ["Téléphone", clientData?.tel] : null,
                  clientData?.mail ? ["Email", clientData?.mail] : null,
                ].filter(Boolean) as [string, string][]).map(([label, value], i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 1 ? C.altRow : "transparent",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <td style={{ padding: "7px 12px", color: C.muted, width: "220px", verticalAlign: "top", borderRight: `1px solid ${C.border}` }}>
                      {label}
                    </td>
                    <td style={{ padding: "7px 12px", fontWeight: 500 }}>
                      {value || <span style={{ color: "#dc2626", fontSize: "12px" }}>[À compléter]</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════ 9. BLOC LCB-FT ═══════ */}
        {isVisible("lcbft") && (
          <div ref={(el) => { sectionRefs.current["lcbft"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Shield style={{ width: "16px", height: "16px", color: C.accent }} />
                {tpl.lcbft.titre}
              </span>
            </h2>
            <div style={thinRuleStyle} />
            <p style={{ fontSize: "10px", color: C.muted, fontStyle: "italic", marginBottom: "12px" }}>
              {tpl.lcbft.soustitre}
            </p>

            {/* Encadré spécial */}
            <div
              style={{
                border: `2px solid ${C.navy}`,
                borderRadius: "4px",
                padding: "20px",
                backgroundColor: C.lightBg,
                marginBottom: "14px",
              }}
            >
              {clientData && (
                <div style={{ display: "flex", gap: "24px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", minWidth: "100px" }}>
                    <p style={{ fontSize: "10px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Vigilance
                    </p>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: vigColor,
                        fontFamily: "'Inter', sans-serif",
                        margin: 0,
                      }}
                    >
                      {clientData?.nivVigilance || "STANDARD"}
                    </p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "80px" }}>
                    <p style={{ fontSize: "10px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      Score global
                    </p>
                    <p
                      style={{
                        fontSize: "24px",
                        fontWeight: 700,
                        color: scoreColor(clientData?.scoreGlobal),
                        fontFamily: "'Inter', sans-serif",
                        margin: 0,
                      }}
                    >
                      {clientData?.scoreGlobal ?? "—"}<span style={{ fontSize: "12px", color: C.muted }}>/100</span>
                    </p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "60px" }}>
                    <p style={{ fontSize: "10px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                      PPE
                    </p>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: clientData?.ppe === "OUI" ? "#dc2626" : "#16a34a",
                        fontFamily: "'Inter', sans-serif",
                        margin: 0,
                      }}
                    >
                      {clientData?.ppe || "NON"}
                    </p>
                  </div>
                  {clientData?.paysRisque && (
                    <div style={{ textAlign: "center", minWidth: "80px" }}>
                      <p style={{ fontSize: "10px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                        Pays à risque
                      </p>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: clientData?.paysRisque === "OUI" ? "#dc2626" : "#16a34a",
                          fontFamily: "'Inter', sans-serif",
                          margin: 0,
                        }}
                      >
                        {clientData?.paysRisque}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {clientData?.be && (
                <p style={{ fontSize: "12px", marginBottom: "10px" }}>
                  <strong>Bénéficiaire(s) effectif(s) :</strong> {clientData?.be}
                </p>
              )}

              <p style={{ fontSize: "13px", lineHeight: 1.6, margin: "0 0 10px" }}>
                {tpl.lcbft.engagements}
              </p>
              <p style={{ fontSize: "12px", lineHeight: 1.6, color: C.muted, margin: 0 }}>
                {tpl.lcbft.conservation}
              </p>
            </div>
          </div>
        )}

        {/* Mission principale */}
        {isVisible("mission") && (
          <div ref={(el) => { sectionRefs.current["mission"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.mission.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("mission")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* Durée */}
        {isVisible("duree") && (
          <div ref={(el) => { sectionRefs.current["duree"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.duree.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("duree")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* Nature et limites */}
        {isVisible("nature") && (
          <div ref={(el) => { sectionRefs.current["nature"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.nature.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("nature")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* ═══════ 10. SECTIONS CONDITIONNELLES ═══════ */}

        {/* Mission sociale */}
        {missionsActives?.sociale && isVisible("mission_sociale") && (
          <div ref={(el) => { sectionRefs.current["mission_sociale"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.missionSociale.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("mission_sociale")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* Mission juridique */}
        {missionsActives?.juridique && isVisible("mission_juridique") && (
          <div ref={(el) => { sectionRefs.current["mission_juridique"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.missionJuridique.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("mission_juridique")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* Contrôle fiscal */}
        {missionsActives?.controleFiscal && isVisible("mission_controle_fiscal") && (
          <div ref={(el) => { sectionRefs.current["mission_controle_fiscal"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.missionControleFiscal.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "16px" }}>
              {renderTextBlock(sec("mission_controle_fiscal")?.content ?? "", vars)}
            </div>
            {missionsActives?.controleFiscalOption && (
              <div
                style={{
                  backgroundColor: missionsActives?.controleFiscalOption === "RENONCE" ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${missionsActives?.controleFiscalOption === "RENONCE" ? "#fecaca" : "#bbf7d0"}`,
                  borderRadius: "4px",
                  padding: "14px 18px",
                  fontSize: "13px",
                }}
              >
                <p style={{ fontWeight: 700, margin: "0 0 8px" }}>
                  {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === missionsActives?.controleFiscalOption)?.label || ""}
                </p>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === missionsActives?.controleFiscalOption)?.texte || ""}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Honoraires */}
        {isVisible("honoraires") && (
          <div ref={(el) => { sectionRefs.current["honoraires"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.honoraires.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "16px" }}>
              {renderTextBlock(sec("honoraires")?.content ?? "", vars)}
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: `1px solid ${C.border}`,
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: C.altRow }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${C.border}`, color: C.navy, fontWeight: 600 }}>
                    Désignation
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: `2px solid ${C.border}`, color: C.navy, fontWeight: 600, width: "150px" }}>
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {(tpl.honoraires?.comptable?.lignes ?? []).map((l, i) => {
                  const val = "variable" in l && l.variable
                    ? (honoraires as Record<string, number> | undefined)?.[l.variable] ?? 0
                    : (l as { fixe?: number }).fixe ?? 0;
                  return (
                    <tr key={`c-${i}`} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: i % 2 === 1 ? C.altRow : "transparent" }}>
                      <td style={{ padding: "7px 12px" }}>{l.label}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                        {val ? `${Number(val).toLocaleString("fr-FR")} ${l.suffixe}` : <span style={{ color: "#dc2626", fontSize: "12px" }}>[À compléter]</span>}
                      </td>
                    </tr>
                  );
                })}
                {missionsActives?.sociale && (tpl.honoraires?.sociale?.lignes ?? []).map((l, i) => (
                  <tr key={`s-${i}`} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: ((tpl.honoraires?.comptable?.lignes ?? []).length + i) % 2 === 1 ? C.altRow : "transparent" }}>
                    <td style={{ padding: "7px 12px" }}>{l.label}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                      {l.fixe.toLocaleString("fr-FR")} {l.suffixe}
                    </td>
                  </tr>
                ))}
                {missionsActives?.juridique && (tpl.honoraires?.juridique?.lignes ?? []).map((l, i) => {
                  const val = "variable" in l && l.variable
                    ? (honoraires as Record<string, number> | undefined)?.[l.variable] ?? 0
                    : 0;
                  return (
                    <tr key={`j-${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 12px" }}>{l.label}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                        {val ? `${Number(val).toLocaleString("fr-FR")} ${l.suffixe}` : <span style={{ color: "#dc2626", fontSize: "12px" }}>[À compléter]</span>}
                      </td>
                    </tr>
                  );
                })}
                {missionsActives?.controleFiscal && missionsActives?.controleFiscalOption && missionsActives?.controleFiscalOption !== "RENONCE" && (
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 12px" }}>
                      Contrôle fiscal — {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === missionsActives?.controleFiscalOption)?.label || ""}
                    </td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                      {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === missionsActives?.controleFiscalOption)?.montant?.toLocaleString("fr-FR") || "—"} € HT
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paiement */}
        {isVisible("paiement") && (
          <div ref={(el) => { sectionRefs.current["paiement"] = el; }} style={{ marginBottom: "28px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>MODALITÉS DE PAIEMENT</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap" }}>{renderTextBlock(sec("paiement")?.content ?? "", vars)}</div>
          </div>
        )}

        {/* Conclusion + Signatures */}
        {isVisible("conclusion") && (
          <div ref={(el) => { sectionRefs.current["conclusion"] = el; }} style={{ marginBottom: "28px", marginTop: "40px", scrollMarginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>{tpl.conclusion.titre}</h2>
            <div style={thinRuleStyle} />
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "40px" }}>
              {renderTextBlock(sec("conclusion")?.content ?? "", vars)}
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
              <div style={{ width: "45%", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: C.navy }}>
                  {tpl.conclusion.signatureCabinet.label}
                </p>
                <p style={{ fontSize: "12px", color: C.muted, margin: "0 0 4px" }}>COMPTADEC</p>
                {cabinet?.signature && (
                  <img src={cabinet?.signature} alt="Signature" style={{ height: "64px", margin: "8px auto", objectFit: "contain", display: "block" }} />
                )}
                <div style={{ marginTop: cabinet?.signature ? "4px" : "60px" }}>
                  <p style={{ fontSize: "12px", margin: 0 }}>{clientData?.associe || "[Nom de l'associé]"}</p>
                  <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>Associé signataire</p>
                </div>
              </div>
              <div style={{ width: "45%", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: C.navy }}>
                  {tpl.conclusion.signatureClient.label}
                </p>
                <p style={{ fontSize: "12px", color: C.muted, margin: "0 0 4px" }}>{clientData?.raisonSociale || "[Raison sociale]"}</p>
                <div style={{ marginTop: "60px" }}>
                  <p style={{ fontSize: "12px", margin: 0 }}>{clientData?.dirigeant || "[Nom du dirigeant]"}</p>
                  <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>
                    {clientData?.forme === "SAS" || clientData?.forme === "SASU" ? "Président" : "Gérant"}
                  </p>
                </div>
                <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "8px", fontStyle: "italic" }}>
                  Signature précédée de la mention « Lu et approuvé »
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Annexes */}
        {isVisible("annexes") && (
          <div ref={(el) => { sectionRefs.current["annexes"] = el; }} style={{ marginTop: "40px", paddingTop: "16px", borderTop: `2px solid ${C.navy}`, scrollMarginTop: "20px" }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: "12px" }}>LISTE DES ANNEXES</h2>
            <ol style={{ fontSize: "13px", lineHeight: 2, paddingLeft: "20px", color: C.body, margin: 0 }}>
              <li>Répartition des travaux comptables</li>
              <li>Attestation relative au travail dissimulé</li>
              <li>Mandat de prélèvement SEPA</li>
              <li>Autorisation de télétransmission de la liasse fiscale</li>
              <li>Conditions générales d'intervention</li>
            </ol>

            {/* Annexe 1: Répartition des travaux */}
            <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: "14px" }}>Annexe 1 — Répartition des travaux comptables</h3>
              <div style={thinRuleStyle} />
              <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${C.border}`, fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: C.altRow }}>
                    {(tpl.repartitionTravaux?.colonnes ?? []).map((col: string, i: number) => (
                      <th key={i} style={{ textAlign: i === 0 ? "left" : "center", padding: "6px 10px", borderBottom: `2px solid ${C.border}`, color: C.navy, fontWeight: 600, fontSize: "11px" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(tpl.repartitionTravaux?.lignes ?? []).map((l: any, i: number) => (
                    <tr key={l.id ?? i} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: i % 2 === 1 ? C.altRow : "transparent" }}>
                      <td style={{ padding: "5px 10px" }}>{l.label}</td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>{l.defautCabinet ? "✓" : ""}</td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>{l.defautClient ? "✓" : ""}</td>
                      <td style={{ padding: "5px 10px", textAlign: "center", color: C.muted }}>{l.periodicite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Annexe 2: Attestation travail dissimulé */}
            <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: "14px" }}>Annexe 2 — {tpl.attestationTravailDissimule?.titre ?? "Attestation relative au travail dissimulé"}</h3>
              <div style={thinRuleStyle} />
              <div style={{ fontSize: "12px", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {renderTextBlock(tpl.attestationTravailDissimule?.texte ?? "", vars)}
              </div>
            </div>

            {/* Annexe 3: Mandat SEPA */}
            <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: "14px" }}>Annexe 3 — {tpl.mandatSepa?.titre ?? "Mandat de prélèvement SEPA"}</h3>
              <div style={thinRuleStyle} />
              <div style={{ fontSize: "12px", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: "16px" }}>
                {renderTextBlock(tpl.mandatSepa?.texteAutorisation ?? "", vars)}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${C.border}`, fontSize: "12px" }}>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.altRow }}>
                    <td colSpan={2} style={{ padding: "6px 10px", fontWeight: 700, color: C.navy }}>Créancier</td>
                  </tr>
                  {(tpl.mandatSepa?.champCreancier ?? []).map((c: any) => (
                    <tr key={c.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "5px 10px", color: C.muted, width: "200px" }}>{c.label}</td>
                      <td style={{ padding: "5px 10px", fontWeight: 500 }}>{vars[c.variable] || `[${c.label}]`}</td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.altRow }}>
                    <td colSpan={2} style={{ padding: "6px 10px", fontWeight: 700, color: C.navy }}>Débiteur</td>
                  </tr>
                  {(tpl.mandatSepa?.champDebiteur ?? []).map((c: any) => (
                    <tr key={c.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "5px 10px", color: C.muted, width: "200px" }}>{c.label}</td>
                      <td style={{ padding: "5px 10px", fontWeight: 500 }}>{vars[c.variable] || `[${c.label}]`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Annexe 4: Autorisation liasse fiscale */}
            <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: "14px" }}>Annexe 4 — {tpl.autorisationLiasse?.titre ?? "Autorisation de télétransmission"}</h3>
              <div style={thinRuleStyle} />
              <div style={{ fontSize: "12px", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {renderTextBlock(tpl.autorisationLiasse?.texte ?? "", vars)}
              </div>
            </div>

            {/* Annexe 5: CGV */}
            <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: "14px" }}>Annexe 5 — {tpl.conditionsGenerales?.titre ?? "Conditions générales d'intervention"}</h3>
              <div style={thinRuleStyle} />
              {(tpl.conditionsGenerales?.sections ?? []).map((section: any) => (
                <div key={section.numero} style={{ marginBottom: "14px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: C.navy, marginBottom: "4px" }}>
                    Article {section.numero} — {section.titre}
                  </p>
                  <p style={{ fontSize: "11px", lineHeight: 1.7, whiteSpace: "pre-wrap", color: C.body }}>
                    {section.texte}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ PIED DE PAGE ═══════ */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "12px",
            borderTop: `1px solid ${C.border}`,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "9px", color: "#9ca3af", margin: 0 }}>
            {cabinet?.piedDePage || "Membre de l'Ordre des Experts-Comptables"}
          </p>
          <p style={{ fontSize: "9px", color: "#9ca3af", margin: "2px 0 0" }}>
            COMPTADEC{cabinet?.siret ? ` — SIRET ${cabinet?.siret}` : ""}{cabinet?.numeroOec ? ` — N° OEC ${cabinet?.numeroOec}` : ""}
          </p>
          {cabinet?.siteWeb && (
            <p style={{ fontSize: "9px", color: "#9ca3af", margin: "2px 0 0" }}>
              {cabinet?.siteWeb}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
