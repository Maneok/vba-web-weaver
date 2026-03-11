/**
 * Compliance-specific utilities for AML/KYC workflows.
 */

import type { Client, VigilanceLevel } from "@/lib/types";
import { addMonths, differenceInDays } from "./dates";

// Review period in months per vigilance level
const REVIEW_PERIODS: Record<VigilanceLevel, number> = {
  SIMPLIFIEE: 36,   // 3 years
  STANDARD: 24,     // 2 years
  RENFORCEE: 12,    // 1 year
};

/** Calculate the next review deadline based on vigilance level and last review */
export function calculateReviewDeadline(
  nivVigilance: VigilanceLevel,
  lastReviewDate: Date | string
): Date {
  const months = REVIEW_PERIODS[nivVigilance] ?? 24;
  return addMonths(lastReviewDate, months);
}

/** Check if a review is overdue and determine urgency */
export function isReviewOverdue(dateButoir: string | Date): {
  overdue: boolean;
  daysRemaining: number;
  urgency: "critique" | "urgent" | "attention" | "normal";
} {
  if (!dateButoir) {
    return { overdue: true, daysRemaining: 0, urgency: "critique" };
  }

  const now = new Date();
  let deadline: Date;
  try {
    deadline = typeof dateButoir === "string" ? new Date(dateButoir) : dateButoir;
    if (isNaN(deadline.getTime())) {
      return { overdue: true, daysRemaining: 0, urgency: "critique" };
    }
  } catch {
    return { overdue: true, daysRemaining: 0, urgency: "critique" };
  }

  const daysRemaining = differenceInDays(deadline, now);
  const overdue = daysRemaining < 0;

  let urgency: "critique" | "urgent" | "attention" | "normal";
  if (daysRemaining < 0) urgency = "critique";
  else if (daysRemaining <= 7) urgency = "urgent";
  else if (daysRemaining <= 30) urgency = "attention";
  else urgency = "normal";

  return { overdue, daysRemaining, urgency };
}

// Required and optional KYC fields
const KYC_REQUIRED_FIELDS: Array<{ key: keyof Client; label: string }> = [
  { key: "raisonSociale", label: "Raison sociale" },
  { key: "siren", label: "SIREN" },
  { key: "dirigeant", label: "Dirigeant" },
  { key: "adresse", label: "Adresse" },
  { key: "cp", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "forme", label: "Forme juridique" },
  { key: "dateCreation", label: "Date de creation" },
  { key: "ape", label: "Code APE" },
  { key: "mission", label: "Type de mission" },
  { key: "comptable", label: "Comptable assigne" },
];

const KYC_OPTIONAL_FIELDS: Array<{ key: keyof Client; label: string }> = [
  { key: "mail", label: "Email" },
  { key: "tel", label: "Telephone" },
  { key: "dateExpCni", label: "Date d'expiration CNI" },
  { key: "lienKbis", label: "Lien KBIS" },
  { key: "lienCni", label: "Lien CNI" },
  { key: "be", label: "Beneficiaire effectif" },
  { key: "iban", label: "IBAN" },
];

/** Calculate KYC completeness for a client */
export function calculateKycCompleteness(client: Partial<Client>): {
  percentage: number;
  missingFields: string[];
  status: "complet" | "partiel" | "insuffisant";
} {
  const missingFields: string[] = [];
  let filled = 0;
  const total = KYC_REQUIRED_FIELDS.length + KYC_OPTIONAL_FIELDS.length;

  for (const { key, label } of KYC_REQUIRED_FIELDS) {
    const val = client[key];
    if (val !== undefined && val !== null && val !== "") {
      filled++;
    } else {
      missingFields.push(label);
    }
  }

  for (const { key, label } of KYC_OPTIONAL_FIELDS) {
    const val = client[key];
    if (val !== undefined && val !== null && val !== "") {
      filled++;
    } else {
      missingFields.push(label);
    }
  }

  const percentage = Math.round((filled / total) * 100);
  let status: "complet" | "partiel" | "insuffisant";
  if (percentage >= 90) status = "complet";
  else if (percentage >= 50) status = "partiel";
  else status = "insuffisant";

  return { percentage, missingFields, status };
}

/** Mask sensitive data for display */
export function maskSensitiveData(
  value: string,
  type: "iban" | "siren" | "email" | "phone" | "cni"
): string {
  if (!value) return "";

  switch (type) {
    case "iban": {
      const cleaned = value.replace(/\s/g, "");
      if (cleaned.length < 8) return "****";
      return cleaned.slice(0, 4) + "****" + cleaned.slice(-4);
    }
    case "siren": {
      if (value.length < 4) return "***";
      return "***" + value.slice(-3);
    }
    case "email": {
      const at = value.indexOf("@");
      if (at <= 1) return "***@" + value.slice(at + 1);
      return value[0] + "***@" + value.slice(at + 1);
    }
    case "phone": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 6) return "** ** ** **";
      return digits.slice(0, 2) + " ** ** ** " + digits.slice(-2);
    }
    case "cni": {
      if (value.length < 4) return "****";
      return "****" + value.slice(-4);
    }
    default:
      return "****";
  }
}

/** Get overall compliance status for a client */
export function getComplianceStatus(client: Partial<Client>): {
  status: "conforme" | "non_conforme" | "a_verifier";
  issues: string[];
} {
  const issues: string[] = [];

  // KYC completeness
  const kyc = calculateKycCompleteness(client);
  if (kyc.status === "insuffisant") {
    issues.push("KYC insuffisant — champs manquants: " + kyc.missingFields.slice(0, 3).join(", "));
  }

  // Review overdue
  if (client.dateButoir) {
    const review = isReviewOverdue(client.dateButoir);
    if (review.overdue) {
      issues.push("Revue periodique en retard");
    }
  } else if (client.dateDerniereRevue) {
    // No deadline set but has a last review date — compute
    issues.push("Date butoir non definie");
  }

  // CNI expiration
  if (client.dateExpCni) {
    try {
      const expDate = new Date(client.dateExpCni);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        issues.push("CNI expiree");
      }
    } catch { /* ignore invalid dates */ }
  } else {
    issues.push("Date d'expiration CNI manquante");
  }

  // Missing documents
  if (!client.lienKbis) issues.push("KBIS manquant");
  if (!client.lienCni) issues.push("Piece d'identite manquante");

  // Risk flags without proper vigilance
  if (client.ppe === "OUI" && client.nivVigilance !== "RENFORCEE") {
    issues.push("Client PPE sans vigilance renforcee");
  }

  let status: "conforme" | "non_conforme" | "a_verifier";
  if (issues.length === 0) status = "conforme";
  else if (issues.length <= 2) status = "a_verifier";
  else status = "non_conforme";

  return { status, issues };
}
