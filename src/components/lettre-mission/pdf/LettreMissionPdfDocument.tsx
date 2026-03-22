import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { LettreMissionPdfData, HonorairesData, LcbftData } from "@/types/lettreMissionPdf";
import { TEXTES_SECTIONS } from "@/lib/lettreMissionDefaults";
import { styles, colors, s, safeNumber, buildTheme, sanitizeForPdf, normalizeSiren, isValidLogoBase64 } from "./pdfStyles";
import { SideStripe, SectionBanner, Separator, SignatureBox, InfoRow, type PdfTheme } from "./PdfComponents";
import PdfTableEntite from "./PdfTableEntite";
import PdfTableHonoraires from "./PdfTableHonoraires";
import PdfTableRepartition from "./PdfTableRepartition";
import PdfSectionLcbft from "./PdfSectionLcbft";
import PdfConditionsGenerales from "./PdfConditionsGenerales";
import PdfAnnexes from "./PdfAnnexes";

interface Props {
  data: LettreMissionPdfData;
}

const LettreMissionPdfDocument: React.FC<Props> = ({ data }) => {
  // Sanitize all numeric values to prevent NaN/Infinity reaching yoga layout engine
  const honoraires: HonorairesData = {
    forfait_annuel_ht: safeNumber(data.honoraires.forfait_annuel_ht),
    constitution_dossier_ht: safeNumber(data.honoraires.constitution_dossier_ht),
    honoraires_ec_heure: safeNumber(data.honoraires.honoraires_ec_heure, 200),
    honoraires_collab_heure: safeNumber(data.honoraires.honoraires_collab_heure, 100),
    juridique_annuel_ht: safeNumber(data.honoraires.juridique_annuel_ht),
    frequence_facturation: data.honoraires.frequence_facturation || "MENSUEL",
    social_bulletin_unite: safeNumber(data.honoraires.social_bulletin_unite, 32),
    social_fin_contrat: safeNumber(data.honoraires.social_fin_contrat, 30),
    social_contrat_simple: safeNumber(data.honoraires.social_contrat_simple, 100),
    social_entree_sans_contrat: safeNumber(data.honoraires.social_entree_sans_contrat, 30),
    social_attestation_maladie: safeNumber(data.honoraires.social_attestation_maladie, 30),
  };
  const lcbft: LcbftData = {
    score_risque: safeNumber(data.lcbft.score_risque),
    niveau_vigilance: data.lcbft.niveau_vigilance || "STANDARD",
    statut_ppe: Boolean(data.lcbft.statut_ppe),
    derniere_diligence_kyc: data.lcbft.derniere_diligence_kyc,
    prochaine_maj_kyc: data.lcbft.prochaine_maj_kyc,
  };
  const { cabinet, client, mission, repartition } = data;

  // Build theme from cabinet colors
  const theme = buildTheme(cabinet.couleur_primaire, cabinet.couleur_secondaire);

  // Format date in French long format
  const dateLong = formatDateLong(data.date_generation);

  // C1/C2 — consistency constants
  const cabinetNom = s(cabinet.nom);

  // BUG 6 / C5 / BUG E — expert name: prefer data, never show cabinet name, never show "—"
  const expertName = data.expert_responsable && data.expert_responsable !== cabinet.nom && data.expert_responsable !== "\u2014" && data.expert_responsable !== ""
    ? data.expert_responsable
    : (data as any).responsable_mission || "";

  // C3 — normalized SIREN for consistent display
  const clientSiren = normalizeSiren(client.siren || "");

  // BUG 5 — safe exercice dates with fallback (trim to catch spaces/invisible chars)
  const rawDateDebut = (client.exercice_debut || "").trim();
  const dateDebut = rawDateDebut && rawDateDebut !== "\u2014" && rawDateDebut.length > 2
    ? rawDateDebut : `01/01/${new Date().getFullYear()}`;
  const rawDateFin = (client.exercice_fin || "").trim();
  const dateFin = rawDateFin && rawDateFin !== "\u2014" && rawDateFin.length > 2
    ? rawDateFin : `31/12/${new Date().getFullYear()}`;

  // E1 — Document metadata
  const pdfTitle = `Lettre de Mission ${s(data.numero_lm)} - ${s(client.raison_sociale)}`;
  const pdfAuthor = cabinetNom;

  // Header: "CABINET | Lettre de Mission — NUMÉRO"
  const Header = () => (
    <View style={styles.headerFixed} fixed>
      <Text style={styles.headerText}>{cabinetNom}</Text>
      <Text style={styles.headerText}>Lettre de Mission — {s(data.numero_lm)}</Text>
    </View>
  );

  // Footer: "CABINET | Document confidentiel — Page X sur Y"
  const Footer = () => (
    <View style={styles.footerFixed} fixed>
      <Text style={styles.footerText}>{cabinetNom} | Document confidentiel</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} sur ${totalPages}`}
      />
    </View>
  );

  // If we have sections_snapshot (modele-based), render from that
  if (data.sections_snapshot && data.sections_snapshot.length > 0) {
    return (
      <Document title={pdfTitle} author={pdfAuthor} subject="Lettre de Mission" creator="GRIMY">
        <Page size="A4" style={styles.page} wrap>
          <SideStripe color={theme.primaire} />
          <Header />
          <Footer />
          {data.is_brouillon && (
            <Text style={styles.watermark} fixed>PROJET</Text>
          )}

          {/* Cover */}
          <RenderCover data={data} theme={theme} />

          {/* Render each section from snapshot */}
          {data.sections_snapshot
            .sort((a, b) => a.ordre - b.ordre)
            .map((section) => (
              <RenderSnapshotSection key={section.id} section={section} data={data} theme={theme} />
            ))}

          {/* CGV */}
          <PdfConditionsGenerales cgv_override={data.cgv_snapshot} cabinet_nom={s(cabinet.nom)} theme={theme} date_generation={data.date_generation} />
        </Page>
      </Document>
    );
  }

  // Standard structured generation
  return (
    <Document title={pdfTitle} author={pdfAuthor} subject="Lettre de Mission" creator="GRIMY">
      <Page size="A4" style={styles.page} wrap>
        <SideStripe color={theme.primaire} />
        <Header />
        <Footer />
        {data.is_brouillon && (
          <Text style={styles.watermark} fixed>PROJET</Text>
        )}

        {/* PAGE DE GARDE */}
        <RenderCover data={data} theme={theme} />

        {/* DESTINATAIRE — formule de politesse */}
        {/* V2-12: Bold name for emphasis */}
        <View style={styles.destBlock}>
          <Text style={styles.destText}>
            À l'attention de{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(client.civilite)} {s(client.nom_dirigeant)}</Text>,
          </Text>
          <Text style={styles.destText}>
            Mandataire social de la société
          </Text>
          <Text style={[styles.destText, { fontFamily: "Helvetica-Bold" }]}>
            {s(client.forme_juridique)} {s(client.raison_sociale)}
          </Text>
          <Text style={styles.destText}>
            {s(client.adresse)}, {s(client.code_postal)} {s(client.ville)}
          </Text>
        </View>

        {/* 1. INTRODUCTION — C9: wrap={false} keeps banner+first para together */}
        <View wrap={false}>
          <SectionBanner title="Introduction" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.introduction}</Text>
        </View>

        {/* 2. VOTRE ENTITÉ — break to avoid orphaned blue header at page bottom */}
        <View break>
          <SectionBanner title="Votre entité" theme={theme} />
          <PdfTableEntite client={client} theme={theme} />
        </View>

        {/* 3. ORGANISATION ET TRANSMISSION — C9: wrap={false} */}
        <View wrap={false}>
          <SectionBanner title="Organisation et transmission" theme={theme} />
          <Text style={styles.bodyText}>
            Organisation et transmission des documents comptables :
          </Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bulletSymbol}>▪</Text>
            <Text style={styles.bulletText}>
              Périodicité : {s(data.periodicite_transmission)} — Avant le J+10
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bulletSymbol}>▪</Text>
            <Text style={styles.bulletText}>
              Transmission via : {s(data.outil_transmission)}
            </Text>
          </View>
          <Text style={[styles.bodyText, { marginTop: 4 }]}>
            {TEXTES_SECTIONS.lcbft_conservation}
          </Text>
        </View>

        {/* 4. OBLIGATIONS DE VIGILANCE LCB-FT */}
        <View wrap={false}>
          <SectionBanner title="Obligations de vigilance LCB-FT" theme={theme} />
          <PdfSectionLcbft lcbft={lcbft} theme={theme} />
        </View>

        {/* 5. NOTRE MISSION — C9 */}
        <View wrap={false}>
          <SectionBanner title="Notre mission" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.notre_mission}</Text>
        </View>

        {/* 6. RESPONSABLE DE LA MISSION — C9 */}
        <View wrap={false}>
          <SectionBanner title="Responsable de la mission" theme={theme} />
          <Text style={styles.bodyText}>
            Le responsable de la mission est {expertName}, expert-comptable inscrit au
            tableau de l'Ordre, qui apportera personnellement son concours à la mission et en garantira la
            bonne réalisation au nom de notre structure d'exercice.
          </Text>
        </View>

        {/* 7. DURÉE DE LA MISSION — C9 + BUG 5 fix */}
        <View wrap={false}>
          <SectionBanner title="Durée de la mission" theme={theme} />
          <Text style={styles.bodyText}>
            Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera
            sur les comptes de l'exercice comptable commençant le {dateDebut} et se terminant le {dateFin}.
          </Text>
          <Text style={styles.bodyText}>
            Cette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation,
            de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions
            Générales d'Intervention.
          </Text>
        </View>

        {/* 8. NATURE ET LIMITE — C9 */}
        <View wrap={false}>
          <SectionBanner title="Nature et limite de la mission" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.nature_limite}</Text>
        </View>

        {/* 9. MISSIONS COMPLÉMENTAIRES */}
        {(mission.mission_sociale || mission.mission_juridique || mission.controle_fiscal) && (
          <>
            <SectionBanner title="Missions complémentaires" theme={theme} />
            <Text style={styles.bodyText}>
              Vous avez souhaité également qu'en complément de cette mission nous assurions les prestations
              suivantes :
            </Text>

            {mission.mission_sociale && (
              <>
                <Text style={styles.sectionSubtitle}>Mission sociale</Text>
                <Text style={styles.bodyText}>{TEXTES_SECTIONS.mission_sociale}</Text>
              </>
            )}

            {mission.mission_juridique && (
              <>
                <Text style={styles.sectionSubtitle}>Mission juridique</Text>
                <Text style={styles.bodyText}>{TEXTES_SECTIONS.mission_juridique}</Text>
              </>
            )}

            {mission.controle_fiscal && (
              <>
                <Text style={styles.sectionSubtitle}>
                  Assistance au contrôle fiscal (sur option)
                </Text>
                <Text style={styles.bodyText}>{TEXTES_SECTIONS.controle_fiscal}</Text>
              </>
            )}
          </>
        )}

        {/* 10. MODALITÉS RELATIONNELLES — C9 */}
        <View wrap={false}>
          <SectionBanner title="Modalités relationnelles" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.modalites}</Text>
        </View>

        {/* 11. CLAUSE RÉSOLUTOIRE — C9 */}
        <View wrap={false}>
          <SectionBanner title="Clause résolutoire" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.clause_resolutoire}</Text>
        </View>

        {/* 12. MANDAT ADMINISTRATIONS — C9 */}
        <View wrap={false}>
          <SectionBanner title="Mandat pour agir auprès des administrations" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.mandat_administrations}</Text>
        </View>

        {/* 13. HONORAIRES — C9 */}
        <View wrap={false}>
          <SectionBanner title="Honoraires" theme={theme} />
          <Text style={styles.bodyText}>{TEXTES_SECTIONS.honoraires_intro}</Text>
        </View>
        <PdfTableHonoraires honoraires={honoraires} mission={mission} theme={theme} />
        <Text style={[styles.bodyText, { marginTop: 6, fontSize: 8.5 }]}>
          {TEXTES_SECTIONS.honoraires_frais}
        </Text>
        <Text style={[styles.bodyText, { fontSize: 8.5 }]}>
          {TEXTES_SECTIONS.honoraires_facturation
            .replace("{{frequence_facturation}}", honoraires.frequence_facturation === "MENSUEL" ? "mensuellement" : honoraires.frequence_facturation === "TRIMESTRIEL" ? "trimestriellement" : "annuellement")}
        </Text>

        {/* 14. FORMULE DE CLÔTURE + SIGNATURE */}
        <View wrap={false}>
          <SectionBanner title="Acceptation et signature" theme={theme} />
          <Text style={styles.bodyText}>
            {TEXTES_SECTIONS.formule_cloture
              .replace("{{formule_civilite}}", s(client.civilite) === "Mme" ? "Chère Madame" : "Cher Monsieur")
              .replace("{{nom_dirigeant}}", s(client.nom_dirigeant))}
          </Text>
          <Text style={[styles.bodyText, { marginTop: 6, fontFamily: "Helvetica-Oblique" }]}>
            Fait à {s(cabinet.ville)}, le {dateLong}
          </Text>
          <View style={styles.signatureContainer}>
            <SignatureBox
              label="L'Expert-comptable"
              boldName
              name={expertName || undefined}
              signatureImage={data.signature_expert}
            />
            <SignatureBox
              label="Le Client"
              name={`${s(client.civilite)} ${s(client.nom_dirigeant)}`}
              signatureImage={data.signature_client}
            />
          </View>
        </View>

        {/* ANNEXE — RÉPARTITION DES TRAVAUX */}
        <View break>
          <SectionBanner title="Annexe 1 — Répartition des travaux" theme={theme} />
          <PdfTableRepartition rows={repartition} theme={theme} />
        </View>

        {/* ANNEXES */}
        <PdfAnnexes data={data} theme={theme} />

        {/* CGV */}
        <PdfConditionsGenerales cgv_override={data.cgv_snapshot} cabinet_nom={s(cabinet.nom)} theme={theme} />
      </Page>
    </Document>
  );
};

// ── Helper sub-components ────────────────────

// Format DD/MM/YYYY or ISO date to "21 mars 2026"
function formatDateLong(raw: string): string {
  if (!raw || raw === "—") return "—";
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  return raw;
}

const RenderCover: React.FC<{ data: LettreMissionPdfData; theme: PdfTheme }> = ({ data, theme }) => {
  const { cabinet, client, mission } = data;
  // B14 — validate logo before rendering
  const hasValidLogo = isValidLogoBase64(cabinet.logo_base64);
  // C3 — normalized SIREN
  const displaySiren = normalizeSiren(client.siren || "");

  return (
    <View>
      {/* Logo + cabinet name */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* V2-2: ref block with subtle left accent */}
        <View style={{ borderLeftWidth: 2, borderLeftColor: theme.primaire, paddingLeft: 6 }}>
          <Text style={{ fontSize: 8.5, color: theme.muted }}>Réf. {s(data.numero_lm)}</Text>
          <Text style={{ fontSize: 8.5, color: theme.muted }}>Date : {formatDateLong(data.date_generation)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {hasValidLogo ? (
            <Image src={cabinet.logo_base64!} style={{ width: 80 }} />
          ) : (
            /* V2-3: fallback text fontSize 16 (was 14) */
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: theme.secondaire }}>
              {s(cabinet.nom)}
            </Text>
          )}
          {hasValidLogo && (
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: theme.secondaire, marginTop: 4 }}>
              {s(cabinet.nom)}
            </Text>
          )}
          <Text style={{ fontSize: 8, color: theme.muted }}>
            {s(cabinet.adresse)}, {s(cabinet.cp)} {s(cabinet.ville)}
          </Text>
          {/* V2-4: SIRET uses theme.border instead of hardcoded #BBBBBB */}
          <Text style={{ fontSize: 7.5, color: theme.border }}>
            SIRET {s(cabinet.siret)}{cabinet.oec_numero ? ` \u2014 OEC ${s(cabinet.oec_numero)}` : ""}
          </Text>
          {(cabinet.email || cabinet.telephone) && (
            <Text style={{ fontSize: 7.5, color: theme.border, marginTop: 1 }}>
              {[cabinet.email, cabinet.telephone].filter(Boolean).join(" \u2014 ")}
            </Text>
          )}
        </View>
      </View>

      {/* Title — BUG 1 fix: grouped in View to prevent overlap */}
      <View style={{ alignItems: "center" }}>
        <Text style={[styles.coverTitle, { color: theme.secondaire }]}>LETTRE DE MISSION</Text>
        <Text style={[styles.coverSubtitle, { color: theme.primaire }]}>{s(mission.type_principal)}</Text>
        {/* Fine line under subtitle */}
        <View style={{ width: "100%", borderBottomWidth: 0.5, borderBottomColor: theme.primaire, marginBottom: 6, marginTop: 2 }} />
        <Text style={[styles.coverNorme, { color: theme.muted }]}>{s(mission.norme_applicable)}</Text>
      </View>

      {/* Premium separator */}
      <Separator color={theme.primaire} />

      {/* V2-6: Info grid with premium InfoRow — marginBottom 6 */}
      <View style={{ marginBottom: 6 }}>
        <InfoRow label="Client" value={`${s(client.forme_juridique)} ${s(client.raison_sociale)}`} theme={theme} />
        <InfoRow label="SIREN" value={displaySiren || "\u2014"} theme={theme} />
        <InfoRow label="Exercice" value={`${s(client.exercice_debut)} \u2014 ${s(client.exercice_fin)}`} theme={theme} />
      </View>

      <Separator color={theme.primaire} />
    </View>
  );
};

/** Render a section from the snapshot (modele-based) */
const RenderSnapshotSection: React.FC<{
  section: { id: string; titre: string; contenu: string; type: string };
  data: LettreMissionPdfData;
  theme: PdfTheme;
}> = ({ section, data, theme }) => {
  // B13 — sanitize text content for PDF + BUG 3/4: replace ª and resolve variables
  // BUG B — auto-fix legacy "par sondages" text from old snapshots
  // BUG D — resolve unresolved template variables
  // BUG F — resolve {{nom_cabinet}} / {{cabinet_nom}}
  const rawDateDebut = (data.client.exercice_debut || "").trim();
  const dateDebut = rawDateDebut && rawDateDebut !== "\u2014" && rawDateDebut.length > 2
    ? rawDateDebut : `01/01/${new Date().getFullYear()}`;
  const rawDateFin = (data.client.exercice_fin || "").trim();
  const dateFin = rawDateFin && rawDateFin !== "\u2014" && rawDateFin.length > 2
    ? rawDateFin : `31/12/${new Date().getFullYear()}`;
  const content = sanitizeForPdf(section.contenu || "")
    .replace(/ª/g, "▪")
    .replace(/\{\{nom_cabinet\}\}/g, data.cabinet.nom || "CABINET")
    .replace(/\{\{cabinet_nom\}\}/g, data.cabinet.nom || "CABINET")
    .replace(/\{\{adresse_cabinet\}\}/g, `${data.cabinet.adresse || ""}, ${data.cabinet.cp || ""} ${data.cabinet.ville || ""}`)
    .replace(/\{\{date_cloture\}\}/g, dateFin)
    .replace(/\{\{date_du_jour\}\}/g, data.date_generation || new Date().toLocaleDateString("fr-FR"))
    .replace(/\{\{exercice_debut\}\}/g, dateDebut)
    .replace(/\{\{exercice_fin\}\}/g, dateFin)
    .replace(/\{\{iban\}\}/g, data.iban || "________________________")
    .replace(/\{\{bic\}\}/g, data.bic || "___________")
    .replace(/\{\{mode_paiement\}\}/g, data.honoraires?.mode_paiement || "prélèvement automatique")
    .replace(/\{\{sous_options_(\w+)\}\}/g, (_match, _missionId) => "")
    .replace(/effectués par sondages\b[^.]*/g, "effectués par notre cabinet uniquement par épreuves, et ne portent donc pas sur l'appréciation de la légalité et de la fiabilité des documents présentés")
    .replace(/par sondages\./g, "par notre cabinet uniquement par épreuves, et ne portent donc pas sur l'appréciation de la légalité et de la fiabilité des documents présentés.");

  // Skip empty sections (B15)
  if (!content.trim() && section.id !== "entite" && section.id !== "honoraires" && section.id !== "annexe_repartition" && section.id !== "lcbft") {
    return null;
  }

  // Special rendering for table sections
  // BUG C — break before entity table to prevent orphaned blue header at page bottom
  if (section.id === "entite" || content === "TABLEAU_ENTITE") {
    return (
      <View break>
        <SectionBanner title={section.titre} theme={theme} />
        <PdfTableEntite client={data.client} theme={theme} />
      </View>
    );
  }

  if (section.id === "honoraires" || content.startsWith("TABLEAU_HONORAIRES")) {
    const textAfterTable = content.replace("TABLEAU_HONORAIRES", "").trim();
    return (
      <View>
        <SectionBanner title={section.titre} theme={theme} />
        <PdfTableHonoraires honoraires={data.honoraires} mission={data.mission} theme={theme} />
        {textAfterTable && (
          <Text style={[styles.bodyText, { marginTop: 6, fontSize: 8.5 }]}>{textAfterTable}</Text>
        )}
      </View>
    );
  }

  if (section.id === "annexe_repartition" || content === "TABLEAU_REPARTITION") {
    return (
      <View break>
        <SectionBanner title={section.titre} theme={theme} />
        <PdfTableRepartition rows={data.repartition} theme={theme} />
      </View>
    );
  }

  if (section.id === "lcbft") {
    return (
      <View>
        <SectionBanner title={section.titre} theme={theme} />
        <PdfSectionLcbft lcbft={data.lcbft} theme={theme} />
      </View>
    );
  }

  if (section.id === "signature") {
    return (
      <View>
        <SectionBanner title={section.titre} theme={theme} />
        <RenderSignatureFromContent content={content} data={data} theme={theme} />
      </View>
    );
  }

  // BUG H — annexes on separate pages in snapshot mode
  const isAnnexe = section.id.startsWith("annexe_") || section.id.startsWith("Annexe") || /^annexe/i.test(section.id);

  // Generic text section — C9: wrap={false} on bandeau + first paragraph
  const paragraphs = content.split("\n\n").filter(Boolean);
  return (
    <View break={isAnnexe}>
      {paragraphs.map((p, i) => {
        // Handle bullet points
        if (p.includes("\n▪") || p.includes("\n\u2014") || p.includes("\n☐")) {
          const lines = p.split("\n");
          const block = (
            <View key={i}>
              {lines.map((line, j) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("▪") || trimmed.startsWith("\u2014") || trimmed.startsWith("☐")) {
                  return (
                    <View key={j} style={styles.bulletPoint}>
                      <Text style={styles.bulletSymbol}>{trimmed.charAt(0)}</Text>
                      <Text style={styles.bulletText}>{trimmed.slice(1).trim()}</Text>
                    </View>
                  );
                }
                return <Text key={j} style={styles.bodyText}>{trimmed}</Text>;
              })}
            </View>
          );
          if (i === 0) {
            return <View key={i} wrap={false}><SectionBanner title={section.titre} theme={theme} />{block}</View>;
          }
          return block;
        }
        if (i === 0) {
          return <View key={i} wrap={false}><SectionBanner title={section.titre} theme={theme} /><Text style={styles.bodyText}>{p}</Text></View>;
        }
        return <Text key={i} style={styles.bodyText}>{p}</Text>;
      })}
      {paragraphs.length === 0 && <SectionBanner title={section.titre} theme={theme} />}
    </View>
  );
};

const RenderSignatureFromContent: React.FC<{ content: string; data: LettreMissionPdfData; theme: PdfTheme }> = ({ data, theme }) => {
  const dateLong = formatDateLong(data.date_generation);
  const expName = data.expert_responsable && data.expert_responsable !== data.cabinet.nom && data.expert_responsable !== "\u2014" && data.expert_responsable !== ""
    ? data.expert_responsable
    : (data as any).responsable_mission || "";
  return (
    <View>
      <Text style={styles.bodyText}>
        Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des
        annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.
      </Text>
      <Text style={[styles.bodyText, { marginTop: 6, fontFamily: "Helvetica-Oblique" }]}>
        Fait à {s(data.cabinet.ville)}, le {dateLong}
      </Text>
      <View style={styles.signatureContainer}>
        <SignatureBox
          label="L'Expert-comptable"
          boldName
          name={expName || undefined}
          signatureImage={data.signature_expert}
        />
        <SignatureBox
          label="Le Client"
          name={`${s(data.client.civilite)} ${s(data.client.nom_dirigeant)}`}
          signatureImage={data.signature_client}
        />
      </View>
    </View>
  );
};

export default LettreMissionPdfDocument;
