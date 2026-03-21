import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { ClientLmData } from "@/types/lettreMissionPdf";
import { styles, colors, s } from "./pdfStyles";

interface Props {
  client: ClientLmData;
}

const rowDefs: { label: string; key: keyof ClientLmData | ((c: ClientLmData) => string) }[] = [
  { label: "Raison sociale", key: "raison_sociale" },
  { label: "Nom commercial", key: "nom_commercial" },
  { label: "Forme juridique", key: "forme_juridique" },
  { label: "Dirigeant", key: (c) => `${c.civilite} ${c.nom_dirigeant}` },
  { label: "Adresse", key: (c) => `${c.adresse}, ${c.code_postal} ${c.ville}` },
  { label: "SIREN", key: "siren" },
  { label: "SIRET", key: "siret" },
  { label: "Code APE", key: "code_ape" },
  { label: "Activité principale", key: "activite_principale" },
  { label: "Capital social", key: "capital_social" },
  { label: "Date de création", key: "date_creation" },
  { label: "Régime fiscal", key: "regime_fiscal" },
  { label: "Exercice", key: (c) => `${s(c.exercice_debut)} — ${s(c.exercice_fin)}` },
  { label: "Assujetti TVA", key: (c) => (c.tva ? "Oui" : "Non") },
  { label: "CAC désigné", key: (c) => (c.cac ? "Oui" : "Non") },
  { label: "Effectif", key: (c) => (c.effectif !== undefined ? String(c.effectif) : "—") },
  { label: "Volume comptable", key: "volume_comptable" },
];

const OPTIONAL_LABELS = new Set(["Nom commercial", "Capital social", "Date de création", "Effectif", "Volume comptable"]);

const PdfTableEntite: React.FC<Props> = ({ client }) => {
  // Build visible rows first so alternance index is correct
  const visibleRows: { label: string; value: string }[] = [];
  for (const row of rowDefs) {
    const val = typeof row.key === "function" ? row.key(client) : client[row.key];
    const valStr = s(val);
    if (valStr === "—" && OPTIONAL_LABELS.has(row.label)) continue;
    visibleRows.push({ label: row.label, value: valStr });
  }

  return (
    <View>
      {/* Header row */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCellBold, { width: "40%" }]}>Information</Text>
        <Text style={[styles.tableCellBold, { width: "60%" }]}>Détail</Text>
      </View>
      {visibleRows.map((row, i) => {
        const isEmpty = row.value === "—";
        return (
          <View
            key={row.label}
            style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: colors.fond_alternance } : {}]}
          >
            <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>{row.label}</Text>
            <Text style={[styles.tableCell, { width: "60%", color: isEmpty ? colors.gris_clair : colors.texte }]}>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default PdfTableEntite;
