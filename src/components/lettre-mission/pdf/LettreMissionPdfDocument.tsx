import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { LettreMissionPdfData, HonorairesData, LcbftData } from "@/types/lettreMissionPdf";
import { TEXTES_SECTIONS } from "@/lib/lettreMissionDefaults";
import { styles, colors, s, safeNumber } from "./pdfStyles";
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

  // opt 47 — format date in French long format
  const dateLong = formatDateLong(data.date_generation);

  // opt 49 — single header: "CABINET | Lettre de Mission — NUMÉRO"
  const Header = () => (
    <View style={styles.headerFixed} fixed>
      <Text style={styles.headerText}>{s(cabinet.nom)}</Text>
      <Text style={styles.headerText}>Lettre de Mission — {s(data.numero_lm)}</Text>
    </View>
  );

  // opt 48/49 — footer on EVERY page: "CABINET | Document confidentiel — Page X / Y"
  const Footer = () => (
    <View style={styles.footerFixed} fixed>
      <Text style={styles.footerText}>{s(cabinet.nom)} | Document confidentiel</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );

  // If we have sections_snapshot (modele-based), render from that
  if (data.sections_snapshot && data.sections_snapshot.length > 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page} wrap>
          <Header />
          <Footer />
          {data.is_brouillon && <Text style={styles.watermark} fixed>PROJET</Text>}

          {/* Cover */}
          <RenderCover data={data} />

          {/* Render each section from snapshot */}
          {data.sections_snapshot
            .sort((a, b) => a.ordre - b.ordre)
            .map((section) => (
              <RenderSnapshotSection key={section.id} section={section} data={data} />
            ))}

          {/* CGV */}
          <PdfConditionsGenerales cgv_override={data.cgv_snapshot} cabinet_nom={s(cabinet.nom)} />
        </Page>
      </Document>
    );
  }

  // Standard structured generation
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Header />
        <Footer />
        {data.is_brouillon && <Text style={styles.watermark} fixed>PROJET</Text>}

        {/* PAGE DE GARDE */}
        <RenderCover data={data} />

        {/* DESTINATAIRE */}
        <View style={styles.destBlock}>
          <Text style={styles.destText}>
            À l'attention de {s(client.civilite)} {s(client.nom_dirigeant)},
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

        {/* INTRODUCTION */}
        <SectionBandeau title="Introduction" />
        <Text style={styles.bodyText}>{TEXTES_SECTIONS.introduction}</Text>

        {/* VOTRE ENTITÉ — opt 11: only wrap={false} if ≤ 8 visible rows */}
        <View>
          <SectionBandeau title="Votre entité" />
          <PdfTableEntite client={client} />
        </View>

        {/* ORGANISATION ET TRANSMISSION */}
        <SectionBandeau title="Organisation et transmission" />
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

        {/* NOTRE MISSION */}
        <SectionBandeau title="Notre mission" />
        <Text style={styles.bodyText}>{TEXTES_SECTIONS.notre_mission}</Text>

        {/* RESPONSABLE DE LA MISSION */}
        <SectionBandeau title="Responsable de la mission" />
        <Text style={styles.bodyText}>
          Le responsable de la mission est {s(data.expert_responsable)}, expert-comptable inscrit au
          tableau de l'Ordre, qui apportera personnellement son concours à la mission et en garantira la
          bonne réalisation au nom de notre structure d'exercice.
        </Text>

        {/* DURÉE DE LA MISSION */}
        <SectionBandeau title="Durée de la mission" />
        <Text style={styles.bodyText}>
          Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera
          sur les comptes de l'exercice comptable commençant le {s(client.exercice_debut) !== "—" ? s(client.exercice_debut) : `01/01/${new Date().getFullYear()}`} et se terminant
          le {s(client.exercice_fin) !== "—" ? s(client.exercice_fin) : `31/12/${new Date().getFullYear()}`}.
        </Text>
        <Text style={styles.bodyText}>
          Cette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation,
          de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions
          Générales d'Intervention.
        </Text>

        {/* NATURE ET LIMITE */}
        <SectionBandeau title="Nature et limite de la mission" />
        <Text style={styles.bodyText}>{TEXTES_SECTIONS.nature_limite}</Text>

        {/* OBLIGATIONS LCB-FT */}
        <SectionBandeau title="Obligations LCB-FT" />
        <PdfSectionLcbft lcbft={lcbft} />

        {/* MISSIONS COMPLÉMENTAIRES */}
        {(mission.mission_sociale || mission.mission_juridique || mission.controle_fiscal) && (
          <>
            <SectionBandeau title="Missions complémentaires" />
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

        {/* CLAUSE RÉSOLUTOIRE */}
        <SectionBandeau title="Clause résolutoire" />
        <Text style={styles.bodyText}>{TEXTES_SECTIONS.clause_resolutoire}</Text>

        {/* MANDAT ADMINISTRATIONS */}
        <SectionBandeau title="Mandat pour agir auprès des administrations" />
        <Text style={styles.bodyText}>{TEXTES_SECTIONS.mandat_administrations}</Text>

        {/* HONORAIRES */}
        <SectionBandeau title="Honoraires" />
        <PdfTableHonoraires honoraires={honoraires} mission={mission} />
        <Text style={[styles.bodyText, { marginTop: 6, fontSize: 8.5 }]}>
          Les honoraires prévus au présent contrat seront révisables annuellement selon l'évolution de
          l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE. À défaut, minimum
          forfaitaire de 3 % par an. Conformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié
          par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive ne peuvent donner
          lieu à des honoraires complémentaires de succès.
        </Text>

        {/* SIGNATURE */}
        <SectionBandeau title="Signature" />
        <Text style={styles.bodyText}>
          Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des
          annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière
          page.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 6 }]}>
          Fait à {s(cabinet.ville)}, le {dateLong}
        </Text>
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
              L'Expert-comptable
            </Text>
            {data.signature_expert ? (
              <Image src={data.signature_expert} style={{ width: 120, height: 35 }} />
            ) : (
              <View style={{ width: 120, height: 35, borderBottomWidth: 0.5, borderBottomColor: colors.gris_clair }} />
            )}
            <Text style={{ fontSize: 8, color: colors.gris, marginTop: 4 }}>{s(data.expert_responsable)}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Le Client</Text>
            {data.signature_client ? (
              <Image src={data.signature_client} style={{ width: 120, height: 35 }} />
            ) : (
              <View style={{ width: 120, height: 35, borderBottomWidth: 0.5, borderBottomColor: colors.gris_clair }} />
            )}
            <Text style={{ fontSize: 8, color: colors.gris, marginTop: 4 }}>
              {s(client.civilite)} {s(client.nom_dirigeant)}
            </Text>
          </View>
        </View>

        {/* ANNEXE — RÉPARTITION DES TRAVAUX */}
        <View break>
          <View style={styles.sectionBandeau}>
            <Text style={styles.sectionBandeauText}>Annexe — Répartition des travaux</Text>
          </View>
          <PdfTableRepartition rows={repartition} />
        </View>

        {/* ANNEXES */}
        <PdfAnnexes data={data} />

        {/* CGV */}
        <PdfConditionsGenerales cgv_override={data.cgv_snapshot} cabinet_nom={s(cabinet.nom)} />
      </Page>
    </Document>
  );
};

// ── Helper sub-components ────────────────────

const SectionBandeau: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.sectionBandeau} wrap={false}>
    <Text style={styles.sectionBandeauText}>{title}</Text>
  </View>
);

// opt 47 — format DD/MM/YYYY or ISO date to "21 mars 2026"
function formatDateLong(raw: string): string {
  if (!raw || raw === "—") return "—";
  // Try to parse as DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  }
  // Try ISO or other parseable format
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  return raw;
}

const RenderCover: React.FC<{ data: LettreMissionPdfData }> = ({ data }) => {
  const { cabinet, client, mission } = data;
  return (
    <View>
      {/* Logo + cabinet name */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={{ fontSize: 9, color: colors.gris }}>Réf. {s(data.numero_lm)}</Text>
          <Text style={{ fontSize: 9, color: colors.gris }}>Date : {formatDateLong(data.date_generation)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {cabinet.logo_base64 ? (
            <Image src={cabinet.logo_base64} style={{ width: 140, height: 55 }} />
          ) : null}
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: colors.secondaire, marginTop: cabinet.logo_base64 ? 4 : 0 }}>
            {s(cabinet.nom)}
          </Text>
        </View>
      </View>

      {/* Title — opt 4: MAJUSCULES, 24pt, Helvetica-Bold */}
      <Text style={styles.coverTitle}>LETTRE DE MISSION</Text>
      {/* opt 5: sous-titre en majuscules */}
      <Text style={styles.coverSubtitle}>{s(mission.type_principal)}</Text>
      {/* opt 6: fine ligne horizontale sous le sous-titre */}
      <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.primaire, marginBottom: 6, marginTop: 2 }} />
      <Text style={styles.coverNorme}>{s(mission.norme_applicable)}</Text>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Info grid — opt 7: labels gris 9pt, values bold 10pt */}
      <View style={{ marginBottom: 2 }}>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Cabinet :</Text>
          <Text style={styles.coverInfoValue}>{s(cabinet.nom)}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Client :</Text>
          <Text style={styles.coverInfoValue}>
            {s(client.forme_juridique)} {s(client.raison_sociale)}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>SIREN :</Text>
          <Text style={styles.coverInfoValue}>{s(client.siren)}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Exercice :</Text>
          <Text style={styles.coverInfoValue}>
            {s(client.exercice_debut)} — {s(client.exercice_fin)}
          </Text>
        </View>
      </View>

      <View style={styles.separator} />
    </View>
  );
};

/** Render a section from the snapshot (modele-based) */
const RenderSnapshotSection: React.FC<{
  section: { id: string; titre: string; contenu: string; type: string };
  data: LettreMissionPdfData;
}> = ({ section, data }) => {
  const content = section.contenu || "";

  // Skip empty sections
  if (!content.trim() && section.id !== "entite" && section.id !== "honoraires" && section.id !== "annexe_repartition") {
    return null;
  }

  // Special rendering for table sections
  if (section.id === "entite" || content === "TABLEAU_ENTITE") {
    return (
      <View>
        <SectionBandeau title={section.titre} />
        <PdfTableEntite client={data.client} />
      </View>
    );
  }

  if (section.id === "honoraires" || content.startsWith("TABLEAU_HONORAIRES")) {
    const textAfterTable = content.replace("TABLEAU_HONORAIRES", "").trim();
    return (
      <View>
        <SectionBandeau title={section.titre} />
        <PdfTableHonoraires honoraires={data.honoraires} mission={data.mission} />
        {textAfterTable && (
          <Text style={[styles.bodyText, { marginTop: 6, fontSize: 8.5 }]}>{textAfterTable}</Text>
        )}
      </View>
    );
  }

  if (section.id === "annexe_repartition" || content === "TABLEAU_REPARTITION") {
    return (
      <View break>
        <SectionBandeau title={section.titre} />
        <PdfTableRepartition rows={data.repartition} />
      </View>
    );
  }

  if (section.id === "lcbft") {
    return (
      <View>
        <SectionBandeau title={section.titre} />
        <PdfSectionLcbft lcbft={data.lcbft} />
      </View>
    );
  }

  if (section.id === "signature") {
    return (
      <View>
        <SectionBandeau title={section.titre} />
        <RenderSignatureFromContent content={content} data={data} />
      </View>
    );
  }

  // Generic text section
  const paragraphs = content.split("\n\n").filter(Boolean);
  return (
    <View>
      <SectionBandeau title={section.titre} />
      {paragraphs.map((p, i) => {
        // Handle bullet points
        if (p.includes("\n▪") || p.includes("\n—") || p.includes("\n☐")) {
          const lines = p.split("\n");
          return (
            <View key={i}>
              {lines.map((line, j) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("▪") || trimmed.startsWith("—") || trimmed.startsWith("☐")) {
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
        }
        // Handle lines with \n as soft breaks
        return <Text key={i} style={styles.bodyText}>{p}</Text>;
      })}
    </View>
  );
};

const RenderSignatureFromContent: React.FC<{ content: string; data: LettreMissionPdfData }> = ({ data }) => {
  const dateLong = formatDateLong(data.date_generation);
  return (
    <View>
      <Text style={styles.bodyText}>
        Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des
        annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.
      </Text>
      <Text style={[styles.bodyText, { marginTop: 6 }]}>
        Fait à {s(data.cabinet.ville)}, le {dateLong}
      </Text>
      <View style={styles.signatureContainer}>
        <View style={styles.signatureBlock}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>L'Expert-comptable</Text>
          {data.signature_expert ? (
            <Image src={data.signature_expert} style={{ width: 120, height: 35 }} />
          ) : (
            <View style={{ width: 120, height: 35, borderBottomWidth: 0.5, borderBottomColor: colors.gris_clair }} />
          )}
          <Text style={{ fontSize: 8, color: colors.gris, marginTop: 4 }}>{s(data.expert_responsable)}</Text>
        </View>
        <View style={styles.signatureBlock}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Le Client</Text>
          {data.signature_client ? (
            <Image src={data.signature_client} style={{ width: 120, height: 35 }} />
          ) : (
            <View style={{ width: 120, height: 35, borderBottomWidth: 0.5, borderBottomColor: colors.gris_clair }} />
          )}
          <Text style={{ fontSize: 8, color: colors.gris, marginTop: 4 }}>
            {s(data.client.civilite)} {s(data.client.nom_dirigeant)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default LettreMissionPdfDocument;
