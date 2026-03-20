import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { HonorairesData, MissionConfig } from "@/types/lettreMissionPdf";
import { styles, colors, formatMontant, formatMontantUnit, safeNumber } from "./pdfStyles";

interface Props {
  honoraires: HonorairesData;
  mission: MissionConfig;
}

const PdfTableHonoraires: React.FC<Props> = ({ honoraires, mission }) => {
  const freq =
    honoraires.frequence_facturation === "MENSUEL"
      ? "Mensuelle"
      : honoraires.frequence_facturation === "TRIMESTRIEL"
        ? "Trimestrielle"
        : "Annuelle";

  const lignes: { designation: string; montant: string; frequence: string }[] = [
    {
      designation: "Mission comptable — Présentation des comptes",
      montant: formatMontant(honoraires.forfait_annuel_ht),
      frequence: freq,
    },
  ];

  if (safeNumber(honoraires.constitution_dossier_ht) > 0) {
    lignes.push({
      designation: "Constitution de dossier (1re année)",
      montant: formatMontant(honoraires.constitution_dossier_ht),
      frequence: "Unique",
    });
  }

  if (mission.mission_sociale) {
    lignes.push({
      designation: "Mission sociale — Bulletins de paie",
      montant: formatMontantUnit(honoraires.social_bulletin_unite, "bulletin"),
      frequence: "Mensuelle",
    });
    lignes.push({
      designation: "Mission sociale — Fin de contrat",
      montant: formatMontant(honoraires.social_fin_contrat),
      frequence: "Par évènement",
    });
  }

  if (mission.mission_juridique) {
    lignes.push({
      designation: "Secrétariat juridique annuel",
      montant: formatMontant(honoraires.juridique_annuel_ht),
      frequence: "Annuelle",
    });
  }

  if (mission.controle_fiscal) {
    const optLabel =
      mission.controle_fiscal_option === "A"
        ? "Option A — 25 € HT/mois"
        : mission.controle_fiscal_option === "B"
          ? "Option B — 10 € HT/mois"
          : "Aucune option souscrite";
    lignes.push({
      designation: `Assistance contrôle fiscal (${optLabel})`,
      montant: mission.controle_fiscal_option === "A" ? "300 € HT" : mission.controle_fiscal_option === "B" ? "120 € HT" : "—",
      frequence: "Annuelle",
    });
  }

  // Taux horaires
  lignes.push({
    designation: "Travaux complémentaires — Expert-comptable",
    montant: formatMontantUnit(honoraires.honoraires_ec_heure, "heure"),
    frequence: "Sur demande",
  });
  lignes.push({
    designation: "Travaux complémentaires — Collaborateur",
    montant: formatMontantUnit(honoraires.honoraires_collab_heure, "heure"),
    frequence: "Sur demande",
  });

  const total = safeNumber(honoraires.forfait_annuel_ht) + safeNumber(honoraires.constitution_dossier_ht) + safeNumber(honoraires.juridique_annuel_ht);

  return (
    <View>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCellBold, { width: "50%" }]}>Désignation</Text>
        <Text style={[styles.tableCellBold, { width: "30%", textAlign: "right" }]}>Montant</Text>
        <Text style={[styles.tableCellBold, { width: "20%", textAlign: "center" }]}>Fréquence</Text>
      </View>
      {lignes.map((l, i) => (
        <View
          key={i}
          style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: colors.fond_alternance } : {}]}
        >
          <Text style={[styles.tableCell, { width: "50%" }]}>{l.designation}</Text>
          <Text style={[styles.tableCell, { width: "30%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
            {l.montant}
          </Text>
          <Text style={[styles.tableCell, { width: "20%", textAlign: "center" }]}>{l.frequence}</Text>
        </View>
      ))}

      {/* Total */}
      <View style={[styles.tableRow, { backgroundColor: colors.secondaire, minHeight: 28 }]}>
        <Text style={[styles.tableCellBold, { width: "50%", color: colors.blanc }]}>
          TOTAL ANNUEL ESTIMÉ
        </Text>
        <Text
          style={[
            styles.tableCellBold,
            { width: "30%", textAlign: "right", color: colors.blanc, fontSize: 10 },
          ]}
        >
          {formatMontant(total)}
        </Text>
        <Text style={[styles.tableCell, { width: "20%", textAlign: "center", color: colors.blanc }]}>
          {freq}
        </Text>
      </View>
    </View>
  );
};

export default PdfTableHonoraires;
