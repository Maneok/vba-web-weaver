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

  // ====== BÉNÉFICIAIRES EFFECTIFS (enhanced) ======
  if (client.be) {
    addTitle("7. BÉNÉFICIAIRES EFFECTIFS");
    const beParts = client.be.split("/").map(b => b.trim());
    beParts.forEach(be => {
      addRow("", be);
    });
    y += 3;
  }

  // ====== DOCUMENTS COLLECTÉS ======
  if (client.documents && client.documents.length > 0) {
    addTitle("8. DOCUMENTS COLLECTÉS (GED)");
    client.documents.forEach(d => {
      addRow(d.type, `${d.name} — v${d.version} — ${d.uploadDate}${d.expiryDate ? ` (exp: ${d.expiryDate})` : ""}`);
    });
    y += 3;
  }

  // ====== SCORE HISTORY ======
  if (client.scoreHistory && client.scoreHistory.length > 1) {
    addTitle("9. HISTORIQUE DES SCORES");
    client.scoreHistory.slice(-5).forEach(h => {
      addRow(h.date, `Score: ${h.scoreGlobal} (${h.nivVigilance}) — ${h.motif}`);
    });
    y += 3;
  }

  doc.save(`Fiche_LCB-FT_${client.ref}_${client.raisonSociale.replace(/\s/g, "_")}.pdf`);
}

// ====== LETTRE DE MISSION PDF (BLOC 4) ======
export function generateLettreMission(client: Client) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 20;
  let y = 20;

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("LETTRE DE MISSION", W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Cabinet Comptable — ${new Date().toLocaleDateString("fr-FR")}`, W / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 15;

  // Client info
  doc.setFontSize(10);
  doc.text(`Destinataire : ${client.raisonSociale}`, marginL, y); y += 5;
  doc.text(`Représentée par : ${client.dirigeant}, ${client.forme}`, marginL, y); y += 5;
  doc.text(`SIREN : ${client.siren}`, marginL, y); y += 5;
  doc.text(`Adresse : ${client.adresse}, ${client.cp} ${client.ville}`, marginL, y); y += 10;

  // Mission description
  doc.setFont("helvetica", "bold");
  doc.text("Objet de la mission", marginL, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Type de mission : ${client.mission}`, marginL, y); y += 5;
  doc.text(`Fréquence : ${client.frequence}`, marginL, y); y += 5;
  doc.text(`Honoraires annuels HT : ${client.honoraires.toLocaleString("fr-FR")} €`, marginL, y); y += 5;
  doc.text(`Associé signataire : ${client.associe}`, marginL, y); y += 5;
  doc.text(`Collaborateur référent : ${client.comptable}`, marginL, y); y += 10;

  // LCB-FT block (dynamic based on vigilance level)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setFillColor(30, 58, 95);
  doc.rect(marginL, y, W - 2 * marginL, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("CLAUSE LCB-FT (Art. L.561-2 CMF)", marginL + 3, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const lcbTexts: Record<string, string[]> = {
    SIMPLIFIEE: [
      "Conformément aux obligations légales (Art. L.561-2 du CMF), le cabinet a procédé aux diligences",
      "de vigilance simplifiée à l'égard du client. Le niveau de risque identifié est FAIBLE.",
      "Les mesures de vigilance standard s'appliquent avec un cycle de revue de 36 mois.",
    ],
    STANDARD: [
      "Conformément aux obligations légales (Art. L.561-2 du CMF), le cabinet a procédé aux diligences",
      "de vigilance standard à l'égard du client. Le niveau de risque identifié est MODÉRÉ.",
      "Des mesures de vigilance renforcées pourront être mises en place si nécessaire.",
      "Le cycle de revue est fixé à 24 mois.",
    ],
    RENFORCEE: [
      "Conformément aux obligations légales (Art. L.561-6 du CMF), le cabinet a procédé aux diligences",
      "de vigilance RENFORCÉE à l'égard du client. Le niveau de risque identifié est ÉLEVÉ.",
      "Des mesures de vigilance complémentaires sont mises en œuvre :",
      "- Examen renforcé de l'origine des fonds et de la nature des opérations",
      "- Actualisation fréquente des données d'identification (cycle de 12 mois)",
      "- Surveillance continue des flux financiers et des transactions inhabituelles",
      "- Documentation systématique des diligences effectuées",
    ],
  };

  const texts = lcbTexts[client.nivVigilance] || lcbTexts.STANDARD;
  texts.forEach(line => {
    doc.text(line, marginL + 2, y);
    y += 4;
  });

  y += 5;
  doc.setFontSize(9);
  doc.text(`Score de risque global : ${client.scoreGlobal}/120 — Vigilance : ${client.nivVigilance}`, marginL, y);
  y += 15;

  // Signatures
  doc.setFontSize(9);
  doc.text("Fait en deux exemplaires,", marginL, y); y += 5;
  doc.text(`Le ${new Date().toLocaleDateString("fr-FR")}`, marginL, y); y += 15;

  doc.text("Pour le cabinet :", marginL, y);
  doc.text("Pour le client :", W / 2 + 10, y);
  y += 15;
  doc.text("____________________", marginL, y);
  doc.text("____________________", W / 2 + 10, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`${client.associe} — Associé signataire`, marginL, y);
  doc.text(`${client.dirigeant}`, W / 2 + 10, y);

  doc.save(`LDM_${client.ref}_${client.raisonSociale.replace(/\s/g, "_")}.pdf`);
}

// ====== RAPPORT DE CONTRÔLE PDF (BLOC 4) ======
export function generateRapportControle(client: Client) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("RAPPORT DE CONTRÔLE QUALITÉ LCB-FT", W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${new Date().toLocaleDateString("fr-FR")} — ${client.ref} — ${client.raisonSociale}`, W / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 12;

  const addSection = (title: string) => {
    doc.setFillColor(30, 58, 95);
    doc.rect(marginL, y, W - 2 * marginL, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, marginL + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  const addLine = (label: string, value: string, ok?: boolean) => {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label, marginL + 2, y);
    doc.setFont("helvetica", "normal");
    if (ok !== undefined) {
      doc.setTextColor(ok ? 34 : 200, ok ? 139 : 0, ok ? 34 : 0);
    }
    doc.text(value, marginL + 80, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  addSection("1. IDENTIFICATION DU DOSSIER");
  addLine("Référence", client.ref);
  addLine("Raison sociale", client.raisonSociale);
  addLine("SIREN", client.siren);
  addLine("Forme juridique", client.forme);
  addLine("Vigilance", client.nivVigilance);
  addLine("Score global", `${client.scoreGlobal}/120`);
  y += 3;

  addSection("2. VÉRIFICATION DOCUMENTAIRE");
  const hasKbis = !!(client.lienKbis || client.documents?.some(d => d.type === "KBIS"));
  const hasStatuts = !!(client.lienStatuts || client.documents?.some(d => d.type === "STATUTS"));
  const hasCni = !!(client.lienCni || client.documents?.some(d => d.type === "CNI"));
  addLine("Extrait Kbis", hasKbis ? "PRÉSENT" : "MANQUANT", hasKbis);
  addLine("Statuts", hasStatuts ? "PRÉSENT" : "MANQUANT", hasStatuts);
  addLine("Pièce d'identité (CNI)", hasCni ? "PRÉSENT" : "MANQUANT", hasCni);
  addLine("KYC Complétude", `${client.kycCompleteness ?? 0}%`, (client.kycCompleteness ?? 0) >= 80);
  y += 3;

  addSection("3. COHÉRENCE DU SCORING");
  const facteurs = [
    client.ppe === "OUI" && "PPE=OUI",
    client.paysRisque === "OUI" && "PAYS_RISQUE=OUI",
    client.atypique === "OUI" && "ATYPIQUE=OUI",
    client.cash === "OUI" && "CASH=OUI",
  ].filter(Boolean);
  const isCoherent = !(client.nivVigilance === "SIMPLIFIEE" && facteurs.length > 0);
  addLine("Facteurs de risque actifs", facteurs.length ? facteurs.join(", ") : "Aucun");
  addLine("Cohérence scoring/vigilance", isCoherent ? "CONFORME" : "INCOHÉRENCE DÉTECTÉE", isCoherent);
  y += 3;

  addSection("4. PILOTAGE");
  addLine("Dernière revue", client.dateDerniereRevue);
  addLine("Date butoir", client.dateButoir);
  addLine("État pilotage", client.etatPilotage, client.etatPilotage === "A JOUR");
  addLine("Expiration CNI", client.dateExpCni || "Non renseignée");
  y += 3;

  addSection("5. CONCLUSION");
  y += 2;
  doc.setFontSize(9);
  doc.text("☐  Dossier CONFORME — Aucune action requise", marginL + 5, y); y += 6;
  doc.text("☐  Dossier NON CONFORME — Actions correctives nécessaires", marginL + 5, y); y += 6;
  doc.text("☐  Dossier à SURVEILLER — Revue anticipée recommandée", marginL + 5, y); y += 12;

  doc.text("Contrôleur : ____________________", marginL + 5, y);
  doc.text("Date : ____________________", W / 2 + 10, y);

  doc.save(`Controle_${client.ref}_${client.raisonSociale.replace(/\s/g, "_")}.pdf`);
}
