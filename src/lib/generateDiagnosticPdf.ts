import jsPDF from "jspdf";
import type { DiagnosticReport } from "./diagnosticEngine";

// Color constants for consistent theming
const COLORS = {
  HEADER_BG: [30, 58, 95] as [number, number, number],
  CATEGORY_BG: [50, 80, 120] as [number, number, number],
  TABLE_HEADER_BG: [240, 240, 240] as [number, number, number],
  ACTION_HEADER_BG: [244, 67, 54] as [number, number, number],
  ACTION_ROW_BG: [255, 235, 235] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  GREY_LIGHT: [150, 150, 150] as [number, number, number],
  GREY_SUBTLE: [200, 200, 200] as [number, number, number],
  GREY_NUMBER: [100, 100, 100] as [number, number, number],
  REF_BLUE: [70, 130, 180] as [number, number, number],
  REC_ORANGE: [150, 80, 0] as [number, number, number],
};

const NOTE_COLORS: Record<string, [number, number, number]> = {
  A: [76, 175, 80],
  B: [255, 193, 7],
  C: [255, 152, 0],
  D: [244, 67, 54],
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  OK: [76, 175, 80],
  ALERTE: [255, 152, 0],
  CRITIQUE: [244, 67, 54],
};

// Page layout constants
const W = 210;
const MARGIN_L = 15;
const MARGIN_R = 195;
const CONTENT_W = MARGIN_R - MARGIN_L;
const PAGE_BOTTOM = 270;
const FOOTER_Y = 290;
const BADGE_WIDTH = 30;
const BADGE_HEIGHT = 18;
const TEXT_OFFSET = MARGIN_L + BADGE_WIDTH + 10; // After note badge
const TEXT_WIDTH = CONTENT_W - BADGE_WIDTH - 10;
const ITEM_INDENT = MARGIN_L + 14;
const ITEM_TEXT_WIDTH = CONTENT_W - 18;

export function generateDiagnosticPdf(report: DiagnosticReport) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 15;

    // Helper: check page break
    function checkPage(needed: number) {
      if (y + needed > PAGE_BOTTOM) { doc.addPage(); y = 15; }
    }

    // Helper: draw section header
    function sectionHeader(title: string, bgColor = COLORS.HEADER_BG) {
      checkPage(15);
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(MARGIN_L, y, CONTENT_W, 7, "F");
      doc.setTextColor(...COLORS.WHITE);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, MARGIN_L + 3, y + 5);
      doc.setTextColor(...COLORS.BLACK);
      y += 12;
    }

    // === PAGE 1: HEADER ===
    doc.setFillColor(...COLORS.HEADER_BG);
    doc.rect(0, 0, W, 40, "F");
    doc.setTextColor(...COLORS.WHITE);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNOSTIC 360\u00b0 TRACFIN", W / 2, 14, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Analyse complete du dispositif LCB-FT du cabinet", W / 2, 22, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Date de generation : ${report.dateGeneration}`, W / 2, 29, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.GREY_SUBTLE);
    doc.text("DOCUMENT CONFIDENTIEL \u2014 Usage interne uniquement", W / 2, 36, { align: "center" });
    doc.setTextColor(...COLORS.BLACK);
    y = 50;

    // === SOMMAIRE ===
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("SOMMAIRE", MARGIN_L, y);
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
      doc.text(item, MARGIN_L + 5, y);
      y += 5;
    }
    y += 5;

    // === 1. RESUME EXECUTIF ===
    sectionHeader("1. RESUME EXECUTIF");

    // Note badge
    const nc = NOTE_COLORS[report.noteLettre] || COLORS.GREY_NUMBER;
    doc.setFillColor(nc[0], nc[1], nc[2]);
    doc.roundedRect(MARGIN_L, y - 4, BADGE_WIDTH, BADGE_HEIGHT, 3, 3, "F");
    doc.setTextColor(...COLORS.WHITE);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(report.noteLettre, MARGIN_L + BADGE_WIDTH / 2, y + 9, { align: "center" });

    doc.setTextColor(...COLORS.BLACK);
    doc.setFontSize(12);
    doc.text(`Score du dispositif : ${report.scoreGlobalDispositif}/100`, TEXT_OFFSET, y + 2);

    // Plain-language synthesis
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const simpleLines = doc.splitTextToSize(report.syntheseSimple, TEXT_WIDTH);
    doc.text(simpleLines, TEXT_OFFSET, y + 8);
    y += Math.max(simpleLines.length * 4, BADGE_HEIGHT) + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const synLines = doc.splitTextToSize(report.synthese, CONTENT_W);
    doc.text(synLines, MARGIN_L, y);
    y += synLines.length * 3.5 + 5;

    // Summary statistics
    const critiques = report.items.filter(i => i.statut === "CRITIQUE").length;
    const alerteCount = report.items.filter(i => i.statut === "ALERTE").length;
    const okCount = report.items.filter(i => i.statut === "OK").length;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Perimetre:", MARGIN_L, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${report.totalClients} client(s), ${report.totalCollaborateurs} collaborateur(s), ${report.totalAlertes} alerte(s)`, MARGIN_L + 30, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Resultats:", MARGIN_L, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${okCount} conforme(s), ${alerteCount} alerte(s), ${critiques} critique(s) sur ${report.items.length} indicateurs`, MARGIN_L + 30, y);
    y += 10;

    // === 2. STATISTIQUES PAR CATEGORIE ===
    sectionHeader("2. STATISTIQUES PAR CATEGORIE");

    // Table header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...COLORS.TABLE_HEADER_BG);
    doc.rect(MARGIN_L, y - 3, CONTENT_W, 6, "F");
    const colPositions = { cat: MARGIN_L + 2, score: MARGIN_L + 70, ok: MARGIN_L + 95, alerte: MARGIN_L + 110, critique: MARGIN_L + 135, total: MARGIN_L + 160 };
    doc.text("Categorie", colPositions.cat, y);
    doc.text("Score", colPositions.score, y);
    doc.text("OK", colPositions.ok, y);
    doc.text("Alertes", colPositions.alerte, y);
    doc.text("Critiques", colPositions.critique, y);
    doc.text("Total", colPositions.total, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const cs of report.categoryStats) {
      checkPage(8);
      // Score color bar - aligned with Score column
      const scoreColor = cs.score >= 80 ? STATUS_COLORS.OK : cs.score >= 50 ? STATUS_COLORS.ALERTE : STATUS_COLORS.CRITIQUE;
      doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.rect(colPositions.score, y - 3.5, (cs.score / 100) * 25, 4, "F");

      doc.setTextColor(...COLORS.BLACK);
      doc.text(cs.categorie, colPositions.cat, y);
      doc.text(`${cs.score}%`, colPositions.score, y);
      doc.text(String(cs.ok), colPositions.ok + 2, y);
      doc.text(String(cs.alerte), colPositions.alerte + 7, y);
      doc.text(String(cs.critique), colPositions.critique + 7, y);
      doc.text(String(cs.total), colPositions.total + 3, y);
      y += 6;
    }
    y += 5;

    // === 3. DETAIL PAR CATEGORIE ===
    sectionHeader("3. DETAIL DES INDICATEURS");

    const categories = [...new Set(report.items.map(i => i.categorie))];
    let globalIdx = 0;
    for (const cat of categories) {
      checkPage(15);

      // Category sub-header
      const catStats = report.categoryStats.find(cs => cs.categorie === cat);
      doc.setFillColor(...COLORS.CATEGORY_BG);
      doc.rect(MARGIN_L, y, CONTENT_W, 6, "F");
      doc.setTextColor(...COLORS.WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${cat}${catStats ? ` \u2014 Score: ${catStats.score}%` : ""}`, MARGIN_L + 3, y + 4.5);
      doc.setTextColor(...COLORS.BLACK);
      y += 9;

      const catItems = report.items.filter(i => i.categorie === cat);
      for (const item of catItems) {
        checkPage(22);
        globalIdx++;

        // Status indicator circle
        const sc = STATUS_COLORS[item.statut] || COLORS.GREY_NUMBER;
        doc.setFillColor(sc[0], sc[1], sc[2]);
        doc.circle(MARGIN_L + 4, y - 1, 2, "F");

        // Numbering
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.GREY_NUMBER);
        doc.text(`${globalIdx}.`, MARGIN_L + 8, y);

        // Indicator title
        doc.setTextColor(...COLORS.BLACK);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        const titleText = `[${item.statut}] ${item.indicateur}`;
        doc.text(titleText, ITEM_INDENT, y);

        // Reference - measure width with the SAME font context (size 9 bold)
        if (item.referenceReglementaire) {
          const titleWidth = doc.getTextWidth(titleText);
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.REF_BLUE);
          doc.text(`(${item.referenceReglementaire})`, ITEM_INDENT + titleWidth + 2, y);
          doc.setTextColor(...COLORS.BLACK);
        }
        y += 4;

        // Detail
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const detLines = doc.splitTextToSize(item.detail, ITEM_TEXT_WIDTH);
        doc.text(detLines, ITEM_INDENT, y);
        y += detLines.length * 3.5;

        // Recommendation
        if (item.recommandation !== "Aucune action requise.") {
          doc.setTextColor(...COLORS.REC_ORANGE);
          const recLines = doc.splitTextToSize(`-> ${item.recommandation}`, ITEM_TEXT_WIDTH);
          doc.text(recLines, ITEM_INDENT, y);
          doc.setTextColor(...COLORS.BLACK);
          y += recLines.length * 3.5;
        }
        y += 3;
      }
      y += 3;
    }

    // === 4. ACTIONS CORRECTIVES PRIORITAIRES ===
    if (report.recommandationsPrioritaires.length > 0) {
      sectionHeader("4. PLAN D'ACTION PRIORITAIRE", COLORS.ACTION_HEADER_BG);

      // Table header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(...COLORS.ACTION_ROW_BG);
      doc.rect(MARGIN_L, y - 3, CONTENT_W, 6, "F");
      doc.text("N\u00b0", MARGIN_L + 2, y);
      doc.text("Action corrective", MARGIN_L + 12, y);
      doc.text("Priorite", MARGIN_L + 150, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const actionTextWidth = CONTENT_W - 32; // space for N° and Priorite columns
      for (let i = 0; i < report.recommandationsPrioritaires.length; i++) {
        checkPage(12);
        const rec = report.recommandationsPrioritaires[i];
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}.`, MARGIN_L + 3, y);
        doc.setFont("helvetica", "normal");
        const recLines = doc.splitTextToSize(rec, actionTextWidth);
        doc.text(recLines, MARGIN_L + 12, y);
        // Priority level
        doc.setTextColor(...COLORS.ACTION_HEADER_BG);
        doc.text(i < 3 ? "URGENTE" : "HAUTE", MARGIN_L + 150, y);
        doc.setTextColor(...COLORS.BLACK);
        y += recLines.length * 4 + 3;
      }
    }

    // === 5. SIGNATURES ===
    checkPage(50);
    y += 5;
    sectionHeader("5. VALIDATION ET SIGNATURES");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Rapport genere le ${report.dateGeneration}`, MARGIN_L, y);
    y += 5;
    doc.text(`Perimetre: ${report.totalClients} clients, ${report.totalCollaborateurs} collaborateurs, ${report.totalAlertes} alertes`, MARGIN_L, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Referent LCB-FT", MARGIN_L, y);
    doc.text("Associe signataire", MARGIN_L + 100, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Nom : ____________________", MARGIN_L, y);
    doc.text("Nom : ____________________", MARGIN_L + 100, y);
    y += 8;
    doc.text("Date : ____________________", MARGIN_L, y);
    doc.text("Date : ____________________", MARGIN_L + 100, y);
    y += 10;
    doc.text("Signature :", MARGIN_L, y);
    doc.text("Signature :", MARGIN_L + 100, y);

    // === FOOTER ===
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.GREY_LIGHT);
      doc.text(
        `Diagnostic 360\u00b0 Tracfin \u2014 ${report.dateGeneration} \u2014 Page ${i}/${pageCount} \u2014 CONFIDENTIEL`,
        W / 2, FOOTER_Y, { align: "center" }
      );
    }

    doc.save(`Diagnostic_360_Tracfin_${report.dateGeneration}.pdf`);
  } catch (err) {
    console.error("[PDF] Erreur lors de la generation du PDF:", err);
    throw new Error("Impossible de generer le PDF. Veuillez reessayer.");
  }
}
