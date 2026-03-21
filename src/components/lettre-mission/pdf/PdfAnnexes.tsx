import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LettreMissionPdfData } from "@/types/lettreMissionPdf";
import { styles, colors, s } from "./pdfStyles";

interface Props {
  data: LettreMissionPdfData;
}

const signatureBoxStyle = {
  marginTop: 24,
  borderWidth: 0.5,
  borderColor: colors.gris,
  borderStyle: "dashed" as const,
  padding: 14,
  paddingBottom: 50,
};

const PdfAnnexes: React.FC<Props> = ({ data }) => {
  const { client, cabinet } = data;

  return (
    <>
      {/* Attestation travail dissimulé */}
      <View break>
        <View style={styles.sectionBandeau}>
          <Text style={styles.sectionBandeauText}>Annexe — Attestation de vigilance (travail dissimulé)</Text>
        </View>
        <Text style={styles.bodyText}>
          Je soussigné(e) {s(client.civilite)} {s(client.nom_dirigeant)}, agissant en qualité de mandataire
          de la société {s(client.raison_sociale)}, immatriculée au RCS sous le n° {s(client.siren)} et dont
          le siège social est situé {s(client.adresse)}, {s(client.code_postal)} {s(client.ville)} :
        </Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Atteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du
          Code du Travail :
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletSymbol}>▪</Text>
          <Text style={styles.bulletText}>Avoir immatriculé mon entreprise au Registre du Commerce et des Sociétés</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletSymbol}>▪</Text>
          <Text style={styles.bulletText}>Employer régulièrement tous mes salariés conformément aux dispositions légales</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletSymbol}>▪</Text>
          <Text style={styles.bulletText}>
            Ne pas employer de salariés étrangers démunis du titre les autorisant à travailler en France
          </Text>
        </View>

        <View style={signatureBoxStyle}>
          <Text style={{ fontSize: 9, color: colors.texte }}>
            Fait à {s(client.ville)}, le ___/___/______
          </Text>
          <Text style={{ fontSize: 8, color: colors.gris, marginTop: 14 }}>
            Signature du dirigeant :
          </Text>
        </View>
      </View>

      {/* Mandat SEPA */}
      <View break>
        <View style={styles.sectionBandeau}>
          <Text style={styles.sectionBandeauText}>Annexe — Mandat de prélèvement SEPA</Text>
        </View>
        <Text style={styles.bodyText}>
          En signant ce formulaire de mandat, vous autorisez {s(cabinet.nom)} à envoyer des instructions à
          votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément aux
          instructions de {s(cabinet.nom)}.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 4 }]}>
          Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la
          convention que vous avez passée avec elle.
        </Text>

        {/* SEPA fields */}
        <View style={{ marginTop: 12, borderWidth: 0.5, borderColor: colors.primaire, padding: 12 }}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: colors.secondaire }]}>Titulaire du compte</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc" }]}>
              {s(client.raison_sociale)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: colors.secondaire }]}>IBAN</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc", fontFamily: "Courier" }]}>
              __ ____ ____ ____ ____ ____ ___
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: colors.secondaire }]}>BIC</Text>
            <Text style={[styles.tableCell, { width: "70%", borderBottomWidth: 0.5, borderBottomColor: "#ccc", fontFamily: "Courier" }]}>
              ___________
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Text style={[styles.tableCellBold, { width: "30%", color: colors.secondaire }]}>Créancier (ICS)</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>{s(cabinet.nom)} — {s(cabinet.siret)}</Text>
          </View>
        </View>

        <View style={signatureBoxStyle}>
          <Text style={{ fontSize: 9, color: colors.texte }}>
            Date : ___/___/______
          </Text>
          <Text style={{ fontSize: 8, color: colors.gris, marginTop: 14 }}>
            Signature du débiteur :
          </Text>
        </View>
      </View>

      {/* Autorisation liasse fiscale */}
      <View break>
        <View style={styles.sectionBandeau}>
          <Text style={styles.sectionBandeauText}>Annexe — Autorisation de transmission de Liasse Fiscale</Text>
        </View>
        <Text style={styles.bodyText}>
          {s(client.raison_sociale)}, représentée par {s(client.civilite)} {s(client.nom_dirigeant)}, mandataire
          social ayant tous pouvoirs à cet effet, déclare autoriser {s(cabinet.nom)} à télétransmettre chaque année
          sur le portail jedéclare.com la liasse fiscale qui la concerne.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 4 }]}>
          Cette autorisation est donnée pour la durée de la mission et peut être révoquée à tout moment par
          lettre recommandée avec accusé de réception.
        </Text>

        <View style={signatureBoxStyle}>
          <Text style={{ fontSize: 9, color: colors.texte }}>
            Fait à {s(client.ville)}, le ___/___/______
          </Text>
          <Text style={{ fontSize: 8, color: colors.gris, marginTop: 14 }}>
            Signature et cachet :
          </Text>
        </View>
      </View>
    </>
  );
};

export default PdfAnnexes;
