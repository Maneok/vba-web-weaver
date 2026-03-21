import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { HonorairesData, MissionConfig } from "@/types/lettreMissionPdf";
import { styles, formatMontant, formatMontantUnit, safeNumber } from "./pdfStyles";
import { RoundedTableWrapper, type PdfTheme, DEFAULT_THEME } from "./PdfComponents";

interface Props {
  honoraires: HonorairesData;
  mission: MissionConfig;
  theme?: PdfTheme;
}

/* ─── Helpers ─── */

const COL_DESIGNATION = "60%";
const COL_MONTANT = "40%";

const TableHeader: React.FC<{ cols: [string, string]; theme: PdfTheme }> = ({ cols, theme }) => (
  <View style={{ flexDirection: "row", backgroundColor: theme.secondaire, minHeight: 26, alignItems: "center" }}>
    <Text style={[styles.tableCellBold, { width: COL_DESIGNATION, color: "#FFFFFF" }]}>{cols[0]}</Text>
    <Text style={[styles.tableCellBold, { width: COL_MONTANT, textAlign: "right", color: "#FFFFFF" }]}>{cols[1]}</Text>
  </View>
);

const TableRow: React.FC<{ label: string; value: string; index: number; theme: PdfTheme }> = ({
  label,
  value,
  index,
  theme,
}) => (
  <View style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: theme.light } : {}]}>
    <Text style={[styles.tableCell, { width: COL_DESIGNATION }]}>{label}</Text>
    <Text style={[styles.tableCell, { width: COL_MONTANT, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
      {value}
    </Text>
  </View>
);

const TotalRow: React.FC<{ label: string; value: string; theme: PdfTheme }> = ({ label, value, theme }) => (
  <View style={[styles.tableRow, { backgroundColor: theme.secondaire, minHeight: 28, borderBottomWidth: 0 }]}>
    <Text style={[styles.tableCellBold, { width: COL_DESIGNATION, color: "#FFFFFF", fontSize: 10 }]}>{label}</Text>
    <Text style={[styles.tableCellBold, { width: COL_MONTANT, textAlign: "right", color: "#FFFFFF", fontSize: 10 }]}>
      {value}
    </Text>
  </View>
);

const SubHeading: React.FC<{ title: string; theme: PdfTheme }> = ({ title, theme }) => (
  <Text
    style={{
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: theme.secondaire,
      marginTop: 10,
      marginBottom: 4,
    }}
  >
    {title}
  </Text>
);

/* ─── Main component ─── */

const PdfTableHonoraires: React.FC<Props> = ({ honoraires, mission, theme: themeIn }) => {
  const theme = themeIn || DEFAULT_THEME;

  /* ── TABLEAU 1 — Mission comptable (always shown) ── */

  const lignesCompta: { label: string; value: string }[] = [
    { label: "Forfait annuel (12 mois)", value: formatMontant(honoraires.forfait_annuel_ht) },
  ];

  if (safeNumber(honoraires.constitution_dossier_ht) > 0) {
    lignesCompta.push({
      label: "Constitution de dossier",
      value: formatMontant(honoraires.constitution_dossier_ht),
    });
  }

  lignesCompta.push({
    label: "Honoraires exceptionnels — Expert-Comptable",
    value: "200 \u20AC HT / heure",
  });
  lignesCompta.push({
    label: "Honoraires exceptionnels — Collaborateur",
    value: "100 \u20AC HT / heure",
  });

  const totalCompta =
    safeNumber(honoraires.forfait_annuel_ht) + safeNumber(honoraires.constitution_dossier_ht);

  /* ── TABLEAU 2 — Mission sociale ── */

  const lignesSociale: { label: string; value: string }[] = [
    { label: "Bulletins de paie à l'unité", value: formatMontantUnit(honoraires.social_bulletin_unite, "bulletin") },
    { label: "Gestion des fins de contrats", value: formatMontantUnit(honoraires.social_fin_contrat, "fin de contrat") },
    { label: "Rédaction de contrat de travail simple", value: formatMontant(honoraires.social_contrat_simple) },
    { label: "Entrée d'un salarié sans rédaction de contrat", value: formatMontant(honoraires.social_entree_sans_contrat) },
    { label: "Attestations maladie", value: formatMontant(honoraires.social_attestation_maladie) },
  ];

  /* ── TABLEAU 3 — Mission juridique ── */

  /* ── TABLEAU 4 — Contrôle fiscal ── */

  const controleFiscalLabel =
    mission.controle_fiscal_option === "A"
      ? "Option A — Couverture intégrale : 25 € HT / mois (300 € HT / an)"
      : mission.controle_fiscal_option === "B"
        ? "Option B — Couverture partielle : 10 € HT / mois (120 € HT / an)"
        : "Aucune option souscrite";

  return (
    <View>
      {/* ═══ TABLEAU 1 — MISSION COMPTABLE ═══ */}
      <RoundedTableWrapper borderColor={theme.border}>
        <TableHeader cols={["Désignation", "Montant HT"]} theme={theme} />
        {lignesCompta.map((l, i) => (
          <TableRow key={i} label={l.label} value={l.value} index={i} theme={theme} />
        ))}
        <TotalRow label="TOTAL MISSION COMPTABLE" value={formatMontant(totalCompta)} theme={theme} />
      </RoundedTableWrapper>

      {/* ═══ TABLEAU 2 — MISSION SOCIALE ═══ */}
      {mission.mission_sociale && (
        <View style={{ marginTop: 10 }}>
          <SubHeading title="Mission sociale" theme={theme} />
          <RoundedTableWrapper borderColor={theme.border}>
            <TableHeader cols={["Prestation", "Montant HT"]} theme={theme} />
            {lignesSociale.map((l, i) => (
              <TableRow key={i} label={l.label} value={l.value} index={i} theme={theme} />
            ))}
          </RoundedTableWrapper>
          <Text
            style={{
              fontSize: 8,
              color: theme.muted,
              fontFamily: "Helvetica-Oblique",
              marginTop: 3,
              paddingHorizontal: 4,
            }}
          >
            Sur devis : Contrat de travail complexe, procédures de licenciement, rupture conventionnelle...
          </Text>
        </View>
      )}

      {/* ═══ TABLEAU 3 — MISSION JURIDIQUE ═══ */}
      {mission.mission_juridique && (
        <View style={{ marginTop: 10 }}>
          <SubHeading title="Mission juridique" theme={theme} />
          <RoundedTableWrapper borderColor={theme.border}>
            <View style={[styles.tableRow, { backgroundColor: theme.light, borderBottomWidth: 0 }]}>
              <Text style={[styles.tableCell, { width: COL_DESIGNATION }]}>
                Secrétariat juridique annuel
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: COL_MONTANT, textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {formatMontant(honoraires.juridique_annuel_ht)}
              </Text>
            </View>
          </RoundedTableWrapper>
        </View>
      )}

      {/* ═══ TABLEAU 4 — CONTRÔLE FISCAL ═══ */}
      {mission.controle_fiscal && (
        <View style={{ marginTop: 10 }}>
          <SubHeading title="Assistance au contrôle fiscal" theme={theme} />
          <RoundedTableWrapper borderColor={theme.border}>
            <View style={[styles.tableRow, { backgroundColor: theme.light, borderBottomWidth: 0 }]}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{controleFiscalLabel}</Text>
            </View>
          </RoundedTableWrapper>
        </View>
      )}
    </View>
  );
};

export default PdfTableHonoraires;
