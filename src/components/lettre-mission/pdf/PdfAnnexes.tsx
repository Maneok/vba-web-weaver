import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LettreMissionPdfData } from "@/types/lettreMissionPdf";
import { styles, s, normalizeSiren } from "./pdfStyles";
import { SectionBanner, AnnexeSignatureBox, RoundedTableWrapper, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  data: LettreMissionPdfData;
  theme?: PdfTheme;
}

/** Bullet item with ▪ symbol */
const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.bulletPoint}>
    <Text style={styles.bulletSymbol}>▪</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

/** SEPA form row */
const SepaRow: React.FC<{
  label: string;
  value: string;
  isLast?: boolean;
  courier?: boolean;
  grayBg?: boolean;
  bold?: boolean;
  theme: PdfTheme;
}> = ({ label, value, isLast, courier, grayBg, bold, theme }) => (
  <View
    style={{
      flexDirection: "row",
      minHeight: 24,
      alignItems: "center",
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: theme.border,
    }}
  >
    <Text
      style={{
        width: "35%",
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        paddingHorizontal: 8,
        paddingVertical: 5,
        color: theme.secondaire,
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        width: "65%",
        fontSize: 9,
        fontFamily: courier ? "Courier" : bold ? "Helvetica-Bold" : "Helvetica",
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: grayBg ? "#F0F0F0" : undefined,
      }}
    >
      {value}
    </Text>
  </View>
);

/** Identification table row for Annexe 4 */
const IdentRow: React.FC<{
  label: string;
  value: string;
  isLast?: boolean;
  theme: PdfTheme;
}> = ({ label, value, isLast, theme }) => (
  <View
    style={{
      flexDirection: "row",
      minHeight: 22,
      alignItems: "center",
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: theme.border,
    }}
  >
    <Text
      style={{
        width: "40%",
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        paddingHorizontal: 8,
        paddingVertical: 5,
        color: theme.secondaire,
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        width: "60%",
        fontSize: 9,
        paddingHorizontal: 8,
        paddingVertical: 5,
      }}
    >
      {value}
    </Text>
  </View>
);

const PdfAnnexes: React.FC<Props> = ({ data, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;
  const { client, cabinet } = data;

  // Format IBAN with spaces every 4 chars, or show blank form line
  const ibanRaw = (data.iban || "").replace(/\s/g, "");
  const ibanDisplay = ibanRaw
    ? ibanRaw.replace(/(.{4})/g, "$1 ").trim()
    : "__ ____ ____ ____ ____ ____ ___";
  const bicDisplay = (data.bic || "").trim() || "___________";

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANNEXE 2 — LUTTE CONTRE LE TRAVAIL DISSIMULÉ              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View break>
        <SectionBanner title="Annexe 2 — Lutte contre le travail dissimulé" theme={theme} />

        {/* Warning box */}
        <View
          style={{
            backgroundColor: "#FFF3E0",
            borderWidth: 0.5,
            borderColor: "#E65100",
            borderRadius: 6,
            padding: 10,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 9.5,
              fontFamily: "Helvetica-Bold",
              color: "#E65100",
              marginBottom: 4,
            }}
          >
            TRAVAIL DISSIMULÉ — Pénalités très lourdes et récemment aggravées
          </Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4, color: "#333333", marginBottom: 2 }}>
            Entraîne : sanctions civiles et pénales (prison avec sursis), contrôle fiscal.
          </Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4, color: "#333333" }}>
            Si vous devez employer une personne, ne serait-ce qu'une minute, il faut préalablement la déclarer.
          </Text>
        </View>

        {/* Attestation text */}
        <Text style={[styles.bodyText, { marginTop: 6 }]}>
          Je soussigné(e) {s(client.civilite)} {s(client.nom_dirigeant)}, agissant en qualité de mandataire de la
          société {s(client.raison_sociale)}, immatriculée au Registre du Commerce des Sociétés sous le
          n° {normalizeSiren(s(client.siren))} et dont le siège social est situé {s(client.adresse)},{" "}
          {s(client.code_postal)} {s(client.ville)} :
        </Text>

        {/* Legal reference */}
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Atteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du
          Travail et de l'article 46 du Code des Marchés Publics :
        </Text>

        <View style={{ marginTop: 4, marginBottom: 6 }}>
          <Bullet>
            Avoir immatriculé mon entreprise au Registre du Commerce des Sociétés.
          </Bullet>
          <Bullet>
            Employer régulièrement tous mes salariés au regard des articles L.1221-10, L.3243-2 et R.3243-1.
          </Bullet>
          <Bullet>
            Ne pas employer de salariés étrangers démunis du titre les autorisant à exercer une activité salariée.
          </Bullet>
        </View>

        {/* Engagement */}
        <Text style={[styles.bodyText, { marginTop: 6 }]}>
          M'engage à ce que ma société respecte ces obligations pendant toute la durée de nos relations contractuelles
          et à en justifier tous les 6 mois ou à tout moment sur demande.
        </Text>

        {/* Documents list */}
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Communique en annexe les documents suivants :
        </Text>
        <View style={{ marginTop: 2, marginBottom: 6 }}>
          <Bullet>Extrait K-bis de moins de 3 mois</Bullet>
          <Bullet>
            Attestation de versement de cotisations de moins de 6 mois (si marchés publics)
          </Bullet>
        </View>

        {/* Signature */}
        <AnnexeSignatureBox
          text={`À ${s(client.ville)}, le ___________`}
          sublabel="Le Client"
        />
      </View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANNEXE 3 — MANDAT DE PRÉLÈVEMENT SEPA                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View break>
        <SectionBanner title="Annexe 3 — Mandat de prélèvement SEPA" theme={theme} />

        {/* Intro text */}
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          En signant ce formulaire de mandat, vous autorisez {s(cabinet.nom)} à envoyer des instructions à votre banque
          pour débiter votre compte conformément aux instructions de {s(cabinet.nom)}. Vous bénéficiez du droit d'être
          remboursé par votre banque selon les conditions de la convention que vous avez passée avec elle. Une demande de
          remboursement doit être présentée dans les 8 semaines suivant la date de débit.
        </Text>

        {/* SEPA form table */}
        <View style={{ marginTop: 12 }}>
          <RoundedTableWrapper borderColor={theme.border}>
            <SepaRow label="Votre nom" value={s(client.raison_sociale)} theme={theme} />
            <SepaRow
              label="Votre adresse"
              value={`${s(client.adresse)}, ${s(client.code_postal)} ${s(client.ville)}`}
              theme={theme}
            />
            <SepaRow label="Votre pays" value="France" theme={theme} />
            <SepaRow
              label="Coordonnées bancaires (IBAN)"
              value={ibanDisplay}
              courier
              grayBg
              theme={theme}
            />
            <SepaRow label="BIC" value={bicDisplay} courier grayBg theme={theme} />
            <SepaRow label="Nom du créancier" value={s(cabinet.nom)} theme={theme} />
            <SepaRow
              label="Identification du créancier (ICS)"
              value="FR67ZZZ4906200"
              theme={theme}
            />
            <SepaRow
              label="Adresse du créancier"
              value={`${s(cabinet.adresse)}, ${s(cabinet.cp)} ${s(cabinet.ville)}`}
              theme={theme}
            />
            <SepaRow
              label="Type de paiement"
              value="Paiement récurrent/répétitif"
              bold
              isLast
              theme={theme}
            />
          </RoundedTableWrapper>
        </View>

        {/* Note */}
        <Text style={[styles.bodyText, { marginTop: 10, fontFamily: "Helvetica-Oblique", fontSize: 8.5 }]}>
          Vos droits concernant le mandat ci-dessus sont expliqués dans un document que vous pouvez obtenir auprès de
          votre banque.
        </Text>

        {/* Signature */}
        <AnnexeSignatureBox
          text={`FAIT À ${s(client.ville).toUpperCase()}, LE ___________`}
          sublabel="LE CLIENT"
        />
      </View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANNEXE 4 — AUTORISATION TRANSMISSION LIASSE FISCALE        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View break>
        <SectionBanner title="Annexe 4 — Autorisation de transmission de liasse fiscale" theme={theme} />

        {/* Identification table */}
        <View style={{ marginTop: 10 }}>
          <RoundedTableWrapper borderColor={theme.border}>
            <IdentRow label="Dénomination de l'Entreprise" value={s(client.raison_sociale)} theme={theme} />
            <IdentRow
              label="Adresse"
              value={`${s(client.adresse)}, ${s(client.code_postal)} ${s(client.ville)}`}
              theme={theme}
            />
            <IdentRow label="Siren" value={normalizeSiren(s(client.siren))} theme={theme} />
            <IdentRow label="Forme Sociale" value={s(client.forme_juridique)} isLast theme={theme} />
          </RoundedTableWrapper>
        </View>

        {/* Authorization text */}
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Représentée par {s(client.civilite)} {s(client.nom_dirigeant)}, mandataire social ayant tous pouvoirs à cet
          effet, déclare autoriser :
        </Text>

        {/* Cabinet block */}
        <View
          style={{
            marginTop: 8,
            marginBottom: 8,
            borderWidth: 0.5,
            borderColor: theme.primaire,
            borderRadius: 4,
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: theme.secondaire }}>
            {s(cabinet.nom)} — {s(cabinet.adresse)}, {s(cabinet.cp)} {s(cabinet.ville)}
          </Text>
        </View>

        {/* Transmission text */}
        <Text style={styles.bodyText}>
          à télétransmettre chaque année sur le portail jedéclare.com, à destination de la Banque, la liasse fiscale qui
          la concerne (ensemble des formulaires fiscaux dûment renseignés répondant à l'obligation de déclaration
          annuelle d'activité de l'entreprise).
        </Text>

        {/* Revocation text */}
        <Text style={[styles.bodyText, { marginTop: 6 }]}>
          Cette autorisation est donnée pour la durée de la mission et peut être révoquée à tout moment par lettre
          recommandée avec accusé de réception.
        </Text>

        {/* Signature */}
        <AnnexeSignatureBox
          text={`À ${s(client.ville)}, le ___________`}
          sublabel="Le Client"
        />
      </View>
    </>
  );
};

export default PdfAnnexes;
