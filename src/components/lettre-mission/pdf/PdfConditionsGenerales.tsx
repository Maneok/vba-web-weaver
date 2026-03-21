import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { TEXTES_CGV } from "@/lib/lettreMissionDefaults";
import { styles, colors } from "./pdfStyles";

interface Props {
  cgv_override?: string;
  cabinet_nom: string;
}

// opt 43: thin separator between articles
const articleSeparator = {
  borderBottomWidth: 0.3,
  borderBottomColor: "#E0E0E0",
  marginBottom: 4, // opt 42
};

const PdfConditionsGenerales: React.FC<Props> = ({ cgv_override, cabinet_nom }) => {
  // If there's a CGV override string (from modele), render it as plain text paragraphs
  if (cgv_override) {
    const paragraphs = cgv_override.split("\n\n").filter(Boolean);
    return (
      <View break>
        <View style={styles.sectionBandeau}>
          <Text style={styles.sectionBandeauText}>Conditions Générales d'Intervention</Text>
        </View>
        <Text style={{ fontSize: 7.5, color: colors.gris, marginBottom: 6 }}>
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
              <View key={i} style={{ marginBottom: 4 }}>
                {/* opt 44: article numbers bold #1B3A5C */}
                <Text style={[styles.sectionSubtitle, { fontSize: 8.5, color: colors.secondaire, marginTop: 4, marginBottom: 2 }]}>{title}</Text>
                {body && <Text style={[styles.bodyText, { fontSize: 7.5 }]}>{body}</Text>}
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
      <View style={styles.sectionBandeau}>
        <Text style={styles.sectionBandeauText}>Conditions Générales d'Intervention</Text>
      </View>
      <Text style={{ fontSize: 7.5, color: colors.gris, marginBottom: 6 }}>
        {cabinet_nom} — Conditions en vigueur
      </Text>
      {TEXTES_CGV.map((article, idx) => (
        <View key={article.numero} style={{ marginBottom: 4 }} wrap={false}>
          {/* opt 44: numéros d'article en bold #1B3A5C */}
          <Text style={[styles.sectionSubtitle, { fontSize: 8.5, color: colors.secondaire, marginTop: 4, marginBottom: 2 }]}>
            {article.numero}. {article.titre}
          </Text>
          {/* opt 41: fontSize 7.5 */}
          <Text style={[styles.bodyText, { fontSize: 7.5 }]}>{article.contenu}</Text>
          {/* opt 43: thin separator */}
          {idx < TEXTES_CGV.length - 1 && <View style={articleSeparator} />}
        </View>
      ))}
    </View>
  );
};

export default PdfConditionsGenerales;
