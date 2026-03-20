import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LcbftData } from "@/types/lettreMissionPdf";
import { styles, colors, s } from "./pdfStyles";

interface Props {
  lcbft: LcbftData;
}

const vigilanceColor = (n: string) => {
  if (n === "SIMPLIFIEE") return colors.vert;
  if (n === "STANDARD") return colors.orange;
  return colors.rouge;
};

const PdfSectionLcbft: React.FC<Props> = ({ lcbft }) => (
  <View>
    <Text style={styles.bodyText}>
      Conformément aux articles L.561-1 et suivants du Code monétaire et financier, le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).
    </Text>

    {/* Mini table */}
    <View style={{ marginTop: 6, marginBottom: 6 }}>
      <View style={[styles.tableRow, { backgroundColor: colors.fond_alternance }]}>
        <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Score de risque</Text>
        <Text style={[styles.tableCellBold, { width: "60%", color: vigilanceColor(lcbft.niveau_vigilance) }]}>
          {lcbft.score_risque} / 120
        </Text>
      </View>
      <View style={styles.tableRow}>
        <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Niveau de vigilance</Text>
        <Text style={[styles.tableCellBold, { width: "60%", color: vigilanceColor(lcbft.niveau_vigilance) }]}>
          {lcbft.niveau_vigilance === "SIMPLIFIEE" ? "Simplifiée" : lcbft.niveau_vigilance === "STANDARD" ? "Standard" : "Renforcée"}
        </Text>
      </View>
      <View style={[styles.tableRow, { backgroundColor: colors.fond_alternance }]}>
        <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Statut PPE</Text>
        <Text style={[styles.tableCell, { width: "60%" }]}>
          {lcbft.statut_ppe ? "Oui — Personne Politiquement Exposée" : "Non"}
        </Text>
      </View>
      {lcbft.derniere_diligence_kyc && (
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Dernière diligence KYC</Text>
          <Text style={[styles.tableCell, { width: "60%" }]}>{s(lcbft.derniere_diligence_kyc)}</Text>
        </View>
      )}
      {lcbft.prochaine_maj_kyc && (
        <View style={[styles.tableRow, { backgroundColor: colors.fond_alternance }]}>
          <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Prochaine révision KYC</Text>
          <Text style={[styles.tableCell, { width: "60%" }]}>{s(lcbft.prochaine_maj_kyc)}</Text>
        </View>
      )}
    </View>

    <Text style={styles.bodyText}>
      Le client s'engage à fournir l'ensemble des documents d'identification requis (CNI, Kbis, registre des bénéficiaires effectifs) et à signaler toute modification de sa situation.
    </Text>
  </View>
);

export default PdfSectionLcbft;
