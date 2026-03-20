import jsPDF from "jspdf";
import { logger } from "@/lib/logger";
import { formatDateFr } from "./dateUtils";
import type { LettreMission, CabinetConfig, LettreMissionOptions, EditorSectionSnapshot } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";

// ──────────────────────────────────────────────
// Layout constants (A4 = 210 x 297mm)
// ──────────────────────────────────────────────
const PAGE_W = 210;
const MARGIN_L = 25;   // 2.5cm left
const MARGIN_R = 190;  // 2cm right (210 - 20)
const MARGIN_TOP = 25; // 2.5cm top
const FOOTER_Y = 277;  // 2cm bottom (297 - 20)
const CONTENT_W = MARGIN_R - MARGIN_L;

// Colors
const NAVY = { r: 27, g: 58, b: 92 };       // #1B3A5C — titres, bandeaux
const BLUE_SECTION = { r: 46, g: 117, b: 182 }; // #2E75B6 — titres sections
const GREY_BG = { r: 242, g: 245, b: 248 };  // #F2F5F8 — alternance tableaux
const GREY_LINE = { r: 214, g: 228, b: 240 }; // #D6E4F0 — bordures tableaux
const WHITE = { r: 255, g: 255, b: 255 };
const BODY_TEXT = { r: 51, g: 51, b: 51 };    // #333333
const FOOTER_COLOR = { r: 102, g: 102, b: 102 }; // #666666

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== "string") return { ...NAVY };
  const h = hex.replace("#", "");
  if (h.length < 6) return { ...NAVY };
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return {
    r: isNaN(r) ? NAVY.r : r,
    g: isNaN(g) ? NAVY.g : g,
    b: isNaN(b) ? NAVY.b : b,
  };
}

function formatMontant(n: number | undefined): string {
  return `${(n ?? 0).toLocaleString("fr-FR")} €`;
}

function formatIban(iban: string): string {
  if (!iban) return "__ __ __ __ __ __ __";
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Safe string coercion — prevents "undefined" from reaching jsPDF.text() */
function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ──────────────────────────────────────────────
// PDF Builder class
// ──────────────────────────────────────────────
class LMPdfBuilder {
  private doc: jsPDF;
  private y: number;
  private cabinet: CabinetConfig;
  private client: Client;
  private options: LettreMissionOptions;
  private numero: string;
  private dateLM: string;
  private editorSections: EditorSectionSnapshot[];

  constructor(lm: LettreMission) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.y = MARGIN_TOP;
    this.cabinet = lm.cabinet;
    this.client = lm.client;
    this.options = lm.options;
    this.numero = lm.numero;
    this.dateLM = lm.date;
    this.editorSections = lm.editorSections ?? [];
  }

  /** Get content from an editor section by id, returns null if not found or not visible */
  private getEditorContent(id: string): string | null {
    const sec = this.editorSections.find((s) => s.id === id);
    if (!sec || !sec.visible) return null;
    return sec.content || null;
  }

  // ── Core methods ──

  private ensureSpace(needed: number): void {
    if (this.y + needed > FOOTER_Y - 5) {
      this.doc.addPage();
      this.y = MARGIN_TOP;
    }
  }

  private newPage(): void {
    this.doc.addPage();
    this.y = MARGIN_TOP;
  }

  private setBody(): void {
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
  }

  private setSmall(): void {
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(80, 80, 80);
  }

  private setTitle(size: number = 14): void {
    this.doc.setFontSize(size);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  }

  private writeText(text: string, maxWidth: number = CONTENT_W): void {
    this.setBody();
    const hasVars = /\{\{\w+\}\}/.test(text);
    const lines = this.doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      this.ensureSpace(5);
      if (hasVars && /\{\{\w+\}\}/.test(line)) {
        // OPT-38: Red highlighting for unresolved variables
        let x = MARGIN_L;
        const segments = line.split(/(\{\{\w+\}\})/g);
        for (const seg of segments) {
          if (!seg) continue;
          if (/^\{\{\w+\}\}$/.test(seg)) {
            this.doc.setTextColor(220, 38, 38);
            this.doc.setFont("helvetica", "bold");
          } else {
            this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
            this.doc.setFont("helvetica", "normal");
          }
          this.doc.text(seg, x, this.y);
          x += this.doc.getTextWidth(seg);
        }
        this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
        this.doc.setFont("helvetica", "normal");
      } else {
        this.doc.text(line, MARGIN_L, this.y);
      }
      this.y += 4.5;
    }
    this.y += 2;
  }

  private writeBullet(text: string): void {
    this.ensureSpace(6);
    this.setBody();
    this.doc.text("•", MARGIN_L + 2, this.y);
    const lines = this.doc.splitTextToSize(text, CONTENT_W - 10);
    this.doc.text(lines, MARGIN_L + 7, this.y);
    this.y += lines.length * 4.5 + 1;
  }

  private drawSectionTitle(title: string): void {
    this.ensureSpace(14);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(BLUE_SECTION.r, BLUE_SECTION.g, BLUE_SECTION.b);
    this.doc.text(title, MARGIN_L, this.y + 4.5);
    this.doc.setDrawColor(BLUE_SECTION.r, BLUE_SECTION.g, BLUE_SECTION.b);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN_L, this.y + 6.5, MARGIN_R, this.y + 6.5);
    this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
    this.y += 12;
  }

  private drawSubTitle(title: string): void {
    this.ensureSpace(8);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(title, MARGIN_L, this.y);
    this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
    this.y += 6;
  }

  private drawTableRow(
    label: string,
    value: string,
    bgColor?: { r: number; g: number; b: number },
    labelWidth: number = 65
  ): void {
    this.ensureSpace(7);
    if (bgColor) {
      this.doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
      this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 7, "F");
    }
    this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
    this.doc.line(MARGIN_L, this.y + 3, MARGIN_R, this.y + 3);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(label, MARGIN_L + 3, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(30, 30, 30);
    // Truncate value if too long
    const maxValWidth = CONTENT_W - labelWidth - 6;
    const truncated = this.doc.splitTextToSize(value, maxValWidth);
    this.doc.text(truncated[0] ?? "", MARGIN_L + labelWidth, this.y);
    this.y += 7;
  }

  private drawHonoraireTableHeader(): void {
    this.ensureSpace(8);
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 8, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Désignation", MARGIN_L + 3, this.y);
    this.doc.text("Montant HT annuel", MARGIN_R - 3, this.y, { align: "right" });
    this.doc.setTextColor(30, 30, 30);
    this.y += 7;
  }

  private drawHonoraireRow(label: string, montant: number, alt: boolean): void {
    this.ensureSpace(7);
    if (alt) {
      this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
      this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 7, "F");
    }
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(label, MARGIN_L + 3, this.y);
    this.doc.text(formatMontant(montant), MARGIN_R - 3, this.y, { align: "right" });
    this.y += 7;
  }

  private drawHonoraireTotal(label: string, montant: number): void {
    this.ensureSpace(9);
    this.doc.setFillColor(230, 235, 245);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 9, "F");
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(label, MARGIN_L + 3, this.y + 1);
    this.doc.text(formatMontant(montant), MARGIN_R - 3, this.y + 1, { align: "right" });
    this.y += 11;
  }

  // ──────────────────────────────────────────────
  // PAGE 1 — Header + Destinataire + Introduction
  // ──────────────────────────────────────────────
  private drawPage1(): void {
    const cab = this.cabinet;
    const cli = this.client;
    const opts = this.options;

    // En-tête: logo à gauche, coordonnées à droite
    if (cab?.logo) {
      try {
        const fmt = cab.logo.startsWith("data:image/jpeg") || cab.logo.startsWith("data:image/jpg") ? "JPEG" : "PNG";
        this.doc.addImage(cab.logo, fmt, MARGIN_L, MARGIN_TOP, 25, 25);
      } catch (err) { logger.warn("PDF", "Invalid logo image:", err); }
    }

    // Coordonnées cabinet à droite
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(s(cab?.nom), MARGIN_R, MARGIN_TOP + 3, { align: "right" });
    this.setSmall();
    this.doc.text(`${s(cab?.adresse)}, ${s(cab?.cp)} ${s(cab?.ville)}`, MARGIN_R, MARGIN_TOP + 8, { align: "right" });
    this.doc.text(`SIRET : ${s(cab?.siret)}`, MARGIN_R, MARGIN_TOP + 12, { align: "right" });
    this.doc.text(`OEC n° ${s(cab?.numeroOEC)}`, MARGIN_R, MARGIN_TOP + 16, { align: "right" });
    this.doc.text(`${s(cab?.email)} — ${s(cab?.telephone)}`, MARGIN_R, MARGIN_TOP + 20, { align: "right" });

    this.y = MARGIN_TOP + 30;

    // Trait séparateur
    this.doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_L, this.y, MARGIN_R, this.y);
    this.y += 8;

    // Bloc destinataire
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(30, 30, 30);
    const formule = opts?.genre === "F" ? "Mme" : "M.";
    this.doc.text(`À l'attention de ${formule} ${s(cli?.dirigeant)}`, MARGIN_L, this.y);
    this.y += 5;
    this.doc.text(`Mandataire social de la société ${s(cli?.forme)} ${s(cli?.raisonSociale)}`, MARGIN_L, this.y);
    this.y += 5;
    this.doc.text(`${s(cli?.adresse)}, ${s(cli?.cp)} ${s(cli?.ville)}`, MARGIN_L, this.y);
    this.y += 12;

    // OPT-26: Titre dynamique, OPT-27: badge norme
    const mtConf = getMissionTypeConfig(this.options?.missionTypeId || "presentation");
    this.ensureSpace(20);
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 1, CONTENT_W, 10, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`LETTRE DE MISSION — ${mtConf.label.toUpperCase()}`, PAGE_W / 2, this.y + 5.5, { align: "center" });
    this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
    this.y += 13;
    this.doc.setFontSize(8);
    this.doc.setTextColor(FOOTER_COLOR.r, FOOTER_COLOR.g, FOOTER_COLOR.b);
    this.doc.text(`Norme applicable : ${mtConf.normeRef}`, PAGE_W / 2, this.y, { align: "center" });
    this.y += 8;

    // Bloc info
    this.setSmall();
    const infoLine = `${s(cab?.ville)}, le ${this.dateLM}  |  Réf. mission n° ${this.numero}  |  ${s(cli?.mail)}  |  ${s(cli?.tel)}`;
    this.doc.text(infoLine, PAGE_W / 2, this.y, { align: "center" });
    this.y += 10;

    // Ligne décorative
    this.doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN_L + 30, this.y, MARGIN_R - 30, this.y);
    this.y += 8;

    // Formule d'introduction — use editor content if available
    const editorIntro = this.getEditorContent("introduction");
    if (editorIntro) {
      // User-edited content: render as-is
      this.writeText(editorIntro);
    } else {
      const politesse = opts.genre === "F" ? "Chère Madame" : "Cher Monsieur";
      this.writeText(`${politesse} ${s(cli?.dirigeant)},`);
      this.y += 2;
      this.writeText(
        `Nous vous remercions de la confiance que vous nous accordez en nous confiant la mission d'expertise comptable ` +
        `relative à votre société ${s(cli?.raisonSociale)}. Conformément à l'article 151 du Code de déontologie des professionnels ` +
        `de l'expertise comptable, la présente lettre de mission a pour objet de définir les termes, conditions et limites de ` +
        `notre intervention ainsi que les droits et obligations réciproques des parties.`
      );
      this.y += 2;
      this.writeText(
        `La présente lettre de mission est établie conformément aux normes professionnelles de l'Ordre des Experts-Comptables ` +
        `et aux dispositions du Code de déontologie de la profession.`
      );
    }
  }

  // ──────────────────────────────────────────────
  // PAGE 2 — Tableau "VOTRE ENTITÉ"
  // ──────────────────────────────────────────────
  private drawPage2(): void {
    this.newPage();
    const cli = this.client;
    const opts = this.options;

    this.drawSectionTitle("VOTRE ENTITÉ");
    this.y += 2;

    // Table header
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 8, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Information", MARGIN_L + 3, this.y);
    this.doc.text("Détail", MARGIN_L + 65, this.y);
    this.doc.setTextColor(30, 30, 30);
    this.y += 7;

    // Capital display logic: EI with 0 = "N/A", other with 0 = "0 €", positive = formatted
    const capitalDisplay = cli?.capital != null && cli.capital > 0
      ? formatMontant(cli.capital)
      : cli?.capital === 0 && (cli?.forme === "ENTREPRISE INDIVIDUELLE" || cli?.typePersonne === "physique")
        ? "N/A (entreprise individuelle)"
        : cli?.capital === 0 ? "0 €" : "Non renseigné";

    const rows: [string, string][] = [
      ["Raison sociale", s(cli?.raisonSociale)],
      ["Forme juridique", s(cli?.forme)],
      ["Dirigeant / Représentant légal", s(cli?.dirigeant)],
      ["Objet social / Activité", s(cli?.domaine)],
      ["Code APE", s(cli?.ape)],
      ["SIREN", s(cli?.siren)],
      ["Capital social", capitalDisplay],
      ["Date de création", s(cli?.dateCreation)],
      ["Date de clôture", s(opts?.exerciceFin) || "31/12"], // TODO: use client.dateCloture when available on Client type
      ["Téléphone", s(cli?.tel)],
      ["Email", s(cli?.mail)],
      ["Expert-comptable responsable", s(cli?.associe)],
      ["Régime fiscal", s(opts?.regimeFiscal)],
      ["Exercice social", `Du ${s(opts?.exerciceDebut)} au ${s(opts?.exerciceFin)}`],
      ["Régime de TVA", s(opts?.tvaRegime)],
      ["Effectif", s(cli?.effectif)],
      ["Type de mission", s(cli?.mission)],
    ];

    for (let i = 0; i < rows.length; i++) {
      const bg = i % 2 === 0 ? GREY_BG : undefined;
      this.drawTableRow(rows[i][0], rows[i][1], bg);
    }

    this.y += 8;

    // Organisation et transmission
    this.drawSubTitle("Organisation et transmission des documents");
    this.y += 2;
    this.drawTableRow("Périodicité", opts.periodicite);
    this.drawTableRow("Outil comptable", opts.outilComptable);
  }

  // ──────────────────────────────────────────────
  // PAGE 3 — Bloc LCB-FT
  // ──────────────────────────────────────────────
  private drawPage3(): void {
    this.newPage();
    const cli = this.client;

    // OPT-31: Encadrement visuel LCB-FT — bandeau NAVY
    this.ensureSpace(14);
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 1, CONTENT_W, 8, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("OBLIGATIONS DE VIGILANCE — LCB-FT", MARGIN_L + 3, this.y + 4.5);
    this.doc.setTextColor(BODY_TEXT.r, BODY_TEXT.g, BODY_TEXT.b);
    this.y += 12;

    // Sous-titre référence légale
    this.setSmall();
    this.doc.setFont("helvetica", "italic");
    this.doc.text(
      "CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Paquet AML 2024-2026",
      MARGIN_L,
      this.y
    );
    this.y += 8;

    // Tableau 2x2 KYC info
    const vigColors: Record<string, { r: number; g: number; b: number }> = {
      SIMPLIFIEE: { r: 76, g: 175, b: 80 },
      STANDARD: { r: 255, g: 152, b: 0 },
      RENFORCEE: { r: 244, g: 67, b: 54 },
    };
    const vc = vigColors[cli?.nivVigilance] ?? { r: 100, g: 100, b: 100 };

    // Row 1
    this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W / 2, 8, "F");
    this.doc.rect(MARGIN_L + CONTENT_W / 2, this.y - 4, CONTENT_W / 2, 8, "F");
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Score de risque", MARGIN_L + 3, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`${cli?.scoreGlobal ?? 0}/100`, MARGIN_L + 45, this.y);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Niveau de vigilance", MARGIN_L + CONTENT_W / 2 + 3, this.y);
    // Colored badge
    const badgeX = MARGIN_L + CONTENT_W / 2 + 50;
    this.doc.setFillColor(vc.r, vc.g, vc.b);
    this.doc.roundedRect(badgeX, this.y - 3.5, 30, 5, 1, 1, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(s(cli?.nivVigilance), badgeX + 15, this.y, { align: "center" });
    this.doc.setTextColor(30, 30, 30);
    this.y += 8;

    // Row 2
    this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W / 2, 8);
    this.doc.rect(MARGIN_L + CONTENT_W / 2, this.y - 4, CONTENT_W / 2, 8);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Statut PPE", MARGIN_L + 3, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(s(cli?.ppe), MARGIN_L + 45, this.y);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Dernière diligence KYC", MARGIN_L + CONTENT_W / 2 + 3, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(cli?.dateDerniereRevue || "—", MARGIN_L + CONTENT_W / 2 + 50, this.y);
    this.y += 8;

    // Row 3
    this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 8, "F");
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Prochaine mise à jour KYC", MARGIN_L + 3, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(cli?.dateButoir || "—", MARGIN_L + 65, this.y);
    this.y += 12;

    // Bloc vigilance dynamique
    this.drawSubTitle(`Mesures de vigilance — ${s(cli?.nivVigilance)}`);
    this.y += 2;

    const vigTexts: Record<string, string> = {
      SIMPLIFIEE:
        "Compte tenu du faible niveau de risque identifié, les mesures de vigilance simplifiée sont appliquées " +
        "conformément à l'article L.561-9 du CMF. Le cabinet procède à l'identification du client, à la vérification " +
        "de son identité et à un examen périodique triennal du dossier.",
      STANDARD:
        "Les mesures de vigilance standard sont appliquées conformément aux articles L.561-5 à L.561-14-2 du CMF. " +
        "Le cabinet procède à l'identification et la vérification de l'identité, au recueil d'informations sur l'objet " +
        "de la relation d'affaires, et à une vigilance constante avec examen bisannuel.",
      RENFORCEE:
        "En raison du niveau de risque élevé identifié, des mesures de vigilance renforcée sont appliquées conformément " +
        "aux articles L.561-10 et L.561-10-2 du CMF. Le cabinet procède à une identification approfondie, à l'obtention " +
        "d'informations sur l'origine des fonds, et à un suivi renforcé avec examen annuel minimum. Toute impossibilité " +
        "de mise en œuvre pourra conduire à la cessation de la relation d'affaires (art. L.561-8 CMF).",
    };
    this.writeText(vigTexts[cli?.nivVigilance] ?? vigTexts.STANDARD);

    this.y += 4;

    // Engagements contractuels
    this.drawSubTitle("Engagements contractuels du client");
    this.y += 2;
    this.writeText(
      "Le client s'engage à fournir, dans les délais impartis, l'ensemble des documents et informations nécessaires " +
      "à l'exercice des obligations de vigilance du cabinet, et notamment : pièce d'identité en cours de validité, " +
      "extrait Kbis de moins de 3 mois, statuts à jour, liste des bénéficiaires effectifs, justificatif de siège social. " +
      "Le refus ou l'impossibilité de fournir ces éléments pourra conduire le cabinet à refuser ou mettre fin à la " +
      "relation d'affaires, conformément à l'article L.561-8 du Code monétaire et financier."
    );

    this.y += 4;

    // Conservation
    this.drawSubTitle("Durée de conservation des données LCB-FT");
    this.y += 2;
    this.writeText(
      "Conformément à l'article L.561-12 du Code monétaire et financier, les documents et informations relatifs " +
      "à l'identité du client et aux opérations réalisées sont conservés pendant cinq ans après la fin de la " +
      "relation d'affaires ou après l'exécution de l'opération."
    );
  }

  // ──────────────────────────────────────────────
  // PAGES 4-5 — Missions
  // ──────────────────────────────────────────────
  private drawPages4_5(): void {
    this.newPage();
    const cli = this.client;
    const opts = this.options;

    // Section: Notre mission — use editor content if available
    this.drawSectionTitle("NOTRE MISSION");
    this.y += 2;

    const editorMission = this.getEditorContent("mission");
    if (editorMission) {
      this.writeText(editorMission);
    } else {
      this.writeText(
        `Conformément aux dispositions de l'ordonnance n° 45-2138 du 19 septembre 1945 et du décret n° 2012-432 ` +
        `du 30 mars 2012, nous nous engageons à exécuter la mission de ${s(cli?.mission)} qui nous est confiée dans le ` +
        `respect des normes professionnelles applicables et du Code de déontologie de la profession d'expert-comptable.`
      );
    }

    // Durée — use editor content if available
    this.drawSubTitle("Durée de la mission");
    const editorDuree = this.getEditorContent("duree");
    if (editorDuree) {
      this.writeText(editorDuree);
    } else {
      this.writeText(
        `La présente mission prend effet à compter du ${opts.exerciceDebut} pour une durée d'un exercice social ` +
        `(du ${opts.exerciceDebut} au ${opts.exerciceFin}), renouvelable par tacite reconduction sauf dénonciation ` +
        `par l'une des parties moyennant un préavis de trois mois avant la date d'échéance, par lettre recommandée ` +
        `avec accusé de réception.`
      );
    }

    // Nature et limites
    this.drawSubTitle("Nature et limites de la mission");
    this.writeText(
      "Notre mission consiste en la tenue et/ou la surveillance de votre comptabilité et en la présentation de vos " +
      "comptes annuels. Cette mission ne constitue ni un audit, ni un commissariat aux comptes, et ne saurait se " +
      "substituer aux obligations légales et réglementaires incombant au représentant légal de l'entité."
    );
    this.writeText(
      "Nos travaux ne comportent pas la recherche systématique de fraudes ou d'erreurs. Toutefois, si de telles " +
      "anomalies venaient à être détectées dans le cadre de nos diligences, nous vous en informerions sans délai."
    );

    // Mission sociale (si activée)
    if (opts.missionSociale) {
      this.y += 4;
      this.drawSubTitle("Mission sociale");
      const editorSociale = this.getEditorContent("mission_sociale");
      if (editorSociale) {
        this.writeText(editorSociale);
      } else {
        this.writeText(
          "Dans le cadre de la mission sociale qui nous est confiée, nous assurons les prestations suivantes :"
        );
        this.writeBullet("Établissement des bulletins de paie et des déclarations sociales obligatoires (DSN)");
        this.writeBullet("Gestion des entrées et sorties du personnel (DPAE, contrats, certificats, STC)");
        this.writeBullet("Calcul et déclaration des charges sociales (URSSAF, retraite, prévoyance)");
        this.writeBullet("Assistance en matière de droit social courant");
      }
    }

    // Mission juridique (si activée)
    if (opts.missionJuridique) {
      this.y += 4;
      this.drawSubTitle("Mission juridique");
      const editorJuridique = this.getEditorContent("mission_juridique");
      if (editorJuridique) {
        this.writeText(editorJuridique);
      } else {
        this.writeText(
          "Conformément à l'article 22 de l'ordonnance du 19 septembre 1945, nous assurons une mission juridique " +
          "accessoire comprenant :"
        );
        this.writeBullet("Rédaction des procès-verbaux d'assemblées générales ordinaires et extraordinaires");
        this.writeBullet("Formalités de modification statutaire et dépôt au greffe du tribunal de commerce");
        this.writeBullet("Tenue des registres obligatoires (registre des assemblées, registre des mouvements de titres)");
        this.writeBullet("Assistance à la rédaction d'actes juridiques courants liés à la vie sociale");
      }
    }

    // Mission contrôle fiscal (si activée)
    if (opts.missionControleFiscal) {
      this.y += 4;
      this.drawSubTitle("Mission d'assistance au contrôle fiscal");
      this.writeText(
        "En cas de vérification de comptabilité ou de contrôle fiscal, notre cabinet vous accompagne dans le cadre " +
        "d'une mission spécifique comprenant :"
      );
      this.writeBullet(
        "Option 1 — Assistance à la préparation : vérification préalable du dossier, analyse des points de " +
        "vulnérabilité, préparation des réponses aux demandes de l'administration"
      );
      this.writeBullet(
        "Option 2 — Assistance pendant le contrôle : présence lors des rendez-vous avec le vérificateur, " +
        "analyse des propositions de rectification, rédaction des observations"
      );
      this.writeBullet(
        "Option 3 — Assistance post-contrôle : analyse de la mise en recouvrement, assistance à la " +
        "contestation (réclamation contentieuse, saisine du conciliateur fiscal)"
      );
    }
  }

  // ──────────────────────────────────────────────
  // PAGE 6 — Honoraires + Signatures
  // ──────────────────────────────────────────────
  private drawPage6(): void {
    this.newPage();
    const cli = this.client;
    const opts = this.options;

    this.drawSectionTitle("HONORAIRES ET CONDITIONS FINANCIÈRES");
    this.y += 2;

    // Honoraires mission comptable
    this.drawSubTitle("Mission comptable");
    this.drawHonoraireTableHeader();
    this.drawHonoraireRow("Honoraires mission comptable annuelle", cli?.honoraires ?? 0, true);
    if ((cli?.reprise ?? 0) > 0) {
      this.drawHonoraireRow("Reprise comptable (exercices antérieurs)", cli?.reprise ?? 0, false);
    }
    if ((opts?.fraisConstitution ?? 0) > 0) {
      this.drawHonoraireRow("Frais de constitution / installation", opts?.fraisConstitution ?? 0, true);
    }
    const totalCompta = (cli?.honoraires ?? 0) + (cli?.reprise ?? 0) + (opts?.fraisConstitution ?? 0);
    this.drawHonoraireTotal("TOTAL MISSION COMPTABLE HT", totalCompta);

    // Honoraires social
    if (opts.missionSociale && opts.honorairesSocial > 0) {
      this.drawSubTitle("Mission sociale");
      this.drawHonoraireTableHeader();
      this.drawHonoraireRow("Honoraires mission sociale annuelle", opts.honorairesSocial, true);
      this.drawHonoraireTotal("TOTAL MISSION SOCIALE HT", opts.honorairesSocial);
    }

    // Honoraires juridique
    if (opts?.missionJuridique && ((cli?.juridique ?? 0) > 0 || (opts?.honorairesJuridique ?? 0) > 0)) {
      this.drawSubTitle("Mission juridique");
      const montJur = (opts?.honorairesJuridique ?? 0) > 0 ? opts.honorairesJuridique : (cli?.juridique ?? 0);
      this.drawHonoraireTableHeader();
      this.drawHonoraireRow("Honoraires mission juridique annuelle", montJur, true);
      this.drawHonoraireTotal("TOTAL MISSION JURIDIQUE HT", montJur);
    }

    // Honoraires contrôle fiscal
    if (opts.missionControleFiscal && opts.honorairesControleFiscal > 0) {
      this.drawSubTitle("Assistance au contrôle fiscal");
      this.drawHonoraireTableHeader();
      this.drawHonoraireRow("Honoraires assistance contrôle fiscal", opts.honorairesControleFiscal, true);
      this.drawHonoraireTotal("TOTAL CONTRÔLE FISCAL HT", opts.honorairesControleFiscal);
    }

    // Grand total
    const grandTotal = totalCompta +
      (opts.missionSociale ? opts.honorairesSocial : 0) +
      (opts?.missionJuridique ? ((opts?.honorairesJuridique ?? 0) > 0 ? opts.honorairesJuridique : (cli?.juridique ?? 0)) : 0) +
      (opts.missionControleFiscal ? opts.honorairesControleFiscal : 0);

    this.y += 4;
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 10, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("TOTAL GÉNÉRAL HT", MARGIN_L + 3, this.y + 1);
    this.doc.text(formatMontant(grandTotal), MARGIN_R - 3, this.y + 1, { align: "right" });
    this.doc.setTextColor(30, 30, 30);
    this.y += 12;

    // TTC
    this.setSmall();
    this.doc.text(
      `Total TTC (TVA ${((this.options as any).taux_tva ?? 20)}%) : ${formatMontant(grandTotal * (1 + ((this.options as any).taux_tva ?? 20) / 100))}`,
      MARGIN_R - 3,
      this.y,
      { align: "right" }
    );
    this.y += 8;

    // OPT-33: Mention honoraires de succès
    const mtConfHono = getMissionTypeConfig(this.options?.missionTypeId || "presentation");
    if (!mtConfHono.honorairesSuccesAutorises) {
      this.setSmall();
      this.doc.setFont("helvetica", "italic");
      const honoText = this.doc.splitTextToSize(
        "Conformément à l'article 24 de l'ordonnance du 19 septembre 1945, les honoraires de résultat (succès) sont interdits pour ce type de mission.",
        CONTENT_W
      );
      for (const line of honoText) {
        this.doc.text(line, MARGIN_L, this.y);
        this.y += 4;
      }
      this.y += 4;
    }

    // Conditions de facturation
    this.drawSubTitle("Conditions de facturation et de règlement");
    this.writeText(
      `Les honoraires sont payables ${(cli?.frequence ?? "mensuel").toLowerCase()}, par prélèvement SEPA ou virement bancaire, ` +
      `à réception de la facture. En cas de retard de paiement, des pénalités seront appliquées conformément à ` +
      `l'article L.441-10 du Code de commerce, au taux de la BCE majoré de 10 points, outre l'indemnité ` +
      `forfaitaire de recouvrement de 40 €.`
    );

    // Formule de conclusion
    this.y += 4;
    this.writeText(
      "En espérant que cette proposition retiendra votre attention, nous vous prions d'agréer, " +
      `${opts?.genre === "F" ? "Chère Madame" : "Cher Monsieur"} ${s(cli?.dirigeant)}, ` +
      "l'expression de nos salutations distinguées."
    );

    // Signatures
    this.drawSignatures();
  }

  private drawSignatures(): void {
    const cli = this.client;
    const cab = this.cabinet;

    this.ensureSpace(80);
    this.y += 6;

    this.setBody();
    this.doc.text("Fait en deux exemplaires originaux,", MARGIN_L, this.y);
    this.y += 5;
    this.doc.text(`À ${s(cab?.ville)}, le ____________________`, MARGIN_L, this.y);
    this.y += 12;

    const colL = MARGIN_L;
    const colR = MARGIN_L + CONTENT_W / 2 + 5;

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.text("Pour le cabinet", colL, this.y);
    this.doc.text("Pour le client", colR, this.y);
    this.y += 6;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.text(s(cab?.nom), colL, this.y);
    this.doc.text(s(cli?.raisonSociale), colR, this.y);
    this.y += 5;
    this.doc.text(s(cli?.associe), colL, this.y);
    this.doc.text(s(cli?.dirigeant), colR, this.y);
    this.y += 4;
    this.setSmall();
    this.doc.text("Associé signataire", colL, this.y);
    this.doc.text("Gérant / Président", colR, this.y);
    this.y += 50; // OPT-37: 5cm d'espace pour signature manuscrite

    // Signature lines
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.3);
    this.doc.line(colL, this.y, colL + 65, this.y);
    this.doc.line(colR, this.y, colR + 65, this.y);
    this.y += 4;
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("Lu et approuvé", colL, this.y);
    this.doc.text("Lu et approuvé", colR, this.y);
  }

  // ──────────────────────────────────────────────
  // PAGE 7 — Répartition des travaux
  // ──────────────────────────────────────────────
  private drawPage7(): void {
    this.newPage();

    this.drawSectionTitle("RÉPARTITION DES TRAVAUX");
    this.y += 2;

    this.setSmall();
    this.doc.setFont("helvetica", "italic");
    this.doc.text(
      "Le tableau ci-dessous récapitule la répartition des responsabilités entre le cabinet et le client.",
      MARGIN_L,
      this.y
    );
    this.y += 8;

    // Table header
    const colW1 = CONTENT_W * 0.5;
    const colW2 = CONTENT_W * 0.25;
    const colW3 = CONTENT_W * 0.25;

    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 8, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Tâche", MARGIN_L + 3, this.y);
    this.doc.text("Cabinet", MARGIN_L + colW1 + colW2 / 2, this.y, { align: "center" });
    this.doc.text("Client", MARGIN_L + colW1 + colW2 + colW3 / 2, this.y, { align: "center" });
    this.doc.setTextColor(30, 30, 30);
    this.y += 7;

    const tasks: [string, boolean, boolean][] = [
      ["Collecte et transmission des pièces comptables", false, true],
      ["Classement et saisie des pièces comptables", true, false],
      ["Rapprochement bancaire", true, false],
      ["Lettrage des comptes tiers", true, false],
      ["Déclarations fiscales (TVA, IS, CFE, CVAE)", true, false],
      ["Établissement des comptes annuels", true, false],
      ["Liasse fiscale", true, false],
      ["Établissement des bulletins de paie", this.options.missionSociale, false],
      ["Déclarations sociales (DSN)", this.options.missionSociale, false],
      ["Gestion des entrées/sorties personnel", this.options.missionSociale, false],
      ["PV d'assemblées générales", this.options.missionJuridique, false],
      ["Formalités juridiques annuelles", this.options.missionJuridique, false],
      ["Conservation des documents comptables", true, true],
      ["Fourniture des relevés bancaires", false, true],
      ["Communication des informations de gestion", false, true],
      ["Information de tout changement de situation", false, true],
    ];

    for (let i = 0; i < tasks.length; i++) {
      this.ensureSpace(7);
      if (i % 2 === 0) {
        this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
        this.doc.rect(MARGIN_L, this.y - 4, CONTENT_W, 7, "F");
      }
      this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
      this.doc.line(MARGIN_L, this.y + 3, MARGIN_R, this.y + 3);

      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(tasks[i][0], MARGIN_L + 3, this.y);
      // Checkmarks
      if (tasks[i][1]) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("X", MARGIN_L + colW1 + colW2 / 2, this.y, { align: "center" });
      }
      if (tasks[i][2]) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("X", MARGIN_L + colW1 + colW2 + colW3 / 2, this.y, { align: "center" });
      }
      this.y += 7;
    }
  }

  // ──────────────────────────────────────────────
  // PAGE 8 — Attestation travail dissimulé
  // ──────────────────────────────────────────────
  private drawPage8(): void {
    this.newPage();
    const cli = this.client;

    this.drawSectionTitle("ATTESTATION DE VIGILANCE — TRAVAIL DISSIMULÉ");
    this.y += 4;

    this.writeText(
      "Conformément aux articles L.8221-1 et suivants du Code du travail, le client atteste sur l'honneur :"
    );
    this.y += 2;

    this.writeBullet(
      "Que le travail est réalisé par des salariés employés régulièrement au regard des articles L.1221-10, " +
      "L.3243-2 et R.3243-1 du Code du travail"
    );
    this.writeBullet(
      "Que les déclarations sociales et le paiement des cotisations et contributions sociales sont effectués " +
      "conformément aux dispositions légales en vigueur"
    );
    this.writeBullet(
      "Que les salariés étrangers sont en possession d'un titre de travail en cours de validité"
    );
    this.writeBullet(
      "Que la société n'a pas fait l'objet de condamnation pour travail dissimulé au sens des articles L.8224-1 " +
      "à L.8224-6 du Code du travail"
    );

    this.y += 6;
    this.writeText(
      "En cas de sous-traitance, le client s'engage à vérifier que ses sous-traitants respectent les mêmes " +
      "obligations, conformément à l'article L.8222-1 du Code du travail."
    );

    this.y += 10;

    // Bloc signature attestation
    this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
    this.doc.roundedRect(MARGIN_L, this.y, CONTENT_W, 45, 2, 2, "F");

    this.y += 8;
    this.setBody();
    this.doc.text(`Société : ${s(cli?.raisonSociale)}`, MARGIN_L + 5, this.y);
    this.y += 6;
    this.doc.text(`SIREN : ${s(cli?.siren)}`, MARGIN_L + 5, this.y);
    this.y += 6;
    this.doc.text(`Représentée par : ${s(cli?.dirigeant)}`, MARGIN_L + 5, this.y);
    this.y += 6;
    this.doc.text(`Fait à : ____________________  Le : ____________________`, MARGIN_L + 5, this.y);
    this.y += 10;
    this.doc.text("Signature du représentant légal :", MARGIN_L + 5, this.y);
    this.y += 15;
  }

  // ──────────────────────────────────────────────
  // PAGE 9 — Mandat SEPA
  // ──────────────────────────────────────────────
  private drawPage9(): void {
    this.newPage();
    const cli = this.client;
    const cab = this.cabinet;

    this.setTitle(14);
    this.doc.text("MANDAT DE PRÉLÈVEMENT SEPA", PAGE_W / 2, this.y, { align: "center" });
    this.y += 4;
    this.setSmall();
    this.doc.setFont("helvetica", "italic");
    this.doc.text("Règlement UE n° 260/2012 — Schéma SEPA Direct Debit Core", PAGE_W / 2, this.y, { align: "center" });
    this.y += 10;

    // Créancier
    this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
    this.doc.roundedRect(MARGIN_L, this.y, CONTENT_W, 30, 2, 2, "F");

    this.y += 7;
    this.drawSubTitle("Créancier");
    this.drawTableRow("Nom", s(cab?.nom));
    this.drawTableRow("Adresse", `${s(cab?.adresse)}, ${s(cab?.cp)} ${s(cab?.ville)}`);
    this.drawTableRow("SIRET", s(cab?.siret));
    this.y += 6;

    // Débiteur
    this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
    this.doc.roundedRect(MARGIN_L, this.y, CONTENT_W, 48, 2, 2);

    this.y += 7;
    this.drawSubTitle("Débiteur");
    this.drawTableRow("Nom / Raison sociale", s(cli?.raisonSociale));
    this.drawTableRow("Adresse", `${s(cli?.adresse)}, ${s(cli?.cp)} ${s(cli?.ville)}`);
    this.drawTableRow("IBAN", formatIban(cli?.iban ?? ""));
    this.drawTableRow("BIC", cli?.bic || "________________________");
    this.drawTableRow("Référence unique (RUM)", `SEPA-${s(cli?.ref)}`);
    this.drawTableRow("Type de paiement", "Récurrent");
    this.y += 6;

    // Mention légale SEPA
    this.setSmall();
    const sepaText =
      "En signant ce formulaire de mandat, vous autorisez le créancier à envoyer des instructions à votre banque " +
      "pour débiter votre compte, et votre banque à débiter votre compte conformément aux instructions du créancier. " +
      "Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la convention " +
      "que vous avez passée avec elle. Une demande de remboursement doit être présentée dans les 8 semaines suivant " +
      "la date de débit de votre compte.";
    const sepaLines = this.doc.splitTextToSize(sepaText, CONTENT_W - 10);
    this.doc.text(sepaLines, MARGIN_L + 5, this.y);
    this.y += sepaLines.length * 4 + 10;

    // Signature
    this.setBody();
    this.doc.text("Date : ____________________", MARGIN_L, this.y);
    this.doc.text("Lieu : ____________________", MARGIN_L + 80, this.y);
    this.y += 12;
    this.doc.text("Signature du débiteur :", MARGIN_L, this.y);
    this.y += 15;
    this.doc.setDrawColor(0, 0, 0);
    this.doc.line(MARGIN_L, this.y, MARGIN_L + 70, this.y);
  }

  // ──────────────────────────────────────────────
  // PAGE 10 — Autorisation liasse fiscale
  // ──────────────────────────────────────────────
  private drawPage10(): void {
    this.newPage();
    const cli = this.client;
    const cab = this.cabinet;

    this.drawSectionTitle("AUTORISATION DE TRANSMISSION DE LA LIASSE FISCALE");
    this.y += 4;

    this.writeText(
      `Je soussigné(e) ${s(cli?.dirigeant)}, agissant en qualité de représentant légal de la société ` +
      `${s(cli?.raisonSociale)} (SIREN ${s(cli?.siren)}), autorise par la présente le cabinet ${s(cab?.nom)} ` +
      `(SIRET ${s(cab?.siret)}), à :`
    );

    this.y += 4;
    this.writeBullet(
      "Transmettre par voie dématérialisée (procédure EDI-TDFC) la liasse fiscale et les déclarations " +
      "de résultats aux services fiscaux compétents"
    );
    this.writeBullet(
      "Transmettre par voie dématérialisée (procédure EDI-TVA) les déclarations de TVA aux services fiscaux"
    );
    this.writeBullet(
      "Effectuer les télépaiements des impôts professionnels (IS, TVA, CFE, CVAE) dans la limite " +
      "des montants préalablement validés par le client"
    );

    this.y += 6;
    this.writeText(
      "Cette autorisation est valable pour la durée de la mission telle que définie dans la lettre de mission. " +
      "Elle peut être révoquée à tout moment par lettre recommandée avec accusé de réception."
    );

    this.y += 10;

    // Cadre signature
    this.doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
    this.doc.roundedRect(MARGIN_L, this.y, CONTENT_W, 40, 2, 2, "F");

    this.y += 8;
    this.setBody();
    this.doc.text(`Fait à : ____________________  Le : ____________________`, MARGIN_L + 5, this.y);
    this.y += 8;
    this.doc.text(`Nom : ${s(cli?.dirigeant)}`, MARGIN_L + 5, this.y);
    this.y += 8;
    this.doc.text("Signature précédée de la mention « Bon pour autorisation » :", MARGIN_L + 5, this.y);
    this.y += 15;
  }

  // ──────────────────────────────────────────────
  // PAGES 11+ — Conditions générales
  // ──────────────────────────────────────────────
  private drawConditionsGenerales(): void {
    this.newPage();

    this.drawSectionTitle("CONDITIONS GÉNÉRALES");
    this.y += 2;

    const sections: [string, string][] = [
      [
        "Article 1 — Objet",
        "Les présentes conditions générales ont pour objet de définir les modalités d'exécution de la mission " +
        "d'expertise comptable confiée au cabinet par le client, conformément aux normes professionnelles et " +
        "au Code de déontologie de la profession."
      ],
      [
        "Article 2 — Obligations du cabinet",
        "Le cabinet s'engage à exécuter sa mission avec diligence et compétence, conformément aux normes " +
        "professionnelles applicables. Il est tenu à une obligation de moyens. Le cabinet est soumis au secret " +
        "professionnel conformément à l'article 21 de l'ordonnance du 19 septembre 1945."
      ],
      [
        "Article 3 — Obligations du client",
        "Le client s'engage à mettre à la disposition du cabinet, en temps utile, l'ensemble des documents et " +
        "informations nécessaires à l'exécution de la mission. Le client est responsable de l'exhaustivité et de " +
        "l'exactitude des informations communiquées. Tout retard dans la transmission des pièces pourra entraîner " +
        "un report des échéances et, le cas échéant, des pénalités de retard auprès de l'administration."
      ],
      [
        "Article 4 — Honoraires",
        "Les honoraires sont fixés d'un commun accord entre les parties et figurent dans le corps de la lettre de " +
        "mission. Ils peuvent être révisés annuellement en fonction de l'évolution des indices et de la charge de " +
        "travail. Toute prestation supplémentaire non prévue dans la lettre de mission fera l'objet d'un devis " +
        "préalable ou d'un avenant."
      ],
      [
        "Article 5 — Responsabilité",
        "La responsabilité civile professionnelle du cabinet est couverte par une assurance conforme aux " +
        "dispositions de l'article 17 de l'ordonnance du 19 septembre 1945. La responsabilité du cabinet ne " +
        "saurait être engagée en cas de manquement du client à ses obligations, notamment en cas de rétention " +
        "d'information, de transmission tardive des documents ou de fourniture d'informations erronées."
      ],
      [
        "Article 6 — Résiliation",
        "Chacune des parties peut mettre fin à la mission par lettre recommandée avec accusé de réception, " +
        "moyennant un préavis de trois mois avant la date anniversaire. En cas de manquement grave de l'une " +
        "des parties à ses obligations, l'autre partie pourra résilier la mission sans préavis, par lettre " +
        "recommandée motivée. Les travaux réalisés jusqu'à la date de résiliation seront facturés au prorata."
      ],
      [
        "Article 7 — Protection des données (RGPD)",
        "Conformément au Règlement (UE) 2016/679 et à la loi Informatique et Libertés, le cabinet traite les " +
        "données personnelles du client aux seules fins de l'exécution de la mission et du respect de ses " +
        "obligations légales. Le client dispose des droits d'accès, de rectification, d'effacement, de limitation " +
        "et de portabilité de ses données. Le cabinet met en œuvre les mesures techniques et organisationnelles " +
        "appropriées pour garantir la sécurité des données."
      ],
      [
        "Article 8 — Propriété intellectuelle",
        "Les travaux réalisés par le cabinet restent sa propriété intellectuelle jusqu'au règlement intégral des " +
        "honoraires. Le client dispose d'un droit d'utilisation non exclusif des livrables pour ses besoins propres."
      ],
      [
        "Article 9 — Lutte contre le blanchiment",
        "Conformément aux articles L.561-1 et suivants du Code monétaire et financier, le cabinet est soumis " +
        "aux obligations de vigilance en matière de lutte contre le blanchiment de capitaux et le financement " +
        "du terrorisme. Le client s'engage à coopérer pleinement à l'exécution de ces obligations."
      ],
      [
        "Article 10 — Droit applicable et juridiction",
        "La présente lettre de mission est régie par le droit français. Tout différend sera soumis à la " +
        "commission de conciliation de l'Ordre des Experts-Comptables de la région compétente. À défaut de " +
        "règlement amiable, le litige sera porté devant les tribunaux compétents du ressort du siège du cabinet."
      ],
    ];

    for (const [titre, texte] of sections) {
      this.ensureSpace(20);
      this.drawSubTitle(titre);
      this.writeText(texte);
      this.y += 3;
    }
  }

  // ──────────────────────────────────────────────
  // Footer on every page
  // ──────────────────────────────────────────────
  private addFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    const mtConf = getMissionTypeConfig(this.options?.missionTypeId || "presentation");
    const cab = this.cabinet;

    // Build full footer text with all cabinet info
    const footerParts: string[] = [];
    if (cab?.nom) footerParts.push(s(cab.nom));
    const addrParts = [s(cab?.adresse), `${s(cab?.cp)} ${s(cab?.ville)}`.trim()].filter(Boolean);
    if (addrParts.length > 0) footerParts.push(addrParts.join(', '));

    const footerLine2Parts: string[] = [];
    if ((cab as any)?.numeroOEC) footerLine2Parts.push(`OEC n° ${s((cab as any).numeroOEC)}`);
    if ((cab as any)?.croec) footerLine2Parts.push(`CROEC ${s((cab as any).croec)}`);
    if ((cab as any)?.assureurNom || (cab as any)?.assureur_nom) footerLine2Parts.push(`RC Pro : ${s((cab as any).assureurNom || (cab as any).assureur_nom)}`);
    if ((cab as any)?.tvaIntracommunautaire || (cab as any)?.tva_intracommunautaire) footerLine2Parts.push(`TVA : ${s((cab as any).tvaIntracommunautaire || (cab as any).tva_intracommunautaire)}`);

    const footerText1 = footerParts.join(' — ');
    const footerText2 = footerLine2Parts.join(' — ');

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      // OPT-29: Footer
      this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
      this.doc.setLineWidth(0.3);
      this.doc.line(MARGIN_L, FOOTER_Y, MARGIN_R, FOOTER_Y);
      this.doc.setFontSize(7);
      this.doc.setTextColor(FOOTER_COLOR.r, FOOTER_COLOR.g, FOOTER_COLOR.b);

      if (footerText2) {
        // Two-line footer with full info
        this.doc.text(footerText1, PAGE_W / 2, FOOTER_Y + 3, { align: "center" });
        this.doc.text(footerText2, PAGE_W / 2, FOOTER_Y + 6.5, { align: "center" });
      } else {
        this.doc.text(
          `${s(cab?.nom)} | Lettre de mission — Document confidentiel`,
          MARGIN_L,
          FOOTER_Y + 4
        );
      }

      this.doc.text(
        `Page ${i} / ${totalPages}`,
        MARGIN_R,
        FOOTER_Y + (footerText2 ? 6.5 : 4),
        { align: "right" }
      );
      // OPT-30: Header on pages 2+
      if (i > 1) {
        this.doc.setFontSize(9);
        this.doc.setTextColor(FOOTER_COLOR.r, FOOTER_COLOR.g, FOOTER_COLOR.b);
        this.doc.text(s(this.cabinet?.nom), MARGIN_L, 12);
        this.doc.text(`${this.numero} — ${mtConf.shortLabel}`, MARGIN_R, 12, { align: "right" });
        this.doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
        this.doc.line(MARGIN_L, 14, MARGIN_R, 14);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Build
  // ──────────────────────────────────────────────
  build(): jsPDF {
    this.drawPage1();
    this.drawPage2();
    this.drawPage3();
    this.drawPages4_5();
    this.drawPage6();
    this.drawPage7();
    this.drawPage8();
    // Only render SEPA page if payment mode is prelevement
    const modePaiement = (this.options as any).mode_paiement ?? (this.options as any).modePaiement;
    if (!modePaiement || modePaiement === "prelevement") {
      this.drawPage9();
    }
    this.drawPage10();
    this.drawConditionsGenerales();
    this.addFooters();
    return this.doc;
  }

  addWatermark(): void {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.saveGraphicsState();
      this.doc.setFontSize(60);
      this.doc.setTextColor(200, 200, 200);
      this.doc.text("BROUILLON", 105, 170, { align: "center", angle: 45 });
      this.doc.restoreGraphicsState();
    }
  }
}

/**
 * Génère un PDF professionnel complet pour une Lettre de Mission.
 */
export function renderLettreMissionPdf(lm: LettreMission, options?: { watermark?: boolean }): jsPDF {
  try {
    const builder = new LMPdfBuilder(lm);
    const doc = builder.build();
    if (options?.watermark) builder.addWatermark();
    return doc;
  } catch (err: unknown) {
    logger.error("PDF", "Erreur lors de la génération du PDF", err);
    // Return a minimal error PDF so callers never get undefined
    const fallback = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    fallback.setFontSize(14);
    fallback.setTextColor(220, 38, 38);
    fallback.text("Erreur lors de la génération du PDF.", 25, 40);
    fallback.setFontSize(10);
    fallback.setTextColor(80, 80, 80);
    fallback.text(String(err), 25, 50);
    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════
// NEW TEMPLATE-BASED PDF GENERATOR
// ══════════════════════════════════════════════════════════════

import type { TemplateSection } from "@/lib/lettreMissionTemplate";
import { replaceTemplateVariables } from "@/lib/lettreMissionTemplate";

interface NewPdfParams {
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
  missionTypeId?: string;
}

const REPARTITION_TASKS: [string, boolean, boolean][] = [
  ["Collecte et classement des pièces comptables", false, true],
  ["Saisie / Intégration des écritures comptables", true, false],
  ["Rapprochement bancaire mensuel", true, false],
  ["Établissement des déclarations de TVA", true, false],
  ["Établissement de la liasse fiscale", true, false],
  ["Comptes annuels (bilan, compte de résultat, annexe)", true, false],
  ["Transmission des relevés bancaires", false, true],
  ["Transmission des factures fournisseurs/clients", false, true],
  ["Conservation des pièces justificatives", true, true],
  ["Déclarations fiscales annuelles (IS, CVAE, CFE)", true, false],
];

export function renderNewLettreMissionPdf(params: NewPdfParams): void {
  try {
  const { sections, client, genre, missions, honoraires, cabinet, variables,
    status = "brouillon", signatureExpert, signatureClient } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y + needed > FOOTER_Y - 5) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  }

  function newPage() {
    doc.addPage();
    y = MARGIN_TOP;
  }

  function setBody() {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
  }

  function setSmall() {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
  }

  function writeText(text: string) {
    setBody();
    const lines = doc.splitTextToSize(text, CONTENT_W);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, MARGIN_L, y);
      y += 4.5;
    }
    y += 2;
  }

  function drawSectionTitle(title: string) {
    ensureSpace(12);
    doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    doc.rect(MARGIN_L, y - 1, CONTENT_W, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), MARGIN_L + 3, y + 4.5);
    doc.setTextColor(30, 30, 30);
    y += 12;
  }

  function drawTableRow2Col(label: string, value: string, shade: boolean) {
    ensureSpace(7);
    if (shade) {
      doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
      doc.rect(MARGIN_L, y - 4, CONTENT_W, 7, "F");
    }
    doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
    doc.line(MARGIN_L, y + 3, MARGIN_R, y + 3);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(label, MARGIN_L + 3, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const truncated = doc.splitTextToSize(value, CONTENT_W - 70);
    doc.text(truncated[0] ?? "", MARGIN_L + 65, y);
    y += 7;
  }

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
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(cabinet.nom, MARGIN_R, MARGIN_TOP + 3, { align: "right" });
  setSmall();
  doc.text(`${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`, MARGIN_R, MARGIN_TOP + 8, { align: "right" });
  doc.text(`SIRET : ${cabinet.siret} — OEC n° ${cabinet.numeroOEC}`, MARGIN_R, MARGIN_TOP + 12, { align: "right" });
  doc.text(`${cabinet.email} — ${cabinet.telephone}`, MARGIN_R, MARGIN_TOP + 16, { align: "right" });
  y = MARGIN_TOP + 24;
  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_L, y, MARGIN_R, y);
  y += 8;

  // ── Title (OPT-19/20) ──
  const mtConf = getMissionTypeConfig(params.missionTypeId || "presentation");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text("LETTRE DE MISSION", PAGE_W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text(mtConf.label.toUpperCase(), PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`Norme applicable : ${mtConf.normeRef}`, PAGE_W / 2, y, { align: "center" });
  y += 10;

  // ── Iterate sections ──
  let isFirstAnnexe = true;

  for (const section of visibleSections) {
    // Page break before annexes
    if (section.type === "annexe" && isFirstAnnexe) {
      newPage();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      doc.text("ANNEXES", PAGE_W / 2, y, { align: "center" });
      y += 12;
      isFirstAnnexe = false;
    }

    // Special content handlers
    if (section.content === "TABLEAU_ENTITE") {
      drawSectionTitle(section.title);
      const rows: [string, string][] = [
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
      rows.forEach(([l, v], i) => drawTableRow2Col(l, v, i % 2 === 0));
      y += 6;
      continue;
    }

    if (section.content === "BLOC_LCBFT") {
      drawSectionTitle(section.title);
      const vigColors: Record<string, { r: number; g: number; b: number }> = {
        SIMPLIFIEE: { r: 76, g: 175, b: 80 },
        STANDARD: { r: 255, g: 152, b: 0 },
        RENFORCEE: { r: 244, g: 67, b: 54 },
      };
      const vc = vigColors[client.nivVigilance] ?? vigColors.STANDARD;
      drawTableRow2Col("Score de risque", `${client.scoreGlobal ?? 0}/100`, true);
      // Vigilance badge
      ensureSpace(7);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Niveau de vigilance", MARGIN_L + 3, y);
      const badgeX = MARGIN_L + 65;
      doc.setFillColor(vc.r, vc.g, vc.b);
      doc.roundedRect(badgeX, y - 3.5, 30, 5, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(client.nivVigilance || "STANDARD", badgeX + 15, y, { align: "center" });
      doc.setTextColor(30, 30, 30);
      y += 7;
      drawTableRow2Col("Statut PPE", client.ppe || "NON", true);
      drawTableRow2Col("Dernière diligence", client.dateDerniereRevue || "—", false);
      drawTableRow2Col("Prochaine MAJ", client.dateButoir || "—", true);
      y += 4;
      setSmall();
      doc.text("CMF art. L.561-1 et s. | Conservation 5 ans après fin de relation", MARGIN_L, y);
      y += 8;
      continue;
    }

    if (section.content === "TABLEAU_HONORAIRES") {
      drawSectionTitle(section.title);
      // 4-column table with TVA (#18)
      const colDesig = MARGIN_L;
      const colHT = MARGIN_L + CONTENT_W * 0.48;
      const colTVA = MARGIN_L + CONTENT_W * 0.67;
      const colTTC = MARGIN_R;
      // Header
      ensureSpace(8);
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(MARGIN_L, y - 4, CONTENT_W, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Désignation", colDesig + 3, y);
      doc.text("Montant HT", colHT, y, { align: "right" });
      doc.text("TVA 20%", colTVA, y, { align: "right" });
      doc.text("Montant TTC", colTTC - 3, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 7;

      function honoRow4(label: string, ht: number, alt: boolean) {
        ensureSpace(7);
        if (alt) { doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b); doc.rect(MARGIN_L, y - 4, CONTENT_W, 7, "F"); }
        const tva = Math.round(ht * 0.20 * 100) / 100;
        const ttc = Math.round(ht * 1.20 * 100) / 100;
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(label, colDesig + 3, y);
        doc.text(formatMontant(ht), colHT, y, { align: "right" });
        doc.text(formatMontant(tva), colTVA, y, { align: "right" });
        doc.text(formatMontant(ttc), colTTC - 3, y, { align: "right" });
        y += 7;
      }

      honoRow4("Forfait comptable annuel", honoraires.comptable, true);
      if (honoraires.constitution > 0) honoRow4("Constitution / Reprise dossier", honoraires.constitution, false);
      if (missions.juridique && honoraires.juridique > 0) honoRow4("Mission juridique annuelle", honoraires.juridique, true);

      const totalHT = honoraires.comptable + honoraires.constitution + (missions.juridique ? honoraires.juridique : 0);
      const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
      const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;

      ensureSpace(9);
      doc.setFillColor(230, 235, 245);
      doc.rect(MARGIN_L, y - 4, CONTENT_W, 9, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("TOTAL", colDesig + 3, y + 1);
      doc.text(formatMontant(totalHT), colHT, y + 1, { align: "right" });
      doc.text(formatMontant(totalTVA), colTVA, y + 1, { align: "right" });
      doc.text(formatMontant(totalTTC), colTTC - 3, y + 1, { align: "right" });
      y += 11;

      const freqLabel = honoraires.frequence === "MENSUEL" ? "mensuel" : honoraires.frequence === "TRIMESTRIEL" ? "trimestriel" : "annuel";
      const divsr = honoraires.frequence === "MENSUEL" ? 12 : honoraires.frequence === "TRIMESTRIEL" ? 4 : 1;
      setSmall();
      doc.text(`Facturation ${freqLabel} : ${formatMontant(Math.round((honoraires.comptable / divsr) * 100) / 100)} HT`, MARGIN_L, y);
      y += 5;
      // OPT-22: Honoraires de succes mention
      doc.text(mtConf.honorairesSuccesAutorises
        ? "Honoraires de résultat (succès) autorisés pour ce type de mission."
        : "Honoraires de résultat (succès) interdits pour ce type de mission.", MARGIN_L, y);
      y += 8;
      continue;
    }

    if (section.content === "TABLEAU_REPARTITION") {
      ensureSpace(20);
      drawSectionTitle(section.title);
      // Header
      const colW1 = CONTENT_W * 0.5;
      const colW2 = CONTENT_W * 0.25;
      const colW3 = CONTENT_W * 0.25;
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(MARGIN_L, y - 4, CONTENT_W, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Tâche", MARGIN_L + 3, y);
      doc.text("Cabinet", MARGIN_L + colW1 + colW2 / 2, y, { align: "center" });
      doc.text("Client", MARGIN_L + colW1 + colW2 + colW3 / 2, y, { align: "center" });
      doc.setTextColor(30, 30, 30);
      y += 7;
      for (let i = 0; i < REPARTITION_TASKS.length; i++) {
        ensureSpace(7);
        if (i % 2 === 0) {
          doc.setFillColor(GREY_BG.r, GREY_BG.g, GREY_BG.b);
          doc.rect(MARGIN_L, y - 4, CONTENT_W, 7, "F");
        }
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(REPARTITION_TASKS[i][0], MARGIN_L + 3, y);
        if (REPARTITION_TASKS[i][1]) {
          doc.setFont("helvetica", "bold");
          doc.text("X", MARGIN_L + colW1 + colW2 / 2, y, { align: "center" });
        }
        if (REPARTITION_TASKS[i][2]) {
          doc.setFont("helvetica", "bold");
          doc.text("X", MARGIN_L + colW1 + colW2 + colW3 / 2, y, { align: "center" });
        }
        y += 7;
      }
      y += 4;
      continue;
    }

    // Regular text section
    if (section.type !== "annexe") {
      drawSectionTitle(section.title);
    } else {
      // Annexe sub-title style
      ensureSpace(10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      doc.text(section.title, MARGIN_L, y);
      doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
      doc.setLineWidth(0.3);
      doc.line(MARGIN_L, y + 2, MARGIN_R, y + 2);
      doc.setTextColor(30, 30, 30);
      y += 8;
    }
    writeText(resolve(section.content));
    y += 2;
  }

  // OPT-21/23: Referentiel + forme rapport encadre
  if (mtConf.referentielApplicable && mtConf.referentielApplicable !== "Sans objet") {
    ensureSpace(20);
    drawSectionTitle("Referentiel et forme du rapport");
    setSmall();
    doc.text(`Référentiel applicable : ${mtConf.referentielApplicable}`, MARGIN_L, y);
    y += 5;
    doc.text(`Forme du rapport : ${mtConf.formeRapport}`, MARGIN_L, y);
    y += 8;
  }

  // ── Signature images (#5) ──
  if (signatureExpert || signatureClient) {
    ensureSpace(40);
    y += 10;
    const colL = MARGIN_L;
    const colR = MARGIN_L + CONTENT_W / 2 + 5;
    if (signatureExpert) {
      try { doc.addImage(signatureExpert, "PNG", colL, y, 50, 20); } catch { /* invalid image */ }
    }
    if (signatureClient) {
      try { doc.addImage(signatureClient, "PNG", colR, y, 50, 20); } catch { /* invalid image */ }
    }
    y += 25;
  }

  // ── Footers with page numbers (#8) + filigrane (#3) ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Filigrane PROJET (#3)
    if (status === "brouillon" || status === "en_attente") {
      doc.saveGraphicsState();
      doc.setFontSize(60);
      doc.setTextColor(200, 200, 200);
      doc.text("PROJET", 105, 170, { align: "center", angle: 45 });
      doc.restoreGraphicsState();
    }

    // Footer line + page numbers (#8)
    doc.setDrawColor(GREY_LINE.r, GREY_LINE.g, GREY_LINE.b);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, FOOTER_Y, MARGIN_R, FOOTER_Y);
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `${cabinet.nom} — SIRET ${cabinet.siret} — Page ${i}/${totalPages}`,
      PAGE_W / 2,
      FOOTER_Y + 4,
      { align: "center" }
    );
  }

  // Save
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `LM_${(client.raisonSociale || "client").replace(/\s+/g, "_")}_${dateStr}.pdf`;
  doc.save(filename);
  } catch (err: unknown) {
    logger.error("PDF", "Erreur lors de la génération du PDF template", err);
    // Generate a minimal error PDF so the user gets feedback
    const fallback = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    fallback.setFontSize(14);
    fallback.setTextColor(220, 38, 38);
    fallback.text("Erreur lors de la génération du PDF.", 25, 40);
    fallback.setFontSize(10);
    fallback.setTextColor(80, 80, 80);
    fallback.text(String(err), 25, 50);
    fallback.save("LM_erreur.pdf");
  }
}

// ──────────────────────────────────────────────
// Generate PDF from LM Instance (modele-based)
// ──────────────────────────────────────────────
export function generatePdfFromInstance(instance: {
  sections_snapshot: { id: string; titre: string; contenu: string; type: string; ordre: number; cnoec_obligatoire?: boolean }[];
  cgv_snapshot: string;
  repartition_snapshot?: { label: string; cabinet: boolean; client: boolean; periodicite?: string }[];
  numero: string;
  status?: string;
  mission_type?: string;
  variables_resolved?: Record<string, string>;
}, cabinet: { nom: string; adresse: string; cp: string; ville: string; siret: string; numeroOEC: string; email: string; telephone: string }, options?: { signatureExpert?: string; signatureClient?: string }): void {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = MARGIN_TOP;

    function ensureSpace(needed: number) {
      if (y + needed > FOOTER_Y - 5) { doc.addPage(); y = MARGIN_TOP; }
    }
    function addFooter(pageNum: number) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageNum} — ${cabinet.nom}`, PAGE_W / 2, FOOTER_Y + 10, { align: "center" });
    }

    // Watermark for drafts
    if (instance.status === "brouillon" || instance.status === "en_validation") {
      doc.setFontSize(60);
      doc.setTextColor(230, 230, 230);
      doc.text("PROJET", PAGE_W / 2, 150, { angle: 45, align: "center" });
    }

    // Header
    doc.setFontSize(10);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text(cabinet.nom, MARGIN_R, MARGIN_TOP, { align: "right" });
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(`${cabinet.adresse}, ${cabinet.cp} ${cabinet.ville}`, MARGIN_R, MARGIN_TOP + 4, { align: "right" });
    doc.text(`SIRET : ${cabinet.siret} — OEC n° ${cabinet.numeroOEC}`, MARGIN_R, MARGIN_TOP + 8, { align: "right" });
    y = MARGIN_TOP + 20;

    // Numero + date
    doc.setFontSize(8);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text(instance.numero, MARGIN_L, y);
    doc.text(formatDateFr(new Date()), MARGIN_R, y, { align: "right" });
    y += 10;

    // Title
    doc.setFontSize(14);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text("LETTRE DE MISSION", PAGE_W / 2, y, { align: "center" });
    y += 7;

    // Mission type subtitle
    if (instance.mission_type) {
      const mtConf = getMissionTypeConfig(instance.mission_type);
      doc.setFontSize(10);
      doc.text(mtConf.label.toUpperCase(), PAGE_W / 2, y, { align: "center" });
      doc.setFontSize(8);
      y += 4;
      doc.setTextColor(130, 130, 130);
      doc.text(`Norme applicable : ${mtConf.normeRef}`, PAGE_W / 2, y, { align: "center" });
      y += 8;
    } else {
      y += 5;
    }

    let pageNum = 1;

    // Sections
    for (const section of instance.sections_snapshot) {
      ensureSpace(25);

      // Section title
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(MARGIN_L, y, CONTENT_W, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(section.titre.toUpperCase(), MARGIN_L + 3, y + 5);
      y += 10;

      // Section content
      const content = section.contenu || "";
      if (content === "TABLEAU_ENTITE" || content === "TABLEAU_HONORAIRES" || content === "TABLEAU_REPARTITION") {
        // Special placeholder — skip (handled by wizard data)
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`[${content}]`, MARGIN_L + 3, y + 4);
        y += 8;
      } else {
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(content, CONTENT_W - 6);
        for (const line of lines) {
          ensureSpace(5);
          doc.text(line, MARGIN_L + 3, y + 3);
          y += 4;
        }
      }
      y += 6;
    }

    // CGV
    if (instance.cgv_snapshot) {
      doc.addPage();
      pageNum++;
      y = MARGIN_TOP;

      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(MARGIN_L, y, CONTENT_W, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("CONDITIONS GÉNÉRALES D'INTERVENTION", MARGIN_L + 3, y + 5);
      y += 12;

      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      const cgvLines = doc.splitTextToSize(instance.cgv_snapshot, CONTENT_W - 6);
      for (const line of cgvLines) {
        if (y + 4 > FOOTER_Y - 5) {
          addFooter(pageNum);
          doc.addPage();
          pageNum++;
          y = MARGIN_TOP;
        }
        doc.text(line, MARGIN_L + 3, y + 3);
        y += 3.5;
      }
    }

    // Signatures
    ensureSpace(40);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text("L'Expert-comptable", MARGIN_L + 10, y);
    doc.text("Le Client", MARGIN_L + CONTENT_W - 40, y);
    y += 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN_L + 5, y, MARGIN_L + 60, y);
    doc.line(MARGIN_L + CONTENT_W - 55, y, MARGIN_R - 5, y);

    // Add footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i);
    }

    const filename = `LDM_${instance.numero}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  } catch (err) {
    logger.error("PDF", "generatePdfFromInstance error", err);
    throw err;
  }
}
