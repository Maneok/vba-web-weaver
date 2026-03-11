import jsPDF from "jspdf";
import type { DiagnosticReport } from "./diagnosticEngine";

export function generateDiagnosticPdf(report: DiagnosticReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  const contentW = marginR - marginL;
  let y = 15;

  // === HEADER ===
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSTIC 360° TRACFIN", W / 2, 13, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Analyse complete du dispositif LCB-FT du cabinet", W / 2, 21, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Date de generation : ${report.dateGeneration}`, W / 2, 29, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 45;

  // === NOTE GLOBALE ===
  const noteColors: Record<string, [number, number, number]> = {
    A: [76, 175, 80],
    B: [255, 193, 7],
    C: [255, 152, 0],
    D: [244, 67, 54],
  };
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

  // === DETAIL PAR CATEGORIE ===
  const categories = [...new Set(report.items.map(i => i.categorie))];
  for (const cat of categories) {
    if (y > 250) { doc.addPage(); y = 15; }

    doc.setFillColor(30, 58, 95);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(cat, marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const catItems = report.items.filter(i => i.categorie === cat);
    for (const item of catItems) {
      if (y > 265) { doc.addPage(); y = 15; }

      // Status indicator
      const statusColors: Record<string, [number, number, number]> = {
        OK: [76, 175, 80],
        ALERTE: [255, 152, 0],
        CRITIQUE: [244, 67, 54],
      };
      const sc = statusColors[item.statut] || [100, 100, 100];
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.circle(marginL + 4, y - 1, 2, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`[${item.statut}] ${item.indicateur}`, marginL + 10, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const detLines = doc.splitTextToSize(item.detail, contentW - 15);
      doc.text(detLines, marginL + 10, y);
      y += detLines.length * 3.5;

      if (item.recommandation !== "Aucune action requise.") {
        doc.setTextColor(150, 80, 0);
        const recLines = doc.splitTextToSize(`-> ${item.recommandation}`, contentW - 15);
        doc.text(recLines, marginL + 10, y);
        doc.setTextColor(0, 0, 0);
        y += recLines.length * 3.5;
      }
      y += 3;
    }
    y += 3;
  }

  // === RECOMMANDATIONS PRIORITAIRES ===
  if (report.recommandationsPrioritaires.length > 0) {
    if (y > 230) { doc.addPage(); y = 15; }

    doc.setFillColor(244, 67, 54);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ACTIONS CORRECTIVES PRIORITAIRES", marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < report.recommandationsPrioritaires.length; i++) {
      if (y > 270) { doc.addPage(); y = 15; }
      const rec = report.recommandationsPrioritaires[i];
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}.`, marginL + 3, y);
      doc.setFont("helvetica", "normal");
      const recLines = doc.splitTextToSize(rec, contentW - 15);
      doc.text(recLines, marginL + 10, y);
      y += recLines.length * 4.5 + 2;
    }
  }

  // === SIGNATURES ===
  if (y > 240) { doc.addPage(); y = 15; }
  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport genere le ${report.dateGeneration}`, marginL, y); y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Referent LCB-FT", marginL, y);
  doc.text("Associe signataire", marginL + 100, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Nom : ____________________", marginL, y);
  doc.text("Nom : ____________________", marginL + 100, y);
  y += 10;
  doc.text("Signature :", marginL, y);
  doc.text("Signature :", marginL + 100, y);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Diagnostic 360° Tracfin — ${report.dateGeneration} — Page ${i}/${pageCount}`,
      W / 2, 290, { align: "center" }
    );
  }

  const safeDate = (report.dateGeneration || "").replace(/[/\\:*?"<>|]/g, "-");
  doc.save(`Diagnostic_360_Tracfin_${safeDate}.pdf`);
}
