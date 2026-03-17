// ══════════════════════════════════════════════════════════════
// Import DOCX — Parser complet avec détection de sections
// OPT 1-25
// ══════════════════════════════════════════════════════════════

import type { LMSection } from "./lettreMissionModeles";
import { GRIMY_DEFAULT_SECTIONS } from "./lettreMissionModeles";
import { MISSION_TYPES } from "./lettreMissionTypes";
import type { MissionTypeConfig } from "./lettreMissionTypes";

// ══════════════════════════════════════════════
// Types (OPT-19)
// ══════════════════════════════════════════════

export interface ParsedSection {
  originalTitle: string;
  mappedId: string | null;
  content: string;
  confidence: number;
  isAutomaticMapping: boolean;
}

export interface RepartitionRow {
  label: string;
  cabinet: boolean;
  client: boolean;
  periodicite?: string;
}

export interface ParsedDocxResult {
  sections: LMSection[];
  parsedSections: ParsedSection[];
  unmappedContent: string[];
  detectedCgv: string | null;
  detectedRepartition: RepartitionRow[];
  confidence: number;
  warnings: string[];
  originalFilename: string;
}

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (OPT-18)

export const ALL_SECTION_IDS = GRIMY_DEFAULT_SECTIONS.map((s) => s.id);

const CNOEC_OBLIGATOIRE_IDS = new Set(
  GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire).map((s) => s.id)
);

// ══════════════════════════════════════════════
// Accent-insensitive normalisation (OPT-6)
// ══════════════════════════════════════════════

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ══════════════════════════════════════════════
// Mots-clés de détection — toutes sections (OPT-5)
// ══════════════════════════════════════════════

const SECTION_KEYWORDS: Record<string, string[]> = {
  introduction: [
    "lettre de mission",
    "presentation des comptes",
    "a l'attention",
    "confiance que vous nous avez",
    "article 151",
    "code de deontologie",
    "contrat entre les parties",
    "conditions generales d'intervention",
    "objet de la mission",
    "preambule",
  ],
  entite: [
    "votre entite",
    "votre entreprise",
    "votre societe",
    "caracteristiques",
    "identification de l'entite",
    "raison sociale",
    "forme juridique",
    "numero siren",
    "immatriculation rcs",
    "siege social",
  ],
  mission: [
    "notre mission",
    "mission que vous",
    "code de deontologie",
    "np 2300",
    "norme professionnelle",
    "attestation de presentation",
    "coherence et vraisemblance",
    "referentiel normatif",
  ],
  duree: [
    "duree de la mission",
    "duree de notre mission",
    "prendra effet",
    "date de signature",
    "exercice comptable",
    "tacitement reconduite",
    "reconduction tacite",
  ],
  nature_limite: [
    "nature et limite",
    "nature de la mission",
    "obligation de moyens",
    "par sondages",
    "actes illegaux",
    "controle exhaustif",
  ],
  responsable_mission: [
    "responsable de la mission",
    "responsable de mission",
    "expert-comptable inscrit",
    "expert comptable inscrit",
    "tableau de l'ordre",
    "signataire de la mission",
  ],
  referentiel_comptable: [
    "referentiel comptable",
    "plan comptable",
    "pcg",
    "reglement anc",
    "referentiel applicable",
  ],
  forme_rapport: [
    "forme du rapport",
    "attestation",
    "rapport emis",
    "rapport de l'expert",
  ],
  lcbft: [
    "lutte contre le blanchiment",
    "lcb-ft",
    "lcb ft",
    "lcbft",
    "lcb",
    "blanchiment de capitaux",
    "financement du terrorisme",
    "vigilance",
    "obligations de vigilance",
    "declaration de soupcon",
    "tracfin",
    "l.561",
  ],
  mission_sociale: [
    "mission sociale",
    "bulletins de salaire",
    "bulletins de paie",
    "paie",
    "social",
    "declarations sociales",
    "dsn",
    "charges sociales",
  ],
  mission_juridique: [
    "mission juridique",
    "secretariat juridique",
    "approbation des comptes",
    "assemblee generale",
    "proces-verbaux",
    "formalites juridiques",
  ],
  mission_controle_fiscal: [
    "controle fiscal",
    "assistance au controle",
    "verification fiscale",
    "examen de comptabilite",
    "garantie controle fiscal",
  ],
  honoraires: [
    "honoraires",
    "remuneration",
    "facturation",
    "tarification",
    "montant des honoraires",
    "revision des honoraires",
    "conditions financieres",
  ],
  modalites: [
    "modalites relationnelles",
    "modalites d'execution",
    "modalites",
    "relations contractuelles",
    "repartition des obligations",
  ],
  clause_resolutoire: [
    "clause resolutoire",
    "resolution de plein droit",
    "inexecution",
    "mise en demeure",
    "article 1225",
  ],
  mandat_fiscal: [
    "mandat fiscal",
    "autorisation de transmission",
    "teletransmission",
    "declarations fiscales",
    "liasse fiscale",
    "jedeclare",
    "administration fiscale",
  ],
  signature: [
    "signature",
    "l'expert-comptable",
    "l'expert comptable",
    "le client",
    "fait a",
    "bon pour accord",
    "lu et approuve",
    "sentiments devoues",
  ],
  organisation: [
    "organisation et transmission",
    "transmission des documents",
    "periodicite",
    "documents comptables",
    "delai de transmission",
    "modalites de transmission",
  ],
  destinataire: [
    "destinataire",
    "a l'attention de",
    "mandataire social",
    "coordonnees du client",
    "monsieur le gerant",
    "madame la gerante",
  ],
  annexe_repartition: [
    "repartition des travaux",
    "repartition des taches",
    "tableau de repartition",
    "obligations respectives",
    "qui fait quoi",
  ],
  annexe_travail_dissimule: [
    "travail dissimule",
    "attestation travail",
    "l.8222",
    "d.8222",
    "emploi regulier",
    "salaries etrangers",
  ],
  annexe_sepa: [
    "mandat de prelevement",
    "sepa",
    "prelevement sepa",
    "mandat sepa",
    "iban",
    "autorisation de prelevement",
    "coordonnees bancaires",
  ],
  annexe_liasse: [
    "liasse fiscale",
    "autorisation de transmission",
    "transmission de liasse",
    "jedeclare",
    "teletransmission liasse",
  ],
  objet_attestation: [
    "objet de l'attestation",
    "information attestee",
    "attestation particuliere",
  ],
  equipe_audit: [
    "equipe d'audit",
    "composition de l'equipe",
    "intervenants",
    "equipe d'intervention",
  ],
  planning_audit: [
    "planning d'intervention",
    "planning d'audit",
    "calendrier d'intervention",
    "phases d'audit",
  ],
  procedures_detail: [
    "procedures convenues",
    "procedures a mettre en oeuvre",
    "diligences convenues",
    "detail des procedures",
  ],
};

// CGV detection keywords
const CGV_KEYWORDS = [
  "conditions generales",
  "conditions d'intervention",
  "conditions particulieres",
  "cgv",
  "conditions generales d'intervention",
  "conditions generales de vente",
  "domaine d'application",
  "clause de responsabilite",
];

// Repartition table detection keywords
const REPARTITION_TABLE_KEYWORDS = [
  "cabinet",
  "client",
  "periodicite",
  "frequence",
  "saisie",
  "lettrage",
  "rapprochement",
  "tva",
  "bilan",
  "liasse",
];

// Multi-section title patterns (OPT-20)
const MULTI_SECTION_PATTERNS: { pattern: RegExp; sections: string[] }[] = [
  { pattern: /sociale?\s+et\s+juridique/i, sections: ["mission_sociale", "mission_juridique"] },
  { pattern: /nature\s+et\s+limite/i, sections: ["nature_limite"] },
  { pattern: /honoraires?\s+et\s+conditions/i, sections: ["honoraires"] },
];

// ══════════════════════════════════════════════
// A) Parse DOCX → HTML (OPT-3, 18, 24, 25)
// ══════════════════════════════════════════════

export async function parseDocxToHtml(file: File): Promise<string> {
  // OPT-18: File validation
  if (!file) {
    throw new Error("Aucun fichier fourni.");
  }
  if (file.size === 0) {
    throw new Error("Le fichier est vide. Veuillez sélectionner un fichier DOCX valide.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Le fichier est trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). La taille maximale est de 10 Mo.`);
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Le fichier n'est pas au format DOCX. Veuillez sélectionner un fichier .docx valide.");
  }

  try {
    // OPT-24: Dynamic import for performance
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.default.convertToHtml({ arrayBuffer });
    if (result.messages?.length > 0) {
      for (const msg of result.messages) {
        if (msg.type === "warning" || msg.type === "error") {
          console.error("[DOCX Import]", msg.type, msg.message); // OPT-25
        }
      }
    }
    return result.value;
  } catch (err) {
    console.error("[DOCX Import] Erreur de parsing:", err); // OPT-25
    throw new Error(
      "Impossible de lire le fichier DOCX. Vérifiez qu'il s'agit d'un fichier .docx valide."
    );
  }
}

// ══════════════════════════════════════════════
// B) Clean HTML → texte brut (OPT-11)
// ══════════════════════════════════════════════

export function cleanHtmlToText(html: string): string {
  let text = html;
  // Table rows → structured lines (OPT-15)
  text = text.replace(/<tr[^>]*>(.*?)<\/tr>/gis, (_, row) => {
    const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis) ?? [];
    const cellTexts = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
    return cellTexts.join(" | ") + "\n";
  });
  // Remove remaining table tags
  text = text.replace(/<\/?(?:table|thead|tbody|tfoot)[^>]*>/gi, "\n");
  // Block-level breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  // List items → dash bullet (OPT-11)
  text = text.replace(/<li[^>]*>/gi, "\n— ");
  text = text.replace(/<\/li>/gi, "");
  // Ordered list markers
  text = text.replace(/<\/?[ou]l[^>]*>/gi, "\n");
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "\u2019");
  text = text.replace(/&lsquo;/g, "\u2018");
  text = text.replace(/&rdquo;/g, "\u201D");
  text = text.replace(/&ldquo;/g, "\u201C");
  text = text.replace(/&ndash;/g, "\u2013");
  text = text.replace(/&mdash;/g, "\u2014");
  text = text.replace(/&hellip;/g, "\u2026");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#\d+;/g, "");
  // Normalize whitespace
  text = text.replace(/[ \t]+/g, " ");
  // Trim lines
  text = text
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
  // Max 2 consecutive newlines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ══════════════════════════════════════════════
// C) Map HTML → Sections (OPT-4 to OPT-10, 13-17, 20-21)
// ══════════════════════════════════════════════

export async function mapHtmlToSections(
  html: string,
  filename: string = "document.docx"
): Promise<ParsedDocxResult> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = Array.from(doc.body.children);

  // Parse into raw blocks (title + content paragraphs)
  const rawBlocks: { title: string; content: string[]; rawHtml: string[]; index: number }[] = [];
  let currentBlock: { title: string; content: string[]; rawHtml: string[]; index: number } | null = null;
  let blockIndex = 0;

  for (const el of elements) {
    const isHeading =
      /^H[1-6]$/.test(el.tagName) || isBoldParagraph(el as HTMLElement);
    const text = (el.textContent ?? "").trim();

    if (!text) continue;

    // OPT-7: Also check first words of paragraph for section detection
    const isLikelySectionStart = !isHeading && text.length < 200 && matchSectionByFirstWords(text);

    if ((isHeading || isLikelySectionStart) && text.length < 200) {
      if (currentBlock) rawBlocks.push(currentBlock);
      currentBlock = { title: text, content: [], rawHtml: [], index: blockIndex++ };
    } else if (currentBlock) {
      currentBlock.content.push(cleanHtmlToText(el.outerHTML));
      currentBlock.rawHtml.push(el.outerHTML);
    } else {
      currentBlock = {
        title: "",
        content: [cleanHtmlToText(el.outerHTML)],
        rawHtml: [el.outerHTML],
        index: blockIndex++,
      };
    }
  }
  if (currentBlock) rawBlocks.push(currentBlock);

  // OPT-14: If no structure at all, create a single section
  if (rawBlocks.length === 0) {
    const fullText = cleanHtmlToText(html);
    if (!fullText.trim()) {
      console.error("[DOCX Import] Le document est vide après parsing."); // OPT-25
      return {
        sections: [],
        parsedSections: [],
        unmappedContent: [],
        detectedCgv: null,
        detectedRepartition: [],
        confidence: 0,
        warnings: ["Le document est vide."],
        originalFilename: filename,
      };
    }
    return {
      sections: [{
        id: "contenu_complet",
        titre: "Contenu importé",
        contenu: fullText,
        type: "conditional",
        editable: true,
        cnoec_obligatoire: false,
        ordre: 1,
      }],
      parsedSections: [{
        originalTitle: "(sans titre)",
        mappedId: null,
        content: fullText.slice(0, 500),
        confidence: 0,
        isAutomaticMapping: false,
      }],
      unmappedContent: [fullText.slice(0, 300)],
      detectedCgv: null,
      detectedRepartition: [],
      confidence: 0,
      warnings: ["Aucune structure détectée. Le contenu a été importé comme une seule section."],
      originalFilename: filename,
    };
  }

  // Map blocks to sections
  const sections: LMSection[] = [];
  const parsedSections: ParsedSection[] = [];
  const unmappedContent: string[] = [];
  let detectedCgv: string | null = null;
  const detectedRepartition: RepartitionRow[] = [];
  const warnings: string[] = [];
  let recognizedCount = 0;
  let customCounter = 0;
  const usedSectionIds = new Set<string>();
  const totalBlocks = rawBlocks.length;

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const contenu = block.content.join("\n\n").trim();

    // OPT-16: CGV detection — everything after CGV title goes into CGV
    if (isCgvBlock(block.title, contenu)) {
      const cgvParts = [`${block.title}\n\n${contenu}`];
      for (let j = i + 1; j < rawBlocks.length; j++) {
        const nextBlock = rawBlocks[j];
        if (nextBlock.title && isH1LevelTitle(nextBlock.title)) break;
        cgvParts.push(`${nextBlock.title}\n\n${nextBlock.content.join("\n\n")}`.trim());
        i = j;
      }
      detectedCgv = cgvParts.join("\n\n").trim();
      recognizedCount++;
      parsedSections.push({
        originalTitle: block.title,
        mappedId: "cgv",
        content: detectedCgv.slice(0, 500),
        confidence: 100,
        isAutomaticMapping: true,
      });
      continue;
    }

    // OPT-17: Repartition table detection and parsing
    const rawHtmlStr = block.rawHtml.join("");
    if (detectRepartitionTable(rawHtmlStr)) {
      const rows = parseRepartitionTable(rawHtmlStr);
      if (rows.length > 0) {
        detectedRepartition.push(...rows);
        recognizedCount++;
        if (!usedSectionIds.has("annexe_repartition")) {
          usedSectionIds.add("annexe_repartition");
          const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === "annexe_repartition");
          sections.push({
            id: "annexe_repartition",
            titre: block.title || grimyRef?.titre || "Répartition des travaux",
            contenu: contenu || grimyRef?.contenu || "",
            type: grimyRef?.type ?? "fixed",
            editable: true,
            cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
            cnoec_reference: grimyRef?.cnoec_reference,
            cnoec_warning: grimyRef?.cnoec_warning,
            ordre: sections.length + 1,
          });
          parsedSections.push({
            originalTitle: block.title,
            mappedId: "annexe_repartition",
            content: contenu.slice(0, 300),
            confidence: 80,
            isAutomaticMapping: true,
          });
        }
        continue;
      }
    }

    // OPT-20: Check for multi-section titles
    const multiMatch = checkMultiSectionTitle(block.title);
    if (multiMatch && multiMatch.length > 1) {
      const contentParts = splitContentForMultiSection(contenu, multiMatch.length);
      for (let k = 0; k < multiMatch.length; k++) {
        const secId = multiMatch[k];
        if (usedSectionIds.has(secId)) continue;
        usedSectionIds.add(secId);
        recognizedCount++;
        const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === secId);
        sections.push({
          id: secId,
          titre: grimyRef?.titre || secId,
          contenu: contentParts[k] || grimyRef?.contenu || "",
          type: grimyRef?.type ?? "fixed",
          editable: true,
          cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
          cnoec_reference: grimyRef?.cnoec_reference,
          cnoec_warning: grimyRef?.cnoec_warning,
          ordre: sections.length + 1,
        });
        parsedSections.push({
          originalTitle: block.title,
          mappedId: secId,
          content: (contentParts[k] || "").slice(0, 300),
          confidence: 60,
          isAutomaticMapping: true,
        });
      }
      continue;
    }

    // Standard section matching (OPT-8)
    const matchResult = matchSectionId(block.title, contenu, usedSectionIds);

    if (matchResult) {
      usedSectionIds.add(matchResult.id);
      recognizedCount++;
      const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === matchResult.id);
      sections.push({
        id: matchResult.id,
        titre: block.title || grimyRef?.titre || matchResult.id,
        contenu: contenu || grimyRef?.contenu || "",
        type: grimyRef?.type ?? "fixed",
        condition: grimyRef?.condition,
        editable: true,
        cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
        cnoec_reference: grimyRef?.cnoec_reference,
        cnoec_warning: grimyRef?.cnoec_warning,
        ordre: sections.length + 1,
      });
      parsedSections.push({
        originalTitle: block.title,
        mappedId: matchResult.id,
        content: contenu.slice(0, 300),
        confidence: matchResult.score,
        isAutomaticMapping: true,
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
      if (contenu) unmappedContent.push(contenu.slice(0, 300));
      parsedSections.push({
        originalTitle: block.title || `Section ${customCounter}`,
        mappedId: null,
        content: contenu.slice(0, 300),
        confidence: 0,
        isAutomaticMapping: false,
      });
    }
  }

  // OPT-21: Flat fallback if no sections matched
  if (recognizedCount === 0 && sections.length > 0) {
    warnings.push(
      "Aucune section n'a pu être associée automatiquement au modèle GRIMY. " +
      "Les paragraphes ont été importés comme sections personnalisées."
    );
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

  // OPT-9: Confidence = recognized / total blocks × 100
  const confidence = totalBlocks > 0
    ? Math.round((recognizedCount / totalBlocks) * 100)
    : 0;

  return {
    sections,
    parsedSections,
    unmappedContent,
    detectedCgv,
    detectedRepartition,
    confidence,
    warnings,
    originalFilename: filename,
  };
}

// ══════════════════════════════════════════════
// D) Détecter les sections manquantes (OPT-12)
// ══════════════════════════════════════════════

export function detectMissingSections(
  parsed: ParsedDocxResult,
  missionTypeId?: string
): string[] {
  const parsedIds = new Set(parsed.sections.map((s) => s.id));

  if (missionTypeId) {
    const mtConfig = (MISSION_TYPES as Record<string, MissionTypeConfig>)[missionTypeId];
    if (mtConfig) {
      return mtConfig.requiredSections.filter((id) => !parsedIds.has(id));
    }
  }

  return [...CNOEC_OBLIGATOIRE_IDS].filter((id) => !parsedIds.has(id));
}

// ══════════════════════════════════════════════
// E) Auto-fill empty sections from GRIMY defaults
// ══════════════════════════════════════════════

export function autoFillFromGrimy(sections: LMSection[]): LMSection[] {
  const existingIds = new Set(sections.map((s) => s.id));
  const result = [...sections];

  for (const defaultSection of GRIMY_DEFAULT_SECTIONS) {
    if (!existingIds.has(defaultSection.id)) {
      result.push({ ...defaultSection, ordre: result.length + 1 });
    }
  }

  return result.map((section) => {
    if (section.contenu && section.contenu.trim().length > 0) return section;
    const ref = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === section.id);
    if (ref) {
      return { ...section, contenu: ref.contenu };
    }
    return section;
  });
}

// ══════════════════════════════════════════════
// Helpers internes
// ══════════════════════════════════════════════

function isBoldParagraph(el: HTMLElement): boolean {
  if (el.tagName !== "P") return false;
  const strong = el.querySelector("strong, b");
  if (!strong) return false;
  const boldLen = (strong.textContent ?? "").trim().length;
  const totalLen = (el.textContent ?? "").trim().length;
  return totalLen > 0 && totalLen < 200 && boldLen / totalLen > 0.8;
}

/** OPT-7: Check if first words of a paragraph match a section keyword */
function matchSectionByFirstWords(text: string): boolean {
  const firstWords = normalizeText(text.slice(0, 80));
  for (const keywords of Object.values(SECTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (firstWords.startsWith(normalizeText(kw))) return true;
    }
  }
  return false;
}

/** Check if title appears to be a top-level (H1) heading */
function isH1LevelTitle(title: string): boolean {
  const norm = normalizeText(title);
  return (
    norm.startsWith("conditions generales") ||
    norm.startsWith("annexe") ||
    norm.startsWith("table des matieres")
  );
}

/** Détecte si un bloc correspond aux CGV (OPT-16) */
function isCgvBlock(title: string, content: string): boolean {
  const normalizedTitle = normalizeText(title);
  const normalizedContent = normalizeText(content.slice(0, 600));
  const combined = normalizedTitle + " " + normalizedContent;

  let score = 0;
  for (const kw of CGV_KEYWORDS) {
    const kwNorm = normalizeText(kw);
    if (normalizedTitle.includes(kwNorm)) {
      score += 10;
    } else if (combined.includes(kwNorm)) {
      score += 2;
    }
  }

  const articlePattern = /\b\d+\.\s+(domaine|definition|resiliation|suspension|obligation|honoraire|responsabilite|donnees|differend|conservation)/;
  if (articlePattern.test(normalizeText(content.slice(0, 1500)))) {
    score += 5;
  }

  return score >= 10;
}

/** Détecte si le HTML contient un tableau de répartition des tâches */
function detectRepartitionTable(html: string): boolean {
  if (!/<table/i.test(html)) return false;
  const normalized = normalizeText(html);
  let hits = 0;
  for (const kw of REPARTITION_TABLE_KEYWORDS) {
    if (normalized.includes(normalizeText(kw))) hits++;
  }
  return hits >= 3;
}

/** OPT-17: Parse a repartition table HTML into RepartitionRow[] */
function parseRepartitionTable(html: string): RepartitionRow[] {
  const rows: RepartitionRow[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tableRows = doc.querySelectorAll("tr");

    let headerSkipped = false;
    for (const tr of tableRows) {
      const cells = tr.querySelectorAll("td, th");
      if (cells.length < 3) continue;

      if (!headerSkipped) {
        const firstCellText = normalizeText(cells[0].textContent ?? "");
        if (firstCellText.includes("tache") || firstCellText.includes("designation") || firstCellText.includes("description")) {
          headerSkipped = true;
          continue;
        }
        headerSkipped = true;
      }

      const label = (cells[0].textContent ?? "").trim();
      if (!label) continue;

      const cabinetText = normalizeText(cells[1].textContent ?? "");
      const clientText = normalizeText(cells[2].textContent ?? "");
      const cabinet = cabinetText === "x" || cabinetText === "oui" || cabinetText === "✓" || cabinetText === "✔";
      const client = clientText === "x" || clientText === "oui" || clientText === "✓" || clientText === "✔";

      const periodicite = cells.length >= 4 ? (cells[3].textContent ?? "").trim() : undefined;

      rows.push({ label, cabinet, client, periodicite: periodicite || undefined });
    }
  } catch (err) {
    console.error("[DOCX Import] Erreur parsing tableau répartition:", err); // OPT-25
  }
  return rows;
}

/** OPT-20: Check if a title matches multiple sections */
function checkMultiSectionTitle(title: string): string[] | null {
  if (!title) return null;
  const norm = normalizeText(title);
  for (const mp of MULTI_SECTION_PATTERNS) {
    if (mp.pattern.test(norm) && mp.sections.length > 1) {
      return mp.sections;
    }
  }
  return null;
}

/** Split content roughly for multi-section titles */
function splitContentForMultiSection(content: string, parts: number): string[] {
  if (!content || parts <= 1) return [content];
  const paragraphs = content.split("\n\n");
  const perPart = Math.ceil(paragraphs.length / parts);
  const result: string[] = [];
  for (let i = 0; i < parts; i++) {
    result.push(paragraphs.slice(i * perPart, (i + 1) * perPart).join("\n\n"));
  }
  return result;
}

/**
 * Match a block to a known section ID using accent-insensitive keyword scoring.
 * Returns { id, score } or null. (OPT-8)
 */
function matchSectionId(
  title: string,
  content: string,
  usedIds: Set<string>
): { id: string; score: number } | null {
  const normalizedTitle = normalizeText(title);
  const searchText = normalizedTitle + " " + normalizeText(content.slice(0, 600));

  let bestId: string | null = null;
  let bestScore = 0;

  for (const [sectionId, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (usedIds.has(sectionId)) continue;

    let score = 0;
    for (const kw of keywords) {
      const kwNorm = normalizeText(kw);
      if (normalizedTitle.includes(kwNorm)) {
        score += 10;
      } else if (searchText.includes(kwNorm)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = sectionId;
    }
  }

  if (bestScore >= 10 && bestId) return { id: bestId, score: Math.min(bestScore, 100) };
  if (bestScore >= 2 && bestId) return { id: bestId, score: Math.min(bestScore * 5, 80) };
  return null;
}

// ══════════════════════════════════════════════
// Tests inline (commentés) — OPT-23
// ══════════════════════════════════════════════

/*
// Test 1: DOCX avec 5 sections connues
// const html5 = '<h1>Notre mission</h1><p>Texte mission</p><h1>Honoraires</h1><p>1000€</p><h1>LCB-FT</h1><p>Vigilance</p><h1>Durée</h1><p>1 an</p><h1>Signature</h1><p>Lu et approuvé</p>';
// const result5 = await mapHtmlToSections(html5, "test.docx");
// assert(result5.sections.length === 5);
// assert(result5.sections.some(s => s.id === "mission"));
// assert(result5.sections.some(s => s.id === "honoraires"));
// assert(result5.confidence > 80);

// Test 2: DOCX vide
// const htmlEmpty = '';
// const resultEmpty = await mapHtmlToSections(htmlEmpty, "vide.docx");
// assert(resultEmpty.sections.length === 0);
// assert(resultEmpty.confidence === 0);
// assert(resultEmpty.warnings.includes("Le document est vide."));

// Test 3: DOCX sans structure (texte brut)
// const htmlFlat = '<p>Ceci est un long texte sans aucun titre ni structure de section.</p>';
// const resultFlat = await mapHtmlToSections(htmlFlat, "plat.docx");
// assert(resultFlat.sections.length === 1);
// assert(resultFlat.sections[0].id === "contenu_complet");
// assert(resultFlat.warnings.some(w => w.includes("Aucune structure")));

// Test 4: cleanHtmlToText
// assert(cleanHtmlToText('<p>Hello</p><p>World</p>') === 'Hello\nWorld');
// assert(cleanHtmlToText('<ul><li>A</li><li>B</li></ul>') === '— A\n— B');
// assert(cleanHtmlToText('<table><tr><td>A</td><td>B</td></tr></table>') === 'A | B');

// Test 5: detectMissingSections avec missionTypeId
// const parsed = { sections: [{ id: "introduction" }, { id: "mission" }] };
// const missing = detectMissingSections(parsed as any, "audit_contractuel");
// assert(missing.includes("equipe_audit"));
// assert(missing.includes("planning_audit"));
*/
