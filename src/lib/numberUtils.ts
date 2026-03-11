/**
 * Numeric and financial utilities for French accounting compliance.
 */

/** Round to nearest cent (avoid floating point errors) */
export function roundToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Format number as French currency: "1 234,56 €" */
export function formatEuro(value: number, showSymbol = true): string {
  if (!Number.isFinite(value)) return showSymbol ? "0,00 €" : "0,00";
  const formatted = value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showSymbol ? `${formatted} €` : formatted;
}

/** Format number with French locale (space separators, comma decimal) */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Parse French formatted number "1 234,56" → 1234.56 */
export function parseFrenchNumber(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  const cleaned = text.trim()
    .replace(/\s/g, "")      // remove spaces
    .replace(/\u00a0/g, "")  // remove nbsp
    .replace(/,/, ".");       // comma → dot
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Detect suspiciously round amounts (AML signal) */
export function isSuspiciouslyRound(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  // Exactly divisible by 1000 (1k, 5k, 10k, 50k, 100k)
  if (value >= 1000 && value % 1000 === 0) return true;
  // Exactly divisible by 500 for amounts over 5000
  if (value >= 5000 && value % 500 === 0) return true;
  return false;
}

/** Calculate payment schedule breakdown */
export function calculatePaymentSchedule(
  annuel: number,
  frequence: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL"
): { montant: number; echeances: number; total: number } {
  if (!Number.isFinite(annuel) || annuel < 0) {
    return { montant: 0, echeances: 0, total: 0 };
  }
  const divisors = { MENSUEL: 12, TRIMESTRIEL: 4, ANNUEL: 1 };
  const echeances = divisors[frequence] ?? 12;
  const montant = roundToCents(annuel / echeances);
  return { montant, echeances, total: roundToCents(montant * echeances) };
}

/** Validate capital/honoraires ratio for AML signals */
export function validateCapitalHonorairesRatio(
  capital: number | null,
  honoraires: number | null
): { warnings: string[] } {
  const warnings: string[] = [];
  const cap = capital ?? 0;
  const hon = honoraires ?? 0;

  if (cap > 0 && cap < 100 && hon > 10000) {
    warnings.push("Capital tres faible (<100€) avec honoraires eleves (>10k€)");
  }
  if (cap > 1_000_000 && hon < 1000) {
    warnings.push("Capital tres eleve (>1M€) avec honoraires tres faibles (<1k€)");
  }
  if (hon > 0 && isSuspiciouslyRound(hon)) {
    warnings.push("Montant d'honoraires suspicieusement rond");
  }
  return { warnings };
}

/** Calculate TVA amount */
export function calculateTVA(
  montantHT: number,
  taux: 20 | 10 | 5.5 | 2.1 = 20
): { ht: number; tva: number; ttc: number } {
  if (!Number.isFinite(montantHT) || montantHT < 0) {
    return { ht: 0, tva: 0, ttc: 0 };
  }
  const tva = roundToCents(montantHT * taux / 100);
  return { ht: roundToCents(montantHT), tva, ttc: roundToCents(montantHT + tva) };
}
