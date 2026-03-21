import React from "react";
import { View, Text, Svg, Circle as SvgCircle } from "@react-pdf/renderer";
import { TEXTES_CGV } from "@/lib/lettreMissionDefaults";
import { styles, sanitizeForPdf } from "./pdfStyles";
import { SectionBanner, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  cgv_override?: string;
  cabinet_nom: string;
  theme?: PdfTheme;
  date_generation?: string;
}

// V2-50: Circle-numbered article heading — 16x16 (was 18x18) for compact look
const CircleNumber: React.FC<{ num: number; theme: PdfTheme }> = ({ num, theme }) => (
  <View style={{ width: 16, height: 16, marginRight: 6 }}>
    <Svg viewBox="0 0 16 16" style={{ width: 16, height: 16 }}>
      <SvgCircle cx="8" cy="8" r="7" fill={theme.secondaire} />
    </Svg>
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>{num}</Text>
    </View>
  </View>
);

// Thin separator between articles
const articleSeparator = {
  borderBottomWidth: 0.3,
  borderBottomColor: "#E0E0E0",
  marginBottom: 4,
};

const PdfConditionsGenerales: React.FC<Props> = ({ cgv_override, cabinet_nom, theme: themeIn, date_generation }) => {
  const theme = themeIn || DEFAULT_THEME;
  // opt 46 — dynamic date
  const dateVigueur = date_generation || new Date().toLocaleDateString("fr-FR");

  // If there's a CGV override string (from modele), render it as plain text paragraphs
  if (cgv_override) {
    const paragraphs = sanitizeForPdf(cgv_override).split("\n\n").filter(Boolean);
    return (
      <View break>
        <SectionBanner title="Conditions Générales d'Intervention" theme={theme} />
        <Text style={{ fontSize: 7.5, color: theme.muted, marginBottom: 6 }}>
          {cabinet_nom} — Conditions en vigueur au {dateVigueur}
        </Text>
        {paragraphs.map((p, i) => {
          const match = p.match(/^(\d+)\.\s*(.+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            const lines = p.split("\n");
            const titleText = lines[0].replace(/^\d+\.\s*/, "");
            const body = lines.slice(1).join("\n").trim();
            return (
              <View key={i} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 2 }}>
                  <CircleNumber num={num} theme={theme} />
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: theme.secondaire }}>{titleText}</Text>
                </View>
                {body && <Text style={[styles.bodyText, { fontSize: 7.5, lineHeight: 1.3, paddingLeft: 24 }]}>{body}</Text>}
                <View style={articleSeparator} />
              </View>
            );
          }
          return (
            <Text key={i} style={[styles.bodyText, { fontSize: 7.5 }]}>
              {p}
            </Text>
          );
        })}
      </View>
    );
  }

  // Default structured CGV
  return (
    <View break>
      <SectionBanner title="Conditions Générales d'Intervention" theme={theme} />
      <Text style={{ fontSize: 7.5, color: theme.muted, marginBottom: 6 }}>
        {cabinet_nom} — Conditions en vigueur au {dateVigueur}
      </Text>
      {TEXTES_CGV.map((article, idx) => (
        <View key={article.numero} style={{ marginBottom: 4 }}>
          {/* A7 — wrap={false} only on heading+first line to prevent orphaned title */}
          <View wrap={false}>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 2 }}>
              <CircleNumber num={article.numero} theme={theme} />
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: theme.secondaire }}>
                {article.titre}
              </Text>
            </View>
          </View>
          <Text style={[styles.bodyText, { fontSize: 7.5, lineHeight: 1.3, paddingLeft: 24 }]}>{sanitizeForPdf(article.contenu)}</Text>
          {idx < TEXTES_CGV.length - 1 && <View style={articleSeparator} />}
        </View>
      ))}
    </View>
  );
};

export default PdfConditionsGenerales;
