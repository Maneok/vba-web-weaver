import type { Client } from "@/lib/types";
import type {
  CabinetConfig,
  LettreMission,
  LettreMissionTemplate,
  LettreMissionBloc,
  BlocTemplate,
} from "@/types/lettreMission";
import { replaceVariables } from "@/lib/lettreMissionVariables";
import { renderLettreMissionPdf } from "@/lib/lettreMissionPdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, PageBreak } from "docx";
import { saveAs } from "file-saver";

// Compteur de numérotation (en mémoire — en prod, serait en BDD)
let lmCounter = 0;

function generateNumero(): string {
  lmCounter++;
  const year = new Date().getFullYear();
  const num = String(lmCounter).padStart(3, "0");
  return `LM-${year}-${num}`;
}

/**
 * Réinitialise le compteur (utile pour les tests ou initialisation depuis la BDD).
 */
export function resetCounter(value: number = 0): void {
  lmCounter = value;
}

/**
 * Template par défaut avec tous les blocs standards.
 */
export function getDefaultTemplate(): LettreMissionTemplate {
  const now = new Date().toISOString();
  return {
    id: "default",
    nom: "Lettre de mission standard",
    description: "Modèle standard conforme aux normes de l'Ordre des Experts-Comptables",
    createdAt: now,
    updatedAt: now,
    blocs: [
      {
        id: "bloc-identification",
        type: "identification",
        titre: "Identification du client",
        contenu: "Client : {{raison_sociale}}\nForme : {{forme_juridique}} — SIREN : {{siren}}\nAdresse : {{adresse_complete}}\nDirigeant : {{dirigeant}}\nActivité : {{domaine}} (APE {{ape}})\nCapital : {{capital}} €",
        ordre: 1,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-mission",
        type: "mission",
        titre: "Nature et étendue de la mission",
        contenu: `Nous avons l'honneur de vous confirmer les termes et conditions de notre intervention pour la mission de {{mission}} que vous nous confiez.

La mission est exercée conformément aux normes professionnelles applicables et aux dispositions du Code de déontologie de la profession d'expert-comptable.

Type de mission : {{mission}}
Fréquence : {{frequence}}
Associé signataire : {{associe}}
Superviseur : {{superviseur}}
Comptable référent : {{comptable}}
Période : du {{date_debut_mission}} au {{date_fin_mission}}`,
        ordre: 2,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-honoraires",
        type: "honoraires",
        titre: "Honoraires",
        contenu: "Honoraires annuels HT : {{honoraires}} €\nFréquence de facturation : {{frequence}}",
        ordre: 3,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-paiement",
        type: "paiement",
        titre: "Modalités de paiement",
        contenu: `Les honoraires sont payables selon la fréquence convenue ({{frequence}}), par prélèvement SEPA ou virement bancaire.

En cas de retard de paiement, des pénalités de retard seront appliquées conformément à l'article L.441-10 du Code de commerce, au taux d'intérêt appliqué par la Banque Centrale Européenne majoré de 10 points, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.`,
        ordre: 4,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-lcbft",
        type: "lcbft",
        titre: "Obligations LCB-FT",
        contenu: `Conformément aux articles L.561-2 et suivants du Code monétaire et financier, notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Niveau de vigilance applicable : {{niv_vigilance}}
Score de risque : {{score_global}}/100`,
        ordre: 5,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-kyc",
        type: "kyc",
        titre: "Pièces justificatives (KYC)",
        contenu: `Dans le cadre de nos obligations de vigilance, nous vous remercions de bien vouloir nous fournir les documents suivants :
- Pièce d'identité en cours de validité du dirigeant
- Extrait Kbis de moins de 3 mois
- Statuts à jour
- Justificatif de domiciliation du siège social
- Liste des bénéficiaires effectifs`,
        ordre: 6,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-resiliation",
        type: "resiliation",
        titre: "Résiliation",
        contenu: `La présente lettre de mission est conclue pour une durée d'un an, renouvelable par tacite reconduction.

Chacune des parties peut mettre fin à la mission par lettre recommandée avec accusé de réception, moyennant un préavis de trois mois avant la date anniversaire.

En cas de résiliation, les travaux réalisés jusqu'à la date d'effet de la résiliation seront facturés au prorata temporis.`,
        ordre: 7,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-rgpd",
        type: "rgpd",
        titre: "Protection des données personnelles (RGPD)",
        contenu: `Conformément au Règlement Général sur la Protection des Données (UE) 2016/679 et à la loi Informatique et Libertés, nous vous informons que les données personnelles collectées dans le cadre de notre mission font l'objet d'un traitement dont le responsable est {{cabinet_nom}}.

Ces données sont collectées pour les finalités suivantes : exécution de la mission comptable, respect des obligations légales (notamment LCB-FT), facturation et gestion de la relation client.

Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et de limitation du traitement. Pour exercer ces droits, contactez : {{cabinet_email}}.`,
        ordre: 8,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-juridiction",
        type: "juridiction",
        titre: "Juridiction et droit applicable",
        contenu: `La présente lettre de mission est régie par le droit français.

En cas de litige relatif à l'interprétation ou à l'exécution de la présente lettre, les parties conviennent de rechercher une solution amiable. À défaut, le litige sera soumis à la commission de conciliation de l'Ordre des Experts-Comptables de la région compétente, puis le cas échéant aux tribunaux compétents.`,
        ordre: 9,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-signature",
        type: "signature",
        titre: "Signatures",
        contenu: "",
        ordre: 10,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-sepa",
        type: "sepa",
        titre: "Annexe — Mandat de prélèvement SEPA",
        contenu: "",
        ordre: 11,
        obligatoire: false,
        visible: true,
      },
    ],
  };
}

/**
 * Génère un objet LettreMission structuré avec tous les blocs résolus.
 */
export function generateLettreMission(
  client: Client,
  template: LettreMissionTemplate,
  cabinetConfig: CabinetConfig
): LettreMission {
  const numero = generateNumero();
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const blocs: LettreMissionBloc[] = template.blocs
    .filter((b) => b.visible)
    .sort((a, b) => a.ordre - b.ordre)
    .map((bloc: BlocTemplate) => ({
      id: bloc.id,
      type: bloc.type,
      titre: bloc.titre,
      contenuBrut: bloc.contenu,
      contenuRendu: replaceVariables(bloc.contenu, client, cabinetConfig),
      ordre: bloc.ordre,
      visible: bloc.visible,
    }));

  return {
    numero,
    date,
    client,
    cabinet: cabinetConfig,
    template,
    blocs,
    metadata: {
      genereLe: new Date().toISOString(),
      genereParUser: client.associe,
      version: 1,
      statut: "brouillon",
    },
  };
}

/**
 * Génère et télécharge un PDF à partir d'un objet LettreMission.
 */
export function renderToPdf(lettreMission: LettreMission): void {
  const doc = renderLettreMissionPdf(lettreMission);
  const filename = `LDM_${lettreMission.numero}_${lettreMission.client.raisonSociale.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

/**
 * Génère et télécharge un DOCX à partir d'un objet LettreMission.
 */
export async function renderToDocx(lettreMission: LettreMission): Promise<void> {
  const { client, cabinet } = lettreMission;
  const primaryColor = cabinet.couleurPrimaire.replace("#", "");

  const sections: Paragraph[] = [];

  // Header
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: cabinet.nom, bold: true, size: 28, color: primaryColor }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`,
          size: 18,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `SIRET : ${cabinet.siret} — OEC : ${cabinet.numeroOEC}`,
          size: 18,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${cabinet.email} — ${cabinet.telephone}`,
          size: 18,
          color: "666666",
        }),
      ],
    })
  );

  // Title
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: "LETTRE DE MISSION",
          bold: true,
          size: 36,
          color: primaryColor,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `Réf. ${lettreMission.numero}`, size: 18, color: "888888" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `${cabinet.ville}, le ${lettreMission.date}`,
          size: 20,
        }),
      ],
    })
  );

  // Render each bloc
  const sortedBlocs = [...lettreMission.blocs].filter((b) => b.visible).sort((a, b) => a.ordre - b.ordre);
  let sectionNum = 1;

  for (const bloc of sortedBlocs) {
    if (bloc.type === "sepa") continue; // SEPA handled separately

    // Section title
    const titleText =
      bloc.type === "identification" ? `${sectionNum++}. Identification du client` :
      bloc.type === "honoraires" ? `${sectionNum++}. Honoraires` :
      bloc.type === "lcbft" ? `${sectionNum++}. Obligations LCB-FT` :
      bloc.type === "kyc" ? `${sectionNum++}. Pièces justificatives (KYC)` :
      bloc.type === "signature" ? `${sectionNum++}. Signatures` :
      `${sectionNum++}. ${bloc.titre}`;

    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: primaryColor } },
        children: [
          new TextRun({ text: titleText, bold: true, size: 24, color: primaryColor }),
        ],
      })
    );

    // Special rendering for some types
    if (bloc.type === "identification") {
      const idFields: [string, string][] = [
        ["Raison sociale", client.raisonSociale],
        ["Forme juridique", `${client.forme} — Capital : ${client.capital?.toLocaleString("fr-FR") ?? "N/C"} €`],
        ["SIREN", client.siren],
        ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
        ["Dirigeant", client.dirigeant],
        ["Activité", `${client.domaine} (APE ${client.ape})`],
      ];
      for (const [label, value] of idFields) {
        sections.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `${label} : `, bold: true, size: 20 }),
              new TextRun({ text: value, size: 20 }),
            ],
          })
        );
      }
    } else if (bloc.type === "honoraires") {
      // Honoraires table
      const honorairesTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                shading: { type: ShadingType.SOLID, color: primaryColor },
                children: [new Paragraph({ children: [new TextRun({ text: "Désignation", bold: true, color: "FFFFFF", size: 20 })] })],
                width: { size: 70, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                shading: { type: ShadingType.SOLID, color: primaryColor },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Montant HT", bold: true, color: "FFFFFF", size: 20 })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          ...([
            ["Mission comptable", client.honoraires],
            ["Reprise comptable", client.reprise],
            ["Mission juridique", client.juridique],
          ] as [string, number][]).map(
            ([label, amount], i) =>
              new TableRow({
                children: [
                  new TableCell({
                    shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F5F5FA" } : undefined,
                    children: [new Paragraph({ children: [new TextRun({ text: label, size: 20 })] })],
                  }),
                  new TableCell({
                    shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F5F5FA" } : undefined,
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${(amount ?? 0).toLocaleString("fr-FR")} €`, size: 20 })] })],
                  }),
                ],
              })
          ),
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.SOLID, color: "E0E5F0" },
                children: [new Paragraph({ children: [new TextRun({ text: "TOTAL HT", bold: true, size: 22 })] })],
              }),
              new TableCell({
                shading: { type: ShadingType.SOLID, color: "E0E5F0" },
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({
                    text: `${((client.honoraires ?? 0) + (client.reprise ?? 0) + (client.juridique ?? 0)).toLocaleString("fr-FR")} €`,
                    bold: true,
                    size: 22,
                  })],
                })],
              }),
            ],
          }),
        ],
      });
      sections.push(new Paragraph({ children: [] })); // spacer
      sections.push(honorairesTable as unknown as Paragraph); // docx accepts tables in doc children
    } else if (bloc.type === "signature") {
      sections.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [new TextRun({ text: `Fait en deux exemplaires originaux, à ${cabinet.ville}`, size: 20 })],
        }),
        new Paragraph({ spacing: { after: 300 }, children: [] }),
        new Paragraph({
          children: [
            new TextRun({ text: "Pour le cabinet\t\t\t\t\tPour le client", bold: true, size: 20 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${cabinet.nom}\t\t\t\t\t${client.raisonSociale}`, size: 18 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${client.associe}\t\t\t\t\t${client.dirigeant}`, size: 18 }),
          ],
        }),
        new Paragraph({ spacing: { after: 400 }, children: [] }),
        new Paragraph({
          children: [
            new TextRun({ text: "Signature : ________________\t\t\tSignature : ________________", size: 18 }),
          ],
        })
      );
    } else {
      // Generic text bloc
      const lines = bloc.contenuRendu.split("\n");
      for (const line of lines) {
        if (line.startsWith("- ")) {
          sections.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 40 },
              children: [new TextRun({ text: line.slice(2), size: 20 })],
            })
          );
        } else {
          sections.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: line, size: 20 })],
            })
          );
        }
      }
    }
  }

  // SEPA annexe
  if (client.iban) {
    sections.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: "ANNEXE — MANDAT DE PRÉLÈVEMENT SEPA", bold: true, size: 28, color: primaryColor }),
        ],
      })
    );

    const sepaFields: [string, string][] = [
      ["Créancier", cabinet.nom],
      ["SIRET créancier", cabinet.siret],
      ["Débiteur", client.raisonSociale],
      ["IBAN", client.iban.replace(/(.{4})/g, "$1 ").trim()],
      ["BIC", client.bic],
      ["Référence unique de mandat", `SEPA-${client.ref}`],
      ["Type de paiement", "Récurrent"],
    ];

    for (const [label, value] of sepaFields) {
      sections.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${label} : `, bold: true, size: 20 }),
            new TextRun({ text: value || "________________________", size: 20 }),
          ],
        })
      );
    }
  }

  // Build the document - separate tables and paragraphs correctly
  const docChildren: (Paragraph | Table)[] = [];
  for (const item of sections) {
    if (item instanceof Table) {
      docChildren.push(item);
    } else {
      docChildren.push(item);
    }
  }

  const docx = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch = 1440 twips
          },
        },
        children: docChildren,
      },
    ],
  });

  const filename = `LDM_${lettreMission.numero}_${client.raisonSociale.replace(/\s+/g, "_")}.docx`;
  Packer.toBlob(docx).then((blob) => {
    saveAs(blob, filename);
  });
}
