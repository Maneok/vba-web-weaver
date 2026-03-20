// ══════════════════════════════════════════════════════════════
// Import DOCX — Parser complet avec détection de sections
// + Mapping publipostage Word → GRIMY
// ══════════════════════════════════════════════════════════════

import type { LMSection } from "./lettreMissionModeles";
import { GRIMY_DEFAULT_SECTIONS } from "./lettreMissionModeles";
import { MISSION_TYPES } from "./lettreMissionTypes";
import type { MissionTypeConfig } from "./lettreMissionTypes";

// ══════════════════════════════════════════════
// Types
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

export interface DetectedVariable {
  original: string;
  mapped: string | null;
  format: string;
  count: number;
  category: 'client' | 'cabinet' | 'mission' | 'dates' | 'divers';
}

export interface DocxMetadata {
  totalWords: number;
  totalParagraphs: number;
  hasTableau: boolean;
  hasImages: boolean;
  language: 'fr' | 'en' | 'unknown';
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
  detectedVars: DetectedVariable[];
  mappedVarsCount: number;
  duplicateVarWarnings: string[];
  metadata: DocxMetadata;
}

// ══════════════════════════════════════════════
// A1) PUBLIPOSTAGE_TO_GRIMY mapping
// ══════════════════════════════════════════════

export const PUBLIPOSTAGE_TO_GRIMY: Record<string, string> = {
  // Client
  'NomClient': 'raison_sociale', 'Nom_Client': 'raison_sociale', 'RaisonSociale': 'raison_sociale',
  'Raison_Sociale': 'raison_sociale', 'RAISON_SOCIALE': 'raison_sociale', 'Société': 'raison_sociale',
  'Societe': 'raison_sociale', 'NomSociete': 'raison_sociale', 'Client': 'raison_sociale',
  'SIREN': 'siren', 'Siren': 'siren', 'N_SIREN': 'siren', 'NumSiren': 'siren', 'SIRET': 'siren',
  'Dirigeant': 'dirigeant', 'NomDirigeant': 'dirigeant', 'Gérant': 'dirigeant', 'Gerant': 'dirigeant',
  'Président': 'dirigeant', 'President': 'dirigeant', 'RepresentantLegal': 'dirigeant', 'Mandataire': 'dirigeant',
  'FormeJuridique': 'forme_juridique', 'Forme_Juridique': 'forme_juridique', 'StatutJuridique': 'forme_juridique',
  'Adresse': 'adresse', 'AdresseClient': 'adresse', 'Rue': 'adresse', 'Adresse1': 'adresse',
  'CodePostal': 'cp', 'Code_Postal': 'cp', 'CP': 'cp',
  'Ville': 'ville', 'VilleClient': 'ville',
  'Capital': 'capital', 'CapitalSocial': 'capital', 'Capital_Social': 'capital',
  'APE': 'ape', 'CodeAPE': 'ape', 'NAF': 'ape', 'CodeNAF': 'ape',
  'Email': 'email', 'EmailClient': 'email', 'Mail': 'email', 'Courriel': 'email',
  'Telephone': 'telephone', 'Tel': 'telephone', 'TelClient': 'telephone',
  'Effectif': 'effectif', 'NbSalaries': 'effectif',
  // Honoraires
  'Honoraires': 'honoraires', 'HonorairesHT': 'honoraires', 'Honoraires_HT': 'honoraires',
  'Hono': 'honoraires', 'MontantHT': 'honoraires', 'ForfaitAnnuel': 'honoraires',
  'Setup': 'setup', 'FraisSetup': 'setup', 'ConstitutionDossier': 'setup', 'Frais_Dossier': 'setup',
  'Frequence': 'frequence', 'FrequenceFacturation': 'frequence_facturation', 'Periodicite': 'frequence',
  // Cabinet
  'NomCabinet': 'nom_cabinet', 'Cabinet': 'nom_cabinet',
  'ExpertComptable': 'associe', 'Expert_Comptable': 'associe', 'Associe': 'associe', 'Associé': 'associe',
  'Signataire': 'associe_signataire',
  // Dates
  'Date': 'date_du_jour', 'DateDuJour': 'date_du_jour', 'Date_du_Jour': 'date_du_jour',
  'DateSignature': 'date_signature', 'DateCloture': 'date_cloture', 'Date_Cloture': 'date_cloture',
  'DebutExercice': 'exercice_debut', 'FinExercice': 'exercice_fin',
  // Divers
  'IBAN': 'iban', 'BIC': 'bic', 'Banque': 'banque',
  'RegimeFiscal': 'regime_fiscal', 'TVA': 'tva', 'RegimeTVA': 'regime_tva',
  'ResponsableMission': 'responsable_mission', 'ChefMission': 'chef_mission',
  'QualiteDirigeant': 'qualite_dirigeant', 'Qualite_Dirigeant': 'qualite_dirigeant',
  'NumeroOEC': 'numero_oec', 'CROEC': 'croec',
};

// OPT-16: Abbreviation mapping
const ABBREVIATION_MAP: Record<string, string> = {
  'rs': 'raison_sociale', 'fj': 'forme_juridique', 'hono': 'honoraires',
  'ec': 'associe', 'cp': 'cp', 'tel': 'telephone',
};

// OPT-19: Category mapping for GRIMY variables
const VAR_CATEGORIES: Record<string, DetectedVariable['category']> = {
  raison_sociale: 'client', siren: 'client', dirigeant: 'client', forme_juridique: 'client',
  adresse: 'client', cp: 'client', ville: 'client', capital: 'client', ape: 'client',
  email: 'client', telephone: 'client', effectif: 'client', qualite_dirigeant: 'client',
  nom_cabinet: 'cabinet', associe: 'cabinet', associe_signataire: 'cabinet',
  numero_oec: 'cabinet', croec: 'cabinet',
  honoraires: 'mission', setup: 'mission', frequence: 'mission', frequence_facturation: 'mission',
  responsable_mission: 'mission', chef_mission: 'mission', regime_fiscal: 'mission',
  tva: 'mission', regime_tva: 'mission',
  date_du_jour: 'dates', date_signature: 'dates', date_cloture: 'dates',
  exercice_debut: 'dates', exercice_fin: 'dates',
  iban: 'divers', bic: 'divers', banque: 'divers',
};

// ══════════════════════════════════════════════
// A2) Publipostage variable detection
// ══════════════════════════════════════════════

// OPT-25: Normalize non-breaking spaces
function normalizeSpaces(text: string): string {
  return text.replace(/[\u00A0\u2007\u202F]/g, ' ');
}

function findGrimyMapping(varName: string): string | null {
  // Direct match
  if (PUBLIPOSTAGE_TO_GRIMY[varName]) return PUBLIPOSTAGE_TO_GRIMY[varName];
  // Case-insensitive match
  const lower = varName.toLowerCase();
  for (const [key, value] of Object.entries(PUBLIPOSTAGE_TO_GRIMY)) {
    if (key.toLowerCase() === lower) return value;
  }
  // OPT-25: Normalized match (strip separators)
  const normalized = varName.replace(/[_\-\s]/g, '').toLowerCase();
  for (const [key, value] of Object.entries(PUBLIPOSTAGE_TO_GRIMY)) {
    if (key.replace(/[_\-\s]/g, '').toLowerCase() === normalized) return value;
  }
  // OPT-16: Abbreviation match
  if (ABBREVIATION_MAP[lower]) return ABBREVIATION_MAP[lower];
  // Already a GRIMY variable name?
  const grimyVars = new Set(Object.values(PUBLIPOSTAGE_TO_GRIMY));
  if (grimyVars.has(lower)) return lower;
  return null;
}

// OPT-21: Patterns to ignore (page numbers, confidential notices)
const IGNORE_PATTERNS = [
  /^page\s+\d+\s*[/\\]\s*\d+$/i,
  /^document\s+confidentiel$/i,
  /^confidentiel$/i,
  /^page\s+\d+$/i,
  /^\d+\s*[/\\]\s*\d+$/,
];

function shouldIgnoreVar(name: string): boolean {
  return IGNORE_PATTERNS.some(p => p.test(name.trim()));
}

export function detectAndMapPublipostageVars(text: string): {
  mappedText: string;
  detectedVars: DetectedVariable[];
  duplicateWarnings: string[];
} {
  const normalizedText = normalizeSpaces(text);
  const varCounts = new Map<string, { mapped: string | null; format: string; count: number }>();
  let mappedText = normalizedText;

  const patterns: { regex: RegExp; format: string }[] = [
    { regex: /«([^»]+)»/g, format: '«»' },
    { regex: /<<([^>]+)>>/g, format: '<<>>' },
    // OPT-17: Also detect {{VarName}} that aren't already GRIMY vars
    { regex: /\{\{([A-Za-z_àéèêëïôùûçÀÉÈ][A-Za-z0-9_àéèêëïôùûçÀÉÈ]*)\}\}/g, format: '{{}}' },
    { regex: /(?<!\{)\{([A-Za-z_àéèêëïôùûç][A-Za-z0-9_àéèêëïôùûç]*)\}(?!\})/g, format: '{}' },
    { regex: /\[([A-Z][A-Za-z_]+)\]/g, format: '[]' },
    { regex: /MERGEFIELD\s+["']?([^"'\s}]+)["']?/gi, format: 'MERGEFIELD' },
    // OPT-24: Auto-detect *UPPERCASE* patterns
    { regex: /\*([A-Z_]{3,})\*/g, format: '*AUTO*' },
  ];

  for (const { regex, format } of patterns) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(normalizedText)) !== null) {
      const original = match[1].trim();
      // OPT-21: Skip page numbers / confidential notices
      if (shouldIgnoreVar(original)) continue;
      const grimyVar = findGrimyMapping(original);
      const key = `${original}::${format}`;
      const existing = varCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        varCounts.set(key, { mapped: grimyVar, format, count: 1 });
      }
      if (grimyVar) {
        mappedText = mappedText.split(match[0]).join(`{{${grimyVar}}}`);
      }
    }
  }

  // OPT-22: Detect Word form checkboxes
  mappedText = mappedText.replace(/☑/g, '[x]').replace(/☐/g, '[ ]');

  // Build result array with categories
  const detectedVars: DetectedVariable[] = Array.from(varCounts.entries()).map(([key, val]) => ({
    original: key.split('::')[0],
    mapped: val.mapped,
    format: val.format,
    count: val.count,
    category: val.mapped ? (VAR_CATEGORIES[val.mapped] || 'divers') : 'divers',
  }));

  // OPT-20: Detect duplicate mappings (2 different variables → same GRIMY field)
  const duplicateWarnings: string[] = [];
  const mappedToSources = new Map<string, string[]>();
  for (const v of detectedVars) {
    if (!v.mapped) continue;
    const sources = mappedToSources.get(v.mapped) || [];
    sources.push(v.original);
    mappedToSources.set(v.mapped, sources);
  }
  for (const [grimyField, sources] of mappedToSources) {
    if (sources.length > 1) {
      duplicateWarnings.push(
        `${sources.length} variables (${sources.join(', ')}) pointent vers le même champ « ${grimyField} ».`
      );
    }
  }

  return { mappedText, detectedVars, duplicateWarnings };
}

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PARSE_TIMEOUT = 5000; // 5 seconds

export const ALL_SECTION_IDS = GRIMY_DEFAULT_SECTIONS.map((s) => s.id);

const CNOEC_OBLIGATOIRE_IDS = new Set(
  GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire).map((s) => s.id)
);

// ══════════════════════════════════════════════
// Normalisation helpers
// ══════════════════════════════════════════════

function normalizeText(text: string): string {
  return normalizeSpaces(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// OPT-11: Language detection
function detectLanguage(text: string): 'fr' | 'en' | 'unknown' {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length < 20) return 'unknown';
  const enWords = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'been', 'will', 'are', 'not', 'but', 'can', 'all', 'your', 'was', 'which']);
  const enCount = words.filter(w => enWords.has(w)).length;
  const ratio = enCount / words.length;
  if (ratio > 0.08) return 'en';
  return 'fr';
}

// ══════════════════════════════════════════════
// Section keywords
// ══════════════════════════════════════════════

const SECTION_KEYWORDS: Record<string, string[]> = {
  introduction: [
    "lettre de mission", "presentation des comptes", "a l'attention",
    "confiance que vous nous avez", "article 151", "code de deontologie",
    "contrat entre les parties", "conditions generales d'intervention",
    "objet de la mission", "preambule",
  ],
  entite: [
    "votre entite", "votre entreprise", "votre societe", "caracteristiques",
    "identification de l'entite", "raison sociale", "forme juridique",
    "numero siren", "immatriculation rcs", "siege social",
  ],
  mission: [
    "notre mission", "mission que vous", "code de deontologie",
    "np 2300", "norme professionnelle", "attestation de presentation",
    "coherence et vraisemblance", "referentiel normatif",
  ],
  duree: [
    "duree de la mission", "duree de notre mission", "prendra effet",
    "date de signature", "exercice comptable", "tacitement reconduite",
    "reconduction tacite",
  ],
  nature_limite: [
    "nature et limite", "nature de la mission", "obligation de moyens",
    "par sondages", "actes illegaux", "controle exhaustif",
  ],
  responsable_mission: [
    "responsable de la mission", "responsable de mission",
    "expert-comptable inscrit", "expert comptable inscrit",
    "tableau de l'ordre", "signataire de la mission",
  ],
  referentiel_comptable: [
    "referentiel comptable", "plan comptable", "pcg",
    "reglement anc", "referentiel applicable",
  ],
  forme_rapport: [
    "forme du rapport", "attestation emise", "rapport emis",
    "rapport de l'expert",
  ],
  lcbft: [
    "lutte contre le blanchiment", "lcb-ft", "lcb ft", "lcbft", "lcb",
    "blanchiment de capitaux", "financement du terrorisme",
    "vigilance", "obligations de vigilance", "declaration de soupcon", "tracfin", "l.561",
  ],
  mission_sociale: [
    "mission sociale", "bulletins de salaire", "bulletins de paie",
    "paie", "social", "declarations sociales", "dsn", "charges sociales",
  ],
  mission_juridique: [
    "mission juridique", "secretariat juridique", "approbation des comptes",
    "assemblee generale", "proces-verbaux", "formalites juridiques",
  ],
  mission_controle_fiscal: [
    "controle fiscal", "assistance au controle", "verification fiscale",
    "examen de comptabilite", "garantie controle fiscal",
  ],
  honoraires: [
    "honoraires", "remuneration", "facturation", "tarification",
    "montant des honoraires", "revision des honoraires", "conditions financieres",
  ],
  modalites: [
    "modalites relationnelles", "modalites d'execution", "modalites",
    "relations contractuelles", "repartition des obligations",
  ],
  clause_resolutoire: [
    "clause resolutoire", "resolution de plein droit",
    "inexecution", "mise en demeure", "article 1225",
  ],
  mandat_fiscal: [
    "mandat fiscal", "autorisation de transmission", "teletransmission",
    "declarations fiscales", "liasse fiscale", "jedeclare", "administration fiscale",
  ],
  signature: [
    "signature", "l'expert-comptable", "l'expert comptable", "le client",
    "fait a", "bon pour accord", "lu et approuve", "sentiments devoues",
  ],
  organisation: [
    "organisation et transmission", "transmission des documents",
    "periodicite", "documents comptables", "delai de transmission",
    "modalites de transmission",
  ],
  destinataire: [
    "destinataire", "a l'attention de", "mandataire social",
    "coordonnees du client", "monsieur le gerant", "madame la gerante",
  ],
  annexe_repartition: [
    "repartition des travaux", "repartition des taches",
    "tableau de repartition", "obligations respectives", "qui fait quoi",
  ],
  annexe_travail_dissimule: [
    "travail dissimule", "attestation travail", "l.8222",
    "d.8222", "emploi regulier", "salaries etrangers",
    "attestation de vigilance",
  ],
  annexe_sepa: [
    "mandat de prelevement", "sepa", "prelevement sepa", "mandat sepa",
    "iban", "autorisation de prelevement", "coordonnees bancaires",
  ],
  annexe_liasse: [
    "liasse fiscale", "autorisation de transmission",
    "transmission de liasse", "jedeclare", "teletransmission liasse",
  ],
  objet_attestation: [
    "objet de l'attestation", "information attestee", "attestation particuliere",
  ],
  equipe_audit: [
    "equipe d'audit", "composition de l'equipe", "intervenants",
    "equipe d'intervention",
  ],
  planning_audit: [
    "planning d'intervention", "planning d'audit",
    "calendrier d'intervention", "phases d'audit", "calendrier d'audit",
  ],
  procedures_detail: [
    "procedures convenues", "procedures a mettre en oeuvre",
    "diligences convenues", "detail des procedures",
  ],
};

const CGV_KEYWORDS = [
  "conditions generales", "conditions d'intervention",
  "conditions particulieres", "cgv", "conditions generales d'intervention",
  "conditions generales de vente", "domaine d'application",
  "clause de responsabilite",
];

const REPARTITION_TABLE_KEYWORDS = [
  "cabinet", "client", "periodicite", "frequence",
  "saisie", "lettrage", "rapprochement", "tva", "bilan", "liasse",
];

const MULTI_SECTION_PATTERNS: { pattern: RegExp; sections: string[] }[] = [
  { pattern: /sociale?\s+et\s+juridique/i, sections: ["mission_sociale", "mission_juridique"] },
  { pattern: /nature\s+et\s+limite/i, sections: ["nature_limite"] },
  { pattern: /honoraires?\s+et\s+conditions/i, sections: ["honoraires"] },
];

// ══════════════════════════════════════════════
// Parse DOCX → HTML
// ══════════════════════════════════════════════

export async function parseDocxToHtml(file: File): Promise<string> {
  if (!file) throw new Error("Aucun fichier fourni.");
  if (file.size === 0) throw new Error("Le fichier est vide. Veuillez sélectionner un fichier DOCX valide.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). La taille maximale est de 10 Mo.`);
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Format non supporté. Utilisez un fichier .docx");
  }

  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();

    // OPT-12: Timeout protection
    const result = await Promise.race([
      mammoth.default.convertToHtml({ arrayBuffer }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Document trop complexe. Essayez un document plus simple.")), PARSE_TIMEOUT)
      ),
    ]);

    if (result.messages?.length > 0) {
      for (const msg of result.messages) {
        if (msg.type === "warning" || msg.type === "error") {
          console.warn("[DOCX Import]", msg.type, msg.message);
        }
      }
    }
    return result.value;
  } catch (err) {
    if (err instanceof Error && err.message.includes("trop complexe")) throw err;
    console.error("[DOCX Import] Erreur de parsing:", err);
    throw new Error("Impossible de lire le fichier. Vérifiez qu'il s'agit d'un DOCX valide.");
  }
}

// OPT-2: Parse DOCX → raw text (more reliable for variable detection)
export async function parseDocxToText(file: File): Promise<string> {
  if (!file) throw new Error("Aucun fichier fourni.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Fichier trop volumineux (max 10 Mo).");
  if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("Format non supporté. Utilisez .docx");

  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.default.extractRawText({ arrayBuffer });
  return normalizeSpaces(result.value);
}

// ══════════════════════════════════════════════
// Clean HTML → text
// ══════════════════════════════════════════════

export function cleanHtmlToText(html: string): string {
  let text = html;
  // Remove <style> and <script> blocks
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Table rows → structured lines
  text = text.replace(/<tr[^>]*>(.*?)<\/tr>/gis, (_, row) => {
    const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis) ?? [];
    const cellTexts = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
    return cellTexts.join(" | ") + "\n";
  });
  text = text.replace(/<\/?(?:table|thead|tbody|tfoot)[^>]*>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  // List items → dash bullet
  text = text.replace(/<li[^>]*>/gi, "\n— ");
  text = text.replace(/<\/li>/gi, "");
  text = text.replace(/<\/?[ou]l[^>]*>/gi, "\n");
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "\u2019").replace(/&lsquo;/g, "\u2018");
  text = text.replace(/&rdquo;/g, "\u201D").replace(/&ldquo;/g, "\u201C");
  text = text.replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014");
  text = text.replace(/&hellip;/g, "\u2026").replace(/&nbsp;/g, " ");
  text = text.replace(/&#\d+;/g, "");
  // OPT-22: Checkbox conversion
  text = text.replace(/☑/g, '[x]').replace(/☐/g, '[ ]');
  // Normalize whitespace
  text = normalizeSpaces(text);
  text = text.replace(/[ \t]+/g, " ");
  text = text.split("\n").map((l) => l.trim()).join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ══════════════════════════════════════════════
// Map HTML → Sections + Variables
// ══════════════════════════════════════════════

export async function mapHtmlToSections(
  html: string,
  filename: string = "document.docx"
): Promise<ParsedDocxResult> {
  const warnings: string[] = [];

  // OPT-10: Detect images
  const hasImages = /<img\b/i.test(html);
  if (hasImages) {
    warnings.push("Images détectées mais non importées.");
  }

  // OPT-14: Detect tables
  const hasTableau = /<table\b/i.test(html);

  // OPT-3: Detect and map publipostage variables on full text BEFORE splitting
  const fullText = cleanHtmlToText(html);
  const { mappedText, detectedVars, duplicateWarnings } = detectAndMapPublipostageVars(fullText);

  // OPT-23: No variables warning
  if (detectedVars.length === 0 && fullText.length > 200) {
    warnings.push(
      "Aucune variable de publipostage détectée. Ce document semble être une lettre finalisée, pas un modèle."
    );
  }

  // OPT-11: Language detection
  const language = detectLanguage(fullText);
  if (language === 'en') {
    warnings.push("Ce document semble être en anglais. Les mots-clés de détection sont optimisés pour le français.");
  }

  // OPT-14: Metadata
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;
  const totalParagraphs = fullText.split(/\n\n+/).filter(Boolean).length;

  // Parse HTML into blocks
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = Array.from(doc.body.children);

  const rawBlocks: { title: string; content: string[]; rawHtml: string[]; index: number }[] = [];
  let currentBlock: { title: string; content: string[]; rawHtml: string[]; index: number } | null = null;
  let blockIndex = 0;

  for (const el of elements) {
    const isHeading = /^H[1-6]$/.test(el.tagName) || isBoldParagraph(el as HTMLElement);
    const text = (el.textContent ?? "").trim();
    if (!text) continue;

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

  // Empty document
  if (rawBlocks.length === 0) {
    if (!fullText.trim()) {
      return {
        sections: [], parsedSections: [], unmappedContent: [],
        detectedCgv: null, detectedRepartition: [], confidence: 0,
        warnings: ["Le document est vide."], originalFilename: filename,
        detectedVars: [], mappedVarsCount: 0, duplicateVarWarnings: [],
        metadata: { totalWords: 0, totalParagraphs: 0, hasTableau: false, hasImages, language: 'unknown' },
      };
    }
    return {
      sections: [{
        id: "contenu_complet", titre: "Contenu importé", contenu: mappedText,
        type: "conditional", editable: true, cnoec_obligatoire: false, ordre: 1,
      }],
      parsedSections: [{
        originalTitle: "(sans titre)", mappedId: null,
        content: fullText.slice(0, 500), confidence: 0, isAutomaticMapping: false,
      }],
      unmappedContent: [fullText.slice(0, 300)],
      detectedCgv: null, detectedRepartition: [],
      confidence: 0,
      warnings: ["Aucune structure détectée. Le contenu a été importé comme une seule section.", ...warnings],
      originalFilename: filename,
      detectedVars, mappedVarsCount: detectedVars.filter(v => v.mapped).length,
      duplicateVarWarnings: duplicateWarnings,
      metadata: { totalWords, totalParagraphs, hasTableau, hasImages, language },
    };
  }

  // Map blocks to sections
  const sections: LMSection[] = [];
  const parsedSections: ParsedSection[] = [];
  const unmappedContent: string[] = [];
  let detectedCgv: string | null = null;
  const detectedRepartition: RepartitionRow[] = [];
  let recognizedCount = 0;
  let customCounter = 0;
  const usedSectionIds = new Set<string>();
  const totalBlocks = rawBlocks.length;

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    // Apply publipostage mapping to section content
    const rawContent = block.content.join("\n\n").trim();
    const contenu = detectedVars.length > 0
      ? detectAndMapPublipostageVars(rawContent).mappedText
      : rawContent;

    // CGV detection
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
        originalTitle: block.title, mappedId: "cgv",
        content: detectedCgv.slice(0, 500), confidence: 100, isAutomaticMapping: true,
      });
      continue;
    }

    // Repartition table detection
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
            type: grimyRef?.type ?? "fixed", editable: true,
            cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
            cnoec_reference: grimyRef?.cnoec_reference,
            cnoec_warning: grimyRef?.cnoec_warning,
            ordre: sections.length + 1,
          });
          parsedSections.push({
            originalTitle: block.title, mappedId: "annexe_repartition",
            content: contenu.slice(0, 300), confidence: 80, isAutomaticMapping: true,
          });
        }
        continue;
      }
    }

    // OPT-6: Multi-section title detection
    const multiMatch = checkMultiSectionTitle(block.title);
    if (multiMatch && multiMatch.length > 1) {
      warnings.push(`Section composite détectée : « ${block.title} » — vérifiez le découpage.`);
      const contentParts = splitContentForMultiSection(contenu, multiMatch.length);
      for (let k = 0; k < multiMatch.length; k++) {
        const secId = multiMatch[k];
        if (usedSectionIds.has(secId)) continue;
        usedSectionIds.add(secId);
        recognizedCount++;
        const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === secId);
        sections.push({
          id: secId, titre: grimyRef?.titre || secId,
          contenu: contentParts[k] || grimyRef?.contenu || "",
          type: grimyRef?.type ?? "fixed", editable: true,
          cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
          cnoec_reference: grimyRef?.cnoec_reference,
          cnoec_warning: grimyRef?.cnoec_warning,
          ordre: sections.length + 1,
        });
        parsedSections.push({
          originalTitle: block.title, mappedId: secId,
          content: (contentParts[k] || "").slice(0, 300),
          confidence: 60, isAutomaticMapping: true,
        });
      }
      continue;
    }

    // Standard section matching
    const matchResult = matchSectionId(block.title, contenu, usedSectionIds);

    if (matchResult) {
      usedSectionIds.add(matchResult.id);
      recognizedCount++;
      const grimyRef = GRIMY_DEFAULT_SECTIONS.find((s) => s.id === matchResult.id);
      sections.push({
        id: matchResult.id,
        titre: block.title || grimyRef?.titre || matchResult.id,
        contenu: contenu || grimyRef?.contenu || "",
        type: grimyRef?.type ?? "fixed", condition: grimyRef?.condition, editable: true,
        cnoec_obligatoire: grimyRef?.cnoec_obligatoire ?? false,
        cnoec_reference: grimyRef?.cnoec_reference,
        cnoec_warning: grimyRef?.cnoec_warning,
        ordre: sections.length + 1,
      });
      parsedSections.push({
        originalTitle: block.title, mappedId: matchResult.id,
        content: contenu.slice(0, 300),
        confidence: matchResult.score, isAutomaticMapping: true,
      });
    } else if (contenu || block.title) {
      customCounter++;
      sections.push({
        id: `custom_${customCounter}`,
        titre: block.title || `Section importée ${customCounter}`,
        contenu, type: "conditional", editable: true,
        cnoec_obligatoire: false, ordre: sections.length + 1,
      });
      if (contenu) unmappedContent.push(contenu.slice(0, 300));
      parsedSections.push({
        originalTitle: block.title || `Section ${customCounter}`,
        mappedId: null, content: contenu.slice(0, 300),
        confidence: 0, isAutomaticMapping: false,
      });
    }
  }

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

  // OPT-13: Confidence = sections (60%) + variables (40%)
  const sectionConfidence = totalBlocks > 0 ? recognizedCount / totalBlocks : 0;
  const totalVars = detectedVars.length;
  const mappedVarsCount = detectedVars.filter(v => v.mapped).length;
  const varConfidence = totalVars > 0 ? mappedVarsCount / totalVars : 1;
  const confidence = Math.round((sectionConfidence * 0.6 + varConfidence * 0.4) * 100);

  // OPT-47: Debug logging
  console.log(
    `[DOCX Import] ${parsedSections.length} sections detected, ${recognizedCount} mapped, ` +
    `${detectedVars.length} variables detected (${mappedVarsCount} mapped), confidence: ${confidence}%`
  );

  return {
    sections, parsedSections, unmappedContent, detectedCgv, detectedRepartition,
    confidence, warnings: [...warnings, ...duplicateWarnings], originalFilename: filename,
    detectedVars, mappedVarsCount, duplicateVarWarnings: duplicateWarnings,
    metadata: { totalWords, totalParagraphs, hasTableau, hasImages, language },
  };
}

// ══════════════════════════════════════════════
// Detect missing sections
// ══════════════════════════════════════════════

export function detectMissingSections(
  parsed: ParsedDocxResult,
  missionTypeId?: string
): string[] {
  const parsedIds = new Set(parsed.sections.map((s) => s.id));
  if (missionTypeId) {
    const mtConfig = (MISSION_TYPES as Record<string, MissionTypeConfig>)[missionTypeId];
    if (mtConfig) return mtConfig.requiredSections.filter((id) => !parsedIds.has(id));
  }
  return [...CNOEC_OBLIGATOIRE_IDS].filter((id) => !parsedIds.has(id));
}

// ══════════════════════════════════════════════
// Auto-fill empty sections from GRIMY defaults
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
    if (ref) return { ...section, contenu: ref.contenu };
    return section;
  });
}

// OPT-48: Test helper — accepts raw HTML for unit tests
export function testParseDocx(htmlContent: string): Promise<ParsedDocxResult> {
  return mapHtmlToSections(htmlContent, "test.docx");
}

// ══════════════════════════════════════════════
// Internal helpers
// ══════════════════════════════════════════════

function isBoldParagraph(el: HTMLElement): boolean {
  if (el.tagName !== "P") return false;
  const strong = el.querySelector("strong, b");
  if (!strong) return false;
  const boldLen = (strong.textContent ?? "").trim().length;
  const totalLen = (el.textContent ?? "").trim().length;
  return totalLen > 0 && totalLen < 200 && boldLen / totalLen > 0.8;
}

function matchSectionByFirstWords(text: string): boolean {
  const firstWords = normalizeText(text.slice(0, 80));
  for (const keywords of Object.values(SECTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (firstWords.startsWith(normalizeText(kw))) return true;
    }
  }
  return false;
}

function isH1LevelTitle(title: string): boolean {
  const norm = normalizeText(title);
  return (
    norm.startsWith("conditions generales") ||
    norm.startsWith("annexe") ||
    norm.startsWith("table des matieres")
  );
}

function isCgvBlock(title: string, content: string): boolean {
  const normalizedTitle = normalizeText(title);
  const normalizedContent = normalizeText(content.slice(0, 600));
  const combined = normalizedTitle + " " + normalizedContent;
  let score = 0;
  for (const kw of CGV_KEYWORDS) {
    const kwNorm = normalizeText(kw);
    if (normalizedTitle.includes(kwNorm)) score += 10;
    else if (combined.includes(kwNorm)) score += 2;
  }
  const articlePattern = /\b\d+\.\s+(domaine|definition|resiliation|suspension|obligation|honoraire|responsabilite|donnees|differend|conservation)/;
  if (articlePattern.test(normalizeText(content.slice(0, 1500)))) score += 5;
  return score >= 10;
}

function detectRepartitionTable(html: string): boolean {
  if (!/<table/i.test(html)) return false;
  const normalized = normalizeText(html);
  let hits = 0;
  for (const kw of REPARTITION_TABLE_KEYWORDS) {
    if (normalized.includes(normalizeText(kw))) hits++;
  }
  return hits >= 3;
}

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
    console.error("[DOCX Import] Erreur parsing tableau répartition:", err);
  }
  return rows;
}

function checkMultiSectionTitle(title: string): string[] | null {
  if (!title) return null;
  const norm = normalizeText(title);
  for (const mp of MULTI_SECTION_PATTERNS) {
    if (mp.pattern.test(norm) && mp.sections.length > 1) return mp.sections;
  }
  return null;
}

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

function matchSectionId(
  title: string, content: string, usedIds: Set<string>
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
      if (normalizedTitle.includes(kwNorm)) score += 10;
      else if (searchText.includes(kwNorm)) score += 1;
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
