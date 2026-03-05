import jsPDF from "jspdf";
import type { Client } from "./types";

export function generateFicheAcceptation(client: Client) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  let y = 15;

  const addTitle = (text: string) => {
    doc.setFillColor(30, 58, 95);
    doc.rect(marginL, y, marginR - marginL, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginL + 3, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 12;
  };

  const addRow = (label: string, value: string, col2Label?: string, col2Value?: string) => {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label, marginL + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "—"), marginL + 55, y);
    if (col2Label) {
      doc.setFont("helvetica", "bold");
      doc.text(col2Label, marginL + 100, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(col2Value || "—"), marginL + 148, y);
    }
    y += 5;
  };

  // ====== HEADER ======
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("FICHE D'ACCEPTATION LCB-FT", W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Générée le ${new Date().toLocaleDateString("fr-FR")} — Réf. ${client.ref}`, W / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // ====== IDENTIFICATION ======
  addTitle("1. IDENTIFICATION DU CLIENT");
  addRow("Raison sociale", client.raisonSociale, "SIREN", client.siren);
  addRow("Forme juridique", client.forme, "Code APE", client.ape);
  addRow("Dirigeant", client.dirigeant, "Capital", `${client.capital.toLocaleString("fr-FR")} €`);
  addRow("Adresse", `${client.adresse}, ${client.cp} ${client.ville}`);
  addRow("Téléphone", client.tel, "Email", client.mail);
  addRow("Effectif", client.effectif, "Date création", client.dateCreation);
  addRow("Domaine d'activité", client.domaine);
  if (client.be) addRow("Bénéficiaires effectifs", client.be);
  y += 3;

  // ====== MISSION ======
  addTitle("2. NATURE DE LA MISSION");
  addRow("Type de mission", client.mission, "Fréquence", client.frequence);
  addRow("Comptable référent", client.comptable, "Associé signataire", client.associe);
  addRow("Superviseur", client.superviseur);
  addRow("Honoraires", `${client.honoraires.toLocaleString("fr-FR")} €`, "IBAN", client.iban);
  addRow("Date de reprise", client.dateReprise);
  y += 3;

  // ====== FACTEURS DE RISQUE ======
  addTitle("3. FACTEURS DE RISQUE IDENTIFIÉS");
  const flag = (v: string) => v === "OUI" ? "⚠ OUI" : "NON";
  addRow("PPE (Pers. Politiquement Exposée)", flag(client.ppe), "Pays à risque", flag(client.paysRisque));
  addRow("Montage atypique", flag(client.atypique), "Relation à distance", flag(client.distanciel));
  addRow("Espèces significatives", flag(client.cash), "Pression du client", flag(client.pression));
  y += 3;

  // ====== SCORING ======
  addTitle("4. ÉVALUATION DU RISQUE (SCORING)");
  
  // Score table
  const scores = [
    { label: "Activité (APE)", value: client.scoreActivite },
    { label: "Pays", value: client.scorePays },
    { label: "Mission", value: client.scoreMission },
    { label: "Maturité", value: client.scoreMaturite },
    { label: "Structure", value: client.scoreStructure },
  ];

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(marginL, y - 3, marginR - marginL, 6, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const colW = (marginR - marginL) / 6;
  scores.forEach((s, i) => {
    doc.text(s.label, marginL + 2 + i * colW, y);
  });
  doc.text("GLOBAL", marginL + 2 + 5 * colW, y);
  y += 6;

  // Values row
  doc.setFont("helvetica", "normal");
  scores.forEach((s, i) => {
    doc.text(String(s.value), marginL + 2 + i * colW, y);
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(client.scoreGlobal), marginL + 2 + 5 * colW, y);
  y += 5;

  if (client.malus > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 0, 0);
    doc.text(`Malus appliqué : +${client.malus} points`, marginL + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  // Vigilance result
  y += 2;
  const vigColor: Record<string, [number, number, number]> = {
    SIMPLIFIEE: [34, 139, 34],
    STANDARD: [200, 150, 0],
    RENFORCEE: [200, 0, 0],
  };
  const vc = vigColor[client.nivVigilance] || [0, 0, 0];
  doc.setFillColor(vc[0], vc[1], vc[2]);
  doc.roundedRect(marginL, y - 4, 80, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`VIGILANCE ${client.nivVigilance}`, marginL + 5, y + 1.5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // ====== PILOTAGE ======
  addTitle("5. PILOTAGE & ÉCHÉANCES");
  addRow("Dernière revue", client.dateDerniereRevue, "Date butoir", client.dateButoir);
  addRow("État du pilotage", client.etatPilotage, "Statut client", client.statut);
  addRow("Expiration CNI", client.dateExpCni);
  y += 3;

  // ====== DÉCISION ======
  addTitle("6. DÉCISION D'ACCEPTATION");
  y += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("☐  ACCEPTATION SANS RÉSERVE", marginL + 5, y); y += 6;
  doc.text("☐  ACCEPTATION AVEC VIGILANCE RENFORCÉE", marginL + 5, y); y += 6;
  doc.text("☐  REFUS DE LA MISSION", marginL + 5, y); y += 10;

  addRow("Date de la décision", "_ _ / _ _ / _ _ _ _", "Signature de l'associé", "____________________");
  y += 15;
  addRow("Nom du référent LCB-FT", "____________________", "Signature", "____________________");

  // ====== FOOTER ======
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Fiche LCB-FT — ${client.raisonSociale} — Page ${i}/${pageCount}`,
      W / 2, 290, { align: "center" }
    );
  }

  doc.save(`Fiche_LCB-FT_${client.ref}_${client.raisonSociale.replace(/\s/g, "_")}.pdf`);
}
