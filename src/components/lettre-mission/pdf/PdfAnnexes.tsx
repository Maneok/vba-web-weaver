import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LettreMissionPdfData } from "@/types/lettreMissionPdf";
import { styles, s } from "./pdfStyles";
import { SectionBanner, AnnexeSignatureBox, CheckIcon, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  data: LettreMissionPdfData;
  theme?: PdfTheme;
}

/** Bullet with SVG checkmark */
const CheckBullet: React.FC<{ text: string; theme: PdfTheme }> = ({ text, theme }) => (
  <View style={{ flexDirection: "row", marginBottom: 3, paddingLeft: 8, alignItems: "flex-start" }}>
    <View style={{ width: 16, marginTop: 1 }}>
      <CheckIcon color={theme.success} size={9} />
    </View>
    <Text style={{ fontSize: 9, flex: 1, lineHeight: 1.4 }}>{text}</Text>
  </View>
);

const PdfAnnexes: React.FC<Props> = ({ data, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;
  const { client, cabinet } = data;

  return (
    <>
      {/* Annexe 2 — Attestation travail dissimulé */}
      <View break>
        <SectionBanner title="Annexe 2 — Attestation de vigilance (travail dissimulé)" theme={theme} />
        <Text style={styles.bodyText}>
          Je soussigné(e) {s(client.civilite)} {s(client.nom_dirigeant)}, agissant en qualité de mandataire
          de la société {s(client.raison_sociale)}, immatriculée au RCS sous le n° {s(client.siren)} et dont
          le siège social est situé {s(client.adresse)}, {s(client.code_postal)} {s(client.ville)} :
        </Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Atteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du
          Code du Travail :
        </Text>
        <CheckBullet text="Avoir immatriculé mon entreprise au Registre du Commerce et des Sociétés" theme={theme} />
        <CheckBullet text="Employer régulièrement tous mes salariés conformément aux dispositions légales" theme={theme} />
        <CheckBullet text="Ne pas employer de salariés étrangers démunis du titre les autorisant à travailler en France" theme={theme} />

        <AnnexeSignatureBox
          text={`Fait à ${s(client.ville)}, le ___/___/______`}
          sublabel="Signature du dirigeant :"
        />
      </View>

      {/* Annexe 3 — Mandat SEPA */}
      <View break>
        <SectionBanner title="Annexe 3 — Mandat de prélèvement SEPA" theme={theme} />
        <Text style={styles.bodyText}>
          En signant ce formulaire de mandat, vous autorisez {s(cabinet.nom)} à envoyer des instructions à
          votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément aux
          instructions de {s(cabinet.nom)}.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 4 }]}>
          Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la
          convention que vous avez passée avec elle.
        </Text>

        {/* SEPA fields — framed */}
        <View style={{ marginTop: 12, borderWidth: 0.5, borderColor: theme.primaire, borderRadius: 6, padding: 12, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: theme.secondaire }]}>Titulaire du compte</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc" }]}>
              {s(client.raison_sociale)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: theme.secondaire }]}>IBAN</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc", fontFamily: "Courier" }]}>
              __ ____ ____ ____ ____ ____ ___
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: theme.secondaire }]}>BIC</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc", fontFamily: "Courier" }]}>
              ___________
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: theme.secondaire }]}>Créancier (ICS)</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>{s(cabinet.nom)} — {s(cabinet.siret)}</Text>
          </View>
        </View>

        <AnnexeSignatureBox
          text="Date : ___/___/______"
          sublabel="Signature du débiteur :"
        />
      </View>

      {/* Annexe 4 — Autorisation liasse fiscale */}
      <View break>
        <SectionBanner title="Annexe 4 — Autorisation de transmission de Liasse Fiscale" theme={theme} />
        <Text style={styles.bodyText}>
          {s(client.raison_sociale)}, représentée par {s(client.civilite)} {s(client.nom_dirigeant)}, mandataire
          social ayant tous pouvoirs à cet effet, déclare autoriser {s(cabinet.nom)} à télétransmettre chaque année
          sur le portail{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>jedéclare.com</Text>
          {" "}la liasse fiscale qui la concerne.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 4 }]}>
          Cette autorisation est donnée pour la durée de la mission et peut être révoquée à tout moment par
          lettre recommandée avec accusé de réception.
        </Text>

        <AnnexeSignatureBox
          text={`Fait à ${s(client.ville)}, le ___/___/______`}
          sublabel="Signature et cachet :"
        />
      </View>
    </>
  );
};

export default PdfAnnexes;
