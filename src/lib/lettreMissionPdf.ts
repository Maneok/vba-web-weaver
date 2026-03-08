import jsPDF from "jspdf";
import type { LettreMission, CabinetConfig, SepaMandat } from "@/types/lettreMission";
import type { Client } from "@/lib/types";

const MARGIN_L = 25; // 2.5cm
const MARGIN_R = 185;
const CONTENT_W = MARGIN_R - MARGIN_L;
const PAGE_W = 210;
const PAGE_H = 297;
const FOOTER_Y = 282;

function addHeader(doc: jsPDF, cabinet: CabinetConfig, numero: string) {
  const primaryColor = hexToRgb(cabinet.couleurPrimaire);

  // Header bar
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, PAGE_W, 32, "F");

  // Logo if available
  if (cabinet.logo) {
    try {
      doc.addImage(cabinet.logo, "PNG", MARGIN_L, 5, 22, 22);
    } catch {
      // logo invalide, on continue
    }
  }

  // Cabinet info right side
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const cabinetLines = [
    cabinet.nom,
    `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`,
    `SIRET : ${cabinet.siret} — OEC : ${cabinet.numeroOEC}`,
    `${cabinet.email} — ${cabinet.telephone}`,
  ];
  let hy = 8;
  for (const line of cabinetLines) {
    doc.text(line, MARGIN_R, hy, { align: "right" });
    hy += 4.5;
  }

  // Document title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LETTRE DE MISSION", PAGE_W / 2, 26, { align: "center" });

  // Reference
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Réf. ${numero}`, MARGIN_R, 38, { align: "right" });
}

function addFooter(doc: jsPDF, cabinet: CabinetConfig, pageNum: number, totalPages: number) {
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_L, FOOTER_Y, MARGIN_R, FOOTER_Y);
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `${cabinet.nom} — Membre de l'Ordre des Experts-Comptables — SIRET ${cabinet.siret}`,
    PAGE_W / 2,
    FOOTER_Y + 4,
    { align: "center" }
  );
  doc.text(`Page ${pageNum}/${totalPages}`, MARGIN_R, FOOTER_Y + 4, { align: "right" });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 5) {
    doc.addPage();
    return 20;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, cabinet: CabinetConfig): number {
  const color = hexToRgb(cabinet.couleurPrimaire);
  doc.setFillColor(color.r, color.g, color.b);
  doc.rect(MARGIN_L, y - 1, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN_L + 3, y + 4);
  doc.setTextColor(0, 0, 0);
  return y + 11;
}

function drawIdentificationBloc(doc: jsPDF, client: Client, y: number): number {
  y = checkPageBreak(doc, y, 50);

  // Grey background box
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 42, 2, 2, "FD");

  doc.setFontSize(9);
  let by = y + 6;

  const fields: [string, string][] = [
    ["Raison sociale", client.raisonSociale],
    ["Forme juridique", `${client.forme} — Capital : ${client.capital?.toLocaleString("fr-FR") ?? "N/C"} €`],
    ["SIREN", client.siren],
    ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
    ["Dirigeant", client.dirigeant],
    ["Activité", `${client.domaine} (APE ${client.ape})`],
  ];

  for (const [label, value] of fields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, MARGIN_L + 4, by);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN_L + 40, by);
    by += 6;
  }

  return y + 47;
}

function drawHonorairesBloc(doc: jsPDF, client: Client, y: number): number {
  y = checkPageBreak(doc, y, 45);

  const rows: [string, string][] = [
    ["Mission comptable", `${client.honoraires?.toLocaleString("fr-FR") ?? "0"} €`],
    ["Reprise comptable", `${client.reprise?.toLocaleString("fr-FR") ?? "0"} €`],
    ["Mission juridique", `${client.juridique?.toLocaleString("fr-FR") ?? "0"} €`],
  ];
  const total = (client.honoraires ?? 0) + (client.reprise ?? 0) + (client.juridique ?? 0);

  // Table header
  doc.setFillColor(30, 58, 95);
  doc.rect(MARGIN_L, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Désignation", MARGIN_L + 4, y + 5);
  doc.text("Montant HT", MARGIN_R - 4, y + 5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 7;

  // Table rows with alternating colors
  doc.setFontSize(9);
  for (let i = 0; i < rows.length; i++) {
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 252);
      doc.rect(MARGIN_L, y, CONTENT_W, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.text(rows[i][0], MARGIN_L + 4, y + 5);
    doc.text(rows[i][1], MARGIN_R - 4, y + 5, { align: "right" });
    y += 7;
  }

  // Total row
  doc.setFillColor(230, 235, 245);
  doc.rect(MARGIN_L, y, CONTENT_W, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL HT", MARGIN_L + 4, y + 6);
  doc.text(`${total.toLocaleString("fr-FR")} €`, MARGIN_R - 4, y + 6, { align: "right" });
  y += 8;

  // TTC
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Total TTC (TVA 20%) : ${(total * 1.2).toLocaleString("fr-FR")} €`, MARGIN_R - 4, y + 5, { align: "right" });
  y += 5;

  // Fréquence
  doc.text(`Fréquence de facturation : ${client.frequence}`, MARGIN_L + 4, y + 5);
  y += 10;

  return y;
}

function drawLcbftBloc(doc: jsPDF, client: Client, y: number, cabinet: CabinetConfig): number {
  y = checkPageBreak(doc, y, 40);

  // Dark blue box
  doc.setFillColor(20, 40, 70);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("🔒  Obligations LCB-FT", MARGIN_L + 4, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 11;

  const vigLabel: Record<string, string> = {
    SIMPLIFIEE: "Vigilance Simplifiée",
    STANDARD: "Vigilance Standard",
    RENFORCEE: "Vigilance Renforcée",
  };
  const vigColors: Record<string, [number, number, number]> = {
    SIMPLIFIEE: [76, 175, 80],
    STANDARD: [255, 152, 0],
    RENFORCEE: [244, 67, 54],
  };
  const vc = vigColors[client.nivVigilance] ?? [100, 100, 100];

  doc.setFillColor(vc[0], vc[1], vc[2]);
  doc.roundedRect(MARGIN_L, y, 50, 6, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(vigLabel[client.nivVigilance] ?? client.nivVigilance, MARGIN_L + 3, y + 4.5);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "normal");
  doc.text(`Score de risque : ${client.scoreGlobal}/100`, MARGIN_L + 55, y + 4.5);
  y += 10;

  doc.setFontSize(8);
  const lcbText =
    "Conformément aux articles L.561-2 et suivants du Code monétaire et financier, " +
    "notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux " +
    "et le financement du terrorisme (LCB-FT). Les mesures de vigilance applicables à votre " +
    "dossier sont adaptées au niveau de risque identifié.";
  const lines = doc.splitTextToSize(lcbText, CONTENT_W - 4);
  doc.text(lines, MARGIN_L + 2, y);
  y += lines.length * 4 + 5;

  return y;
}

function drawKycBloc(doc: jsPDF, client: Client, y: number): number {
  y = checkPageBreak(doc, y, 35);

  doc.setFontSize(9);
  const checks: [string, boolean][] = [
    ["Pièce d'identité du dirigeant en cours de validité", client.dateExpCni ? new Date(client.dateExpCni) > new Date() : false],
    ["Extrait Kbis / Inscription RCS de moins de 3 mois", !!client.lienKbis],
    ["Statuts à jour", !!client.lienStatuts],
    ["Bénéficiaires effectifs identifiés", !!client.be],
    ["Justificatif de domicile ou siège social", !!client.adresse],
    ["Attestation de vigilance à jour", client.etat === "VALIDE"],
  ];

  let cy = y;
  for (const [label, done] of checks) {
    doc.setFont("helvetica", "normal");
    // Checkbox
    doc.setDrawColor(150, 150, 150);
    doc.rect(MARGIN_L + 2, cy - 3, 3.5, 3.5);
    if (done) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 139, 34);
      doc.text("✓", MARGIN_L + 2.5, cy);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFont("helvetica", "normal");
    doc.text(label, MARGIN_L + 9, cy);
    cy += 6;
  }

  return cy + 3;
}

function drawSignatureBloc(doc: jsPDF, client: Client, cabinet: CabinetConfig, y: number): number {
  y = checkPageBreak(doc, y, 55);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Fait en deux exemplaires originaux,`, MARGIN_L, y);
  y += 5;
  doc.text(`À ${cabinet.ville}, le ____________________`, MARGIN_L, y);
  y += 12;

  const colL = MARGIN_L;
  const colR = MARGIN_L + CONTENT_W / 2 + 5;

  // Left column - Cabinet
  doc.setFont("helvetica", "bold");
  doc.text("Pour le cabinet", colL, y);
  doc.text("Pour le client", colR, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(cabinet.nom, colL, y);
  doc.text(client.raisonSociale, colR, y);
  y += 5;
  doc.text(`Représenté par ${client.associe}`, colL, y);
  doc.text(`Représenté par ${client.dirigeant}`, colR, y);
  y += 5;
  doc.text("Associé signataire", colL, y);
  doc.text("Gérant / Président", colR, y);
  y += 15;

  // Signature lines
  doc.setDrawColor(0, 0, 0);
  doc.line(colL, y, colL + 60, y);
  doc.line(colR, y, colR + 60, y);
  y += 4;
  doc.setFontSize(7);
  doc.text("Signature et cachet", colL, y);
  doc.text("Signature et cachet", colR, y);

  return y + 10;
}

function drawSepaAnnexe(doc: jsPDF, client: Client, cabinet: CabinetConfig): void {
  doc.addPage();
  let y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ANNEXE — MANDAT DE PRÉLÈVEMENT SEPA", PAGE_W / 2, y, { align: "center" });
  y += 15;

  // Cadre
  doc.setDrawColor(100, 100, 100);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 80, 2, 2, "FD");

  let sy = y + 8;
  doc.setFontSize(9);

  const sepaFields: [string, string][] = [
    ["Créancier", cabinet.nom],
    ["SIRET créancier", cabinet.siret],
    ["Adresse créancier", `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`],
    ["", ""],
    ["Débiteur", client.raisonSociale],
    ["Adresse débiteur", `${client.adresse}, ${client.cp} ${client.ville}`],
    ["IBAN", formatIban(client.iban)],
    ["BIC", client.bic],
    ["", ""],
    ["Référence unique de mandat (RUM)", `SEPA-${client.ref}`],
    ["Type de paiement", "Récurrent"],
  ];

  for (const [label, value] of sepaFields) {
    if (!label) {
      sy += 3;
      continue;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, MARGIN_L + 5, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value || "________________________", MARGIN_L + 60, sy);
    sy += 6;
  }

  y += 90;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const sepaText =
    "En signant ce formulaire de mandat, vous autorisez le cabinet à envoyer des instructions " +
    "à votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément " +
    "aux instructions du cabinet. Vous bénéficiez du droit d'être remboursé par votre banque selon " +
    "les conditions décrites dans la convention que vous avez passée avec elle.";
  const sepaLines = doc.splitTextToSize(sepaText, CONTENT_W - 10);
  doc.text(sepaLines, MARGIN_L + 5, y);
  y += sepaLines.length * 4 + 15;

  // Signature
  doc.setFontSize(9);
  doc.text(`Date : ____________________`, MARGIN_L, y);
  doc.text(`Lieu : ____________________`, MARGIN_L + 80, y);
  y += 15;
  doc.text("Signature du débiteur :", MARGIN_L, y);
  y += 15;
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN_L, y, MARGIN_L + 70, y);
}

function formatIban(iban: string): string {
  if (!iban) return "________________________";
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 30,
    g: parseInt(h.substring(2, 4), 16) || 58,
    b: parseInt(h.substring(4, 6), 16) || 95,
  };
}

/**
 * Génère un PDF professionnel haute qualité pour une Lettre de Mission.
 */
export function renderLettreMissionPdf(lm: LettreMission): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { client, cabinet } = lm;

  // === PAGE 1 ===
  addHeader(doc, cabinet, lm.numero);
  let y = 42;

  // Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${cabinet.ville}, le ${lm.date}`, MARGIN_R, y, { align: "right" });
  y += 10;

  // Render each bloc in order
  const sortedBlocs = [...lm.blocs].filter((b) => b.visible).sort((a, b) => a.ordre - b.ordre);
  let sectionNum = 1;

  for (const bloc of sortedBlocs) {
    switch (bloc.type) {
      case "identification":
        y = drawSectionTitle(doc, `${sectionNum++}. Identification du client`, y, cabinet);
        y = drawIdentificationBloc(doc, client, y);
        break;

      case "mission": {
        y = checkPageBreak(doc, y, 30);
        y = drawSectionTitle(doc, `${sectionNum++}. ${bloc.titre}`, y, cabinet);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const missionLines = doc.splitTextToSize(bloc.contenuRendu, CONTENT_W - 4);
        for (const line of missionLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN_L + 2, y);
          y += 4.5;
        }
        y += 5;
        break;
      }

      case "honoraires":
        y = checkPageBreak(doc, y, 50);
        y = drawSectionTitle(doc, `${sectionNum++}. Honoraires`, y, cabinet);
        y = drawHonorairesBloc(doc, client, y);
        break;

      case "paiement": {
        y = checkPageBreak(doc, y, 25);
        y = drawSectionTitle(doc, `${sectionNum++}. ${bloc.titre}`, y, cabinet);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const payLines = doc.splitTextToSize(bloc.contenuRendu, CONTENT_W - 4);
        for (const line of payLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN_L + 2, y);
          y += 4.5;
        }
        y += 5;
        break;
      }

      case "lcbft":
        y = checkPageBreak(doc, y, 50);
        y = drawSectionTitle(doc, `${sectionNum++}. Obligations LCB-FT`, y, cabinet);
        y = drawLcbftBloc(doc, client, y, cabinet);
        break;

      case "kyc":
        y = checkPageBreak(doc, y, 45);
        y = drawSectionTitle(doc, `${sectionNum++}. Pièces justificatives (KYC)`, y, cabinet);
        y = drawKycBloc(doc, client, y);
        break;

      case "resiliation":
      case "rgpd":
      case "juridiction":
      case "custom": {
        y = checkPageBreak(doc, y, 25);
        y = drawSectionTitle(doc, `${sectionNum++}. ${bloc.titre}`, y, cabinet);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const textLines = doc.splitTextToSize(bloc.contenuRendu, CONTENT_W - 4);
        for (const line of textLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN_L + 2, y);
          y += 4.5;
        }
        y += 5;
        break;
      }

      case "signature":
        y = drawSignatureBloc(doc, client, cabinet, y);
        break;

      case "sepa":
        // SEPA is always on a separate page
        break;
    }
  }

  // SEPA annexe if IBAN present
  if (client.iban) {
    drawSepaAnnexe(doc, client, cabinet);
  }

  // Add footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, cabinet, i, totalPages);
  }

  return doc;
}
