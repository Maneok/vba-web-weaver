import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LcbftData } from "@/types/lettreMissionPdf";
import { styles, s, safeNumber } from "./pdfStyles";
import { ScoreGauge, Badge, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  lcbft: LcbftData;
  theme?: PdfTheme;
}

const vigilanceColor = (n: string, theme: PdfTheme) => {
  if (n === "SIMPLIFIEE") return theme.success;
  if (n === "STANDARD") return theme.warning;
  return theme.danger;
};

const vigilanceLabel = (n: string) => {
  if (n === "SIMPLIFIEE") return "Simplifiée";
  if (n === "STANDARD") return "Standard";
  return "Renforcée";
};

const vigilanceBg = (n: string, theme: PdfTheme) => {
  if (n === "SIMPLIFIEE") return "#E8F5E9";
  if (n === "STANDARD") return "#FFF3E0";
  return "#FFEBEE";
};

const PdfSectionLcbft: React.FC<Props> = ({ lcbft, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;
  const score = Math.max(0, Math.min(120, safeNumber(lcbft.score_risque, 0)));
  const vColor = vigilanceColor(lcbft.niveau_vigilance, theme);

  return (
    <View>
      <Text style={styles.bodyText}>
        Conformément aux articles L.561-1 et suivants du Code monétaire et financier, le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).
      </Text>

      {/* Premium layout: gauge left + info right */}
      <View style={{ flexDirection: "row", marginTop: 8, marginBottom: 8, borderWidth: 0.5, borderColor: theme.border, borderRadius: 6, padding: 10, overflow: "hidden" }}>
        {/* Score gauge */}
        <View style={{ width: 80, alignItems: "center", justifyContent: "center" }}>
          <ScoreGauge score={score} max={120} color={vColor} />
        </View>

        {/* Info panel */}
        <View style={{ flex: 1, paddingLeft: 12, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 8, color: theme.muted, width: 100 }}>Vigilance :</Text>
            <Badge text={vigilanceLabel(lcbft.niveau_vigilance)} bgColor={vigilanceBg(lcbft.niveau_vigilance, theme)} textColor={vColor} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 8, color: theme.muted, width: 100 }}>Statut PPE :</Text>
            {lcbft.statut_ppe ? (
              <Badge text="PPE identifié" bgColor="#FFEBEE" textColor={theme.danger} />
            ) : (
              <Text style={{ fontSize: 8.5, color: theme.text }}>Non</Text>
            )}
          </View>
          {lcbft.derniere_diligence_kyc && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: theme.muted, width: 100 }}>Dernière KYC :</Text>
              <Text style={{ fontSize: 8.5, color: theme.text }}>{s(lcbft.derniere_diligence_kyc)}</Text>
            </View>
          )}
          {lcbft.prochaine_maj_kyc && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 8, color: theme.muted, width: 100 }}>Prochaine KYC :</Text>
              <Text style={{ fontSize: 8.5, color: theme.text }}>{s(lcbft.prochaine_maj_kyc)}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.bodyText}>
        Le client s'engage à fournir l'ensemble des documents d'identification requis (CNI, Kbis, registre des bénéficiaires effectifs) et à signaler toute modification de sa situation.
      </Text>
    </View>
  );
};

export default PdfSectionLcbft;
