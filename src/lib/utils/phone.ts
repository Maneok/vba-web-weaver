/**
 * French phone number formatting and parsing.
 */

/** Format a phone number to standard French display format */
export function formatPhoneFR(phone: string): string {
  if (!phone) return "";
  // Strip all non-digit chars except leading +
  const hasPlus = phone.trimStart().startsWith("+");
  const digits = phone.replace(/\D/g, "");

  // International format: +33 X XX XX XX XX
  if (hasPlus && digits.startsWith("33") && digits.length === 11) {
    const national = digits.slice(2);
    return `+33 ${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
  }

  // National format: 0X XX XX XX XX
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }

  // Unrecognized — return cleaned original
  return phone.trim();
}

/** Parse and validate a French phone number */
export function parsePhoneFR(phone: string): {
  isValid: boolean;
  national: string;
  international: string;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { isValid: false, national: "", international: "", error: "Numero vide" };
  }

  const hasPlus = phone.trimStart().startsWith("+");
  const digits = phone.replace(/\D/g, "");

  let national = "";

  // +33XXXXXXXXX (11 digits)
  if (hasPlus && digits.startsWith("33") && digits.length === 11) {
    national = "0" + digits.slice(2);
  }
  // 0XXXXXXXXX (10 digits)
  else if (digits.length === 10 && digits.startsWith("0")) {
    national = digits;
  }
  // 33XXXXXXXXX without + (11 digits)
  else if (digits.startsWith("33") && digits.length === 11) {
    national = "0" + digits.slice(2);
  }
  else {
    return { isValid: false, national: "", international: "", error: "Format non reconnu" };
  }

  // Validate prefix: 01-09 for French numbers
  const prefix = parseInt(national.slice(1, 2), 10);
  if (prefix < 1 || prefix > 9) {
    return { isValid: false, national: "", international: "", error: "Prefixe invalide" };
  }

  const international = "+33" + national.slice(1);
  return { isValid: true, national, international };
}
