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
  "SCI",
  "SCP",
  "SELAS",
  "SELARL",
  "EARL",
  "SA",
  "ASSOCIATION",
  "SNC",
  "TRUST",
  "FIDUCIE",
  "FONDATION",
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
export const FREQUENCES = ["MENSUEL", "TRIMESTRIEL", "ANNUEL"] as const;

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

// Risk score thresholds
export const RISK_THRESHOLDS = {
  SIMPLIFIEE_MAX: 30,
  STANDARD_MAX: 59,
  RENFORCEE_MIN: 60,
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
