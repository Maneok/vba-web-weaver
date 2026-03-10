import type { VigilanceLevel } from "./types";
import { RISK_THRESHOLDS } from "./constants";

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
  "TENUE COMPTABLE": 10,
  "SOCIAL / PAIE SEULE": 10,
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

// ====== STRUCTURE SCORING ======
function scoreStructure(forme: string): number {
  const f = forme.toUpperCase().trim();
  if (["ENTREPRISE INDIVIDUELLE", "SNC", "ARTISAN"].some(k => f.includes(k))) return 0;
  if (f.includes("EARL")) return 0;
  if (f.includes("SARL") || f.includes("EURL")) return 20;
  if (["SELAS", "SELARL", "SCP"].some(k => f.includes(k))) return 30;
  if (f.includes("SCI") || f.includes("CIVILE")) return 35;
  if (f.includes("SAS")) return 40;
  if (f === "SA" || f.startsWith("SA ") || f.includes(" SA")) return 40;
  if (f.includes("ASSOCIATION")) return 50;
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
  const ancienneteYears = (now.getTime() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
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

// ====== MAIN RISK CALCULATION ======
export function calculateRiskScore(params: {
  ape: string;
  paysRisque: boolean;
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
}): {
  scoreActivite: number;
  scorePays: number;
  scoreMission: number;
  scoreMaturite: number;
  scoreStructure: number;
  malus: number;
  scoreGlobal: number;
  nivVigilance: VigilanceLevel;
} {
  // PPE or Atypique = forced 100, but still compute malus for audit trail
  if (params.ppe || params.atypique) {
    const sa = APE_SCORES[params.ape] ?? 25;
    const sp = params.paysRisque ? 100 : 0;
    const sm = MISSION_SCORES[params.mission] ?? 25;
    const smat = scoreMaturite(params.dateCreation, params.dateReprise, params.effectif, params.forme);
    const ss = scoreStructure(params.forme);
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

  const scoreAct = APE_SCORES[params.ape] ?? 25;
  const scorePays = params.paysRisque ? 100 : 0;
  const scoreMis = MISSION_SCORES[params.mission] ?? 25;
  const scoreMat = scoreMaturite(params.dateCreation, params.dateReprise, params.effectif, params.forme);
  const scoreStr = scoreStructure(params.forme);

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
  switch (nivVigilance) {
    case "SIMPLIFIEE": d.setFullYear(d.getFullYear() + 3); break;
    case "STANDARD": d.setFullYear(d.getFullYear() + 1); break;
    case "RENFORCEE": d.setMonth(d.getMonth() + 6); break;
  }
  return d.toISOString().split("T")[0];
}

export function getPilotageStatus(dateButoir: string): string {
  const now = new Date();
  const butoir = new Date(dateButoir);
  if (isNaN(butoir.getTime())) return "RETARD";
  const diffDays = (butoir.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "RETARD";
  if (diffDays < 60) return "BIENTÔT";
  return "A JOUR";
}

