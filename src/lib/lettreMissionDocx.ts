import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  PageBreak,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import { saveAs } from "file-saver";
import type { LettreMission } from "@/types/lettreMission";

const NAVY = "1A1A2E";
const GREY = "F5F5F8";

function formatMontant(n: number | undefined): string {
  return `${(n ?? 0).toLocaleString("fr-FR")} €`;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    shading: { type: ShadingType.SOLID, color: NAVY },
    children: [new TextRun({ text, bold: true, size: 22, color: "FFFFFF" })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: NAVY } },
    children: [new TextRun({ text, bold: true, size: 20, color: NAVY })],
  });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function tableRow2Col(label: string, value: string, shade: boolean): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 40, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })],
      }),
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 60, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 18 })] })],
      }),
    ],
  });
}

function honoRow(label: string, montant: number, shade: boolean): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 20 })] })],
      }),
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(montant), size: 20 })] })],
      }),
    ],
  });
}

function honoRow4Col(label: string, ht: number, shade: boolean): TableRow {
  const tva = Math.round(ht * 0.2 * 100) / 100;
  const ttc = ht + tva;
  return new TableRow({
    children: [
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 40, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 20 })] })],
      }),
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(ht), size: 20 })] })],
      }),
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(tva), size: 20 })] })],
      }),
      new TableCell({
        shading: shade ? { type: ShadingType.SOLID, color: GREY } : undefined,
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(ttc), size: 20 })] })],
      }),
    ],
  });
}

function honoHeader4Col(): TableRow {
  return new TableRow({
    tableHeader: true,
    children: ["Désignation", "HT", "TVA 20 %", "TTC"].map((text, i) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: NAVY },
        width: { size: i === 0 ? 40 : 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
      })
    ),
  });
}

function honoTotal4Col(label: string, ht: number): TableRow {
  const tva = Math.round(ht * 0.2 * 100) / 100;
  const ttc = ht + tva;
  return new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
      }),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(ht), bold: true, size: 22 })] })],
      }),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(tva), bold: true, size: 22 })] })],
      }),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(ttc), bold: true, size: 22 })] })],
      }),
    ],
  });
}

function honoTotal(label: string, montant: number): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
      }),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E0E5F0" },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatMontant(montant), bold: true, size: 22 })] })],
      }),
    ],
  });
}

// Safe string access helper
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function renderLettreMissionDocx(lm: LettreMission): Promise<void> {
  const { client, cabinet, options: opts } = lm;
  const children: (Paragraph | Table)[] = [];

  // ── PAGE 1: Header + Destinataire + Intro ──
  children.push(
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: cabinet.nom, bold: true, size: 22, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`, size: 16, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: `SIRET : ${cabinet.siret} — OEC : ${cabinet.numeroOEC}`, size: 16, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 150 }, children: [new TextRun({ text: `${cabinet.email} — ${cabinet.telephone}`, size: 16, color: "666666" })] }),
  );

  const formule = opts?.genre === "F" ? "Mme" : "M.";
  children.push(
    bodyText(`À l'attention de ${formule} ${str(client?.dirigeant)}`),
    bodyText(`Mandataire social de la société ${str(client?.forme)} ${str(client?.raisonSociale)}`),
    bodyText(`${str(client?.adresse)}, ${str(client?.cp)} ${str(client?.ville)}`),
    new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
  );

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "LETTRE DE MISSION", bold: true, size: 28, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "PRÉSENTATION DES COMPTES ANNUELS", bold: true, size: 22, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 150 }, children: [new TextRun({ text: `${cabinet.ville}, le ${lm.date}  |  Réf. ${lm.numero}`, size: 18, color: "888888" })] }),
  );

  const politesse = opts?.genre === "F" ? "Chère Madame" : "Cher Monsieur";
  children.push(
    bodyText(`${politesse} ${str(client?.dirigeant)},`),
    bodyText(`Nous vous remercions de la confiance que vous nous accordez en nous confiant la mission d'expertise comptable relative à votre société ${str(client?.raisonSociale)}. Conformément à l'article 151 du Code de déontologie des professionnels de l'expertise comptable, la présente lettre de mission a pour objet de définir les termes, conditions et limites de notre intervention.`),
  );

  // ── PAGE 2: Votre entité ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("VOTRE ENTITÉ"));

  const entityRows: [string, string][] = [
    ["Raison sociale", str(client?.raisonSociale)],
    ["Forme juridique", str(client?.forme)],
    ["Activité", str(client?.domaine)],
    ["Code APE", str(client?.ape)],
    ["SIREN", str(client?.siren)],
    ["Capital social", formatMontant(client?.capital)],
    ["Date de création", str(client?.dateCreation)],
    ["Expert-comptable", str(client?.associe)],
    ["Régime fiscal", str(opts?.regimeFiscal)],
    ["Exercice social", `${str(opts?.exerciceDebut)} — ${str(opts?.exerciceFin)}`],
    ["TVA", str(opts?.tvaRegime)],
    ["CAC", opts?.cac ? "Oui" : "Non"],
    ["Effectif", str(client?.effectif)],
    ["Volume comptable", str(opts?.volumeComptable)],
    ["Type de mission", str(client?.mission)],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: entityRows.map(([l, v], i) => tableRow2Col(l, v, i % 2 === 0)),
  }));

  children.push(subHeading("Organisation et transmission"));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableRow2Col("Périodicité", opts.periodicite, true),
      tableRow2Col("Outil comptable", opts.outilComptable, false),
    ],
  }));

  // ── PAGE 3: LCB-FT ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("OBLIGATIONS DE VIGILANCE — LUTTE CONTRE LE BLANCHIMENT"));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Paquet AML 2024-2026", italics: true, size: 16, color: "888888" })] }));

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableRow2Col("Score de risque", `${client?.scoreGlobal ?? 0}/100`, true),
      tableRow2Col("Niveau de vigilance", str(client?.nivVigilance), false),
      tableRow2Col("Statut PPE", str(client?.ppe), true),
      tableRow2Col("Dernière diligence KYC", client?.dateDerniereRevue || "—", false),
      tableRow2Col("Prochaine mise à jour", client?.dateButoir || "—", true),
    ],
  }));

  children.push(subHeading(`Mesures de vigilance — ${str(client?.nivVigilance)}`));
  const vigTexts: Record<string, string> = {
    SIMPLIFIEE: "Mesures de vigilance simplifiée appliquées conformément à l'article L.561-9 du CMF.",
    STANDARD: "Mesures de vigilance standard appliquées conformément aux articles L.561-5 à L.561-14-2 du CMF.",
    RENFORCEE: "Mesures de vigilance renforcée appliquées conformément aux articles L.561-10 et L.561-10-2 du CMF.",
  };
  children.push(bodyText(vigTexts[client?.nivVigilance] ?? vigTexts.STANDARD));

  children.push(subHeading("Durée de conservation (art. L.561-12 CMF)"));
  children.push(bodyText("Les documents et informations sont conservés pendant cinq ans après la fin de la relation d'affaires."));

  // ── PAGES 4-5: Missions ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("NOTRE MISSION"));
  children.push(bodyText(`Notre cabinet s'engage à exécuter la mission de ${str(client?.mission)} conformément aux normes professionnelles et au Code de déontologie.`));

  children.push(subHeading("Durée de la mission"));
  children.push(bodyText(`La mission prend effet du ${opts.exerciceDebut} au ${opts.exerciceFin}, renouvelable par tacite reconduction avec préavis de 3 mois.`));

  children.push(subHeading("Nature et limites"));
  children.push(bodyText("Notre mission consiste en la tenue/surveillance de votre comptabilité et présentation des comptes annuels. Elle ne constitue ni un audit, ni un commissariat aux comptes."));

  if (opts.missionSociale) {
    children.push(subHeading("Mission sociale"));
    children.push(bulletItem("Établissement des bulletins de paie et DSN"));
    children.push(bulletItem("Gestion des entrées/sorties du personnel"));
    children.push(bulletItem("Calcul et déclaration des charges sociales"));
    children.push(bulletItem("Assistance en droit social courant"));
  }
  if (opts.missionJuridique) {
    children.push(subHeading("Mission juridique"));
    children.push(bulletItem("Rédaction des PV d'assemblées générales"));
    children.push(bulletItem("Formalités de modification statutaire"));
    children.push(bulletItem("Tenue des registres obligatoires"));
  }
  if (opts.missionControleFiscal) {
    children.push(subHeading("Assistance au contrôle fiscal"));
    children.push(bulletItem("Option 1 — Assistance à la préparation"));
    children.push(bulletItem("Option 2 — Assistance pendant le contrôle"));
    children.push(bulletItem("Option 3 — Assistance post-contrôle"));
  }

  // ── PAGE 6: Honoraires ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("HONORAIRES ET CONDITIONS FINANCIÈRES"));

  children.push(subHeading("Mission comptable"));
  const honoComptaRows = [honoRow("Mission comptable annuelle", client?.honoraires ?? 0, true)];
  if ((client?.reprise ?? 0) > 0) honoComptaRows.push(honoRow("Reprise comptable", client?.reprise ?? 0, false));
  if ((opts?.fraisConstitution ?? 0) > 0) honoComptaRows.push(honoRow("Frais de constitution", opts?.fraisConstitution ?? 0, true));
  const totalCompta = (client?.honoraires ?? 0) + (client?.reprise ?? 0) + (opts?.fraisConstitution ?? 0);
  honoComptaRows.push(honoTotal("TOTAL COMPTABLE HT", totalCompta));

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: honoComptaRows }));

  if (opts?.missionSociale && (opts?.honorairesSocial ?? 0) > 0) {
    children.push(subHeading("Mission sociale"));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [honoRow("Mission sociale", opts?.honorairesSocial ?? 0, true), honoTotal("TOTAL SOCIAL HT", opts?.honorairesSocial ?? 0)] }));
  }
  if (opts?.missionJuridique) {
    const montJur = (opts?.honorairesJuridique ?? 0) > 0 ? opts.honorairesJuridique : (client?.juridique ?? 0);
    if (montJur > 0) {
      children.push(subHeading("Mission juridique"));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [honoRow("Mission juridique", montJur, true), honoTotal("TOTAL JURIDIQUE HT", montJur)] }));
    }
  }

  children.push(subHeading("Conditions de règlement"));
  children.push(bodyText(`Honoraires payables ${(client?.frequence ?? "mensuel").toLowerCase()}, par prélèvement SEPA ou virement. Pénalités de retard conformément à l'article L.441-10 du Code de commerce.`));

  // Signatures
  children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `Fait en deux exemplaires, à ${str(cabinet?.ville)}`, size: 20 })] }));
  children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Pour le cabinet : ${str(cabinet?.nom)}`, bold: true, size: 20 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `${str(client?.associe)} — Associé signataire`, size: 18 })] }));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Signature : ________________", size: 18 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Pour le client : ${str(client?.raisonSociale)}`, bold: true, size: 20 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `${str(client?.dirigeant)} — Gérant / Président`, size: 18 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Signature : ________________", size: 18 })] }));

  // ── PAGE 7: Répartition ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("RÉPARTITION DES TRAVAUX"));

  const repartitionRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ children: [new TextRun({ text: "Tâche", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Cabinet", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Client", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ],
    }),
  ];
  const rTasks: [string, string, string][] = [
    ["Collecte pièces comptables", "", "X"],
    ["Saisie comptable", "X", ""],
    ["Rapprochement bancaire", "X", ""],
    ["Déclarations fiscales", "X", ""],
    ["Comptes annuels", "X", ""],
    ["Liasse fiscale", "X", ""],
    ["Conservation documents", "X", "X"],
    ["Relevés bancaires", "", "X"],
  ];
  rTasks.forEach(([t, c, cl], i) => {
    repartitionRows.push(new TableRow({
      children: [
        new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] }),
        new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c, bold: true, size: 18 })] })] }),
        new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cl, bold: true, size: 18 })] })] }),
      ],
    }));
  });
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: repartitionRows }));

  // ── PAGE 8: Attestation travail dissimulé ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("ATTESTATION DE VIGILANCE — TRAVAIL DISSIMULÉ"));
  children.push(bodyText("Conformément aux articles L.8221-1 et suivants du Code du travail, le client atteste sur l'honneur :"));
  children.push(bulletItem("Que le travail est réalisé par des salariés employés régulièrement"));
  children.push(bulletItem("Que les déclarations sociales sont effectuées conformément à la loi"));
  children.push(bulletItem("Que les salariés étrangers sont en possession d'un titre de travail valide"));
  children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Société : ${str(client?.raisonSociale)} — SIREN : ${str(client?.siren)}`, size: 20 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Représentée par : ${str(client?.dirigeant)}`, size: 20 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Signature : ________________", size: 20 })] }));

  // ── PAGE 9: SEPA ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("MANDAT DE PRÉLÈVEMENT SEPA"));
  const sepaRows: [string, string][] = [
    ["Créancier", str(cabinet?.nom)],
    ["SIRET créancier", str(cabinet?.siret)],
    ["Débiteur", str(client?.raisonSociale)],
    ["IBAN", client?.iban ? client.iban.replace(/(.{4})/g, "$1 ").trim() : "________________________"],
    ["BIC", client?.bic || "________________________"],
    ["Référence (RUM)", `SEPA-${str(client?.ref)}`],
    ["Type de paiement", "Récurrent"],
  ];
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sepaRows.map(([l, v], i) => tableRow2Col(l, v, i % 2 === 0)) }));
  children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Date : __________  Lieu : __________  Signature : ________________", size: 20 })] }));

  // ── PAGE 10: Autorisation liasse ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("AUTORISATION DE TRANSMISSION DE LA LIASSE FISCALE"));
  children.push(bodyText(`Je soussigné(e) ${str(client?.dirigeant)}, représentant légal de ${str(client?.raisonSociale)}, autorise le cabinet ${str(cabinet?.nom)} à :`));
  children.push(bulletItem("Transmettre la liasse fiscale par EDI-TDFC"));
  children.push(bulletItem("Transmettre les déclarations de TVA par EDI-TVA"));
  children.push(bulletItem("Effectuer les télépaiements d'impôts professionnels"));
  children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Signature : ________________", size: 20 })] }));

  // ── PAGES 11+: Conditions générales ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("CONDITIONS GÉNÉRALES"));

  const cgSections: [string, string][] = [
    ["Article 1 — Objet", "Les présentes conditions définissent les modalités d'exécution de la mission d'expertise comptable."],
    ["Article 2 — Obligations du cabinet", "Le cabinet s'engage à exécuter sa mission avec diligence et compétence. Il est soumis au secret professionnel."],
    ["Article 3 — Obligations du client", "Le client met à disposition les documents nécessaires en temps utile. Il est responsable de leur exactitude."],
    ["Article 4 — Honoraires", "Les honoraires sont fixés d'un commun accord. Toute prestation supplémentaire fait l'objet d'un devis préalable."],
    ["Article 5 — Responsabilité", "La responsabilité civile du cabinet est couverte par une assurance conforme à l'article 17 de l'ordonnance de 1945."],
    ["Article 6 — Résiliation", "Préavis de 3 mois par LRAR. Résiliation sans préavis en cas de manquement grave. Facturation au prorata."],
    ["Article 7 — RGPD", "Traitement des données conformément au RGPD. Droits d'accès, rectification, effacement, portabilité."],
    ["Article 8 — LCB-FT", "Le cabinet est soumis aux obligations de vigilance. Le client s'engage à coopérer."],
    ["Article 9 — Juridiction", "Droit français. Conciliation OEC puis tribunaux compétents."],
  ];
  for (const [titre, texte] of cgSections) {
    children.push(subHeading(titre));
    children.push(bodyText(texte));
  }

  // Build document
  const docx = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1418, right: 1134, bottom: 1134, left: 1418 }, // 2.5cm / 2cm
            pageNumbers: { start: 1 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${str(cabinet?.nom)} — SIRET ${str(cabinet?.siret)} — Membre de l'Ordre des Experts-Comptables — Page `, size: 14, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "888888" }),
                  new TextRun({ text: "/", size: 14, color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const filename = `LDM_${lm?.numero ?? "draft"}_${(client?.raisonSociale ?? "client").replace(/\s+/g, "_")}.docx`;
  const blob = await Packer.toBlob(docx);
  saveAs(blob, filename);
}

// ══════════════════════════════════════════════════════════════
// NEW TEMPLATE-BASED DOCX GENERATOR
// ══════════════════════════════════════════════════════════════

import type { TemplateSection } from "@/lib/lettreMissionTemplate";
import { replaceTemplateVariables } from "@/lib/lettreMissionTemplate";
import type { Client } from "@/lib/types";

interface NewDocxParams {
  sections: TemplateSection[];
  client: Client;
  genre: "M" | "Mme";
  missions: { sociale: boolean; juridique: boolean; fiscal: boolean };
  honoraires: {
    comptable: number;
    constitution: number;
    juridique: number;
    frequence: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL";
  };
  cabinet: {
    nom: string;
    adresse: string;
    cp: string;
    ville: string;
    siret: string;
    numeroOEC: string;
    email: string;
    telephone: string;
  };
  variables: Record<string, string>;
  status?: string;
  signatureExpert?: string;
  signatureClient?: string;
}

const REPARTITION_TASKS_DOCX: { tache: string; cabinet: boolean; client: boolean }[] = [
  { tache: "Collecte et classement des pièces comptables", cabinet: false, client: true },
  { tache: "Saisie / Intégration des écritures comptables", cabinet: true, client: false },
  { tache: "Rapprochement bancaire mensuel", cabinet: true, client: false },
  { tache: "Établissement des déclarations de TVA", cabinet: true, client: false },
  { tache: "Établissement de la liasse fiscale", cabinet: true, client: false },
  { tache: "Comptes annuels (bilan, compte de résultat, annexe)", cabinet: true, client: false },
  { tache: "Transmission des relevés bancaires", cabinet: false, client: true },
  { tache: "Transmission des factures fournisseurs/clients", cabinet: false, client: true },
  { tache: "Conservation des pièces justificatives", cabinet: true, client: true },
  { tache: "Déclarations fiscales annuelles (IS, CVAE, CFE)", cabinet: true, client: false },
];

export async function renderNewLettreMissionDocx(params: NewDocxParams): Promise<void> {
  const { sections, client, missions, honoraires, cabinet, variables } = params;
  const children: (Paragraph | Table)[] = [];

  function resolve(text: string): string {
    return replaceTemplateVariables(text, variables).replace(/\{\{\w+\}\}/g, "[À compléter]");
  }

  // Filter visible sections
  const visibleSections = sections.filter((sec) => {
    if (sec.type === "conditional") {
      if (sec.condition === "sociale" && !missions.sociale) return false;
      if (sec.condition === "juridique" && !missions.juridique) return false;
      if (sec.condition === "fiscal" && !missions.fiscal) return false;
    }
    return true;
  });

  // ── Header ──
  children.push(
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: cabinet.nom, bold: true, size: 22, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`, size: 16, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: `SIRET : ${cabinet.siret} — OEC n° ${cabinet.numeroOEC}`, size: 16, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 150 }, children: [new TextRun({ text: `${cabinet.email} — ${cabinet.telephone}`, size: 16, color: "666666" })] }),
  );

  // Watermark for draft status
  if (params.status === "brouillon" || params.status === "en_attente") {
    const watermarkLabel = params.status === "brouillon" ? "BROUILLON" : "PROJET";
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: `— ${watermarkLabel} —`, bold: true, size: 24, color: "CC0000" })] }),
    );
  }

  // Title
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "LETTRE DE MISSION", bold: true, size: 28, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Présentation des comptes annuels", size: 22, color: NAVY })] }),
  );

  // ── Iterate sections ──
  let isFirstAnnexe = true;

  for (const section of visibleSections) {
    if (section.type === "annexe" && isFirstAnnexe) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "ANNEXES", bold: true, size: 28, color: NAVY })] }));
      isFirstAnnexe = false;
    }

    // Special content
    if (section.content === "TABLEAU_ENTITE") {
      children.push(heading(section.title));
      const entityRows: [string, string][] = [
        ["Raison sociale", client.raisonSociale || ""],
        ["Forme juridique", client.forme || ""],
        ["Activité", client.domaine || ""],
        ["Code APE", client.ape || ""],
        ["SIREN", client.siren || ""],
        ["Capital social", client.capital ? formatMontant(client.capital) : "—"],
        ["Date de création", client.dateCreation || "—"],
        ["Dirigeant", client.dirigeant || ""],
        ["Effectif", client.effectif || "—"],
        ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
      ];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: entityRows.map(([l, v], i) => tableRow2Col(l, v, i % 2 === 0)),
      }));
      continue;
    }

    if (section.content === "BLOC_LCBFT") {
      children.push(heading(section.title));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          tableRow2Col("Score de risque", `${client.scoreGlobal ?? 0}/100`, true),
          tableRow2Col("Niveau de vigilance", client.nivVigilance || "STANDARD", false),
          tableRow2Col("Statut PPE", client.ppe || "NON", true),
          tableRow2Col("Dernière diligence", client.dateDerniereRevue || "—", false),
          tableRow2Col("Prochaine MAJ", client.dateButoir || "—", true),
        ],
      }));
      children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "CMF art. L.561-1 et s. | Conservation 5 ans après fin de relation", italics: true, size: 16, color: "888888" })] }));
      continue;
    }

    if (section.content === "TABLEAU_HONORAIRES") {
      children.push(heading(section.title));
      const honoRows: TableRow[] = [honoHeader4Col()];
      let rowIdx = 0;
      honoRows.push(honoRow4Col("Forfait comptable annuel", honoraires.comptable, rowIdx++ % 2 === 0));
      if (honoraires.constitution > 0) {
        honoRows.push(honoRow4Col("Constitution / Reprise dossier", honoraires.constitution, rowIdx++ % 2 === 0));
      }
      if (missions.juridique && honoraires.juridique > 0) {
        honoRows.push(honoRow4Col("Mission juridique annuelle", honoraires.juridique, rowIdx++ % 2 === 0));
      }
      const totalHT = honoraires.comptable + honoraires.constitution + (missions.juridique ? honoraires.juridique : 0);
      honoRows.push(honoTotal4Col("TOTAL", totalHT));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: honoRows }));

      const freqLabel = honoraires.frequence === "MENSUEL" ? "mensuel" : honoraires.frequence === "TRIMESTRIEL" ? "trimestriel" : "annuel";
      const divisor = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
      children.push(bodyText(`Facturation ${freqLabel} : ${formatMontant(Math.round((honoraires.comptable / divisor) * 100) / 100)} HT`));
      continue;
    }

    if (section.content === "TABLEAU_REPARTITION") {
      children.push(heading(section.title));
      const repartitionRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ children: [new TextRun({ text: "Tâche", bold: true, color: "FFFFFF", size: 18 })] })] }),
            new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Cabinet", bold: true, color: "FFFFFF", size: 18 })] })] }),
            new TableCell({ shading: { type: ShadingType.SOLID, color: NAVY }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Client", bold: true, color: "FFFFFF", size: 18 })] })] }),
          ],
        }),
      ];
      REPARTITION_TASKS_DOCX.forEach((row, i) => {
        repartitionRows.push(new TableRow({
          children: [
            new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ children: [new TextRun({ text: row.tache, size: 18 })] })] }),
            new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.cabinet ? "X" : "", bold: true, size: 18 })] })] }),
            new TableCell({ shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: GREY } : undefined, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.client ? "X" : "", bold: true, size: 18 })] })] }),
          ],
        }));
      });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: repartitionRows }));
      continue;
    }

    // Regular text section
    if (section.type === "annexe") {
      children.push(subHeading(section.title));
    } else {
      children.push(heading(section.title));
    }

    // Split content into paragraphs
    const resolvedContent = resolve(section.content);
    for (const line of resolvedContent.split("\n")) {
      if (line.trim()) {
        children.push(bodyText(line));
      }
    }
  }

  // Build document
  const docxDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1418, right: 1134, bottom: 1134, left: 1418 },
            pageNumbers: { start: 1 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${cabinet.nom} — SIRET ${cabinet.siret} — Page `, size: 14, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "888888" }),
                  new TextRun({ text: "/", size: 14, color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `LM_${(client.raisonSociale || "client").replace(/\s+/g, "_")}_${dateStr}.docx`;
  const blob = await Packer.toBlob(docxDoc);
  saveAs(blob, filename);
}
