import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { PdfRepartitionRow } from "@/types/lettreMissionPdf";
import { styles, colors } from "./pdfStyles";

interface Props {
  rows: PdfRepartitionRow[];
}

const checkmark = "\u2713"; // ✓

const PdfTableRepartition: React.FC<Props> = ({ rows }) => {
  let lastCategorie = "";
  let visibleIdx = 0;

  return (
    // opt 24: outer border for consistency
    <View style={{ borderWidth: 0.5, borderColor: "#E0E0E0" }}>
      {/* Header — opt 33: fond #D6E4F0 + opt 35: widths 50/15/15/20 */}
      <View style={[styles.tableHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.secondaire }]}>
        <Text style={[styles.tableCellBold, { width: "50%", color: colors.secondaire }]}>Tâche</Text>
        <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center", color: colors.secondaire }]}>Cabinet</Text>
        <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center", color: colors.secondaire }]}>Client</Text>
        <Text style={[styles.tableCellBold, { width: "20%", textAlign: "center", color: colors.secondaire }]}>Périodicité</Text>
      </View>
      {rows.map((row, i) => {
        const showCat = row.categorie && row.categorie !== lastCategorie;
        if (row.categorie) lastCategorie = row.categorie;

        // opt 30: coerce booleans — data may arrive as strings from JSON storage
        const isCabinet = row.cabinet === true || row.cabinet === ("true" as any);
        const isClient = row.client === true || row.client === ("true" as any);

        const rowIdx = visibleIdx++;

        return (
          <React.Fragment key={i}>
            {showCat && (
              <View style={{ backgroundColor: colors.primaire, paddingVertical: 3, paddingHorizontal: 6, marginTop: i > 0 ? 2 : 0 }}>
                <Text style={{ color: colors.blanc, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
                  {row.categorie}
                </Text>
              </View>
            )}
            {/* opt 32: alternance */}
            <View
              style={[styles.tableRow, rowIdx % 2 === 0 ? { backgroundColor: colors.fond_alternance } : {}]}
            >
              <Text style={[styles.tableCell, { width: "50%" }]}>{row.tache}</Text>
              {/* opt 31: ✓ vert, — gris + opt 34: centré */}
              <Text style={[styles.tableCell, { width: "15%", textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 11, color: isCabinet ? colors.vert : colors.gris_clair }]}>
                {isCabinet ? checkmark : "—"}
              </Text>
              <Text style={[styles.tableCell, { width: "15%", textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 11, color: isClient ? colors.vert : colors.gris_clair }]}>
                {isClient ? checkmark : "—"}
              </Text>
              <Text style={[styles.tableCell, { width: "20%", textAlign: "center", color: colors.gris }]}>
                {row.periodicite}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
};

export default PdfTableRepartition;
