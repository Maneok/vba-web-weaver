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
// ALL section IDs — derived from GRIMY defaults
// ══════════════════════════════════════════════

export const ALL_SECTION_IDS = GRIMY_DEFAULT_SECTIONS.map((s) => s.id);

// ══════════════════════════════════════════════
// Accent-insensitive normalisation
// ══════════════════════════════════════════════

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ══════════════════════════════════════════════
// Mots-clés de détection — 22 sections GRIMY
// ══════════════════════════════════════════════

const SECTION_KEYWORDS: Record<string, string[]> = {
  destinataire: [
    "destinataire",
    "a l'attention de",
    "mandataire social",
    "adresse du client",
    "coordonnees du client",
    "identification du client",
    "monsieur le gerant",
    "madame la gerante",
    "cher client",
  ],
  introduction: [
    "lettre de mission",
    "presentation des comptes",
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
    "caracteristiques de l'entite",
    "identification de l'entite",
    "raison sociale",
    "forme juridique",
    "numero siren",
    "immatriculation rcs",
    "siege social",
  ],
  organisation: [
    "organisation et transmission",
    "transmission des documents",
    "periodicite",
    "documents comptables",
    "delai de transmission",
    "outil de transmission",
    "conservation lcb",
    "duree de conservation",
    "modalites de transmission",
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
    "plan comptable general",
    "obligation de cooperation",
  ],
  responsable_mission: [
    "responsable de la mission",
    "responsable de mission",
    "expert-comptable inscrit",
    "expert comptable inscrit",
    "tableau de l'ordre",
    "concours personnel",
    "garantit la bonne realisation",
    "signataire de la mission",
  ],
  duree: [
    "duree de la mission",
    "duree de notre mission",
    "prendra effet",
    "date de signature",
    "exercice comptable",
    "tacitement reconduite",
    "reconduction tacite",
    "exercices futurs",
    "date de cloture",
  ],
  nature_limite: [
    "nature et limite",
    "nature de la mission",
    "limite de la mission",
    "obligation de moyens",
    "par sondages",
    "actes illegaux",
    "irregularites",
    "verification des ecritures",
    "controle exhaustif",
  ],
  lcbft: [
    "lutte contre le blanchiment",
    "lcb-ft",
    "lcb ft",
    "lcbft",
    "blanchiment de capitaux",
    "financement du terrorisme",
    "vigilance",
    "obligations de vigilance",
    "declaration de soupcon",
    "tracfin",
    "l.561",
    "art. l.561",
  ],
  missions_complementaires_intro: [
    "missions complementaires",
    "prestations complementaires",
    "en complement",
    "prestations suivantes",
    "missions accessoires",
    "missions additionnelles",
    "vous avez souhaite",
  ],
  mission_sociale: [
    "mission sociale",
    "bulletins de salaire",
    "bulletins de paie",
    "paie",
    "declarations sociales",
    "dsn",
    "journal des salaires",
    "gestion de la paie",
    "charges sociales",
    "traitement de la paie",
  ],
  mission_juridique: [
    "mission juridique",
    "secretariat juridique",
    "approbation des comptes",
    "assemblee generale",
    "proces-verbaux",
    "actes juridiques",
    "formalites juridiques",
    "greffe",
    "statuts",
  ],
  mission_controle_fiscal: [
    "controle fiscal",
    "assistance au controle",
    "verification fiscale",
    "examen de comptabilite",
    "garantie controle fiscal",
    "risque fiscal",
    "mutualiser le risque",
    "procedure de controle",
  ],
  clause_resolutoire: [
    "clause resolutoire",
    "resolution de plein droit",
    "inexecution",
    "mise en demeure",
    "article 1225",
    "resiliation pour manquement",
    "infructueuse pendant",
    "trente jours",
  ],
  mandat_fiscal: [
    "mandat fiscal",
    "mandat pour agir",
    "autorisation de transmission",
    "teletransmission",
    "declarations fiscales",
    "jedeclare",
    "je declare",
    "services des impots",
    "administration fiscale",
    "mandat aupres des administrations",
  ],
  modalites: [
    "modalites relationnelles",
    "modalites d'execution",
    "relations contractuelles",
    "cadre relationnel",
    "conditions relationnelles",
    "repartition des obligations",
    "termes de cette lettre",
  ],
  honoraires: [
    "honoraires",
    "remuneration",
    "facturation",
    "tarification",
    "montant des honoraires",
    "revision des honoraires",
    "indice des prix",
    "conditions financieres",
    "budget previsionnel",
    "echeancier",
  ],
  signature: [
    "signature",
    "l'expert-comptable",
    "l'expert comptable",
    "le client",
    "fait a",
    "bon pour accord",
    "lu et approuve",
    "retourner un exemplaire",
    "paraphe",
    "sentiments devoues",
  ],
  annexe_repartition: [
    "repartition des travaux",
    "repartition des taches",
    "tableau de repartition",
    "annexe repartition",
    "obligations respectives",
    "incombe au cabinet",
    "incombe au client",
    "qui fait quoi",
  ],
  annexe_travail_dissimule: [
    "travail dissimule",
    "attestation travail",
    "l.8222",
    "d.8222",
    "r.8222",
    "atteste sur l'honneur",
    "emploi regulier",
    "salaries etrangers",
    "code du travail",
  ],
  annexe_sepa: [
    "mandat de prelevement",
    "sepa",
    "prelevement sepa",
    "mandat sepa",
    "iban",
    "debit de votre compte",
    "autorisation de prelevement",
    "coordonnees bancaires",
    "formulaire de mandat",
  ],
  annexe_liasse: [
    "liasse fiscale",
    "autorisation de transmission",
    "transmission de liasse",
    "jedeclare",
    "je declare",
    "teletransmission liasse",
    "annexe liasse",
    "portail jedeclare",
  ],
};

// CGV detection keywords (separate from section matching)
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

// IDs des sections CNOEC obligatoires
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

  const rawBlocks: { title: string; content: string[]; rawHtml: string[] }[] = [];
  let currentBlock: { title: string; content: string[]; rawHtml: string[] } | null = null;

  for (const el of elements) {
    const isHeading =
      /^H[1-6]$/.test(el.tagName) || isBoldParagraph(el as HTMLElement);
    const text = (el.textContent ?? "").trim();

    if (!text) continue;

    if (isHeading && text.length < 200) {
      if (currentBlock) rawBlocks.push(currentBlock);
      currentBlock = { title: text, content: [], rawHtml: [] };
    } else if (currentBlock) {
      currentBlock.content.push(cleanHtmlToText(el.outerHTML));
      currentBlock.rawHtml.push(el.outerHTML);
    } else {
      currentBlock = {
        title: "",
        content: [cleanHtmlToText(el.outerHTML)],
        rawHtml: [el.outerHTML],
      };
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
  const usedSectionIds = new Set<string>();

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const contenu = block.content.join("\n\n").trim();

    // CGV detection (check before section matching)
    if (isCgvBlock(block.title, contenu)) {
      detectedCgv = `${block.title}\n\n${contenu}`;
      recognizedCount++;
      continue;
    }

    // Repartition table detection
    const isRepartitionTable = detectRepartitionTable(block.rawHtml.join(""));

    const matchedId = matchSectionId(block.title, contenu, usedSectionIds);

    // Override with repartition if table detected
    const finalId =
      isRepartitionTable && !usedSectionIds.has("annexe_repartition")
        ? "annexe_repartition"
        : matchedId;

    if (finalId) {
      usedSectionIds.add(finalId);
      recognizedCount++;
      const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === finalId);
      sections.push({
        id: finalId,
        titre: block.title || grimyRef?.titre || finalId,
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
      if (contenu) unmappedContent.push(contenu.slice(0, 300));
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

  // Confidence = ratio of detected CNOEC obligatory sections
  const cnoecTotal = CNOEC_OBLIGATOIRE_IDS.size;
  const cnoecFound = [...CNOEC_OBLIGATOIRE_IDS].filter((id) =>
    parsedIds.has(id)
  ).length;
  const confidence = cnoecTotal > 0 ? Math.round((cnoecFound / cnoecTotal) * 100) : 0;

  return { sections, unmappedContent, detectedCgv, confidence, warnings };
}

// ══════════════════════════════════════════════
// C) Clean HTML → texte brut
// ══════════════════════════════════════════════

export function cleanHtmlToText(html: string): string {
  let text = html;
  // Table rows → structured lines
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
  // List items → bullet
  text = text.replace(/<li[^>]*>/gi, "\n▪ ");
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
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, "\u201D");
  text = text.replace(/&ldquo;/g, "\u201C");
  text = text.replace(/&ndash;/g, "\u2013");
  text = text.replace(/&mdash;/g, "\u2014");
  text = text.replace(/&hellip;/g, "\u2026");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#\d+;/g, "");
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

  // Also fill empty content for existing sections
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

/**
 * Détecte si un bloc correspond aux CGV
 */
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

  // Also detect by structure: numbered articles typical of CGV
  const articlePattern = /\b\d+\.\s+(domaine|definition|resiliation|suspension|obligation|honoraire|responsabilite|donnees|differend|conservation)/;
  if (articlePattern.test(normalizeText(content.slice(0, 1500)))) {
    score += 5;
  }

  return score >= 10;
}

/**
 * Détecte si le HTML contient un tableau de répartition des tâches
 */
function detectRepartitionTable(html: string): boolean {
  if (!/<table/i.test(html)) return false;
  const normalized = normalizeText(html);
  let hits = 0;
  for (const kw of REPARTITION_TABLE_KEYWORDS) {
    if (normalized.includes(normalizeText(kw))) hits++;
  }
  // Need at least 3 repartition-related keywords in a table
  return hits >= 3;
}

/**
 * Match a block to a known section ID using accent-insensitive keyword scoring.
 * Prevents duplicate assignments via usedIds set.
 * Thresholds: >= 1 for title match, >= 2 for content-only match.
 */
function matchSectionId(
  title: string,
  content: string,
  usedIds: Set<string>
): string | null {
  const normalizedTitle = normalizeText(title);
  // Search window: title + first 600 chars of content
  const searchText = normalizedTitle + " " + normalizeText(content.slice(0, 600));

  let bestId: string | null = null;
  let bestScore = 0;

  for (const [sectionId, keywords] of Object.entries(SECTION_KEYWORDS)) {
    // Skip already-assigned sections
    if (usedIds.has(sectionId)) continue;

    let score = 0;
    for (const kw of keywords) {
      const kwNorm = normalizeText(kw);
      if (normalizedTitle.includes(kwNorm)) {
        score += 10; // Strong match in title
      } else if (searchText.includes(kwNorm)) {
        score += 1; // Weak match in content
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = sectionId;
    }
  }

  // Threshold: title match (>= 10 means at least 1 keyword in title)
  // or at least 2 content-only keyword matches
  if (bestScore >= 10) return bestId; // title match
  if (bestScore >= 2) return bestId;  // content-only matches
  return null;
}
