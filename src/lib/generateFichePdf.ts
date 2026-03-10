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
  addRow("Dirigeant", client.dirigeant, "Capital", `${(client.capital ?? 0).toLocaleString("fr-FR")} €`);
  addRow("Adresse", `${client.adresse}, ${client.cp} ${client.ville}`);
  addRow("Téléphone", client.tel, "Email", client.mail);
  addRow("Effectif", client.effectif, "Date création", client.dateCreation);
  addRow("Domaine d'activité", client.domaine);
  y += 3;

  // === BENEFICIAIRES EFFECTIFS ===
  if (client.be && client.be.trim()) {
    addTitle("1b. BENEFICIAIRES EFFECTIFS (RBE)");
    const beEntries = client.be.split("/").map(b => b.trim()).filter(Boolean);
    for (const be of beEntries) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`  - ${be}`, marginL + 2, y);
      y += 5;
    }
    y += 2;
  }

  // ====== MISSION ======
  addTitle("2. NATURE DE LA MISSION");
  addRow("Type de mission", client.mission, "Fréquence", client.frequence);
  addRow("Comptable référent", client.comptable, "Associé signataire", client.associe);
  addRow("Superviseur", client.superviseur);
  addRow("Honoraires", `${(client.honoraires ?? 0).toLocaleString("fr-FR")} €`, "IBAN", client.iban);
  addRow("Date de reprise", client.dateReprise);
  y += 3;

  // ====== FACTEURS DE RISQUE ======
  addTitle("3. FACTEURS DE RISQUE IDENTIFIÉS");
  const flag = (v: string) => v === "OUI" ? "⚠ OUI" : "NON";
  addRow("PPE (Pers. Politiquement Exposée)", flag(client.ppe), "Pays à risque", flag(client.paysRisque));
  addRow("Montage atypique", flag(client.atypique), "Relation à distance", flag(client.distanciel));
  addRow("Espèces significatives", flag(client.cash), "Pression du client", flag(client.pression));
  y += 3;

  // ====== SCORING WITH RADAR ======
  addTitle("4. EVALUATION DU RISQUE (SCORING)");

  const scores = [
    { label: "Activite", value: client.scoreActivite },
    { label: "Pays", value: client.scorePays },
    { label: "Mission", value: client.scoreMission },
    { label: "Maturite", value: client.scoreMaturite },
    { label: "Structure", value: client.scoreStructure },
  ];

  // --- RADAR CHART ---
  const radarCx = marginL + 45;
  const radarCy = y + 38;
  const radarR = 30;
  const n = scores.length;
  const angleOffset = -Math.PI / 2;

  // Grid circles
  for (let ring = 1; ring <= 4; ring++) {
    const r = (radarR * ring) / 4;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.circle(radarCx, radarCy, r);
  }

  // Grid labels
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  for (let ring = 1; ring <= 4; ring++) {
    doc.text(String(ring * 25), radarCx + 1, radarCy - (radarR * ring) / 4 + 1);
  }

  // Axis lines and labels
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const radarPoints: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const axX = radarCx + radarR * Math.cos(angle);
    const axY = radarCy + radarR * Math.sin(angle);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.15);
    doc.line(radarCx, radarCy, axX, axY);

    // Label position
    const lx = radarCx + (radarR + 8) * Math.cos(angle);
    const ly = radarCy + (radarR + 8) * Math.sin(angle);
    doc.text(scores[i].label, lx, ly, { align: "center" });

    // Data point
    const val = Math.min(scores[i].value ?? 0, 100) / 100;
    const px = radarCx + radarR * val * Math.cos(angle);
    const py = radarCy + radarR * val * Math.sin(angle);
    radarPoints.push([px, py]);
  }

  // Draw filled polygon
  if (radarPoints.length > 0) {
    doc.setFillColor(30, 58, 95);
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    // Manual polygon path
    const firstPt = radarPoints[0];
    let pathStr = `${firstPt[0]} ${firstPt[1]} m `;
    for (let i = 1; i < radarPoints.length; i++) {
      pathStr += `${radarPoints[i][0]} ${radarPoints[i][1]} l `;
    }
    // Use lines instead since jsPDF doesn't have easy polygon fill
    for (let i = 0; i < radarPoints.length; i++) {
      const next = radarPoints[(i + 1) % radarPoints.length];
      doc.line(radarPoints[i][0], radarPoints[i][1], next[0], next[1]);
    }
    // Draw filled circles at data points
    for (const pt of radarPoints) {
      doc.setFillColor(30, 58, 95);
      doc.circle(pt[0], pt[1], 1, "F");
    }
  }

  // Score table on the right side
  const tableX = marginL + 100;
  let tableY = y + 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(240, 240, 245);
  doc.rect(tableX, tableY - 3, 80, 6, "F");
  doc.text("Critere", tableX + 2, tableY);
  doc.text("Score", tableX + 50, tableY);
  doc.text("/100", tableX + 65, tableY);
  tableY += 6;

  doc.setFont("helvetica", "normal");
  for (const s of scores) {
    doc.text(s.label, tableX + 2, tableY);
    // Color-coded bar
    const barW = ((s.value ?? 0) / 100) * 30;
    const barColor: [number, number, number] = s.value >= 61 ? [244, 67, 54] : s.value >= 26 ? [255, 152, 0] : [76, 175, 80];
    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.rect(tableX + 40, tableY - 2.5, barW, 3, "F");
    doc.text(String(s.value), tableX + 72, tableY);
    tableY += 5.5;
  }

  // Global score
  tableY += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`SCORE GLOBAL : ${client.scoreGlobal}`, tableX + 2, tableY);
  if (client.malus > 0) {
    tableY += 5;
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    doc.text(`dont malus : +${client.malus}`, tableX + 2, tableY);
    doc.setTextColor(0, 0, 0);
  }

  y = Math.max(radarCy + radarR + 15, tableY + 8);

  // Vigilance result
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

  const safeName = (client.raisonSociale || "client").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/_+/g, "_");
  doc.save(`Fiche_LCB-FT_${client.ref}_${safeName}.pdf`);
}
