/**
 * French business validators: SIRET, NAF/APE, TVA intra, password strength, postal code.
 */

/** Luhn checksum for SIREN/SIRET validation */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = parseInt(digits[i], 10);
    if ((digits.length - i) % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Validate a 14-digit SIRET number (SIREN + NIC) */
export function validateSIRET(siret: string): {
  valid: boolean;
  siren: string;
  nic: string;
  error?: string;
} {
  if (!siret) return { valid: false, siren: "", nic: "", error: "SIRET vide" };

  const cleaned = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(cleaned)) {
    return { valid: false, siren: "", nic: "", error: "Le SIRET doit contenir 14 chiffres" };
  }

  const siren = cleaned.slice(0, 9);
  const nic = cleaned.slice(9, 14);

  if (!luhnCheck(cleaned)) {
    return { valid: false, siren, nic, error: "Cle de controle SIRET invalide (Luhn)" };
  }

  return { valid: true, siren, nic };
}

/** Validate a NAF/APE code format (e.g. "56.10A") */
export function validateNAFCode(code: string): boolean {
  if (!code) return false;
  // Format: 2 digits + dot + 2 digits + letter (e.g. 56.10A)
  // Also accept without dot (e.g. 5610A)
  return /^\d{2}\.?\d{2}[A-Z]$/i.test(code.trim());
}

/** Validate French intra-community VAT number */
export function validateTVAIntra(tva: string): {
  valid: boolean;
  countryCode: string;
  error?: string;
} {
  if (!tva) return { valid: false, countryCode: "", error: "Numero TVA vide" };

  const cleaned = tva.replace(/\s/g, "").toUpperCase();

  if (cleaned.length < 4) {
    return { valid: false, countryCode: "", error: "Numero TVA trop court" };
  }

  const countryCode = cleaned.slice(0, 2);

  // French TVA: FR + 2 check digits + 9-digit SIREN
  if (countryCode === "FR") {
    if (!/^FR\d{2}\d{9}$/.test(cleaned)) {
      return { valid: false, countryCode, error: "Format TVA francais invalide (FR + 11 chiffres)" };
    }
    const siren = cleaned.slice(4);
    const checkDigits = parseInt(cleaned.slice(2, 4), 10);
    const expectedCheck = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
    if (checkDigits !== expectedCheck) {
      return { valid: false, countryCode, error: "Cle de controle TVA invalide" };
    }
    return { valid: true, countryCode };
  }

  // Other EU: basic format check (2 letters + digits/letters)
  if (/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(cleaned)) {
    return { valid: true, countryCode };
  }

  return { valid: false, countryCode, error: "Format de numero TVA non reconnu" };
}

/** Evaluate password strength (0-4 scale with French labels) */
export function getPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
} {
  if (!password) {
    return { score: 0, label: "Tres faible", suggestions: ["Entrez un mot de passe"] };
  }

  const suggestions: string[] = [];
  let points = 0;

  // Length checks
  if (password.length >= 8) points++;
  else suggestions.push("Au moins 8 caracteres");

  if (password.length >= 12) points++;
  else if (password.length >= 8) suggestions.push("Idealement 12 caracteres ou plus");

  // Character diversity
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  else suggestions.push("Melangez majuscules et minuscules");

  if (/\d/.test(password)) points++;
  else suggestions.push("Ajoutez des chiffres");

  if (/[^a-zA-Z0-9]/.test(password)) points++;
  else suggestions.push("Ajoutez des caracteres speciaux (!@#$...)");

  // Common patterns penalty
  const lower = password.toLowerCase();
  if (/^(password|motdepasse|123456|azerty|qwerty)/i.test(lower)) {
    points = Math.max(0, points - 2);
    suggestions.push("Evitez les mots de passe courants");
  }
  if (/(.)\1{2,}/.test(password)) {
    points = Math.max(0, points - 1);
    suggestions.push("Evitez les repetitions de caracteres");
  }

  const score = Math.min(4, Math.max(0, points)) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<number, string> = {
    0: "Tres faible",
    1: "Faible",
    2: "Moyen",
    3: "Fort",
    4: "Excellent",
  };

  return { score, label: labels[score], suggestions: score >= 3 ? [] : suggestions };
}

// Department data for enhanced postal code validation
const DEPARTMENTS: Record<string, { name: string; region: string }> = {
  "01": { name: "Ain", region: "Auvergne-Rhone-Alpes" },
  "02": { name: "Aisne", region: "Hauts-de-France" },
  "03": { name: "Allier", region: "Auvergne-Rhone-Alpes" },
  "06": { name: "Alpes-Maritimes", region: "Provence-Alpes-Cote d'Azur" },
  "13": { name: "Bouches-du-Rhone", region: "Provence-Alpes-Cote d'Azur" },
  "31": { name: "Haute-Garonne", region: "Occitanie" },
  "33": { name: "Gironde", region: "Nouvelle-Aquitaine" },
  "34": { name: "Herault", region: "Occitanie" },
  "38": { name: "Isere", region: "Auvergne-Rhone-Alpes" },
  "44": { name: "Loire-Atlantique", region: "Pays de la Loire" },
  "59": { name: "Nord", region: "Hauts-de-France" },
  "67": { name: "Bas-Rhin", region: "Grand Est" },
  "69": { name: "Rhone", region: "Auvergne-Rhone-Alpes" },
  "75": { name: "Paris", region: "Ile-de-France" },
  "77": { name: "Seine-et-Marne", region: "Ile-de-France" },
  "78": { name: "Yvelines", region: "Ile-de-France" },
  "83": { name: "Var", region: "Provence-Alpes-Cote d'Azur" },
  "91": { name: "Essonne", region: "Ile-de-France" },
  "92": { name: "Hauts-de-Seine", region: "Ile-de-France" },
  "93": { name: "Seine-Saint-Denis", region: "Ile-de-France" },
  "94": { name: "Val-de-Marne", region: "Ile-de-France" },
  "95": { name: "Val-d'Oise", region: "Ile-de-France" },
  "2A": { name: "Corse-du-Sud", region: "Corse" },
  "2B": { name: "Haute-Corse", region: "Corse" },
  "971": { name: "Guadeloupe", region: "DOM-TOM" },
  "972": { name: "Martinique", region: "DOM-TOM" },
  "973": { name: "Guyane", region: "DOM-TOM" },
  "974": { name: "La Reunion", region: "DOM-TOM" },
  "976": { name: "Mayotte", region: "DOM-TOM" },
};

/** Enhanced postal code validation with department and region info */
export function validateCodePostalEnhanced(cp: string): {
  valid: boolean;
  departement: string;
  departementNom: string;
  region: string;
  error?: string;
} {
  if (!cp) return { valid: false, departement: "", departementNom: "", region: "", error: "Code postal vide" };

  const cleaned = cp.replace(/\s/g, "");
  if (!/^\d{5}$/.test(cleaned)) {
    return { valid: false, departement: "", departementNom: "", region: "", error: "Le code postal doit contenir 5 chiffres" };
  }

  // DOM-TOM: 97X or 98X
  if (cleaned.startsWith("97") || cleaned.startsWith("98")) {
    const dept3 = cleaned.slice(0, 3);
    const info = DEPARTMENTS[dept3];
    if (info) {
      return { valid: true, departement: dept3, departementNom: info.name, region: info.region };
    }
    return { valid: true, departement: dept3, departementNom: "Outre-mer", region: "DOM-TOM" };
  }

  // Corsica: 20XXX → 2A or 2B
  if (cleaned.startsWith("20")) {
    const num = parseInt(cleaned.slice(2, 5), 10);
    const corseDept = num < 200 ? "2A" : "2B";
    const info = DEPARTMENTS[corseDept] ?? { name: "Corse", region: "Corse" };
    return { valid: true, departement: corseDept, departementNom: info.name, region: info.region };
  }

  // Metropolitan: first 2 digits
  const dept2 = cleaned.slice(0, 2);
  const deptNum = parseInt(dept2, 10);

  if (deptNum < 1 || deptNum > 95) {
    return { valid: false, departement: dept2, departementNom: "", region: "", error: "Departement invalide" };
  }

  const info = DEPARTMENTS[dept2];
  return {
    valid: true,
    departement: dept2,
    departementNom: info?.name ?? `Departement ${dept2}`,
    region: info?.region ?? "France metropolitaine",
  };
}
