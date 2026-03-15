import jsPDF from "jspdf";
import type { Client } from "./types";

const LM_LAB_TEXTES: Record<string, { titre: string; corps: string }> = {
  SIMPLIFIEE: {
    titre: "Obligations LCB-FT — Vigilance Simplifiee",
    corps: `Conformement aux articles L.561-2 et L.561-9 du Code monetaire et financier, notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de la vigilance simplifiee applicable a votre dossier, nous procedons a :
- L'identification du client et la verification de son identite sur la base d'un document officiel en cours de validite ;
- L'identification du beneficiaire effectif ;
- Le recueil d'informations sur l'objet et la nature de la relation d'affaires ;
- Un examen periodique du dossier tous les 3 ans.

Les mesures de vigilance simplifiee sont appliquees en l'absence de soupcon de blanchiment et compte tenu du faible niveau de risque identifie.`,
  },
  STANDARD: {
    titre: "Obligations LCB-FT — Vigilance Standard",
    corps: `Conformement aux articles L.561-2 et L.561-5 a L.561-14-2 du Code monetaire et financier, notre cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de la vigilance standard applicable a votre dossier, nous procedons a :
- L'identification et la verification de l'identite du client et, le cas echeant, du beneficiaire effectif ;
- Le recueil d'informations sur l'objet et la nature de la relation d'affaires ;
- L'exercice d'une vigilance constante sur la relation d'affaires, incluant un examen attentif des operations ;
- Un examen periodique du dossier tous les 2 ans ;
- La mise a jour reguliere des elements d'identification.

En cas de soupcon, le cabinet est tenu de proceder a une declaration de soupcon aupres de Tracfin (art. L.561-15 CMF).`,
  },
  RENFORCEE: {
    titre: "Obligations LCB-FT — Vigilance Renforcee",
    corps: `Conformement aux articles L.561-2, L.561-10 et L.561-10-2 du Code monetaire et financier, notre cabinet est soumis aux obligations renforcees de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Votre dossier fait l'objet de mesures de vigilance renforcee en raison du niveau de risque identifie. A ce titre, nous procedons a :
- L'identification et la verification approfondie de l'identite du client, du beneficiaire effectif et de la structure de controle ;
- L'obtention d'informations complementaires sur l'origine des fonds et du patrimoine ;
- L'examen renforce de l'objet et de la nature de la relation d'affaires ;
- Un suivi renforce et continu de la relation, avec un examen periodique au minimum annuel ;
- La mise en place d'un examen approfondi de toute operation complexe, d'un montant inhabituellement eleve ou ne paraissant pas avoir de justification economique ;
- L'information de l'associe signataire et, le cas echeant, du referent LCB-FT du cabinet.

Toute impossibilite de mettre en oeuvre ces mesures pourra conduire le cabinet a mettre fin a la relation d'affaires (art. L.561-8 CMF). En cas de soupcon, une declaration sera effectuee aupres de Tracfin (art. L.561-15 CMF).`,
  },
};

export function generateLettreMission(client: Client) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 20;
  const marginR = 190;
  const contentW = marginR - marginL;
  let y = 20;

  // === HEADER ===
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("LETTRE DE MISSION", W / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cabinet d'Expertise Comptable", W / 2, 22, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Ref. ${client.ref} — ${new Date().toLocaleDateString("fr-FR")}`, W / 2, 29, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 45;

  // === CLIENT INFO ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Destinataire", marginL, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(client.raisonSociale || "—", marginL, y); y += 5;
  doc.text(`${client.forme || "—"} — SIREN ${client.siren || "—"}`, marginL, y); y += 5;
  doc.text(`${client.adresse || ""}, ${client.cp || ""} ${client.ville || ""}`, marginL, y); y += 5;
  doc.text(`A l'attention de ${client.dirigeant || "—"}`, marginL, y); y += 10;

  // === OBJET ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Objet : Lettre de mission", marginL, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const introText = `Madame, Monsieur,\n\nNous avons l'honneur de vous confirmer les termes et conditions de notre intervention pour la mission de ${client.mission || "expertise comptable"} que vous nous confiez.`;
  const introLines = doc.splitTextToSize(introText, contentW);
  doc.text(introLines, marginL, y);
  y += introLines.length * 5 + 5;

  // === MISSION DETAILS ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. Nature de la mission", marginL, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const missionDetails = [
    ["Type de mission", client.mission],
    ["Frequence", client.frequence],
    ["Associe signataire", client.associe],
    ["Superviseur", client.superviseur],
    ["Comptable referent", client.comptable],
    ["Honoraires HT", `${(client.honoraires ?? 0).toLocaleString("fr-FR")} EUR`],
  ];
  for (const [label, val] of missionDetails) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, marginL + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(val || "—", marginL + 60, y);
    y += 5;
  }
  y += 5;

  // === BLOC LCB-FT DYNAMIQUE ===
  const lmLab = LM_LAB_TEXTES[client.nivVigilance] ?? LM_LAB_TEXTES["STANDARD"];
  if (y > 200) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2. " + lmLab.titre, marginL, y);
  y += 3;

  // Colored bar indicating vigilance level
  const vigColors: Record<string, [number, number, number]> = {
    SIMPLIFIEE: [76, 175, 80],
    STANDARD: [255, 152, 0],
    RENFORCEE: [244, 67, 54],
  };
  const vc = vigColors[client.nivVigilance] || [100, 100, 100];
  doc.setFillColor(vc[0], vc[1], vc[2]);
  doc.rect(marginL, y, contentW, 1.5, "F");
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const labLines = doc.splitTextToSize(lmLab.corps, contentW - 5);
  for (const line of labLines) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(line, marginL + 2, y);
    y += 4.5;
  }
  y += 5;

  // === BENEFICIAIRES EFFECTIFS ===
  if (client.be) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. Beneficiaires effectifs identifies", marginL, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const beLines = client.be.split("/").map(b => b.trim()).filter(Boolean);
    for (const be of beLines) {
      doc.text(`- ${be}`, marginL + 5, y);
      y += 5;
    }
    y += 5;
  }

  // === SIGNATURES ===
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Fait en deux exemplaires,", marginL, y); y += 5;
  doc.text(`A __________________, le ${new Date().toLocaleDateString("fr-FR")}`, marginL, y); y += 15;

  doc.setFont("helvetica", "bold");
  doc.text("Pour le cabinet", marginL, y);
  doc.text("Pour le client", marginL + 100, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${client.associe || "—"} — Associe signataire`, marginL, y);
  doc.text(client.dirigeant || "—", marginL + 100, y);
  y += 15;
  doc.text("Signature :", marginL, y);
  doc.text("Signature :", marginL + 100, y);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Lettre de Mission LCB-FT — ${client.raisonSociale} — Page ${i}/${pageCount}`,
      W / 2, 290, { align: "center" }
    );
  }

  doc.save(`LDM_${client.ref}_${client.raisonSociale.replace(/\s/g, "_")}.pdf`);
}
