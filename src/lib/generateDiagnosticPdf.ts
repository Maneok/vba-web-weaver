import jsPDF from "jspdf";
import type { DiagnosticReport } from "./diagnosticEngine";

export function generateDiagnosticPdf(report: DiagnosticReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  const contentW = marginR - marginL;
  let y = 15;

  const noteColors: Record<string, [number, number, number]> = {
    A: [76, 175, 80],
    B: [255, 193, 7],
    C: [255, 152, 0],
    D: [244, 67, 54],
  };
  const statusColors: Record<string, [number, number, number]> = {
    OK: [76, 175, 80],
    ALERTE: [255, 152, 0],
    CRITIQUE: [244, 67, 54],
  };

  // Helper: check page break
  function checkPage(needed: number) {
    if (y + needed > 270) { doc.addPage(); y = 15; }
  }

  // === PAGE 1: HEADER === (Amélioration #49 - confidentialité)
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSTIC 360° TRACFIN", W / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Analyse complete du dispositif LCB-FT du cabinet", W / 2, 22, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Date de generation : ${report.dateGeneration}`, W / 2, 29, { align: "center" });
  // Amélioration #49 - Mention de confidentialité
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text("DOCUMENT CONFIDENTIEL — Usage interne uniquement", W / 2, 36, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 50;

  // === SOMMAIRE (Amélioration #43) ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SOMMAIRE", marginL, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const tocItems = [
    "1. Resume executif et note globale",
    "2. Statistiques par categorie",
    "3. Detail des indicateurs par categorie",
    "4. Actions correctives prioritaires",
    "5. Plan d'action et signatures",
  ];
  for (const item of tocItems) {
    doc.text(item, marginL + 5, y);
    y += 5;
  }
  y += 5;

  // === 1. RESUME EXECUTIF (Amélioration #44) ===
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("1. RESUME EXECUTIF", marginL + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Note badge
  const nc = noteColors[report.noteLettre] || [100, 100, 100];
  doc.setFillColor(nc[0], nc[1], nc[2]);
  doc.roundedRect(marginL, y - 4, 30, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(report.noteLettre, marginL + 15, y + 9, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Score du dispositif : ${report.scoreGlobalDispositif}/100`, marginL + 40, y + 2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const synLines = doc.splitTextToSize(report.synthese, contentW - 45);
  doc.text(synLines, marginL + 40, y + 8);
  y += 25;

  // Summary statistics
  doc.setFontSize(9);
  const critiques = report.items.filter(i => i.statut === "CRITIQUE").length;
  const alerteCount = report.items.filter(i => i.statut === "ALERTE").length;
  const okCount = report.items.filter(i => i.statut === "OK").length;

  doc.setFont("helvetica", "bold");
  doc.text("Perimetre:", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${report.totalClients} client(s), ${report.totalCollaborateurs} collaborateur(s), ${report.totalAlertes} alerte(s)`, marginL + 30, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Resultats:", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${okCount} conforme(s), ${alerteCount} alerte(s), ${critiques} critique(s) sur ${report.items.length} indicateurs`, marginL + 30, y);
  y += 10;

  // === 2. STATISTIQUES PAR CATEGORIE (Amélioration #45, #49) ===
  checkPage(40);
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("2. STATISTIQUES PAR CATEGORIE", marginL + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Table header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(marginL, y - 3, contentW, 6, "F");
  doc.text("Categorie", marginL + 2, y);
  doc.text("Score", marginL + 70, y);
  doc.text("OK", marginL + 95, y);
  doc.text("Alertes", marginL + 110, y);
  doc.text("Critiques", marginL + 135, y);
  doc.text("Total", marginL + 160, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const cs of report.categoryStats) {
    checkPage(8);
    // Score color bar
    const scoreColor = cs.score >= 80 ? statusColors.OK : cs.score >= 50 ? statusColors.ALERTE : statusColors.CRITIQUE;
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.rect(marginL + 65, y - 3.5, (cs.score / 100) * 25, 4, "F");

    doc.setTextColor(0, 0, 0);
    doc.text(cs.categorie, marginL + 2, y);
    doc.text(`${cs.score}%`, marginL + 70, y);
    doc.text(String(cs.ok), marginL + 97, y);
    doc.text(String(cs.alerte), marginL + 117, y);
    doc.text(String(cs.critique), marginL + 142, y);
    doc.text(String(cs.total), marginL + 163, y);
    y += 6;
  }
  y += 5;

  // === 3. DETAIL PAR CATEGORIE (Amélioration #46 - références) ===
  checkPage(15);
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("3. DETAIL DES INDICATEURS", marginL + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  const categories = [...new Set(report.items.map(i => i.categorie))];
  // Amélioration #48: numbering
  let globalIdx = 0;
  for (const cat of categories) {
    checkPage(15);

    // Category sub-header
    const catStats = report.categoryStats.find(cs => cs.categorie === cat);
    doc.setFillColor(50, 80, 120);
    doc.rect(marginL, y, contentW, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${cat}${catStats ? ` — Score: ${catStats.score}%` : ""}`, marginL + 3, y + 4.5);
    doc.setTextColor(0, 0, 0);
    y += 9;

    const catItems = report.items.filter(i => i.categorie === cat);
    for (const item of catItems) {
      checkPage(20);
      globalIdx++;

      // Status indicator
      const sc = statusColors[item.statut] || [100, 100, 100];
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.circle(marginL + 4, y - 1, 2, "F");

      // Amélioration #48: Numérotation enrichie
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(`${globalIdx}.`, marginL + 8, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(`[${item.statut}] ${item.indicateur}`, marginL + 14, y);

      // Amélioration #46: Référence réglementaire
      if (item.referenceReglementaire) {
        doc.setFontSize(7);
        doc.setTextColor(70, 130, 180);
        doc.text(`(${item.referenceReglementaire})`, marginL + 14 + doc.getTextWidth(`[${item.statut}] ${item.indicateur}`) + 2, y);
        doc.setTextColor(0, 0, 0);
      }
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const detLines = doc.splitTextToSize(item.detail, contentW - 18);
      doc.text(detLines, marginL + 14, y);
      y += detLines.length * 3.5;

      if (item.recommandation !== "Aucune action requise.") {
        doc.setTextColor(150, 80, 0);
        const recLines = doc.splitTextToSize(`-> ${item.recommandation}`, contentW - 18);
        doc.text(recLines, marginL + 14, y);
        doc.setTextColor(0, 0, 0);
        y += recLines.length * 3.5;
      }
      y += 3;
    }
    y += 3;
  }

  // === 4. ACTIONS CORRECTIVES PRIORITAIRES (Amélioration #50) ===
  if (report.recommandationsPrioritaires.length > 0) {
    checkPage(20);

    doc.setFillColor(244, 67, 54);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("4. PLAN D'ACTION PRIORITAIRE", marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    // Table header for action plan
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(255, 235, 235);
    doc.rect(marginL, y - 3, contentW, 6, "F");
    doc.text("N°", marginL + 2, y);
    doc.text("Action corrective", marginL + 12, y);
    doc.text("Priorite", marginL + 150, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < report.recommandationsPrioritaires.length; i++) {
      checkPage(12);
      const rec = report.recommandationsPrioritaires[i];
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}.`, marginL + 3, y);
      doc.setFont("helvetica", "normal");
      const recLines = doc.splitTextToSize(rec, 130);
      doc.text(recLines, marginL + 12, y);
      // Priority level
      doc.setTextColor(244, 67, 54);
      doc.text(i < 3 ? "URGENTE" : "HAUTE", marginL + 150, y);
      doc.setTextColor(0, 0, 0);
      y += recLines.length * 4.5 + 2;
    }
  }

  // === 5. SIGNATURES ===
  checkPage(50);
  y += 5;
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("5. VALIDATION ET SIGNATURES", marginL + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 15;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport genere le ${report.dateGeneration}`, marginL, y);
  y += 5;
  doc.text(`Perimetre: ${report.totalClients} clients, ${report.totalCollaborateurs} collaborateurs, ${report.totalAlertes} alertes`, marginL, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Referent LCB-FT", marginL, y);
  doc.text("Associe signataire", marginL + 100, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Nom : ____________________", marginL, y);
  doc.text("Nom : ____________________", marginL + 100, y);
  y += 8;
  doc.text("Date : ____________________", marginL, y);
  doc.text("Date : ____________________", marginL + 100, y);
  y += 10;
  doc.text("Signature :", marginL, y);
  doc.text("Signature :", marginL + 100, y);

  // === FOOTER (Améliorations #48, #49) ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Diagnostic 360° Tracfin — ${report.dateGeneration} — Page ${i}/${pageCount} — CONFIDENTIEL`,
      W / 2, 290, { align: "center" }
    );
  }

  doc.save(`Diagnostic_360_Tracfin_${report.dateGeneration}.pdf`);
}
