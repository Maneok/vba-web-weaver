import type { VigilanceLevel } from "./types";
import { RISK_THRESHOLDS } from "./constants";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// ====== SCORING DATA TYPES ======
export interface PaysRisqueData {
  score: number;
  est_gafi_noir: boolean;
  est_gafi_gris: boolean;
  est_offshore: boolean;
}

export interface ScoringData {
  missions: Map<string, number>;
  typesJuridiques: Map<string, number>;
  pays: Map<string, PaysRisqueData>;
  activites: Map<string, number>;
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
      supabase.from("ref_missions").select("code, libelle, score").eq("cabinet_id", cabinetId),
      supabase.from("ref_types_juridiques").select("code, libelle, score").eq("cabinet_id", cabinetId),
      supabase.from("ref_pays").select("code, libelle, libelle_nationalite, score, est_gafi_noir, est_gafi_gris, est_offshore").eq("cabinet_id", cabinetId),
      supabase.from("ref_activites").select("code, libelle, score").eq("cabinet_id", cabinetId),
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

    const data: ScoringData = { missions, typesJuridiques, pays, activites };

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
export function calculateDateButoir(nivVigilance: VigilanceLevel): string {
  const d = new Date();
  switch (nivVigilance) {
    case "SIMPLIFIEE": d.setFullYear(d.getFullYear() + 3); break;
    case "STANDARD": d.setFullYear(d.getFullYear() + 2); break;
    case "RENFORCEE": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

// ====== ADDRESS NORMALIZATION (Idée 17) ======
export function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return "";
  return addr
    .toUpperCase()
    .replace(/[,;.]/g, " ")
    .replace(/\bAVENUE\b/g, "AV")
    .replace(/\bBOULEVARD\b/g, "BD")
    .replace(/\bROUTE\b/g, "RTE")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bIMPASSE\b/g, "IMP")
    .replace(/\bALLEE\b/g, "ALL")
    .replace(/\bCHEMIN\b/g, "CH")
    .replace(/\bRUE\b/g, "RUE")
    .replace(/\s+/g, " ")
    .trim();
}

// ====== MISSION SCORING ======
export const MISSION_SCORES: Record<string, number> = {
  "TENUE COMPTABLE": 25,
  "SOCIAL / PAIE SEULE": 25,
  "IRPP": 20,
  "REVISION / SURVEILLANCE": 30,
  "CONSEIL DE GESTION": 40,
  "CONSTITUTION / CESSION": 60,
  "DOMICILIATION": 80,
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

  // #20 - Resolve mission score with flexible DB lookup + hardcoded fallback
  const resolveMission = (mission: string): number => {
    if (scoringData && scoringData.missions.size > 0) {
      const dbScore = scoringData.missions.get(mission);
      if (dbScore !== undefined) return dbScore;
      // Try uppercase for libelle match
      const upper = scoringData.missions.get(mission.toUpperCase().trim());
      if (upper !== undefined) return upper;
      // Try normalized key (underscores → spaces)
      const normalized = scoringData.missions.get(normalizeKey(mission));
      if (normalized !== undefined) return normalized;
    }
    return MISSION_SCORES[mission] ?? 25;
  };

  // PPE or Atypique = forced 100, but still compute malus for audit trail
  if (params.ppe || params.atypique) {
    const sa = resolveApe(params.ape);
    const sp = computeScorePays(params.paysRisque, params.pays, scoringData);
    const sm = resolveMission(params.mission);
    const smat = scoreMaturite(params.dateCreation, params.dateReprise, params.effectif, params.forme);
    const ss = scoreStructure(params.forme, scoringData);
    let mal = 0;
    if (params.cash) mal += 40;
    if (params.pression) mal += 40;
    if (params.distanciel) mal += 30;
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

  // Malus
  let malus = 0;
  if (params.cash) malus += 40;
  if (params.pression) malus += 40;
  if (params.distanciel) malus += 30;

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

  // Cap
  scoreGlobal = Math.min(scoreGlobal, 120);

  let nivVigilance: VigilanceLevel;
  if (scoreGlobal <= RISK_THRESHOLDS.SIMPLIFIEE_MAX) nivVigilance = "SIMPLIFIEE";
  else if (scoreGlobal <= RISK_THRESHOLDS.STANDARD_MAX) nivVigilance = "STANDARD";
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
export function calculateNextReviewDate(nivVigilance: VigilanceLevel, lastReview: string): string {
  let d = new Date(lastReview);
  // P5-11: Guard against invalid date — fallback to today (iterative, no recursion)
  if (isNaN(d.getTime())) d = new Date();
  // Use UTC methods to avoid timezone-dependent date shifts
  switch (nivVigilance) {
    case "SIMPLIFIEE": d.setUTCFullYear(d.getUTCFullYear() + 3); break;
    case "STANDARD": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    case "RENFORCEE": d.setUTCMonth(d.getUTCMonth() + 6); break;
  }
  return d.toISOString().split("T")[0];
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

// #18 - Recalculate risk for a client with all computed fields
export function recalculateClientRisk(client: {
  ape: string; paysRisque: boolean; pays?: string; mission: string;
  dateCreation: string; dateReprise: string; effectif: string; forme: string;
  ppe: boolean; atypique: boolean; distanciel: boolean; cash: boolean; pression: boolean;
}, scoringData?: ScoringData) {
  const risk = calculateRiskScore(client, scoringData);
  const now = new Date().toISOString().split("T")[0];
  const dateButoir = calculateNextReviewDate(risk.nivVigilance, now);
  return {
    ...risk,
    dateDerniereRevue: now,
    dateButoir,
    etatPilotage: getPilotageStatus(dateButoir),
  };
}
