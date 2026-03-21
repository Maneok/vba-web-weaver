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
  // opt 21: capital with € symbol
  { label: "Capital social", key: (c) => {
    const v = s(c.capital_social);
    if (v === "—" || !v) return "—";
    // Already contains € → return as-is
    if (v.includes("€")) return v;
    return `${v} €`;
  }},
  { label: "Date de création", key: "date_creation" },
  { label: "Régime fiscal", key: "regime_fiscal" },
  { label: "Exercice", key: (c) => `${s(c.exercice_debut)} — ${s(c.exercice_fin)}` },
  { label: "Assujetti TVA", key: (c) => (c.tva ? "Oui" : "Non") },
  { label: "CAC désigné", key: (c) => (c.cac ? "Oui" : "Non") },
  // opt 22: effectif 0 → "—"
  { label: "Effectif", key: (c) => {
    if (c.effectif === undefined || c.effectif === null || c.effectif === 0) return "—";
    return String(c.effectif);
  }},
  { label: "Volume comptable", key: "volume_comptable" },
];

const OPTIONAL_LABELS = new Set(["Nom commercial", "Capital social", "Date de création", "Effectif", "Volume comptable"]);

const PdfTableEntite: React.FC<Props> = ({ client }) => {
  // Build visible rows first so alternance index is correct
  const visibleRows: { label: string; value: string }[] = [];
  for (const row of rowDefs) {
    const val = typeof row.key === "function" ? row.key(client) : client[row.key];
    const valStr = typeof val === "string" ? val : s(val);
    if ((valStr === "—" || !valStr) && OPTIONAL_LABELS.has(row.label)) continue;
    visibleRows.push({ label: row.label, value: valStr || "—" });
  }

  return (
    // opt 24: outer border around the whole table
    <View style={{ borderWidth: 0.5, borderColor: "#E0E0E0" }}>
      {/* Header row — opt 20: fond #D6E4F0, texte bold #1B3A5C */}
      <View style={[styles.tableHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.secondaire }]}>
        <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>Information</Text>
        <Text style={[styles.tableCellBold, { width: "60%", color: colors.secondaire }]}>Détail</Text>
      </View>
      {visibleRows.map((row, i) => {
        const isEmpty = row.value === "—";
        return (
          <View
            key={row.label}
            // opt 19: alternance visible
            style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: colors.fond_alternance } : {}]}
          >
            <Text style={[styles.tableCellBold, { width: "40%", color: colors.secondaire }]}>{row.label}</Text>
            {/* opt 23: empty values in gris_clair */}
            <Text style={[styles.tableCell, { width: "60%", color: isEmpty ? colors.gris_clair : colors.texte }]}>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default PdfTableEntite;
