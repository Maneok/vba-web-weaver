/**
 * Application-wide constants.
 * Centralizes hardcoded values that were previously scattered across components.
 * These can later be loaded from a Supabase `parametres` table.
 */

import type { MissionType } from "@/lib/types";

// Legal forms available for client creation
export const FORMES_JURIDIQUES = [
  "ENTREPRISE INDIVIDUELLE",
  "SARL",
  "EURL",
  "SAS",
  "SASU",
  "SCI",
  "SCP",
  "SELAS",
  "SELARL",
  "SELAFA",
  "EARL",
  "SA",
  "ASSOCIATION",
  "SNC",
  "TRUST",
  "FIDUCIE",
  "FONDATION",
  "GIE",
  "LMNP",
  "MICRO-ENTREPRISE",
  "PROFESSION LIBERALE",
  "SPFPL",
] as const;

// Mission types
export const MISSIONS: MissionType[] = [
  "TENUE COMPTABLE",
  "REVISION / SURVEILLANCE",
  "SOCIAL / PAIE SEULE",
  "CONSEIL DE GESTION",
  "CONSTITUTION / CESSION",
  "DOMICILIATION",
  "IRPP",
];

// Billing frequencies
export const FREQUENCES = ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"] as const;

// Default team members — to be replaced by collaborateurs from Supabase
export const DEFAULT_COMPTABLES = ["MAGALIE", "JULIEN", "FANNY", "SERGE", "JOSE"] as const;
export const DEFAULT_ASSOCIES = ["DIDIER", "PASCAL", "KEVIN"] as const;
export const DEFAULT_SUPERVISEURS = ["SAMUEL", "BRAYAN"] as const;

// Alert categories for registre LCB-FT
export const ALERT_CATEGORIES = [
  "ADMIN : KYC Incomplet",
  "INTERNE : Erreur Procedure",
  "FLUX : Incoherence / Atypique",
  "SOUPCON : Tracfin potentiel",
  "EXTERNE : Gel des avoirs / Sanctions",
  "PPE : Personne Politiquement Exposee",
  "PAYS : Juridiction a risque",
  "ANOMALIE : Ecart detecte",
  "OPERATION ATYPIQUE : Montant inhabituel",
] as const;

// Alert priorities
export const ALERT_PRIORITIES = [
  { value: "CRITIQUE", label: "Critique", color: "text-red-400 bg-red-500/15" },
  { value: "HAUTE", label: "Haute", color: "text-orange-400 bg-orange-500/15" },
  { value: "MOYENNE", label: "Moyenne", color: "text-amber-400 bg-amber-500/15" },
  { value: "BASSE", label: "Basse", color: "text-slate-400 bg-slate-500/15" },
] as const;

// Competence levels
export const COMPETENCE_LEVELS = [
  { value: "JUNIOR", label: "Junior", color: "bg-slate-500/15 text-slate-400" },
  { value: "CONFIRME", label: "Confirme", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "SENIOR", label: "Senior", color: "bg-blue-500/15 text-blue-400" },
  { value: "EXPERT", label: "Expert", color: "bg-purple-500/15 text-purple-400" },
] as const;

// Formation status
export const FORMATION_STATUS = [
  { value: "A JOUR", label: "A jour", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "A FORMER", label: "A former", color: "bg-amber-500/15 text-amber-400" },
  { value: "JAMAIS FORME", label: "Jamais forme", color: "bg-red-500/15 text-red-400" },
] as const;

// Controle qualite results
export const CONTROLE_RESULTATS = [
  "CONFORME",
  "NON CONFORME MINEUR",
  "NON CONFORME MAJEUR",
  "CONFORME AVEC RESERVES",
] as const;

// Deadline thresholds (in days)
export const DEADLINE_THRESHOLDS = {
  CRITIQUE: 0,      // overdue
  URGENT: 7,        // within 7 days
  ATTENTION: 30,    // within 30 days
  NORMAL: 90,       // within 90 days
} as const;

// Risk score thresholds
export const RISK_THRESHOLDS = {
  SIMPLIFIEE_MAX: 30,
  STANDARD_MAX: 59,
  RENFORCEE_MIN: 60,
} as const;

// OPT-35: Validate threshold consistency at module load
if (RISK_THRESHOLDS.SIMPLIFIEE_MAX >= RISK_THRESHOLDS.STANDARD_MAX || RISK_THRESHOLDS.STANDARD_MAX >= RISK_THRESHOLDS.RENFORCEE_MIN) {
  throw new Error("Risk thresholds misconfigured: must be SIMPLIFIEE_MAX < STANDARD_MAX < RENFORCEE_MIN");
}

// Pagination
export const DEFAULT_PAGE_SIZE = 25;

// Toast durations (ms)
export const TOAST_DURATION_SHORT = 1500;
export const TOAST_DURATION_DEFAULT = 4000;
export const TOAST_DURATION_LONG = 6000;

// Timeout values (ms)
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 15000;
export const AUTOSAVE_DELAY_MS = 2000;
export const AUTH_TIMEOUT_MS = 6000;
export const RETRY_DELAY_MS = 1000;

// Retry counts
export const MAX_RETRIES = 1;

// Audit trail fetch limit
export const AUDIT_TRAIL_FETCH_LIMIT = 2000;

// Cockpit thresholds (days)
export const COCKPIT_CRITIQUE_DAYS = 180;
export const CNI_WARNING_DAYS = 90;
export const CNI_URGENT_DAYS = 30;

// Fonction options for collaborateur forms
export const FONCTION_OPTIONS = [
  { value: "ASSOCIE SIGNATAIRE", label: "Associe signataire" },
  { value: "SUPERVISEUR", label: "Superviseur" },
  { value: "COLLABORATEUR", label: "Collaborateur" },
  { value: "STAGIAIRE", label: "Stagiaire" },
  { value: "ALTERNANT", label: "Alternant" },
  { value: "SECRETAIRE", label: "Secretaire" },
] as const;

// Vigilance level color mappings (shared across components)
export const VIGILANCE_COLORS = {
  SIMPLIFIEE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  STANDARD: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  RENFORCEE: "bg-red-500/15 text-red-400 border-red-500/20",
} as const;

// C1: Documents required by vigilance level
export const DOCS_REQUIRED = {
  ALL: ["KBIS", "STATUTS", "CNI", "RIB"],
  STANDARD: [],
  RENFORCEE: [],
} as const;

// C2: LCB question categories
export const QUESTION_CATEGORIES = {
  IDENTITE: ["ppe", "paysRisque"],
  COMPORTEMENT: ["distanciel", "cash", "pression"],
  STRUCTURE: ["atypique", "changeJuridiques", "structureComplexe", "capitalInconnus"],
  GEOGRAPHIE: ["filialesEtrangeres", "transactionsPays", "fournisseursPays", "mouvementsCash"],
} as const;

// C3: Chart colors
export const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

// Audit trail action types
export const AUDIT_ACTION_TYPES = [
  "CONNEXION",
  "DECONNEXION",
  "CREATION",
  "MODIFICATION",
  "SUPPRESSION",
  "INVITATION_UTILISATEUR",
  "CHANGEMENT_ROLE",
  "CREATION_CLIENT",
  "SCREENING",
  "SCORING_CALCUL",
  "ALERTE_REGISTRE",
  "DECLARATION_TRACFIN",
  "REVUE_PERIODIQUE",
  "CONTROLE_QUALITE",
  "LETTRE_MISSION",
] as const;
