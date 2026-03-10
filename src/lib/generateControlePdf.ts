import jsPDF from "jspdf";
import type { Client, ControleQualite } from "./types";

// ── safe text to avoid jsPDF crash on undefined/null + truncate overflow ──
function safe(val: unknown, maxLen = 0): string {
  if (val === null || val === undefined) return "—";
  const s = String(val);
  if (maxLen > 0 && s.length > maxLen) return s.substring(0, maxLen) + "...";
  return s;
}

// ── consistent page break guard ──
function pageGuard(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 15;
  }
  return y;
}

// ── Footer helper ──
function addFooter(doc: jsPDF, label: string) {
  const W = 210;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${label} — Page ${i}/${pageCount}`, W / 2, 290, { align: "center" });
  }
}

// ════════════════════════════════════════════════════════════════════
// Full quality control report using actual controles data
// ════════════════════════════════════════════════════════════════════
export function generateRapportControle(echantillon: Client[], controles?: ControleQualite[]) {
  if (!echantillon || echantillon.length === 0) return;

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

  // === STATISTICS SUMMARY ===
  if (controles && controles.length > 0) {
    const total = controles.length;
    const conformes = controles.filter((c) => c.resultatGlobal === "CONFORME").length;
    const ncMineur = controles.filter((c) => c.resultatGlobal === "NON CONFORME MINEUR").length;
    const ncMajeur = controles.filter((c) => c.resultatGlobal === "NON CONFORME MAJEUR").length;
    const reserves = controles.filter((c) => c.resultatGlobal === "CONFORME AVEC RESERVES").length;
    const taux = total > 0 ? Math.round(((conformes + reserves) / total) * 100) : 0;

    doc.setFillColor(245, 247, 250);
    doc.rect(marginL, y - 4, contentW, 20, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("SYNTHESE DES CONTROLES", marginL + 3, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Total: ${total} | Conformes: ${conformes} | NC mineures: ${ncMineur} | NC majeures: ${ncMajeur} | Reserves: ${reserves}`, marginL + 3, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Taux de conformite: ${taux}%`, marginL + 3, y);
    doc.setFont("helvetica", "normal");
    y += 10;
  }

  // === INTRO ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const intro = `Conformement aux procedures internes du cabinet et aux obligations de l'article L.561-32 du CMF, un echantillon de ${echantillon.length} dossiers a ete tire au sort pour controle qualite mensuel.`;
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, marginL, y);
  y += introLines.length * 5 + 5;

  // === TABLE HEADER ===
  y = pageGuard(doc, y, 10);
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
    y = pageGuard(doc, y, 8);
    const flags = [c.ppe === "OUI" ? "PPE" : "", c.paysRisque === "OUI" ? "Pays" : ""].filter(Boolean).join("/") || "—";
    const row = [
      safe(c.ref, 10),
      safe(c.raisonSociale, 28),
      safe(c.forme, 10),
      String(c.scoreGlobal ?? 0),
      safe(c.nivVigilance),
      flags,
      safe(c.etatPilotage),
    ];
    row.forEach((v, i) => doc.text(v, marginL + cols[i] + 2, y));
    doc.setDrawColor(220, 220, 220);
    doc.line(marginL, y + 2, marginR, y + 2);
    y += 6;
  }
  y += 5;

  // === DETAIL PER CLIENT ===
  for (const c of echantillon) {
    y = pageGuard(doc, y, 50);

    doc.setFillColor(30, 58, 95);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(safe(`${c.ref} — ${c.raisonSociale}`, 60), marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(8);
    const checkPoints = [
      { label: "1. Identite & BE", detail: `Dirigeant: ${safe(c.dirigeant)} | BE: ${c.be || "Non renseigne"} | CNI exp: ${safe(c.dateExpCni)}` },
      { label: "2. Scoring", detail: `Act:${c.scoreActivite ?? 0} Pay:${c.scorePays ?? 0} Mis:${c.scoreMission ?? 0} Mat:${c.scoreMaturite ?? 0} Str:${c.scoreStructure ?? 0} Mal:${c.malus ?? 0} = ${c.scoreGlobal ?? 0} -> ${safe(c.nivVigilance)}` },
      { label: "3. Facteurs risque", detail: `PPE:${safe(c.ppe)} Pays:${safe(c.paysRisque)} Atyp:${safe(c.atypique)} Dist:${safe(c.distanciel)} Cash:${safe(c.cash)} Press:${safe(c.pression)}` },
      { label: "4. Pilotage", detail: `Derniere revue: ${safe(c.dateDerniereRevue)} | Butoir: ${safe(c.dateButoir)} | Etat: ${safe(c.etatPilotage)}` },
    ];

    for (const cp of checkPoints) {
      y = pageGuard(doc, y, 8);
      doc.setFont("helvetica", "bold");
      doc.text(cp.label, marginL + 3, y);
      doc.setFont("helvetica", "normal");
      doc.text(safe(cp.detail, 90), marginL + 40, y);

      doc.setDrawColor(100, 100, 100);
      doc.rect(marginR - 15, y - 3, 4, 4);
      doc.text("OK", marginR - 10, y);
      doc.rect(marginR - 3, y - 3, 4, 4);

      y += 6;
    }

    const anomalies: string[] = [];
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI")) {
      anomalies.push("INCOHERENCE: Vigilance simplifiee avec facteur de risque");
    }
    const expCniDate = c.dateExpCni ? new Date(c.dateExpCni) : null;
    if (expCniDate && !isNaN(expCniDate.getTime()) && expCniDate < new Date()) {
      anomalies.push("CNI EXPIREE");
    }
    if (c.etatPilotage === "RETARD") {
      anomalies.push("REVISION EN RETARD");
    }
    const riskCount = [c.ppe, c.paysRisque, c.atypique, c.distanciel, c.cash, c.pression]
      .filter((v) => v === "OUI").length;
    if (riskCount >= 3 && c.nivVigilance !== "RENFORCEE") {
      anomalies.push(`${riskCount} facteurs de risque mais vigilance non renforcee`);
    }

    if (anomalies.length > 0) {
      y = pageGuard(doc, y, anomalies.length * 4 + 8);
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

    // Associated control result
    if (controles) {
      const ctrl = controles.find((ct) => ct.siren === c.siren);
      if (ctrl) {
        y = pageGuard(doc, y, 20);
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`Resultat du controle: ${safe(ctrl.resultatGlobal)}`, marginL + 3, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        if (ctrl.controleur) {
          doc.text(`Controleur: ${ctrl.controleur}`, marginL + 3, y); y += 4;
        }
        if (ctrl.incident) {
          doc.text(`Incident: ${safe(ctrl.incident, 80)}`, marginL + 3, y); y += 4;
        }
        if (ctrl.actionCorrectrice) {
          doc.text(`Action correctrice: ${safe(ctrl.actionCorrectrice, 80)}`, marginL + 3, y); y += 4;
        }
      }
    }

    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Commentaire : _______________________________________________________________", marginL + 3, y);
    y += 8;
  }

  // === NON-CONFORMITY ACTION PLAN ===
  if (controles) {
    const ncControles = controles.filter((c) => (c.resultatGlobal ?? "").startsWith("NON CONFORME"));
    if (ncControles.length > 0) {
      y = pageGuard(doc, y, 30);

      doc.setFillColor(200, 60, 60);
      doc.rect(marginL, y, contentW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("PLAN D'ACTIONS CORRECTIVES", marginL + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 12;

      doc.setFillColor(245, 240, 240);
      doc.rect(marginL, y - 4, contentW, 7, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const acCols = [0, 50, 90, 130, 155];
      const acHeaders = ["Dossier", "Resultat", "Action correctrice", "Echeance", "Suivi"];
      acHeaders.forEach((h, i) => doc.text(h, marginL + acCols[i] + 2, y));
      y += 6;

      doc.setFont("helvetica", "normal");
      for (const nc of ncControles) {
        y = pageGuard(doc, y, 8);
        const fmtEch = nc.dateEcheance ? new Date(nc.dateEcheance).toLocaleDateString("fr-FR") : "—";
        const suiviLabel: Record<string, string> = { A_TRAITER: "A traiter", EN_COURS: "En cours", RESOLU: "Resolu", CLOTURE: "Cloture" };
        const acRow = [
          safe(nc.dossierAudite, 25),
          safe(nc.resultatGlobal, 20),
          safe(nc.actionCorrectrice, 20) || "A definir",
          fmtEch,
          suiviLabel[nc.suiviStatut] || nc.suiviStatut || "A traiter",
        ];
        acRow.forEach((v, i) => doc.text(v, marginL + acCols[i] + 2, y));
        doc.setDrawColor(220, 220, 220);
        doc.line(marginL, y + 2, marginR, y + 2);
        y += 6;
      }
      y += 5;
    }
  }

  // === CONCLUSION ===
  y = pageGuard(doc, y, 50);
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

  addFooter(doc, `Rapport Controle Qualite LCB-FT — ${moisStr}`);

  doc.save(`Rapport_Controle_${new Date().toISOString().slice(0, 7)}.pdf`);
}

// ════════════════════════════════════════════════════════════════════
// Single control PDF using proper ControleQualite type
// ════════════════════════════════════════════════════════════════════
export function generateSingleControlePdf(c: ControleQualite) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  const contentW = marginR - marginL;
  let y = 15;
  const dateStr = new Date().toLocaleDateString("fr-FR");

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FICHE DE CONTROLE QUALITE LCB-FT", W / 2, 11, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date du controle : ${c.dateTirage || dateStr}`, W / 2, 19, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 33;

  // Client info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dossier controle", marginL, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const info: [string, string][] = [
    ["Raison sociale", safe(c.dossierAudite)],
    ["SIREN", safe(c.siren)],
    ["Forme juridique", safe(c.forme)],
    ["Score global", `${c.scoreGlobal ?? 0}/100`],
    ["Niveau de vigilance", safe(c.nivVigilance)],
    ["Controleur", c.controleur || "—"],
  ];
  for (const [label, val] of info) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, marginL + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, marginL + 50, y);
    y += 5;
  }
  y += 3;

  // Risk factors
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Facteurs de risque", marginL, y); y += 6;
  doc.setFontSize(9);
  const factors: [string, string][] = [
    ["PPE", safe(c.ppe)], ["Pays a risque", safe(c.paysRisque)], ["Operation atypique", safe(c.atypique)],
    ["Distanciel", safe(c.distanciel)], ["Especes", safe(c.cash)], ["Pression/Urgence", safe(c.pression)],
  ];
  for (const [label, val] of factors) {
    doc.setFont("helvetica", "normal");
    doc.text(`${label} : ${val}`, marginL + 3, y);
    y += 5;
  }
  y += 3;

  // Check points
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Points de controle", marginL, y); y += 6;
  doc.setFontSize(9);
  const points: [string, string][] = [
    ["1. Identite & Beneficiaires effectifs", c.point1],
    ["2. Scoring & Niveau de vigilance", c.point2],
    ["3. Documents & Contrat", c.point3],
  ];
  for (const [label, val] of points) {
    y = pageGuard(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.text(label, marginL + 3, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(val || "Non renseigne", contentW - 10);
    doc.text(lines, marginL + 5, y);
    y += lines.length * 4 + 3;
  }

  // Result
  y += 2;
  y = pageGuard(doc, y, 15);
  const isConf = c.resultatGlobal === "CONFORME";
  const isNCMaj = c.resultatGlobal === "NON CONFORME MAJEUR";
  const isNCMin = c.resultatGlobal === "NON CONFORME MINEUR";
  doc.setFillColor(isConf ? 34 : isNCMaj ? 200 : isNCMin ? 230 : 200, isConf ? 139 : isNCMaj ? 50 : isNCMin ? 150 : 170, isConf ? 34 : 50);
  doc.rect(marginL, y - 4, contentW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Resultat global : ${safe(c.resultatGlobal)}`, marginL + 3, y + 2);
  doc.setTextColor(0, 0, 0);
  y += 14;

  // Incident
  if (c.incident) {
    y = pageGuard(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Incident :", marginL, y); y += 5;
    doc.setFont("helvetica", "normal");
    const incLines = doc.splitTextToSize(c.incident, contentW - 5);
    doc.text(incLines, marginL + 3, y);
    y += incLines.length * 4 + 5;
  }

  // Action correctrice
  if (c.actionCorrectrice) {
    y = pageGuard(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 100, 200);
    doc.text("ACTION CORRECTRICE", marginL, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal");
    const actLines = doc.splitTextToSize(c.actionCorrectrice, contentW - 5);
    doc.text(actLines, marginL + 3, y);
    y += actLines.length * 4 + 3;
    if (c.dateEcheance) {
      try {
        doc.text(`Echeance: ${new Date(c.dateEcheance).toLocaleDateString("fr-FR")}`, marginL + 3, y);
      } catch {
        doc.text(`Echeance: ${c.dateEcheance}`, marginL + 3, y);
      }
      y += 4;
    }
    if (c.suiviStatut) {
      const suiviLabel: Record<string, string> = { A_TRAITER: "A traiter", EN_COURS: "En cours", RESOLU: "Resolu", CLOTURE: "Cloture" };
      doc.text(`Statut: ${suiviLabel[c.suiviStatut] || c.suiviStatut}`, marginL + 3, y); y += 4;
    }
    y += 3;
  }

  // Commentaire
  if (c.commentaire) {
    y = pageGuard(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Commentaire :", marginL, y); y += 5;
    doc.setFont("helvetica", "normal");
    const comLines = doc.splitTextToSize(c.commentaire, contentW - 5);
    doc.text(comLines, marginL + 3, y);
    y += comLines.length * 4 + 5;
  }

  // Signatures
  y = pageGuard(doc, y, 35);
  y = Math.max(y + 5, 220);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, marginR, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Controleur", marginL, y);
  doc.text("Referent LCB-FT", marginL + 90, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Nom : ____________________", marginL, y);
  doc.text("Nom : ____________________", marginL + 90, y);
  y += 8;
  doc.text("Date : ____________________", marginL, y);
  doc.text("Date : ____________________", marginL + 90, y);
  y += 8;
  doc.text("Signature :", marginL, y);
  doc.text("Signature :", marginL + 90, y);

  addFooter(doc, `Fiche Controle — ${safe(c.dossierAudite, 30)}`);

  // sanitize filename
  const safeName = (c.dossierAudite || "dossier").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
  doc.save(`Controle_${safeName}_${c.dateTirage || "sans-date"}.pdf`);
}
