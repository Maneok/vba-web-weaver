// OPT-46: Hoist KNOWN_IBAN_COUNTRIES to module level (avoid re-creation per call)
const KNOWN_IBAN_COUNTRIES = new Set([
  "AD","AE","AL","AT","AZ","BA","BE","BG","BH","BR","BY","CH","CR","CY","CZ",
  "DE","DK","DO","EE","EG","ES","FI","FO","FR","GB","GE","GI","GL","GR","GT",
  "HR","HU","IE","IL","IQ","IS","IT","JO","KW","KZ","LB","LC","LI","LT","LU",
  "LV","MC","MD","ME","MK","MR","MT","MU","NL","NO","PK","PL","PS","PT","QA",
  "RO","RS","SA","SC","SE","SI","SK","SM","ST","SV","TL","TN","TR","UA","VA","VG","XK",
]);

// OPT: Hoist FR bank map to module level (avoid re-creation per call)
const FR_BANKS = new Map([
  ["30004", "BNP Paribas"], ["30006", "BNP Paribas"], ["10011", "BNP Paribas"],
  ["30003", "Société Générale"], ["30056", "HSBC"],
  ["14508", "Crédit Mutuel"], ["10278", "Crédit Mutuel"],
  ["17569", "Crédit Agricole"], ["17206", "Crédit Agricole"], ["15589", "Crédit Agricole"],
  ["20041", "La Banque Postale"], ["30002", "LCL"],
  ["10057", "Caisse d'Épargne"], ["12506", "Caisse d'Épargne"],
  ["30027", "CIC"], ["10096", "CIC"], ["30066", "CIC"],
]);

// OPT: Hoist IBAN length map to module level
const IBAN_LENGTHS = new Map<string, number>([
  ["FR", 27], ["DE", 22], ["ES", 24], ["IT", 27], ["BE", 16],
  ["LU", 20], ["CH", 21], ["GB", 22], ["NL", 18], ["PT", 25], ["AT", 20], ["IE", 22],
]);

export function validateIBAN(iban: string): { valid: boolean; bankName?: string; error?: string } {
  if (!iban || typeof iban !== "string") return { valid: false, error: "IBAN requis" };
  const trimmed = iban.trim();
  if (!trimmed) return { valid: false, error: "IBAN requis" };
  // Reject non-alphanumeric characters (except spaces, which are stripped)
  if (/[^A-Za-z0-9\s]/.test(trimmed)) return { valid: false, error: "L'IBAN ne doit contenir que des lettres et chiffres" };
  const clean = trimmed.replace(/\s/g, "").toUpperCase();
  if (clean.length < 15 || clean.length > 34) return { valid: false, error: "Longueur IBAN invalide (15-34 caractères)" };
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return { valid: false, error: "Format IBAN invalide" };
  const countryCode = clean.slice(0, 2);
  if (!KNOWN_IBAN_COUNTRIES.has(countryCode)) return { valid: false, error: `Code pays IBAN inconnu: ${countryCode}` };
  // Country-specific length checks
  const expectedLen = IBAN_LENGTHS.get(countryCode);
  if (expectedLen && clean.length !== expectedLen) {
    return { valid: false, error: `IBAN ${countryCode} = ${expectedLen} caractères (reçu ${clean.length})` };
  }

  // Vérification modulo 97 (chunk-safe to avoid integer overflow on long IBANs)
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  if (remainder !== 1) return { valid: false, error: "Clé IBAN invalide" };

  // Nom de la banque depuis le code établissement (FR only)
  if (!clean.startsWith("FR")) return { valid: true };
  const codeEtab = clean.slice(4, 9);
  return { valid: true, bankName: FR_BANKS.get(codeEtab) || "Banque inconnue" };
}
