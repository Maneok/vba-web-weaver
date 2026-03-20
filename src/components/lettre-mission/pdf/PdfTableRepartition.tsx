import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { PdfRepartitionRow } from "@/types/lettreMissionPdf";
import { styles, colors } from "./pdfStyles";

interface Props {
  rows: PdfRepartitionRow[];
}

const checkmark = "\u00A7"; // §

const PdfTableRepartition: React.FC<Props> = ({ rows }) => {
  let lastCategorie = "";

  return (
    <View>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCellBold, { width: "50%" }]}>Tâche</Text>
        <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center" }]}>Cabinet</Text>
        <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center" }]}>Client</Text>
        <Text style={[styles.tableCellBold, { width: "20%", textAlign: "center" }]}>Périodicité</Text>
      </View>
      {rows.map((row, i) => {
        const showCat = row.categorie && row.categorie !== lastCategorie;
        if (row.categorie) lastCategorie = row.categorie;
        return (
          <React.Fragment key={i}>
            {showCat && (
              <View style={{ backgroundColor: colors.primaire, paddingVertical: 3, paddingHorizontal: 6, marginTop: i > 0 ? 4 : 0 }}>
                <Text style={{ color: colors.blanc, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
                  {row.categorie}
                </Text>
              </View>
            )}
            <View
              style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: colors.fond_alternance } : {}]}
            >
              <Text style={[styles.tableCell, { width: "50%" }]}>{row.tache}</Text>
              <Text style={[styles.tableCell, { width: "15%", textAlign: "center", color: row.cabinet ? colors.primaire : colors.gris_clair }]}>
                {row.cabinet ? checkmark : "—"}
              </Text>
              <Text style={[styles.tableCell, { width: "15%", textAlign: "center", color: row.client ? colors.primaire : colors.gris_clair }]}>
                {row.client ? checkmark : "—"}
              </Text>
              <Text style={[styles.tableCell, { width: "20%", textAlign: "center" }]}>
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
