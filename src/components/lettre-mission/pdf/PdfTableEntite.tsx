import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { ClientLmData } from "@/types/lettreMissionPdf";
import { styles, colors, s, normalizeSiren } from "./pdfStyles";
import { RoundedTableWrapper, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  client: ClientLmData;
  theme?: PdfTheme;
}

const rowDefs: { label: string; key: keyof ClientLmData | ((c: ClientLmData) => string) }[] = [
  { label: "Raison sociale", key: "raison_sociale" },
  { label: "Nom commercial", key: "nom_commercial" },
  { label: "Forme juridique", key: "forme_juridique" },
  { label: "Dirigeant", key: (c) => `${c.civilite} ${c.nom_dirigeant}` },
  { label: "Adresse", key: (c) => `${c.adresse}, ${c.code_postal} ${c.ville}` },
  { label: "SIREN", key: (c) => normalizeSiren(c.siren || "") },
  { label: "SIRET", key: (c) => normalizeSiren(c.siret || "") },
  { label: "Code APE", key: "code_ape" },
  { label: "Activité principale", key: "activite_principale" },
  { label: "Capital social", key: (c) => {
    const v = s(c.capital_social);
    if (v === "\u2014" || !v) return "\u2014";
    if (v.includes("\u20AC")) return v;
    return `${v} \u20AC`;
  }},
  { label: "Date de création", key: "date_creation" },
  { label: "Régime fiscal", key: "regime_fiscal" },
  { label: "Exercice", key: (c) => `${s(c.exercice_debut)} \u2014 ${s(c.exercice_fin)}` },
  { label: "Assujetti TVA", key: (c) => (c.tva ? "Oui" : "Non") },
  { label: "CAC désigné", key: (c) => (c.cac ? "Oui" : "Non") },
  { label: "Effectif", key: (c) => {
    if (c.effectif === undefined || c.effectif === null || c.effectif === 0) return "\u2014";
    return String(c.effectif);
  }},
  { label: "Volume comptable", key: "volume_comptable" },
];

const OPTIONAL_LABELS = new Set(["Nom commercial", "Capital social", "Date de création", "Effectif", "Volume comptable"]);

const PdfTableEntite: React.FC<Props> = ({ client, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;

  const visibleRows: { label: string; value: string }[] = [];
  for (const row of rowDefs) {
    const val = typeof row.key === "function" ? row.key(client) : client[row.key];
    const valStr = typeof val === "string" ? val : s(val);
    if ((valStr === "\u2014" || !valStr) && OPTIONAL_LABELS.has(row.label)) continue;
    visibleRows.push({ label: row.label, value: valStr || "\u2014" });
  }

  return (
    <RoundedTableWrapper borderColor={theme.border}>
      {/* V2-21: Header — "Caractéristique" / "Valeur" */}
      <View style={{ flexDirection: "row", backgroundColor: theme.secondaire, minHeight: 24, alignItems: "center" }}>
        <Text style={[styles.tableCellBold, { width: "40%", color: "#FFFFFF" }]}>Caractéristique</Text>
        <Text style={[styles.tableCellBold, { width: "60%", color: "#FFFFFF" }]}>Valeur</Text>
      </View>
      {visibleRows.map((row, i) => {
        const isEmpty = row.value === "\u2014";
        return (
          <View
            key={row.label}
            style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: theme.light } : {}]}
          >
            {/* V2-22: label with subtle tinted background */}
            <Text style={[styles.tableCellBold, { width: "40%", color: theme.secondaire, backgroundColor: i % 2 === 0 ? "#EDF2F7" : "#F7FAFC" }]}>{row.label}</Text>
            <Text style={[styles.tableCell, { width: "60%", color: isEmpty ? "#BBBBBB" : theme.text, fontFamily: isEmpty ? "Helvetica-Oblique" : "Helvetica" }]}>
              {isEmpty ? "Non renseigné" : row.value}
            </Text>
          </View>
        );
      })}
    </RoundedTableWrapper>
  );
};

export default PdfTableEntite;
