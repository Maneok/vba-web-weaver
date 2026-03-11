/**
 * Extended validation functions for French business compliance.
 */

/** Validate SIRET (14 digits) using Luhn algorithm */
export function validateSIRET(siret: string): boolean {
  const clean = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Validate EU TVA intracommunautaire number (French: FR + 2 digits/chars + SIREN) */
export function validateTVAIntra(tva: string): boolean {
  const clean = tva.replace(/\s/g, "").toUpperCase();
  if (!/^FR[0-9A-Z]{2}\d{9}$/.test(clean)) return false;
  // Verify SIREN part with Luhn
  const siren = clean.slice(4);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(siren[i], 10);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Known disposable/temporary email domains */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "guerrillamail.info", "grr.la",
  "mailinator.com", "tempmail.com", "throwaway.email", "temp-mail.org",
  "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com", "maildrop.cc",
  "dispostable.com", "mailnesia.com", "spamgourmet.com", "trashmail.com",
  "yopmail.com", "yopmail.fr", "jetable.com", "trash-mail.com",
  "mytemp.email", "tempail.com", "mohmal.com", "getnada.com",
]);

/** Check if email domain is a known disposable/temporary service */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/** Classify French phone number type */
export function validatePhoneType(phone: string): {
  valid: boolean;
  type?: "mobile" | "fixe" | "premium" | "gratuit";
  normalized?: string;
} {
  if (!phone || typeof phone !== "string") return { valid: false };
  const clean = phone.replace(/[\s.\-()]/g, "");
  // Normalize +33 prefix
  const normalized = clean.startsWith("+33") ? "0" + clean.slice(3) : clean;
  if (!/^0[1-9]\d{8}$/.test(normalized)) return { valid: false };
  const prefix = normalized.slice(0, 2);
  if (["06", "07"].includes(prefix)) return { valid: true, type: "mobile", normalized };
  if (["01", "02", "03", "04", "05", "09"].includes(prefix)) return { valid: true, type: "fixe", normalized };
  if (prefix === "08") {
    const third = normalized[2];
    if (third === "0") return { valid: true, type: "gratuit", normalized };
    return { valid: true, type: "premium", normalized };
  }
  return { valid: false };
}

/** Comprehensive client date validation */
export function validateClientDates(dates: {
  dateCreation?: string;
  dateReprise?: string;
  dateExpCni?: string;
  dateButoir?: string;
  dateDerniereRevue?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = new Date();

  if (dates.dateCreation) {
    const d = new Date(dates.dateCreation);
    if (isNaN(d.getTime())) errors.push("Date de creation invalide");
    else if (d > now) errors.push("Date de creation dans le futur");
    else if (d < new Date("1800-01-01")) errors.push("Date de creation trop ancienne");
  }

  if (dates.dateReprise && dates.dateCreation) {
    const reprise = new Date(dates.dateReprise);
    const creation = new Date(dates.dateCreation);
    if (!isNaN(reprise.getTime()) && !isNaN(creation.getTime()) && reprise < creation) {
      errors.push("Date de reprise anterieure a la date de creation");
    }
  }

  if (dates.dateExpCni) {
    const d = new Date(dates.dateExpCni);
    if (isNaN(d.getTime())) errors.push("Date d'expiration CNI invalide");
    else {
      const yearsDiff = (d.getTime() - now.getTime()) / (365.25 * 86400000);
      if (yearsDiff < -15) errors.push("CNI expiree depuis plus de 15 ans (donnee obsolete)");
    }
  }

  if (dates.dateDerniereRevue) {
    const d = new Date(dates.dateDerniereRevue);
    if (!isNaN(d.getTime()) && d > now) {
      errors.push("Date de derniere revue dans le futur");
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate beneficiary ownership percentages */
export function validateBeneficiaryPercentages(
  beneficiaries: { nom: string; pourcentage: number }[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(beneficiaries)) return { valid: false, errors: ["Liste invalide"] };

  let total = 0;
  for (const b of beneficiaries) {
    if (b.pourcentage < 0) errors.push(`${b.nom}: pourcentage negatif`);
    if (b.pourcentage > 100) errors.push(`${b.nom}: pourcentage superieur a 100%`);
    total += b.pourcentage;
  }
  if (total > 100) errors.push(`Total des parts = ${total}% (superieur a 100%)`);

  return { valid: errors.length === 0, errors };
}

/** Validate NAF/APE code format (XX.XXY where Y is letter or digit) */
export function validateNAF(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  return /^\d{2}\.\d{2}[A-Z]$/.test(code.trim().toUpperCase());
}

/** Validate RCS format (Ville + B/A/C/D + number) */
export function validateRCS(rcs: string): boolean {
  if (!rcs || typeof rcs !== "string") return false;
  // Common format: "RCS PARIS B 123 456 789" or "PARIS B 123456789"
  const clean = rcs.replace(/\s/g, "").toUpperCase();
  return /^(RCS)?[A-Z]+[ABCD]\d{9}$/.test(clean);
}
