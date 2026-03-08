import { useRef, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Shield } from "lucide-react";
import { loadCabinetConfig, type CabinetConfig } from "./CabinetConfigForm";
import type { EditorState, EditorSection } from "./LettreMissionEditor";
import type { Client } from "@/lib/types";
import {
  LETTRE_MISSION_TEMPLATE,
  getFormulePolitesse,
  getCherGenre,
  CONTROLE_FISCAL_OPTIONS,
} from "@/lib/lettreMissionContent";

/* ---- Props ---- */
interface LettreMissionPreviewV2Props {
  state: EditorState;
  client: Client | null;
  activeSectionId?: string | null;
}

/* ---- Variable replacement ---- */
function buildVariableMap(client: Client | null, cabinet: CabinetConfig, state: EditorState): Record<string, string> {
  const c = client;
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const year = new Date().getFullYear().toString();

  return {
    formule_politesse: getFormulePolitesse(state.genre),
    cher_genre: getCherGenre(state.genre),
    dirigeant: c?.dirigeant ?? "",
    raison_sociale: c?.raisonSociale ?? "",
    forme_juridique: c?.forme ?? "",
    capital: c?.capital ? `${Number(c.capital).toLocaleString("fr-FR")} €` : "",
    adresse: c?.adresse ?? "",
    adresse_complete: c ? `${c.adresse}, ${c.cp} ${c.ville}` : "",
    cp: c?.cp ?? "",
    ville: c?.ville ?? "",
    siren: c?.siren ?? "",
    ape: c?.ape ?? "",
    date_creation: "",
    date_cloture: "",
    date_effet: today,
    debut_exercice: `01/01/${year}`,
    fin_exercice: `31/12/${year}`,
    date: today,
    annee: year,
    effectif: c?.effectif?.toString() ?? "",
    domaine: c?.domaine ?? "",
    qualite_dirigeant: c?.forme === "SAS" || c?.forme === "SASU" ? "Président" : "Gérant",
    associe: c?.associe ?? "",
    honoraires: state.honoraires.honoraires ? state.honoraires.honoraires.toLocaleString("fr-FR") : "",
    setup: state.honoraires.setup ? state.honoraires.setup.toLocaleString("fr-FR") : "",
    honoraires_juridique: state.honoraires.honoraires_juridique ? state.honoraires.honoraires_juridique.toLocaleString("fr-FR") : "",
    controle_fiscal_montant: (() => {
      const opt = CONTROLE_FISCAL_OPTIONS.find((o) => o.id === state.missions.controleFiscalOption);
      return opt?.montant ? opt.montant.toLocaleString("fr-FR") : "";
    })(),
    frequence_paiement: state.honoraires.frequence === "mensuel" ? "mensuellement" : "trimestriellement",
    montant_periodique: (() => {
      const div = state.honoraires.frequence === "mensuel" ? 12 : 4;
      return state.honoraires.honoraires ? (state.honoraires.honoraires / div).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "";
    })(),
    cabinet_nom: cabinet.nom,
    cabinet_adresse: `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`,
    cabinet_ics: cabinet.icsSepa,
    ref_client: c?.ref ?? "",
    iban: c?.iban ?? "",
    bic: c?.bic ?? "",
  };
}

function replaceVariables(text: string, vars: Record<string, string>): React.ReactNode[] {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (!part.startsWith("{{")) return <span key={i}>{part}</span>;
    const key = part.slice(2, -2).trim();
    const val = vars[key];
    if (val) {
      return <span key={i} style={{ fontWeight: 500 }}>{val}</span>;
    }
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
        [À COMPLÉTER]
      </span>
    );
  });
}

/* ---- Styles ---- */
const COLORS = {
  navy: "#1a1a2e",
  body: "#333333",
  lightBg: "#f0f4ff",
  accent: "#1e40af",
  border: "#e5e7eb",
  muted: "#6b7280",
  footerBg: "#f9fafb",
};

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: "28px",
  scrollMarginTop: "20px",
};

const H2_STYLE: React.CSSProperties = {
  fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "13px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: COLORS.navy,
  borderBottom: `2px solid ${COLORS.navy}`,
  paddingBottom: "6px",
  marginBottom: "14px",
};

/* ---- Component ---- */
export default function LettreMissionPreviewV2({ state, client, activeSectionId }: LettreMissionPreviewV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [fullscreen, setFullscreen] = useState(false);

  const cabinet = useMemo(() => loadCabinetConfig(), []);
  const vars = useMemo(() => buildVariableMap(client, cabinet, state), [client, cabinet, state]);
  const tpl = LETTRE_MISSION_TEMPLATE;

  // Scroll sync
  useEffect(() => {
    if (activeSectionId && sectionRefs.current[activeSectionId]) {
      sectionRefs.current[activeSectionId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [activeSectionId]);

  // Helper: get section by id
  const getSection = (id: string): EditorSection | undefined =>
    state.sections.find((s) => s.id === id);

  // Render multiline text with variable replacement
  const renderText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => (
      <span key={i}>
        {replaceVariables(line, vars)}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  };

  // Vigilance color
  const vigilanceColor =
    client?.nivVigilance === "RENFORCEE" ? "#dc2626" :
    client?.nivVigilance === "SIMPLIFIEE" ? "#16a34a" : "#2563eb";

  const scoreColor = (score: number) =>
    score >= 70 ? "#dc2626" : score >= 40 ? "#f59e0b" : "#16a34a";

  return (
    <div
      ref={containerRef}
      className={`relative ${fullscreen ? "fixed inset-0 z-50 bg-slate-900/95 p-8 overflow-auto" : "h-full overflow-y-auto"}`}
      style={{ backgroundColor: fullscreen ? undefined : "#f1f5f9" }}
    >
      {/* Fullscreen toggle */}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-4 z-10 h-8 w-8 bg-background/80 backdrop-blur border-white/20"
        onClick={() => setFullscreen(!fullscreen)}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>

      {/* A4 Paper */}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "60px 50px 40px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "14px",
          lineHeight: "1.6",
          color: COLORS.body,
          minHeight: fullscreen ? "auto" : "1100px",
        }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <div ref={(el) => { sectionRefs.current["entete"] = el; }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              {cabinet.logo ? (
                <img src={cabinet.logo} alt="Logo" style={{ height: "56px", width: "56px", objectFit: "contain" }} />
              ) : (
                <div style={{
                  height: "56px", width: "56px", borderRadius: "8px",
                  background: `linear-gradient(135deg, ${cabinet.couleurPrimaire}, ${cabinet.couleurSecondaire || "#64748b"})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, fontSize: "20px",
                }}>
                  {(cabinet.nom || "C").charAt(0)}
                </div>
              )}
              <div>
                <h1 style={{
                  fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: "18px", fontWeight: 800,
                  color: cabinet.couleurPrimaire || COLORS.navy,
                  margin: 0, lineHeight: 1.2,
                }}>
                  {cabinet.nom || "CABINET D'EXPERTISE COMPTABLE"}
                </h1>
                <p style={{ fontSize: "11px", color: COLORS.muted, margin: "4px 0 0" }}>
                  {cabinet.adresse && `${cabinet.adresse}, `}{cabinet.cp} {cabinet.ville}
                </p>
                <p style={{ fontSize: "11px", color: COLORS.muted, margin: "2px 0 0" }}>
                  {cabinet.email}{cabinet.telephone && ` — ${cabinet.telephone}`}
                </p>
                {cabinet.siret && (
                  <p style={{ fontSize: "10px", color: "#9ca3af", margin: "2px 0 0" }}>
                    SIRET : {cabinet.siret} | N° OEC : {cabinet.numeroOec}
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* Gradient divider */}
          <div style={{
            height: "2px", width: "100%", marginBottom: "24px",
            background: `linear-gradient(to right, ${cabinet.couleurPrimaire || COLORS.navy}, ${cabinet.couleurSecondaire || "#94a3b8"})`,
          }} />
        </div>

        {/* ═══════════════ DESTINATAIRE ═══════════════ */}
        {client && (
          <div style={{ marginLeft: "auto", maxWidth: "300px", marginBottom: "32px", textAlign: "right" }}>
            <p style={{ fontWeight: 600, fontSize: "14px", margin: 0 }}>
              {client.raisonSociale}
            </p>
            <p style={{ fontSize: "12px", color: COLORS.muted, margin: "2px 0" }}>
              {client.forme} — SIREN {client.siren}
            </p>
            <p style={{ fontSize: "12px", color: COLORS.muted, margin: "2px 0" }}>
              {client.adresse}
            </p>
            <p style={{ fontSize: "12px", color: COLORS.muted, margin: "2px 0" }}>
              {client.cp} {client.ville}
            </p>
            {client.dirigeant && (
              <p style={{ fontSize: "12px", margin: "6px 0 0" }}>
                À l'attention de <strong>{client.dirigeant}</strong>
              </p>
            )}
          </div>
        )}

        {/* ═══════════════ TITLE ═══════════════ */}
        <h1 style={{
          fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          textAlign: "center",
          fontSize: "20px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: COLORS.navy,
          marginBottom: "4px",
        }}>
          Lettre de Mission
        </h1>
        <p style={{
          fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          textAlign: "center",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: COLORS.muted,
          marginBottom: "32px",
        }}>
          Présentation des comptes annuels
        </p>

        {/* ═══════════════ INTRODUCTION ═══════════════ */}
        {getSection("introduction")?.visible && (
          <div ref={(el) => { sectionRefs.current["introduction"] = el; }} style={SECTION_STYLE}>
            <p>{renderText(getSection("introduction")!.content)}</p>
          </div>
        )}

        {/* ═══════════════ VOTRE ENTITÉ ═══════════════ */}
        {getSection("entite")?.visible && client && (
          <div ref={(el) => { sectionRefs.current["entite"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.entite.titre}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                {[
                  ["Raison sociale", client.raisonSociale],
                  ["Forme juridique", client.forme],
                  client.capital ? ["Capital social", `${Number(client.capital).toLocaleString("fr-FR")} €`] : null,
                  ["Adresse du siège social", `${client.adresse}, ${client.cp} ${client.ville}`],
                  ["N° SIREN", client.siren],
                  client.ape ? ["Code APE / NAF", client.ape] : null,
                  ["Dirigeant / Représentant légal", client.dirigeant],
                  client.effectif ? ["Effectif", `${client.effectif} salarié(s)`] : null,
                  client.domaine ? ["Domaine d'activité", client.domaine] : null,
                ].filter(Boolean).map(([label, value], i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "6px 12px 6px 0", color: COLORS.muted, width: "220px", verticalAlign: "top" }}>{label}</td>
                    <td style={{ padding: "6px 0", fontWeight: 500 }}>{value || <span style={{ color: "#dc2626", fontSize: "12px" }}>[À COMPLÉTER]</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════ LCB-FT ENCADRÉ ═══════════════ */}
        {getSection("lcbft")?.visible && (
          <div ref={(el) => { sectionRefs.current["lcbft"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Shield style={{ width: "16px", height: "16px", color: COLORS.accent }} />
                {tpl.lcbft.titre}
              </span>
            </h2>
            <p style={{ fontSize: "10px", color: COLORS.muted, fontStyle: "italic", marginBottom: "12px" }}>
              {tpl.lcbft.soustitre}
            </p>

            {/* Special encadré */}
            <div style={{
              backgroundColor: COLORS.lightBg,
              border: `1px solid ${COLORS.accent}40`,
              borderLeft: `4px solid ${COLORS.accent}`,
              borderRadius: "6px",
              padding: "16px 20px",
              marginBottom: "16px",
            }}>
              {client && (
                <div style={{ display: "flex", gap: "20px", marginBottom: "14px", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", minWidth: "100px" }}>
                    <p style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Niveau de vigilance</p>
                    <p style={{
                      fontSize: "15px", fontWeight: 700, color: vigilanceColor,
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      {client.nivVigilance || "NORMALE"}
                    </p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "80px" }}>
                    <p style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Score global</p>
                    <p style={{
                      fontSize: "15px", fontWeight: 700,
                      color: scoreColor(client.scoreGlobal ?? 0),
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      {client.scoreGlobal ?? "—"}/100
                    </p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "60px" }}>
                    <p style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>PPE</p>
                    <p style={{
                      fontSize: "15px", fontWeight: 700,
                      color: client.ppe === "OUI" ? "#dc2626" : "#16a34a",
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      {client.ppe || "NON"}
                    </p>
                  </div>
                  {client.paysRisque && (
                    <div style={{ textAlign: "center", minWidth: "80px" }}>
                      <p style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Pays à risque</p>
                      <p style={{
                        fontSize: "15px", fontWeight: 700,
                        color: client.paysRisque === "OUI" ? "#dc2626" : "#16a34a",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        {client.paysRisque}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {client?.be && (
                <p style={{ fontSize: "12px", marginBottom: "8px" }}>
                  <strong>Bénéficiaire(s) effectif(s) :</strong> {client.be}
                </p>
              )}

              <p style={{ fontSize: "12.5px", lineHeight: 1.6, marginBottom: "8px" }}>
                {tpl.lcbft.engagements}
              </p>
              <p style={{ fontSize: "12px", lineHeight: 1.6, color: COLORS.muted }}>
                {tpl.lcbft.conservation}
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════ NOTRE MISSION ═══════════════ */}
        {getSection("mission")?.visible && (
          <div ref={(el) => { sectionRefs.current["mission"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.mission.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("mission")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ DURÉE ═══════════════ */}
        {getSection("duree")?.visible && (
          <div ref={(el) => { sectionRefs.current["duree"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.duree.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("duree")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ NATURE ET LIMITES ═══════════════ */}
        {getSection("nature")?.visible && (
          <div ref={(el) => { sectionRefs.current["nature"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.nature.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("nature")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ MISSION SOCIALE (conditional) ═══════════════ */}
        {state.missions.sociale && getSection("mission_sociale")?.visible && (
          <div ref={(el) => { sectionRefs.current["mission_sociale"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.missionSociale.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("mission_sociale")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ MISSION JURIDIQUE (conditional) ═══════════════ */}
        {state.missions.juridique && getSection("mission_juridique")?.visible && (
          <div ref={(el) => { sectionRefs.current["mission_juridique"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.missionJuridique.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("mission_juridique")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ CONTRÔLE FISCAL (conditional) ═══════════════ */}
        {state.missions.controleFiscal && getSection("mission_controle_fiscal")?.visible && (
          <div ref={(el) => { sectionRefs.current["mission_controle_fiscal"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.missionControleFiscal.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "16px" }}>
              {renderText(getSection("mission_controle_fiscal")!.content)}
            </div>
            {/* Selected option highlight */}
            {state.missions.controleFiscalOption && (
              <div style={{
                backgroundColor: state.missions.controleFiscalOption === "RENONCE" ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${state.missions.controleFiscalOption === "RENONCE" ? "#fecaca" : "#bbf7d0"}`,
                borderRadius: "6px",
                padding: "12px 16px",
                fontSize: "12.5px",
              }}>
                <p style={{ fontWeight: 700, marginBottom: "8px" }}>
                  {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === state.missions.controleFiscalOption)?.label}
                </p>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === state.missions.controleFiscalOption)?.texte}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ HONORAIRES ═══════════════ */}
        {getSection("honoraires")?.visible && (
          <div ref={(el) => { sectionRefs.current["honoraires"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>{tpl.honoraires.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "16px" }}>
              {renderText(getSection("honoraires")!.content)}
            </div>

            {/* Honoraires table */}
            <table style={{
              width: "100%", borderCollapse: "collapse",
              border: `1px solid ${COLORS.border}`, fontSize: "13px", marginBottom: "12px",
            }}>
              <thead>
                <tr style={{ backgroundColor: COLORS.footerBg }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${COLORS.border}`, color: COLORS.navy, fontWeight: 600 }}>
                    Désignation
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: `2px solid ${COLORS.border}`, color: COLORS.navy, fontWeight: 600, width: "140px" }}>
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Comptable */}
                {tpl.honoraires.comptable.lignes.map((l, i) => {
                  const val = "variable" in l
                    ? (state.honoraires as Record<string, number>)[l.variable]
                    : l.fixe;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "6px 12px" }}>{l.label}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                        {val ? `${Number(val).toLocaleString("fr-FR")} ${l.suffixe}` : <span style={{ color: "#dc2626", fontSize: "12px" }}>[À COMPLÉTER]</span>}
                      </td>
                    </tr>
                  );
                })}
                {/* Sociale */}
                {state.missions.sociale && tpl.honoraires.sociale.lignes.map((l, i) => (
                  <tr key={`soc-${i}`} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "6px 12px" }}>{l.label}</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                      {l.fixe.toLocaleString("fr-FR")} {l.suffixe}
                    </td>
                  </tr>
                ))}
                {/* Juridique */}
                {state.missions.juridique && tpl.honoraires.juridique.lignes.map((l, i) => {
                  const val = "variable" in l
                    ? (state.honoraires as Record<string, number>)[l.variable!]
                    : null;
                  return (
                    <tr key={`jur-${i}`} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "6px 12px" }}>{l.label}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                        {val ? `${Number(val).toLocaleString("fr-FR")} ${l.suffixe}` : <span style={{ color: "#dc2626", fontSize: "12px" }}>[À COMPLÉTER]</span>}
                      </td>
                    </tr>
                  );
                })}
                {/* Contrôle fiscal */}
                {state.missions.controleFiscal && state.missions.controleFiscalOption && state.missions.controleFiscalOption !== "RENONCE" && (
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "6px 12px" }}>
                      Assistance contrôle fiscal — {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === state.missions.controleFiscalOption)?.label}
                    </td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                      {CONTROLE_FISCAL_OPTIONS.find((o) => o.id === state.missions.controleFiscalOption)?.montant?.toLocaleString("fr-FR")} € HT
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════ PAIEMENT ═══════════════ */}
        {getSection("paiement")?.visible && (
          <div ref={(el) => { sectionRefs.current["paiement"] = el; }} style={SECTION_STYLE}>
            <h2 style={H2_STYLE}>MODALITÉS DE PAIEMENT</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderText(getSection("paiement")!.content)}</div>
          </div>
        )}

        {/* ═══════════════ CONCLUSION + SIGNATURES ═══════════════ */}
        {getSection("conclusion")?.visible && (
          <div ref={(el) => { sectionRefs.current["conclusion"] = el; }} style={{ ...SECTION_STYLE, marginTop: "40px" }}>
            <h2 style={H2_STYLE}>{tpl.conclusion.titre}</h2>
            <div style={{ whiteSpace: "pre-wrap", marginBottom: "40px" }}>
              {renderText(getSection("conclusion")!.content)}
            </div>

            {/* Signature blocks */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
              {/* Cabinet */}
              <div style={{ width: "45%", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: COLORS.navy }}>
                  {tpl.conclusion.signatureCabinet.label}
                </p>
                <p style={{ fontSize: "12px", color: COLORS.muted }}>{cabinet.nom}</p>
                {cabinet.signature && (
                  <img src={cabinet.signature} alt="Signature" style={{ height: "64px", margin: "8px auto", objectFit: "contain" }} />
                )}
                <div style={{ marginTop: cabinet.signature ? "4px" : "60px" }}>
                  <p style={{ fontSize: "12px" }}>{vars.associe || "[Nom de l'associé]"}</p>
                  <p style={{ fontSize: "11px", color: COLORS.muted }}>Associé signataire</p>
                </div>
              </div>
              {/* Client */}
              <div style={{ width: "45%", textAlign: "center" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: COLORS.navy }}>
                  {tpl.conclusion.signatureClient.label}
                </p>
                <p style={{ fontSize: "12px", color: COLORS.muted }}>{client?.raisonSociale || "[Raison sociale]"}</p>
                <div style={{ marginTop: "60px" }}>
                  <p style={{ fontSize: "12px" }}>{client?.dirigeant || "[Nom du dirigeant]"}</p>
                  <p style={{ fontSize: "11px", color: COLORS.muted }}>{vars.qualite_dirigeant}</p>
                </div>
                <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "8px", fontStyle: "italic" }}>
                  Signature précédée de la mention « Lu et approuvé »
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ANNEXES LIST ═══════════════ */}
        {getSection("annexes")?.visible && (
          <div ref={(el) => { sectionRefs.current["annexes"] = el; }} style={{
            marginTop: "40px", paddingTop: "16px",
            borderTop: `2px solid ${COLORS.navy}`,
          }}>
            <h2 style={{ ...H2_STYLE, borderBottom: "none" }}>LISTE DES ANNEXES</h2>
            <ol style={{ fontSize: "13px", lineHeight: 2, paddingLeft: "20px", color: COLORS.body }}>
              <li>Répartition des travaux comptables</li>
              <li>Attestation relative au travail dissimulé</li>
              <li>Mandat de prélèvement SEPA</li>
              <li>Autorisation de télétransmission de la liasse fiscale</li>
              <li>Conditions générales d'intervention</li>
            </ol>
          </div>
        )}

        {/* ═══════════════ FOOTER ═══════════════ */}
        <div style={{
          marginTop: "48px",
          paddingTop: "12px",
          borderTop: `1px solid ${COLORS.border}`,
          textAlign: "center",
        }}>
          <p style={{ fontSize: "9px", color: "#9ca3af", margin: 0 }}>
            {cabinet.piedDePage || "Membre de l'Ordre des Experts-Comptables"}
          </p>
          <p style={{ fontSize: "9px", color: "#9ca3af", margin: "2px 0 0" }}>
            {cabinet.nom}{cabinet.siret && ` — SIRET ${cabinet.siret}`}{cabinet.numeroOec && ` — N° OEC ${cabinet.numeroOec}`}
          </p>
          {cabinet.siteWeb && (
            <p style={{ fontSize: "9px", color: "#9ca3af", margin: "2px 0 0" }}>
              {cabinet.siteWeb}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
