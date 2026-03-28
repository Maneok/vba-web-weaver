import type { VigilanceLevel } from "./types";
import { RISK_THRESHOLDS } from "./constants";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ScreeningState } from "./kycService";

// ====== SCORING DATA TYPES ======
export interface PaysRisqueData {
  score: number;
  est_gafi_noir: boolean;
  est_gafi_gris: boolean;
  est_offshore: boolean;
}

export interface ScoringConfig {
  seuil_bas: number;
  seuil_haut: number;
  malus_cash: number;
  malus_pression: number;
  malus_distanciel: number;
  malus_ppe: number;
  malus_atypique: number;
  revue_standard_mois: number;
  revue_renforcee_mois: number;
  revue_simplifiee_mois: number;
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  seuil_bas: 25,
  seuil_haut: 60,
  malus_cash: 40,
  malus_pression: 40,
  malus_distanciel: 30,
  malus_ppe: 20,
  malus_atypique: 15,
  revue_standard_mois: 24,
  revue_renforcee_mois: 12,
  revue_simplifiee_mois: 36,
};

export interface ScoringData {
  missions: Map<string, number>;
  typesJuridiques: Map<string, number>;
  pays: Map<string, PaysRisqueData>;
  activites: Map<string, number>;
  config: ScoringConfig;
}

// ====== SCORING DATA CACHE (TTL 5 min) ======
const CACHE_TTL_MS = 5 * 60 * 1000;
let scoringCache: { data: ScoringData; cabinetId: string; timestamp: number } | null = null;

// #14 - Normalize key for flexible matching (CODE_LIKE_THIS → CODE LIKE THIS)
function normalizeKey(s: string): string {
  return s.toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export async function loadScoringData(cabinetId: string): Promise<ScoringData> {
  if (
    scoringCache &&
    scoringCache.cabinetId === cabinetId &&
    Date.now() - scoringCache.timestamp < CACHE_TTL_MS
  ) {
    return scoringCache.data;
  }

  try {
    // #15 - Load libelle alongside code for fuzzy matching
    const [missionsRes, typesRes, paysRes, activitesRes] = await Promise.all([
      supabase.from("ref_missions").select("code, libelle, score").or(`cabinet_id.eq.${cabinetId},cabinet_id.is.null`),
      supabase.from("ref_types_juridiques").select("code, libelle, score").or(`cabinet_id.eq.${cabinetId},cabinet_id.is.null`),
      supabase.from("ref_pays").select("code, libelle, libelle_nationalite, score, est_gafi_noir, est_gafi_gris, est_offshore").or(`cabinet_id.eq.${cabinetId},cabinet_id.is.null`),
      supabase.from("ref_activites").select("code, libelle, score").or(`cabinet_id.eq.${cabinetId},cabinet_id.is.null`),
    ]);

    const missions = new Map<string, number>();
    if (missionsRes.data) {
      for (const row of missionsRes.data) {
        const r = row as Record<string, unknown>;
        const score = (r.score as number) ?? 25;
        // #16 - Index by code, normalized code (spaces), and libelle (upper)
        if (r.code) missions.set(r.code as string, score);
        if (r.code) missions.set(normalizeKey(r.code as string), score);
        if (r.libelle) missions.set((r.libelle as string).toUpperCase().trim(), score);
      }
    }

    const typesJuridiques = new Map<string, number>();
    if (typesRes.data) {
      for (const row of typesRes.data) {
        const r = row as Record<string, unknown>;
        const score = (r.score as number) ?? 20;
        typesJuridiques.set(r.code as string, score);
        if (r.code) typesJuridiques.set(normalizeKey(r.code as string), score);
        if (r.libelle) typesJuridiques.set((r.libelle as string).toUpperCase().trim(), score);
      }
    }

    const pays = new Map<string, PaysRisqueData>();
    if (paysRes.data) {
      for (const row of paysRes.data) {
        const r = row as Record<string, unknown>;
        const paysData: PaysRisqueData = {
          score: (r.score as number) ?? 0,
          est_gafi_noir: (r.est_gafi_noir as boolean) ?? false,
          est_gafi_gris: (r.est_gafi_gris as boolean) ?? false,
          est_offshore: (r.est_offshore as boolean) ?? false,
        };
        // #17 - Index by code, libelle, and nationality for broad matching
        if (r.code) pays.set(r.code as string, paysData);
        if (r.libelle) pays.set((r.libelle as string).toUpperCase().trim(), paysData);
        if (r.libelle_nationalite) pays.set((r.libelle_nationalite as string).toUpperCase().trim(), paysData);
      }
    }

    const activites = new Map<string, number>();
    if (activitesRes.data) {
      for (const row of activitesRes.data) {
        const r = row as Record<string, unknown>;
        const score = (r.score as number) ?? 25;
        if (r.code) activites.set(r.code as string, score);
        if (r.libelle) activites.set((r.libelle as string).toUpperCase().trim(), score);
      }
    }

    // Load scoring_config from parametres
    let config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG };
    try {
      const { data: paramData } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("cabinet_id", cabinetId)
        .eq("cle", "scoring_config")
        .single();
      if (paramData?.valeur) {
        const v = typeof paramData.valeur === "string" ? JSON.parse(paramData.valeur) : paramData.valeur;
        config = { ...config, ...v };
      }
    } catch { /* fallback to defaults */ }

    const data: ScoringData = { missions, typesJuridiques, pays, activites, config };

    scoringCache = { data, cabinetId, timestamp: Date.now() };
    logger.info("RiskEngine", `Scoring data loaded for cabinet ${cabinetId} (${missions.size} missions, ${typesJuridiques.size} types, ${pays.size} pays, ${activites.size} activites)`);

    return data;
  } catch (error) {
    logger.error("RiskEngine", "Failed to load scoring data from Supabase, using hardcoded fallback", error);
    throw error;
  }
}

// Exported for testing — allows invalidating the cache
export function clearScoringCache(): void {
  scoringCache = null;
}

/**
 * Appelle la RPC PostgreSQL pour recalculer les scores de TOUS les clients du cabinet.
 * Utilisé quand les paramètres de scoring changent (ref_activites, ref_missions, etc.)
 */
export async function recalculateAllCabinetScores(cabinetId: string): Promise<{ success: boolean; updated_count: number }> {
  try {
    const { data, error } = await supabase.rpc("recalculate_cabinet_scores", { p_cabinet_id: cabinetId });
    if (error) {
      // RPC may not exist yet — graceful degradation
      if (error.message?.includes("does not exist") || error.code === "42883") {
        logger.warn("RiskEngine", "RPC recalculate_cabinet_scores not found — skipping server-side recalc");
        return { success: false, updated_count: 0 };
      }
      logger.error("RiskEngine", "RPC recalculate_cabinet_scores failed:", error.message);
      return { success: false, updated_count: 0 };
    }
    // Invalidate scoring cache so new data is loaded
    clearScoringCache();
    const count = typeof data === "object" && data !== null ? (data as any).updated_count ?? 0 : typeof data === "number" ? data : 0;
    logger.info("RiskEngine", `Scores recalculated: ${count} clients updated`);
    return { success: true, updated_count: count };
  } catch (err) {
    logger.error("RiskEngine", "Failed to recalculate scores:", err);
    return { success: false, updated_count: 0 };
  }
}

// ====== CASH-INTENSIVE APE CODES (Idée 4) ======
export const APE_CASH: string[] = [
  "56.10A", "56.10C", "56.30Z", "47.26Z", "10.71C",
  "96.02A", "96.02B", "96.04Z", "47.11B", "47.11D",
  "47.77Z", "92.00Z",
];

// ====== MISSION → FREQUENCY MAPPING (Idée 7) ======
export const MISSION_FREQUENCE: Record<string, string> = {
  "TENUE COMPTABLE": "MENSUEL",
  "REVISION / SURVEILLANCE": "TRIMESTRIEL",
  "SOCIAL / PAIE SEULE": "MENSUEL",
  "CONSEIL DE GESTION": "ANNUEL",
  "CONSTITUTION / CESSION": "ANNUEL",
  "DOMICILIATION": "MENSUEL",
  "IRPP": "ANNUEL",
};

// ====== VIGILANCE → DATE BUTOIR OFFSET (Idée 9) ======
export function calculateDateButoir(nivVigilance: VigilanceLevel, config?: ScoringConfig): string {
  const d = new Date();
  const moisSimp = config?.revue_simplifiee_mois ?? 36;
  const moisStd = config?.revue_standard_mois ?? 24;
  const moisRenf = config?.revue_renforcee_mois ?? 12;
  switch (nivVigilance) {
    case "SIMPLIFIEE": d.setMonth(d.getMonth() + moisSimp); break;
    case "STANDARD": d.setMonth(d.getMonth() + moisStd); break;
    case "RENFORCEE": d.setMonth(d.getMonth() + moisRenf); break;
  }
  return d.toISOString().split("T")[0];
}

// ====== ADDRESS NORMALIZATION (Idée 17) ======
// OPT: Pre-compile regex patterns at module level for reuse across calls
const ADDR_PUNCTUATION = /[,;.]/g;
const ADDR_WHITESPACE = /\s+/g;
const ADDR_REPLACEMENTS: [RegExp, string][] = [
  [/\bAVENUE\b/g, "AV"], [/\bBOULEVARD\b/g, "BD"], [/\bROUTE\b/g, "RTE"],
  [/\bPLACE\b/g, "PL"], [/\bIMPASSE\b/g, "IMP"], [/\bALLEE\b/g, "ALL"],
  [/\bCHEMIN\b/g, "CH"],
];

export function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return "";
  let result = addr.toUpperCase().replace(ADDR_PUNCTUATION, " ");
  for (const [pattern, replacement] of ADDR_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(ADDR_WHITESPACE, " ").trim();
}

// ====== MISSION SCORING (fallback when ref_missions not loaded) ======
export const MISSION_SCORES: Record<string, number> = {
  // By code (primary)
  "TENUE_COMPTABLE": 25,
  "PRESENTATION_COMPTES_ANNUELS": 25,
  "MISSION_SOCIALE": 10,
  "CONSEIL_GESTION_ACTIFS": 40,
  "CREATION_ENTREPRISE_INF_50K": 30,
  "DOMICILIATION": 80,
  "CONSEIL_PATRIMONIAL": 60,
  // By normalized label (legacy compatibility)
  "TENUE COMPTABLE": 25,
  "SOCIAL / PAIE SEULE": 25,
  "IRPP": 20,
  "REVISION / SURVEILLANCE": 30,
  "CONSEIL DE GESTION": 40,
  "CONSTITUTION / CESSION": 60,
};

// ====== ACTIVITY (APE) SCORING ======
export const APE_SCORES: Record<string, number> = {
  "56.10A": 30, "10.71C": 30, "47.11D": 30, "55.10Z": 30, "68.20A": 30, "68.20B": 30,
  "47.73Z": 20, "96.02A": 25, "47.76Z": 25, "47.11B": 25, "73.11Z": 25, "71.11Z": 25,
  "86.21Z": 20, "86.23Z": 20, "62.20Z": 25, "01.21Z": 25, "70.22Z": 25,
  "41.10A": 30, "41.10B": 70, "41.20A": 40, "41.20B": 40, "43.99C": 40,
  "68.10Z": 80, "68.31Z": 70, "45.11Z": 50, "45.19Z": 50, "45.20A": 30,
  "46.73A": 30, "47.77Z": 80, "56.10C": 60, "56.30Z": 50,
  "64.19Z": 50, "64.20Z": 40, "64.99Z": 80, "66.19B": 50, "46.77Z": 80,
  "77.11A": 40, "82.99Z": 60, "90.03B": 60, "92.00Z": 100,
  "93.29Z": 40, "96.02B": 40, "96.04Z": 40, "47.26Z": 60,
  "49.32Z": 50, "96.01B": 40, "47.91A": 25, "47.26A": 25,
  "46.17A": 25, "49.41A": 25,
};

// ====== COUNTRY RISK ======
export const PAYS_RISQUE: string[] = [
  "AFGHANISTAN", "ALGERIE", "ANGOLA", "ANGUILLA", "ANTIGUA-ET-BARBUDA",
  "BIELORUSSIE", "BULGARIE", "BURKINA FASO", "CAMEROUN", "CONGO (RDC)",
  "COREE DU NORD", "COTE D'IVOIRE", "CROATIE", "EMIRATS ARABES UNIS",
  "FIDJI", "GUAM", "HAITI", "HONG-KONG", "CHINE", "CHYPRE",
  "IRAN", "KENYA", "LIBAN", "MALI", "MONACO", "MOZAMBIQUE",
  "MYANMAR (BIRMANIE)", "NAMIBIE", "NIGERIA", "PALAOS", "PANAMA",
  "PHILIPPINES", "RUSSIE", "SAMOA", "SEYCHELLES", "SOUDAN DU SUD",
  "SYRIE", "TANZANIE", "TRINITE-ET-TOBAGO", "TURQUIE", "VANUATU",
  "VENEZUELA", "VIETNAM", "YEMEN", "ILES VIERGES BRITANNIQUES",
  "ILES VIERGES AMERICAINES", "ILES TURQUES-ET-CAIQUES",
  "SAMOA AMERICAINES",
];

// OPT-1: Pre-computed Set for O(1) country risk lookups
export const PAYS_RISQUE_SET = new Set(PAYS_RISQUE);

// OPT-2: Pre-computed Set for O(1) cash-intensive APE lookups
export const APE_CASH_SET = new Set(APE_CASH);

// ====== STRUCTURE SCORING ======
function scoreStructure(forme: string, scoringData?: ScoringData): number {
  if (!forme || typeof forme !== "string") return 20; // default fallback
  const f = forme.toUpperCase().trim();

  // If DB scoring data available, look up by code
  if (scoringData && scoringData.typesJuridiques.size > 0) {
    const dbScore = scoringData.typesJuridiques.get(f);
    if (dbScore !== undefined) return dbScore;
  }

  // Hardcoded fallback
  if (["ENTREPRISE INDIVIDUELLE", "ARTISAN"].some(k => f.includes(k))) return 20;
  if (f.includes("EARL")) return 20;
  if (f.includes("SARL") || f.includes("EURL")) return 20;
  if (["SELAS", "SELARL", "SCP"].some(k => f.includes(k))) return 30;
  if (f.includes("SCI") || f.includes("CIVILE")) return 35;
  if (f.includes("SAS")) return 40;
  if (f === "SA" || f.startsWith("SA ") || f.includes(" SA")) return 40;
  if (f.includes("ASSOCIATION") || f.includes("ASSO")) return 60;
  if (f === "SNC" || f.startsWith("SNC ")) return 60;
  if (f === "CSE" || f.includes("COMITE SOCIAL")) return 60;
  if (f === "GAEC") return 60;
  if (f.includes("SCCV")) return 70;
  if (["TRUST", "FIDUCIE", "FONDATION"].some(k => f.includes(k))) return 100;
  return 20;
}

// ====== MATURITY SCORING ======
function scoreMaturite(
  dateCreation: string,
  dateReprise: string,
  effectif: string,
  forme: string
): number {
  const now = new Date();
  const creation = new Date(dateCreation);
  // P5-10: Guard against invalid/missing date — treat as recent creation (higher risk)
  if (!dateCreation || isNaN(creation.getTime())) return 65;
  const isReprise = dateReprise && dateReprise !== dateCreation;
  const ancienneteYears = Math.max(0, (now.getTime() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  // P5-9: More robust employee detection — old check only matched exact "0 SALARIÉ"
  const hasSalaries = effectif && !/^0\b|^0 |AUCUN|N[EÉ]ANT|0 SALAR/i.test(effectif.trim()) && effectif.trim() !== "0";
  const formeUpper = (forme || "").toUpperCase();
  const isSCI = formeUpper.includes("SCI") || formeUpper.includes("HOLDING");

  // P6-52: Score by anciennete regardless of reprise status
  // isReprise=false means client was created by firm → lower risk for mature companies
  if (ancienneteYears < 1) return 65;
  if (ancienneteYears < 3) return isReprise ? 50 : 30;
  if (hasSalaries || isSCI) return 0;
  if (!isReprise) return 10; // Created by firm, old, no employees
  return 80; // Dormant shell — old company, reprise, no employees
}

// ====== COUNTRY SCORE FROM DB OR FALLBACK ======
function computeScorePays(
  paysRisque: boolean,
  pays: string | undefined,
  scoringData?: ScoringData
): number {
  // If DB scoring data is available and a country code is provided, use it
  if (scoringData && scoringData.pays.size > 0 && pays) {
    const upper = pays.toUpperCase().trim();
    const paysData = scoringData.pays.get(upper);
    if (paysData) {
      if (paysData.est_gafi_noir) return 100;
      if (paysData.est_gafi_gris) return 70;
      if (paysData.est_offshore) return 50;
      return paysData.score;
    }
  }
  // Hardcoded fallback: simple boolean
  return paysRisque ? 100 : 0;
}

// ====== MAIN RISK CALCULATION ======
export function calculateRiskScore(params: {
  ape: string;
  paysRisque: boolean;
  pays?: string;
  mission: string;
  dateCreation: string;
  dateReprise: string;
  effectif: string;
  forme: string;
  ppe: boolean;
  atypique: boolean;
  distanciel: boolean;
  cash: boolean;
  pression: boolean;
}, scoringData?: ScoringData): {
  scoreActivite: number;
  scorePays: number;
  scoreMission: number;
  scoreMaturite: number;
  scoreStructure: number;
  malus: number;
  scoreGlobal: number;
  nivVigilance: VigilanceLevel;
} {
  // #19 - Resolve activity score with flexible DB lookup + hardcoded fallback
  const resolveApe = (ape: string): number => {
    if (scoringData && scoringData.activites.size > 0) {
      const dbScore = scoringData.activites.get(ape);
      if (dbScore !== undefined) return dbScore;
      // Try uppercase
      const upper = scoringData.activites.get(ape.toUpperCase().trim());
      if (upper !== undefined) return upper;
    }
    return APE_SCORES[ape] ?? 25;
  };

  // #20 - Resolve mission score from ref_missions (DB only, no hardcoded fallback)
  const resolveMission = (mission: string): number => {
    if (scoringData && scoringData.missions.size > 0) {
      const dbScore = scoringData.missions.get(mission);
      if (dbScore !== undefined) return dbScore;
      const upper = scoringData.missions.get(mission.toUpperCase().trim());
      if (upper !== undefined) return upper;
      const normalized = scoringData.missions.get(normalizeKey(mission));
      if (normalized !== undefined) return normalized;
    }
    // Fallback: mission not found in referentiel — use default 25 and warn
    if (typeof console !== "undefined") console.warn(`[riskEngine] Mission "${mission}" non trouvee dans ref_missions — score par defaut 25`);
    return MISSION_SCORES[mission] ?? 25;
  };

  const cfg = scoringData?.config;

  // PPE = forced RENFORCEE at score 100 (non-configurable)
  if (params.ppe) {
    const sa = resolveApe(params.ape);
    const sp = computeScorePays(params.paysRisque, params.pays, scoringData);
    const sm = resolveMission(params.mission);
    const smat = scoreMaturite(params.dateCreation, params.dateReprise, params.effectif, params.forme);
    const ss = scoreStructure(params.forme, scoringData);
    let mal = 0;
    if (params.cash) mal += cfg?.malus_cash ?? 40;
    if (params.pression) mal += cfg?.malus_pression ?? 40;
    if (params.distanciel) mal += cfg?.malus_distanciel ?? 30;
    if (params.atypique) mal += cfg?.malus_atypique ?? 15;
    return {
      scoreActivite: sa, scorePays: sp, scoreMission: sm,
      scoreMaturite: smat, scoreStructure: ss,
      malus: mal, scoreGlobal: 100, nivVigilance: "RENFORCEE",
    };
  }

  const scoreAct = resolveApe(params.ape);
  const scorePays = computeScorePays(params.paysRisque, params.pays, scoringData);
  const scoreMis = resolveMission(params.mission);
  const scoreMat = scoreMaturite(params.dateCreation, params.dateReprise, params.effectif, params.forme);
  const scoreStr = scoreStructure(params.forme, scoringData);

  // Malus (dynamic from scoring_config)
  let malus = 0;
  if (params.cash) malus += cfg?.malus_cash ?? 40;
  if (params.pression) malus += cfg?.malus_pression ?? 40;
  if (params.distanciel) malus += cfg?.malus_distanciel ?? 30;
  if (params.atypique) malus += cfg?.malus_atypique ?? 15;

  // B1: Récence malus — company age (complements scoreMaturite)
  if (params.dateCreation) {
    const created = new Date(params.dateCreation);
    if (!isNaN(created.getTime())) {
      const now2 = new Date();
      const ageMonths = (now2.getFullYear() - created.getFullYear()) * 12 + (now2.getMonth() - created.getMonth());
      if (ageMonths < 6) malus += 20;
      else if (ageMonths < 24) malus += 10;
    }
  }

  // Average of 5 criteria
  const avg = (scoreAct + scorePays + scoreMis + scoreMat + scoreStr) / 5;

  // If any criterion >= 60, it forces the global score (malus always added)
  const maxCriterion = Math.max(scoreAct, scorePays, scoreMis, scoreMat, scoreStr);
  let scoreGlobal: number;
  if (maxCriterion >= 60) {
    scoreGlobal = Math.round(maxCriterion + malus);
  } else {
    scoreGlobal = Math.round(avg + malus);
  }

  scoreGlobal = Math.min(scoreGlobal, 120);

  const seuilSimplifie = cfg?.seuil_bas ?? RISK_THRESHOLDS.SIMPLIFIEE_MAX;
  const seuilRenforce = cfg?.seuil_haut ?? RISK_THRESHOLDS.STANDARD_MAX;

  let nivVigilance: VigilanceLevel;
  if (scoreGlobal <= seuilSimplifie) nivVigilance = "SIMPLIFIEE";
  else if (scoreGlobal <= seuilRenforce) nivVigilance = "STANDARD";
  else nivVigilance = "RENFORCEE";

  return {
    scoreActivite: scoreAct,
    scorePays,
    scoreMission: scoreMis,
    scoreMaturite: scoreMat,
    scoreStructure: scoreStr,
    malus,
    scoreGlobal,
    nivVigilance,
  };
}

// ====== REVIEW DATE CALCULATION ======
export function calculateNextReviewDate(nivVigilance: VigilanceLevel, lastReview: string, config?: ScoringConfig): string {
  let d = new Date(lastReview);
  // P5-11: Guard against invalid date — fallback to today (iterative, no recursion)
  if (isNaN(d.getTime())) d = new Date();
  const moisSimp = config?.revue_simplifiee_mois ?? 36;
  const moisStd = config?.revue_standard_mois ?? 24;
  const moisRenf = config?.revue_renforcee_mois ?? 12;
  switch (nivVigilance) {
    case "SIMPLIFIEE": d.setUTCMonth(d.getUTCMonth() + moisSimp); break;
    case "STANDARD": d.setUTCMonth(d.getUTCMonth() + moisStd); break;
    case "RENFORCEE": d.setUTCMonth(d.getUTCMonth() + moisRenf); break;
  }
  return d.toISOString().split("T")[0];
}

/**
 * Calcule la date à laquelle la revue est DUE pour un client donné.
 * Point de départ = max(date_derniere_revue, date_creation_ligne)
 * Délai = 2 ans (SIMPLIFIEE), 1 an (STANDARD), 6 mois (RENFORCEE)
 */
export function calculateReviewDueDate(
  nivVigilance: VigilanceLevel,
  dateDerniereRevue: string,
  dateCreationLigne: string,
  config?: ScoringConfig
): string {
  const revue = dateDerniereRevue ? new Date(dateDerniereRevue) : null;
  const creation = dateCreationLigne ? new Date(dateCreationLigne) : null;

  let baseDate: Date;
  if (revue && !isNaN(revue.getTime()) && creation && !isNaN(creation.getTime())) {
    baseDate = revue > creation ? new Date(revue) : new Date(creation);
  } else if (revue && !isNaN(revue.getTime())) {
    baseDate = new Date(revue);
  } else if (creation && !isNaN(creation.getTime())) {
    baseDate = new Date(creation);
  } else {
    baseDate = new Date();
  }

  const moisSimp = config?.revue_simplifiee_mois ?? 36;
  const moisStd = config?.revue_standard_mois ?? 24;
  const moisRenf = config?.revue_renforcee_mois ?? 12;
  switch (nivVigilance) {
    case "SIMPLIFIEE": baseDate.setMonth(baseDate.getMonth() + moisSimp); break;
    case "STANDARD": baseDate.setMonth(baseDate.getMonth() + moisStd); break;
    case "RENFORCEE": baseDate.setMonth(baseDate.getMonth() + moisRenf); break;
  }
  return baseDate.toISOString().split("T")[0];
}

/** Détermine si un client est éligible pour une revue (date de revue arrivée ou dépassée). */
export function isReviewDue(
  nivVigilance: VigilanceLevel,
  dateDerniereRevue: string,
  dateCreationLigne: string
): boolean {
  const dueDate = calculateReviewDueDate(nivVigilance, dateDerniereRevue, dateCreationLigne);
  return new Date(dueDate) <= new Date();
}

/** Calcule le nombre de jours restants avant la prochaine revue. Négatif = en retard. */
export function daysUntilReview(
  nivVigilance: VigilanceLevel,
  dateDerniereRevue: string,
  dateCreationLigne: string
): number {
  const dueDate = calculateReviewDueDate(nivVigilance, dateDerniereRevue, dateCreationLigne);
  const diff = new Date(dueDate).getTime() - Date.now();
  const result = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return isNaN(result) ? 0 : result;
}

// OPT-3: Cache Date.now() to avoid multiple Date object creations
export function getPilotageStatus(dateButoir: string): string {
  if (!dateButoir) return "RETARD";
  const butoir = new Date(dateButoir);
  if (isNaN(butoir.getTime())) return "RETARD";
  const diffDays = (butoir.getTime() - Date.now()) / 86400000;
  if (diffDays < 0) return "RETARD";
  if (diffDays < 60) return "BIENTOT";
  return "A JOUR";
}

// OPT-4: Helper to check if a nationality matches a risk country (used in multiple places)
export function isRiskCountry(nationality: string): boolean {
  if (!nationality) return false;
  const upper = nationality.toUpperCase().trim();
  if (PAYS_RISQUE_SET.has(upper)) return true;
  // Partial match for compound names
  for (const p of PAYS_RISQUE) {
    if (upper.includes(p)) return true;
  }
  return false;
}

// ====== B3: Vigilance thresholds as exportable constant ======
export const VIGILANCE_THRESHOLDS = {
  SIMPLIFIEE: { max: 25, label: "Simplifiée", color: "emerald", reviewMonths: 24 },
  STANDARD: { max: 60, label: "Standard", color: "amber", reviewMonths: 12 },
  RENFORCEE: { max: 100, label: "Renforcée", color: "red", reviewMonths: 6 },
} as const;

// ====== B2: Screening malus ======
export function computeScreeningMalus(screening: ScreeningState): number {
  let malus = 0;
  // Sanctions matches
  if (screening.sanctions?.data?.hasCriticalMatch) malus += 100;
  // Gel d'avoirs — check via BODACC result or dedicated field
  // News check — negative articles
  if (screening.news?.data?.hasNegativeNews) malus += 30;
  // BODACC — procédures collectives
  if (screening.bodacc?.data?.hasProcedureCollective) malus += 50;
  // BODACC malus from edge function
  if (screening.bodacc?.data?.malus) malus += screening.bodacc.data.malus;
  return malus;
}

// #18 - Recalculate risk for a client with all computed fields
export function recalculateClientRisk(client: {
  ape: string; paysRisque: boolean; pays?: string; mission: string;
  dateCreation: string; dateReprise: string; effectif: string; forme: string;
  ppe: boolean; atypique: boolean; distanciel: boolean; cash: boolean; pression: boolean;
}, scoringData?: ScoringData) {
  const risk = calculateRiskScore(client, scoringData);
  const now = new Date().toISOString().split("T")[0];
  const dateButoir = calculateNextReviewDate(risk.nivVigilance, now, scoringData?.config);
  return {
    ...risk,
    dateDerniereRevue: now,
    dateButoir,
    etatPilotage: getPilotageStatus(dateButoir),
  };
}
