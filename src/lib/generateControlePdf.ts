import jsPDF from "jspdf";
import type { Client } from "./types";

export function generateRapportControle(echantillon: Client[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  const contentW = marginR - marginL;
  let y = 15;
  const dateStr = new Date().toLocaleDateString("fr-FR");
  const moisStr = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // === HEADER ===
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RAPPORT DE CONTROLE QUALITE LCB-FT", W / 2, 13, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode : ${moisStr} — Date du tirage : ${dateStr}`, W / 2, 22, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 38;

  // === INTRO ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const intro = `Conformement aux procedures internes du cabinet et aux obligations de l'article L.561-32 du CMF, un echantillon de ${echantillon.length} dossiers a ete tire au sort pour controle qualite mensuel.`;
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, marginL, y);
  y += introLines.length * 5 + 5;

  // === TABLE HEADER ===
  doc.setFillColor(240, 240, 245);
  doc.rect(marginL, y - 4, contentW, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const cols = [0, 20, 75, 95, 115, 140, 160];
  const headers = ["Ref", "Raison Sociale", "Forme", "Score", "Vigilance", "PPE/Pays", "Pilotage"];
  headers.forEach((h, i) => doc.text(h, marginL + cols[i] + 2, y));
  y += 6;

  // === TABLE ROWS ===
  doc.setFont("helvetica", "normal");
  for (const c of echantillon) {
    if (y > 265) { doc.addPage(); y = 15; }
    const flags = [c.ppe === "OUI" ? "PPE" : "", c.paysRisque === "OUI" ? "Pays" : ""].filter(Boolean).join("/") || "—";
    const row = [c.ref, c.raisonSociale.substring(0, 28), c.forme, String(c.scoreGlobal), c.nivVigilance, flags, c.etatPilotage];
    row.forEach((v, i) => doc.text(v, marginL + cols[i] + 2, y));
    doc.setDrawColor(220, 220, 220);
    doc.line(marginL, y + 2, marginR, y + 2);
    y += 6;
  }
  y += 5;

  // === DETAIL PER CLIENT ===
  for (const c of echantillon) {
    if (y > 220) { doc.addPage(); y = 15; }

    doc.setFillColor(30, 58, 95);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${c.ref} — ${c.raisonSociale}`, marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(8);
    const checkPoints = [
      { label: "1. Identite & BE", detail: `Dirigeant: ${c.dirigeant} | BE: ${c.be || "Non renseigne"} | CNI exp: ${c.dateExpCni}` },
      { label: "2. Scoring", detail: `Act:${c.scoreActivite} Pay:${c.scorePays} Mis:${c.scoreMission} Mat:${c.scoreMaturite} Str:${c.scoreStructure} Mal:${c.malus} = ${c.scoreGlobal} -> ${c.nivVigilance}` },
      { label: "3. Facteurs risque", detail: `PPE:${c.ppe} Pays:${c.paysRisque} Atyp:${c.atypique} Dist:${c.distanciel} Cash:${c.cash} Press:${c.pression}` },
      { label: "4. Pilotage", detail: `Derniere revue: ${c.dateDerniereRevue} | Butoir: ${c.dateButoir} | Etat: ${c.etatPilotage}` },
    ];

    for (const cp of checkPoints) {
      doc.setFont("helvetica", "bold");
      doc.text(cp.label, marginL + 3, y);
      doc.setFont("helvetica", "normal");
      doc.text(cp.detail, marginL + 40, y);

      // Checkbox
      doc.setDrawColor(100, 100, 100);
      doc.rect(marginR - 15, y - 3, 4, 4);
      doc.text("OK", marginR - 10, y);
      doc.rect(marginR - 3, y - 3, 4, 4);

      y += 6;
    }

    // Anomalies detected
    const anomalies: string[] = [];
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI")) {
      anomalies.push("INCOHERENCE: Vigilance simplifiee avec facteur de risque");
    }
    if (c.dateExpCni && new Date(c.dateExpCni) < new Date()) {
      anomalies.push("CNI EXPIREE");
    }
    if (c.etatPilotage === "RETARD") {
      anomalies.push("REVISION EN RETARD");
    }

    if (anomalies.length > 0) {
      doc.setTextColor(200, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("Anomalies detectees :", marginL + 3, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      for (const a of anomalies) {
        doc.text(`  - ${a}`, marginL + 5, y);
        y += 4;
      }
      doc.setTextColor(0, 0, 0);
    }

    // Comment line
    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Commentaire : _______________________________________________________________", marginL + 3, y);
    y += 8;
  }

  // === CONCLUSION ===
  if (y > 240) { doc.addPage(); y = 15; }
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CONCLUSION & SIGNATURES", marginL + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Resultat global du controle : ______________________________________", marginL, y); y += 8;
  doc.text("Observations : ____________________________________________________", marginL, y); y += 8;
  doc.text("_____________________________________________________________________", marginL, y); y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Controleur", marginL, y);
  doc.text("Referent LCB-FT", marginL + 90, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Nom : ____________________", marginL, y);
  doc.text("Nom : ____________________", marginL + 90, y);
  y += 8;
  doc.text("Signature :", marginL, y);
  doc.text("Signature :", marginL + 90, y);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Rapport Controle Qualite LCB-FT — ${moisStr} — Page ${i}/${pageCount}`,
      W / 2, 290, { align: "center" }
    );
  }

  doc.save(`Rapport_Controle_${new Date().toISOString().slice(0, 7)}.pdf`);
}
