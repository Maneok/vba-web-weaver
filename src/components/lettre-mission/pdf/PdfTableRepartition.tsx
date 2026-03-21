import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { PdfRepartitionRow } from "@/types/lettreMissionPdf";
import { styles } from "./pdfStyles";
import { RoundedTableWrapper, CheckIcon, Badge, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  rows: PdfRepartitionRow[];
  theme?: PdfTheme;
}

const PdfTableRepartition: React.FC<Props> = ({ rows, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;
  let lastCategorie = "";
  let visibleIdx = 0;

  // Count summary
  const cabinetCount = rows.filter((r) => r.cabinet === true || r.cabinet === ("true" as any)).length;
  const clientCount = rows.filter((r) => r.client === true || r.client === ("true" as any)).length;

  return (
    <View>
      <RoundedTableWrapper borderColor={theme.border}>
        {/* Premium header */}
        <View style={{ flexDirection: "row", backgroundColor: theme.primaire, minHeight: 26, alignItems: "center" }}>
          <Text style={[styles.tableCellBold, { width: "50%", color: "#FFFFFF" }]}>Tâche</Text>
          <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center", color: "#FFFFFF" }]}>Cabinet</Text>
          <Text style={[styles.tableCellBold, { width: "15%", textAlign: "center", color: "#FFFFFF" }]}>Client</Text>
          <Text style={[styles.tableCellBold, { width: "20%", textAlign: "center", color: "#FFFFFF" }]}>Périodicité</Text>
        </View>
        {rows.map((row, i) => {
          const showCat = row.categorie && row.categorie !== lastCategorie;
          if (row.categorie) lastCategorie = row.categorie;

          const isCabinet = row.cabinet === true || row.cabinet === ("true" as any);
          const isClient = row.client === true || row.client === ("true" as any);

          const rowIdx = visibleIdx++;

          return (
            <React.Fragment key={i}>
              {showCat && (
                <View style={{ backgroundColor: theme.secondaire, paddingVertical: 3, paddingHorizontal: 6, marginTop: i > 0 ? 2 : 0 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
                    {row.categorie}
                  </Text>
                </View>
              )}
              <View
                style={[styles.tableRow, rowIdx % 2 === 0 ? { backgroundColor: theme.light } : {}]}
              >
                <Text style={[styles.tableCell, { width: "50%" }]}>{row.tache}</Text>
                <View style={{ width: "15%", alignItems: "center", justifyContent: "center" }}>
                  {isCabinet ? (
                    <CheckIcon color={theme.success} size={12} />
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.border }}>—</Text>
                  )}
                </View>
                <View style={{ width: "15%", alignItems: "center", justifyContent: "center" }}>
                  {isClient ? (
                    <CheckIcon color={theme.success} size={12} />
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.border }}>—</Text>
                  )}
                </View>
                <View style={{ width: "20%", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 8, color: theme.muted }}>{row.periodicite}</Text>
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </RoundedTableWrapper>

      {/* Summary count */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6, gap: 8 }}>
        <Badge text={`Cabinet : ${cabinetCount} tâches`} bgColor="#E8F5E9" textColor={theme.success} />
        <Badge text={`Client : ${clientCount} tâches`} bgColor="#E3F2FD" textColor={theme.primaire} />
      </View>
    </View>
  );
};

export default PdfTableRepartition;
