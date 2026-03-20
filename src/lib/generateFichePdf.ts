import jsPDF from "jspdf";
import type { Client } from "./types";
import { formatDateFr } from "./dateUtils";

export interface FicheExtras {
  regimeFiscal?: {
    impot: string;
    impotDetail: string;
    categorieRevenu: string;
    tva: string;
    tvaDetail: string;
    tvaIntracom: string;
    avertissements: string[];
  };
  siret?: string;
  objetSocial?: string;
  dirigeants?: Array<{ nom: string; prenom: string; qualite: string; date_naissance?: string; nationalite?: string }>;
  beneficiaires?: Array<{ nom: string; prenom: string; pourcentage: number; pourcentageVotes?: number; nationalite: string }>;
  chaineBE?: Record<string, { denomination: string; siren: string; dirigeants: any[]; beneficiaires: any[] }>;
  screening?: {
    sanctions?: { hasPPE: boolean; hasCriticalMatch: boolean; matches?: Array<{ person: string; score: number }> };
    bodacc?: { hasProcedureCollective: boolean; alertes: string[] };
    news?: { hasNegativeNews: boolean; alertes: string[] };
    network?: { totalCompanies: number; totalPersons: number; alertes: Array<{ message: string; severity: string }> };
    gelAvoirs?: string[];
  };
  questions?: Array<{ id: string; question: string; value: string; commentaire: string; autoFilled?: boolean }>;
  documents?: Array<{ name: string; type: string }>;
  decision?: string;
  motifRefus?: string;
  motifReserve?: string;
  cabinetName?: string;
  responsable?: string;
}

export function generateFicheAcceptation(client: Client, extras?: FicheExtras) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 195;
  let y = 15;

  const pageBreakIfNeeded = (needed = 20) => {
    if (y > 280 - needed) { doc.addPage(); y = 15; }
  };

  const addTitle = (text: string) => {
    pageBreakIfNeeded(15);
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
    pageBreakIfNeeded();
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label, marginL + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "\u2014"), marginL + 55, y);
    if (col2Label) {
      doc.setFont("helvetica", "bold");
      doc.text(col2Label, marginL + 100, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(col2Value || "\u2014"), marginL + 148, y);
    }
    y += 5;
  };

  const addSmallText = (text: string, indent = 0) => {
    pageBreakIfNeeded();
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(text, marginL + 2 + indent, y);
    y += 4;
  };

  const addSubtitle = (text: string) => {
    pageBreakIfNeeded(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 95);
    doc.text(text, marginL + 2, y);
    doc.setTextColor(0, 0, 0);
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
  doc.text(`Generee le ${formatDateFr(new Date())} \u2014 Ref. ${client.ref}`, W / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // ====== 1. IDENTIFICATION ======
  addTitle("1. IDENTIFICATION DU CLIENT");
  addRow("Raison sociale", client.raisonSociale, "SIREN", client.siren);
  if (extras?.siret) addRow("SIRET (siege)", extras.siret);
  addRow("Forme juridique", client.forme, "Code APE", client.ape);
  addRow("Dirigeant", client.dirigeant, "Capital", `${(client.capital ?? 0).toLocaleString("fr-FR")} \u20AC`);
  addRow("Adresse", [client.adresse, client.cp, client.ville].filter(Boolean).join(", ") || "\u2014");
  addRow("Telephone", client.tel, "Email", client.mail);
  addRow("Effectif", client.effectif, "Date creation", client.dateCreation);
  addRow("Domaine d'activite", client.domaine);
  if (extras?.objetSocial) {
    addRow("Objet social", extras.objetSocial.slice(0, 120) + (extras.objetSocial.length > 120 ? "..." : ""));
  }
  y += 3;

  // ====== 1b. REGIME FISCAL ======
  if (extras?.regimeFiscal) {
    addTitle("1b. REGIME FISCAL PRESUME");
    const rf = extras.regimeFiscal;
    addRow("Impot", `${rf.impot} \u2014 ${rf.impotDetail}`, "Categorie", rf.categorieRevenu || "\u2014");
    addRow("TVA", rf.tva, "N\u00B0 TVA Intracom", rf.tvaIntracom || "\u2014");
    if (rf.tvaDetail) addRow("Detail TVA", rf.tvaDetail);
    if (rf.avertissements.length > 0) {
      for (const a of rf.avertissements) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 120, 0);
        pageBreakIfNeeded();
        doc.text(`/!\\ ${a}`, marginL + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
    }
    addSmallText("Regime deduit de la forme juridique et du code APE \u2014 a confirmer avec le client");
    y += 2;
  }

  // ====== 1c. DIRIGEANTS ======
  if (extras?.dirigeants && extras.dirigeants.length > 0) {
    addTitle("1c. DIRIGEANTS");
    for (const d of extras.dirigeants.slice(0, 10)) {
      const parts = [
        `${d.prenom} ${d.nom}`.trim(),
        d.qualite ? `(${d.qualite})` : "",
        d.nationalite ? `Nat. ${d.nationalite}` : "",
        d.date_naissance ? `Ne(e) ${d.date_naissance}` : "",
      ].filter(Boolean);
      addSmallText(`  \u2022 ${parts.join(" \u2014 ")}`, 2);
    }
    y += 2;
  }

  // ====== 1d. BENEFICIAIRES EFFECTIFS ======
  if ((extras?.beneficiaires && extras.beneficiaires.length > 0) || (client.be && client.be.trim())) {
    addTitle("1d. BENEFICIAIRES EFFECTIFS (RBE)");
    if (extras?.beneficiaires && extras.beneficiaires.length > 0) {
      for (const b of extras.beneficiaires) {
        const line = `${b.prenom} ${b.nom} \u2014 ${b.pourcentage}% parts${b.pourcentageVotes ? `, ${b.pourcentageVotes}% votes` : ""} \u2014 Nat. ${b.nationalite || "non renseignee"}`;
        addSmallText(`  \u2022 ${line}`, 2);
      }
    } else if (client.be) {
      const beEntries = client.be.split(/[/,]/).map(b => b.trim()).filter(Boolean);
      for (const be of beEntries) {
        addSmallText(`  \u2022 ${be}`, 2);
      }
    }

    // Chaine de detention
    if (extras?.chaineBE && Object.keys(extras.chaineBE).length > 0) {
      y += 2;
      addSubtitle("Chaine de detention \u2014 Beneficiaires indirects (art. L.561-2-2 CMF)");
      for (const pm of Object.values(extras.chaineBE)) {
        addSmallText(`  Holding : ${pm.denomination} (SIREN ${pm.siren})`, 2);
        if (pm.beneficiaires.length > 0) {
          for (const b of pm.beneficiaires) {
            addSmallText(`    \u21B3 ${b.prenom} ${b.nom} (${b.pourcentage_parts ?? 0}%) \u2014 BE indirect`, 6);
          }
        } else if (pm.dirigeants.length > 0) {
          addSmallText("    Aucun BE declare \u2014 dirigeants de la holding :", 6);
          for (const d of pm.dirigeants.slice(0, 5)) {
            addSmallText(`    \u21B3 ${d.prenom} ${d.nom} (${d.qualite})`, 6);
          }
        } else {
          addSmallText("    Aucune information disponible sur les BE de cette holding", 6);
        }
      }
    }
    y += 2;
  }

  // ====== 2. MISSION ======
  addTitle("2. NATURE DE LA MISSION");
  addRow("Type de mission", client.mission, "Frequence", client.frequence);
  addRow("Comptable referent", client.comptable, "Associe signataire", client.associe);
  addRow("Superviseur", client.superviseur);
  addRow("Honoraires", `${(client.honoraires ?? 0).toLocaleString("fr-FR")} \u20AC`, "IBAN", client.iban);
  addRow("Date de reprise", client.dateReprise);
  y += 3;

  // ====== 3. RESULTATS DU SCREENING ======
  if (extras?.screening) {
    addTitle("3. RESULTATS DU SCREENING AUTOMATIQUE");
    const s = extras.screening;

    // Sanctions/PPE
    const sanctionStatus = s.sanctions
      ? s.sanctions.hasCriticalMatch ? "/!\\ MATCH CRITIQUE" : s.sanctions.hasPPE ? "/!\\ PPE DETECTEE" : "RAS"
      : "Non effectue";
    addRow("Sanctions / PPE", sanctionStatus);
    if (s.sanctions?.matches) {
      for (const m of s.sanctions.matches.slice(0, 3)) {
        addSmallText(`  Match : ${m.person} (score ${m.score}%)`, 4);
      }
    }

    // Gel des avoirs
    const gelStatus = s.gelAvoirs && s.gelAvoirs.length > 0 ? `/!\\ ${s.gelAvoirs[0]}` : "RAS";
    addRow("Gel des avoirs (DG Tresor)", gelStatus);

    // BODACC
    const bodaccStatus = s.bodacc
      ? s.bodacc.hasProcedureCollective ? "/!\\ PROCEDURE COLLECTIVE" : "RAS"
      : "Non effectue";
    addRow("BODACC", bodaccStatus);
    if (s.bodacc?.alertes) {
      for (const a of s.bodacc.alertes.slice(0, 3)) addSmallText(`  ${a}`, 4);
    }

    // Revue de presse
    const newsStatus = s.news
      ? s.news.hasNegativeNews ? "/!\\ ARTICLES NEGATIFS" : "RAS"
      : "Non effectue";
    addRow("Revue de presse", newsStatus);

    // Reseau
    if (s.network) {
      addRow("Reseau dirigeants", `${s.network.totalCompanies} societe(s), ${s.network.totalPersons} personne(s)`);
      if (s.network.alertes.length > 0) {
        for (const a of s.network.alertes.slice(0, 3)) {
          const prefix = a.severity === "red" ? "/!\\ " : "";
          addSmallText(`  ${prefix}${a.message}`, 4);
        }
      }
    }
    y += 3;
  }

  // ====== 4. FACTEURS DE RISQUE ======
  addTitle("4. FACTEURS DE RISQUE IDENTIFIES");
  const flag = (v: string) => v === "OUI" ? "/!\\ OUI" : "NON";
  addRow("PPE (Pers. Politiquement Exposee)", flag(client.ppe), "Pays a risque", flag(client.paysRisque));
  addRow("Montage atypique", flag(client.atypique), "Relation a distance", flag(client.distanciel));
  addRow("Especes significatives", flag(client.cash), "Pression du client", flag(client.pression));
  y += 3;

  // ====== 5. QUESTIONNAIRE LCB-FT ======
  if (extras?.questions && extras.questions.length > 0) {
    addTitle("5. QUESTIONNAIRE LCB-FT");
    let qIdx = 0;
    for (const q of extras.questions) {
      qIdx++;
      pageBreakIfNeeded(12);
      const isOui = q.value === "OUI";
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");

      // Question number + response
      doc.setFont("helvetica", "bold");
      if (isOui) doc.setTextColor(200, 0, 0);
      const valLabel = isOui && q.autoFilled ? `${q.value} (auto)` : q.value;
      doc.text(`Q${qIdx}. [${valLabel}]`, marginL + 2, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");

      // Question text (truncated)
      const qText = q.question.length > 100 ? q.question.slice(0, 100) + "..." : q.question;
      doc.text(qText, marginL + 28, y);
      y += 4;

      // Comment if OUI
      if (isOui && q.commentaire) {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        const comment = q.commentaire.length > 120 ? q.commentaire.slice(0, 120) + "..." : q.commentaire;
        doc.text(`  Commentaire : ${comment}`, marginL + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
    }
    y += 2;
  }

  // ====== 6. SCORING WITH RADAR ======
  addTitle("6. EVALUATION DU RISQUE (SCORING)");

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

    const lx = radarCx + (radarR + 8) * Math.cos(angle);
    const ly = radarCy + (radarR + 8) * Math.sin(angle);
    doc.text(scores[i].label, lx, ly, { align: "center" });

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
    for (let i = 0; i < radarPoints.length; i++) {
      const next = radarPoints[(i + 1) % radarPoints.length];
      doc.line(radarPoints[i][0], radarPoints[i][1], next[0], next[1]);
    }
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
    const sv = s.value ?? 0;
    const barW = (sv / 100) * 30;
    const barColor: [number, number, number] = sv >= 61 ? [244, 67, 54] : sv >= 26 ? [255, 152, 0] : [76, 175, 80];
    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.rect(tableX + 40, tableY - 2.5, barW, 3, "F");
    doc.text(String(sv), tableX + 72, tableY);
    tableY += 5.5;
  }

  // Global score
  tableY += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`SCORE GLOBAL : ${client.scoreGlobal ?? 0}`, tableX + 2, tableY);
  if ((client.malus ?? 0) > 0) {
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

  // ====== 7. PILOTAGE ======
  addTitle("7. PILOTAGE & ECHEANCES");
  addRow("Derniere revue", client.dateDerniereRevue, "Date butoir", client.dateButoir);
  addRow("Etat du pilotage", client.etatPilotage, "Statut client", client.statut);
  addRow("Expiration CNI", client.dateExpCni);
  y += 3;

  // ====== 8. DOCUMENTS COLLECTES ======
  if (extras?.documents && extras.documents.length > 0) {
    addTitle("8. DOCUMENTS COLLECTES");
    const requiredTypes = ["KBIS", "Statuts", "CNI", "RIB"];
    for (const req of requiredTypes) {
      const found = extras.documents.some(d => (d.type || d.name || "").toUpperCase().includes(req.toUpperCase()));
      const status = found ? "[X]" : "[ ]";
      addSmallText(`  ${status} ${req}`, 2);
    }
    y += 2;
    if (extras.documents.length > 0) {
      addSubtitle("Documents recuperes :");
      for (const d of extras.documents.slice(0, 15)) {
        addSmallText(`  \u2022 ${d.type || d.name}`, 2);
      }
      if (extras.documents.length > 15) {
        addSmallText(`  ... et ${extras.documents.length - 15} autre(s)`, 2);
      }
    }
    y += 2;
  }

  // ====== 9. DECISION ======
  addTitle("9. DECISION D'ACCEPTATION");
  if (extras?.decision) {
    const decisionLabel = extras.decision === "ACCEPTER" ? "ACCEPTATION SANS RESERVE"
      : extras.decision === "ACCEPTER_RESERVE" ? "ACCEPTATION AVEC VIGILANCE RENFORCEE"
      : extras.decision === "REFUSER" ? "REFUS DE LA MISSION" : extras.decision;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    pageBreakIfNeeded();
    doc.text(`Decision : ${decisionLabel}`, marginL + 5, y);
    y += 5;
    if (extras.motifRefus) {
      addRow("Motif du refus", extras.motifRefus);
    }
    if (extras.motifReserve) {
      addRow("Motif de la reserve", extras.motifReserve);
    }
  } else {
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.rect(marginL + 5, y - 3, 3.5, 3.5);
    doc.text("  ACCEPTATION SANS RESERVE", marginL + 9, y); y += 6;
    doc.rect(marginL + 5, y - 3, 3.5, 3.5);
    doc.text("  ACCEPTATION AVEC VIGILANCE RENFORCEE", marginL + 9, y); y += 6;
    doc.rect(marginL + 5, y - 3, 3.5, 3.5);
    doc.text("  REFUS DE LA MISSION", marginL + 9, y); y += 10;
  }

  y += 5;
  addRow("Date de la decision", formatDateFr(new Date()), "Signature de l'associe", "____________________");
  y += 10;
  addRow("Nom du referent LCB-FT", extras?.responsable || "____________________", "Signature", "____________________");

  // ====== 10. MENTIONS LEGALES ======
  pageBreakIfNeeded(25);
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginR, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text("Fiche realisee dans le cadre des obligations de lutte contre le blanchiment de capitaux", marginL + 2, y);
  y += 4;
  doc.text("et le financement du terrorisme (LCB-FT).", marginL + 2, y);
  y += 4;
  doc.text("Art. L.561-4-1 et suivants du Code monetaire et financier.", marginL + 2, y);
  y += 4;
  doc.text(`Date de realisation : ${formatDateFr(new Date())}`, marginL + 2, y);
  if (extras?.cabinetName) {
    y += 4;
    doc.text(`Cabinet : ${extras.cabinetName}`, marginL + 2, y);
  }
  if (extras?.responsable) {
    y += 4;
    doc.text(`Expert-comptable responsable : ${extras.responsable}`, marginL + 2, y);
  }
  doc.setTextColor(0, 0, 0);

  // ====== FOOTER ======
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Fiche LCB-FT \u2014 ${client.raisonSociale} \u2014 Page ${i}/${pageCount}`,
      W / 2, 290, { align: "center" }
    );
  }

  const safeName = (client.raisonSociale || "client").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/_+/g, "_");
  doc.save(`Fiche_LCB-FT_${client.ref}_${safeName}.pdf`);
}
