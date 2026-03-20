import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { TEXTES_CGV } from "@/lib/lettreMissionDefaults";
import { styles, colors } from "./pdfStyles";

interface Props {
  cgv_override?: string;
  cabinet_nom: string;
}

const PdfConditionsGenerales: React.FC<Props> = ({ cgv_override, cabinet_nom }) => {
  // If there's a CGV override string (from modele), render it as plain text paragraphs
  if (cgv_override) {
    const paragraphs = cgv_override.split("\n\n").filter(Boolean);
    return (
      <View break>
        <View style={styles.sectionBandeau}>
          <Text style={styles.sectionBandeauText}>Conditions Générales d'Intervention</Text>
        </View>
        <Text style={{ fontSize: 8, color: colors.gris, marginBottom: 8 }}>
          {cabinet_nom} — Conditions en vigueur
        </Text>
        {paragraphs.map((p, i) => {
          // Check if line starts with a number + "." -> article title
          const match = p.match(/^(\d+)\.\s*(.+)/);
          if (match) {
            const lines = p.split("\n");
            const title = lines[0];
            const body = lines.slice(1).join("\n").trim();
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={[styles.sectionSubtitle, { fontSize: 9 }]}>{title}</Text>
                {body && <Text style={[styles.bodyText, { fontSize: 8.5 }]}>{body}</Text>}
              </View>
            );
          }
          return (
            <Text key={i} style={[styles.bodyText, { fontSize: 8.5 }]}>
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
      <View style={styles.sectionBandeau}>
        <Text style={styles.sectionBandeauText}>Conditions Générales d'Intervention</Text>
      </View>
      <Text style={{ fontSize: 8, color: colors.gris, marginBottom: 8 }}>
        {cabinet_nom} — Conditions en vigueur
      </Text>
      {TEXTES_CGV.map((article) => (
        <View key={article.numero} style={{ marginBottom: 8 }} wrap={false}>
          <Text style={[styles.sectionSubtitle, { fontSize: 9 }]}>
            {article.numero}. {article.titre}
          </Text>
          <Text style={[styles.bodyText, { fontSize: 8.5 }]}>{article.contenu}</Text>
        </View>
      ))}
    </View>
  );
};

export default PdfConditionsGenerales;
