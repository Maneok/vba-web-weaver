import mammoth from "mammoth";
import type { LMSection } from "./lettreMissionModeles";
import { GRIMY_DEFAULT_SECTIONS } from "./lettreMissionModeles";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

export interface ParsedDocxResult {
  sections: LMSection[];
  unmappedContent: string[];
  detectedCgv: string | null;
  confidence: number;
  warnings: string[];
}

// ══════════════════════════════════════════════
// Mots-clés de détection des sections
// ══════════════════════════════════════════════

const SECTION_KEYWORDS: Record<string, string[]> = {
  introduction: ["lettre de mission", "présentation des comptes"],
  entite: ["votre entité", "votre entreprise", "caractéristiques"],
  lcbft: [
    "lutte contre le blanchiment",
    "lcb-ft",
    "lcb",
    "vigilance",
    "blanchiment",
  ],
  mission: ["notre mission", "mission que vous", "code de déontologie"],
  duree: ["durée de la mission", "durée"],
  nature_limite: [
    "nature et limite",
    "nature de la mission",
    "obligation de moyens",
  ],
  mission_sociale: ["mission sociale", "bulletins de salaire", "paie"],
  mission_juridique: ["mission juridique", "secrétariat juridique"],
  mission_controle_fiscal: ["contrôle fiscal", "assistance au contrôle"],
  honoraires: ["honoraires", "rémunération", "facturation"],
  modalites: ["modalités relationnelles", "modalités"],
  repartition: ["répartition des travaux", "répartition des tâches"],
  cgv: ["conditions générales", "cgv", "conditions d'intervention"],
  mandat_sepa: ["mandat de prélèvement", "sepa"],
  mandat_fiscal: ["mandat fiscal", "autorisation de transmission"],
  signature: ["signature", "l'expert-comptable", "le client"],
};

// IDs des sections CNOEC obligatoires (from GRIMY_DEFAULT_SECTIONS)
const CNOEC_OBLIGATOIRE_IDS = new Set(
  GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire).map((s) => s.id)
);

// ══════════════════════════════════════════════
// A) Parse DOCX → HTML
// ══════════════════════════════════════════════

export async function parseDocxToHtml(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

// ══════════════════════════════════════════════
// B) Map HTML → Sections
// ══════════════════════════════════════════════

export async function mapHtmlToSections(
  html: string
): Promise<ParsedDocxResult> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = Array.from(doc.body.children);

  const rawBlocks: { title: string; content: string[] }[] = [];
  let currentBlock: { title: string; content: string[] } | null = null;

  for (const el of elements) {
    const isHeading =
      /^H[1-6]$/.test(el.tagName) || isBoldParagraph(el as HTMLElement);
    const text = (el.textContent ?? "").trim();

    if (!text) continue;

    if (isHeading && text.length < 200) {
      // New section detected
      if (currentBlock) rawBlocks.push(currentBlock);
      currentBlock = { title: text, content: [] };
    } else if (currentBlock) {
      currentBlock.content.push(cleanHtmlToText(el.outerHTML));
    } else {
      // Content before any heading — start an implicit block
      currentBlock = { title: "", content: [cleanHtmlToText(el.outerHTML)] };
    }
  }
  if (currentBlock) rawBlocks.push(currentBlock);

  // Map blocks to sections
  const sections: LMSection[] = [];
  const unmappedContent: string[] = [];
  let detectedCgv: string | null = null;
  const warnings: string[] = [];
  let recognizedCount = 0;
  let customCounter = 0;

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const contenu = block.content.join("\n\n").trim();
    const matchedId = matchSectionId(block.title, contenu);

    if (matchedId === "cgv") {
      detectedCgv = `${block.title}\n\n${contenu}`;
      recognizedCount++;
      continue;
    }

    if (matchedId) {
      recognizedCount++;
      const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === matchedId);
      sections.push({
        id: matchedId,
        titre: block.title || grimyRef?.titre || matchedId,
        contenu: contenu || grimyRef?.contenu || "",
        type: grimyRef?.type ?? "fixed",
        condition: grimyRef?.condition,
        editable: true,
        cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
        cnoec_reference: grimyRef?.cnoec_reference,
        cnoec_warning: grimyRef?.cnoec_warning,
        ordre: sections.length + 1,
      });
    } else if (contenu || block.title) {
      customCounter++;
      sections.push({
        id: `custom_${customCounter}`,
        titre: block.title || `Section importée ${customCounter}`,
        contenu,
        type: "conditional",
        editable: true,
        cnoec_obligatoire: false,
        ordre: sections.length + 1,
      });
      if (contenu) unmappedContent.push(contenu.slice(0, 200));
    }
  }

  // Check for missing CNOEC obligatory sections
  const parsedIds = new Set(sections.map((s) => s.id));
  for (const obligId of CNOEC_OBLIGATOIRE_IDS) {
    if (!parsedIds.has(obligId)) {
      const ref = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === obligId);
      warnings.push(
        `Section CNOEC obligatoire non détectée : « ${ref?.titre ?? obligId} » (${ref?.cnoec_reference ?? ""})`
      );
    }
  }

  const totalKnown = Object.keys(SECTION_KEYWORDS).length;
  const confidence = Math.round((recognizedCount / totalKnown) * 100);

  return { sections, unmappedContent, detectedCgv, confidence, warnings };
}

// ══════════════════════════════════════════════
// C) Clean HTML → texte brut
// ══════════════════════════════════════════════

export function cleanHtmlToText(html: string): string {
  let text = html;
  // Block-level breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  // List items
  text = text.replace(/<li[^>]*>/gi, "\n— ");
  text = text.replace(/<\/li>/gi, "");
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  // Normalize whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ══════════════════════════════════════════════
// D) Détecter les sections CNOEC manquantes
// ══════════════════════════════════════════════

export function detectMissingSections(parsed: ParsedDocxResult): string[] {
  const parsedIds = new Set(parsed.sections.map((s) => s.id));
  return [...CNOEC_OBLIGATOIRE_IDS].filter((id) => !parsedIds.has(id));
}

// ══════════════════════════════════════════════
// Helpers internes
// ══════════════════════════════════════════════

function isBoldParagraph(el: HTMLElement): boolean {
  if (el.tagName !== "P") return false;
  const strong = el.querySelector("strong, b");
  if (!strong) return false;
  // Consider it a heading if the bold text is >80% of the paragraph
  const boldLen = (strong.textContent ?? "").trim().length;
  const totalLen = (el.textContent ?? "").trim().length;
  return totalLen > 0 && totalLen < 200 && boldLen / totalLen > 0.8;
}

function matchSectionId(
  title: string,
  content: string
): string | null {
  const searchText = (title + " " + content.slice(0, 300)).toLowerCase();

  // Score each section by keyword matches, prefer title matches
  let bestId: string | null = null;
  let bestScore = 0;

  for (const [sectionId, keywords] of Object.entries(SECTION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (title.toLowerCase().includes(kwLower)) {
        score += 10; // Strong match in title
      } else if (searchText.includes(kwLower)) {
        score += 1; // Weak match in content
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = sectionId;
    }
  }

  // Require at least a title match (score >= 10) or multiple content matches
  return bestScore >= 2 ? bestId : null;
}

// ══════════════════════════════════════════════
// Export des constantes utiles pour le composant
// ══════════════════════════════════════════════

export const ALL_SECTION_IDS = Object.keys(SECTION_KEYWORDS);
