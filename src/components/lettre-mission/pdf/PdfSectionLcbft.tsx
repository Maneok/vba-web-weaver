import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { LcbftData } from "@/types/lettreMissionPdf";
import { TEXTES_SECTIONS } from "@/lib/lettreMissionDefaults";
import { styles, s, safeNumber } from "./pdfStyles";
import { ScoreGauge, Badge, RoundedTableWrapper, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

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

const vigilanceBg = (n: string, _theme: PdfTheme) => {
  if (n === "SIMPLIFIEE") return "#E8F5E9";
  if (n === "STANDARD") return "#FFF3E0";
  return "#FFEBEE";
};

const PdfSectionLcbft: React.FC<Props> = ({ lcbft, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;
  const score = Math.max(0, Math.min(120, safeNumber(lcbft.score_risque, 0)));
  const vColor = vigilanceColor(lcbft.niveau_vigilance, theme);

  // Split vigilance text into the two logical parts
  const vigilanceFullText = TEXTES_SECTIONS.lcbft_vigilance || "";
  const vigilanceParts = vigilanceFullText.split("\n\n").filter(Boolean);
  const engagementsText = vigilanceParts.length > 1 ? vigilanceParts[1] : "";

  return (
    <View>
      {/* Subtitle under the banner */}
      <Text
        style={{
          fontSize: 8,
          color: theme.muted,
          textAlign: "center",
          marginBottom: 10,
          fontFamily: "Helvetica-Oblique",
        }}
      >
        CMF art. L.561-1 et s. | NPLAB (Arr. 13.02.2019) | PA
      </Text>

      {/* ── Table 1: Score + Vigilance with ScoreGauge ── */}
      <View style={{ flexDirection: "row", marginBottom: 8 }} wrap={false}>
        {/* Score Gauge on the left */}
        <View style={{ width: 76, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
          <ScoreGauge score={score} max={120} color={vColor} />
        </View>

        {/* Table 1 on the right */}
        <View style={{ flex: 1 }}>
          <RoundedTableWrapper borderColor={theme.border}>
            {/* Header row */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: theme.secondaire,
                minHeight: 22,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 8,
                  color: "#FFFFFF",
                  fontFamily: "Helvetica-Bold",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                Score de risque client
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 8,
                  color: "#FFFFFF",
                  fontFamily: "Helvetica-Bold",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                Niveau de vigilance retenu
              </Text>
            </View>
            {/* Data row */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: theme.light,
                minHeight: 24,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 9,
                  fontFamily: "Helvetica-Bold",
                  color: vColor,
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                }}
              >
                {score} / 120
              </Text>
              <View style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Badge
                  text={vigilanceLabel(lcbft.niveau_vigilance)}
                  bgColor={vigilanceBg(lcbft.niveau_vigilance, theme)}
                  textColor={vColor}
                />
              </View>
            </View>
          </RoundedTableWrapper>
        </View>
      </View>

      {/* ── Table 2: PPE + Diligences KYC ── */}
      <View style={{ marginBottom: 10 }}>
        <RoundedTableWrapper borderColor={theme.border}>
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.secondaire,
              minHeight: 22,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 8,
                color: "#FFFFFF",
                fontFamily: "Helvetica-Bold",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              Statut PPE
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 8,
                color: "#FFFFFF",
                fontFamily: "Helvetica-Bold",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              Dernière diligence KYC
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 8,
                color: "#FFFFFF",
                fontFamily: "Helvetica-Bold",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              Prochaine mise à jour KYC
            </Text>
          </View>
          {/* Data row */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.light,
              minHeight: 24,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 4 }}>
              {lcbft.statut_ppe ? (
                <Badge text="Oui - PPE identifié" bgColor="#FFEBEE" textColor={theme.danger} />
              ) : (
                <Text style={{ fontSize: 9, color: theme.text }}>Non</Text>
              )}
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                color: theme.text,
                paddingHorizontal: 8,
                paddingVertical: 5,
              }}
            >
              {s(lcbft.derniere_diligence_kyc)}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                color: theme.text,
                paddingHorizontal: 8,
                paddingVertical: 5,
              }}
            >
              {s(lcbft.prochaine_maj_kyc)}
            </Text>
          </View>
        </RoundedTableWrapper>
      </View>

      {/* ── Engagements contractuels du client ── */}
      <View
        style={{
          borderWidth: 0.5,
          borderColor: theme.border,
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 10,
        }}
        wrap={false}
      >
        {/* Encadre header */}
        <View
          style={{
            backgroundColor: theme.secondaire,
            paddingVertical: 5,
            paddingHorizontal: 10,
          }}
        >
          <Text
            style={{
              fontSize: 8.5,
              color: "#FFFFFF",
              fontFamily: "Helvetica-Bold",
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Engagements contractuels du client
          </Text>
        </View>
        {/* Encadre body */}
        <View style={{ backgroundColor: theme.light, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ fontSize: 9, lineHeight: 1.45, textAlign: "justify", color: theme.text }}>
            {engagementsText}
          </Text>
        </View>
      </View>

      {/* ── Conservation mention ── */}
      <View
        style={{
          backgroundColor: "#F5F5F5",
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 8,
            color: theme.muted,
            fontFamily: "Helvetica-Oblique",
            lineHeight: 1.4,
          }}
        >
          Durée de conservation LCB-FT : art. L.561-12 CMF, 5 ans.
        </Text>
      </View>

      {/* ── Final commitment text ── */}
      <Text style={styles.bodyText}>
        Le client s'engage à fournir l'ensemble des documents d'identification requis (pièce d'identité officielle, extrait Kbis, registre des bénéficiaires effectifs) et à signaler sans délai toute modification de sa situation.
      </Text>
    </View>
  );
};

export default PdfSectionLcbft;
