// ──────────────────────────────────────────────
// Validation & sanitization pour le wizard LM (6 étapes)
// ──────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

/** Step 1 — Client + type mission */
export function validateStep1(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.client_id) errors.push({ field: "client_id", message: "Selectionnez un client" });
  if (!data.type_mission) errors.push({ field: "type_mission", message: "Selectionnez le type de mission" });
  return errors;
}

/** Step 2 — Missions */
export function validateStep2(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const missions = Array.isArray(data.missions_selected) ? data.missions_selected : [];
  const selected = missions.filter((m: Record<string, unknown>) => m.selected);
  if (selected.length === 0) errors.push({ field: "missions", message: "Selectionnez au moins une mission" });

  // Tenue + surveillance incompatibles
  const ids = selected.map((m: Record<string, unknown>) => m.section_id);
  if (ids.includes("tenue") && ids.includes("surveillance")) {
    errors.push({ field: "missions", message: "Tenue et surveillance sont incompatibles" });
  }
  return errors;
}

/** Step 3 — Détails & modalités */
export function validateStep3(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.dirigeant) errors.push({ field: "dirigeant", message: "Nom du dirigeant requis" });
  if (!data.adresse) errors.push({ field: "adresse", message: "Adresse requise" });
  if (!data.cp || !/^\d{5}$/.test(String(data.cp))) errors.push({ field: "cp", message: "Code postal invalide (5 chiffres)" });
  if (!data.ville) errors.push({ field: "ville", message: "Ville requise" });
  if (!data.associe_signataire) errors.push({ field: "associe_signataire", message: "Associe signataire requis" });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email)))
    errors.push({ field: "email", message: "Email invalide" });
  return errors;
}

/** Step 4 — Honoraires */
export function validateStep4(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const honoraires = Number(data.honoraires_ht) || 0;
  if (!data.honoraires_ht || honoraires <= 0)
    errors.push({ field: "honoraires_ht", message: "Honoraires HT requis et > 0" });
  if (honoraires > 500000)
    errors.push({ field: "honoraires_ht", message: "Montant anormalement eleve (> 500 000 EUR)" });
  if (!data.frequence_facturation)
    errors.push({ field: "frequence_facturation", message: "Frequence de facturation requise" });
  if (data.mode_paiement === "prelevement" && data.iban) {
    const iban = String(data.iban).replace(/\s/g, "");
    if (iban.length > 0) {
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban.toUpperCase())) {
        errors.push({ field: "iban", message: "Format IBAN invalide" });
      } else if (iban.toUpperCase().startsWith("FR") && iban.length !== 27) {
        errors.push({ field: "iban", message: "IBAN francais invalide (27 car. commencant par FR)" });
      } else {
        // Modulo 97 checksum
        const clean = iban.toUpperCase();
        const rearranged = clean.slice(4) + clean.slice(0, 4);
        const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
        let remainder = 0;
        for (const ch of numeric) {
          remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
        }
        if (remainder !== 1) {
          errors.push({ field: "iban", message: "Cle IBAN invalide (checksum incorrecte)" });
        }
      }
    }
  }
  return errors;
}

/** Step 5 — Preview (always valid) */
export function validateStep5(): ValidationError[] {
  return [];
}

/** Step 6 — Export (always valid) */
export function validateStep6(): ValidationError[] {
  return [];
}

/** Map step index (0-based) → validator */
export const VALIDATORS: Record<number, (data: Record<string, unknown>) => ValidationError[]> = {
  0: validateStep1,
  1: validateStep2,
  2: validateStep3,
  3: validateStep4,
  4: validateStep5,
  5: validateStep6,
};

/** Sanitize HTML/XSS dans les champs texte */
export function sanitizeText(text: string): string {
  // Strip null bytes and other control characters (except newlines/tabs)
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Remove zero-width and invisible unicode characters used to bypass filters
  cleaned = cleaned.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\uFFF9-\uFFFB]/g, "");
  // HTML-encode dangerous characters FIRST (before stripping URI schemes,
  // so we don't double-encode on repeated calls — & is only encoded if it's
  // not already part of a valid HTML entity)
  cleaned = cleaned.replace(/&(?!(?:amp|lt|gt|quot|#39|#96);)/g, "&amp;");
  cleaned = cleaned.replace(/</g, "&lt;");
  cleaned = cleaned.replace(/>/g, "&gt;");
  cleaned = cleaned.replace(/"/g, "&quot;");
  cleaned = cleaned.replace(/'/g, "&#39;");
  cleaned = cleaned.replace(/`/g, "&#96;");
  // Remove javascript: / data: / vbscript: URI schemes (case-insensitive,
  // whitespace/control-char tolerant to block obfuscation like "java\tscript:")
  cleaned = cleaned.replace(/(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t)\s*:/gi, "");
  // Remove event handler attributes (onclick, onerror, onload, etc.)
  cleaned = cleaned.replace(/\bon\w+\s*=/gi, "");
  // Remove <script and </script tags (even if < was encoded above)
  cleaned = cleaned.replace(/&lt;\s*\/?script/gi, "");
  return cleaned;
}

/** Sanitize recursively — handles strings, arrays, and nested objects */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeValue(obj[key]);
    }
    return result;
  }
  return value;
}

/** Sanitize toutes les données du wizard avant export */
export function sanitizeWizardData<T extends Record<string, unknown>>(data: T): T {
  // Deep-sanitize all string values in the wizard data, not just a hardcoded list
  return sanitizeValue(data) as T;
}
