// ──────────────────────────────────────────────
// Validation & sanitization pour le wizard LM (6 étapes)
// ──────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

/** Step 1 — Client + type mission */
export function validateStep1(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.client_id) errors.push({ field: "client_id", message: "Selectionnez un client" });
  if (!data.type_mission) errors.push({ field: "type_mission", message: "Selectionnez le type de mission" });
  return errors;
}

/** Step 2 — Missions */
export function validateStep2(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const selected = (data.missions_selected || []).filter((m: any) => m.selected);
  if (selected.length === 0) errors.push({ field: "missions", message: "Selectionnez au moins une mission" });

  // Tenue (comptabilite) + surveillance incompatibles
  const ids = selected.map((m: any) => m.section_id);
  if (ids.includes("comptabilite") && data.type_mission === "SURVEILLANCE") {
    errors.push({ field: "missions", message: "Tenue et surveillance sont incompatibles" });
  }
  return errors;
}

/** Step 3 — Détails & modalités */
export function validateStep3(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.dirigeant) errors.push({ field: "dirigeant", message: "Nom du dirigeant requis" });
  if (!data.adresse) errors.push({ field: "adresse", message: "Adresse requise" });
  if (!data.cp || !/^\d{5}$/.test(data.cp)) errors.push({ field: "cp", message: "Code postal invalide (5 chiffres)" });
  if (!data.ville) errors.push({ field: "ville", message: "Ville requise" });
  if (!data.associe_signataire) errors.push({ field: "associe_signataire", message: "Associe signataire requis" });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(data.email))
    errors.push({ field: "email", message: "Email invalide" });
  return errors;
}

/** Step 4 — Honoraires */
export function validateStep4(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.honoraires_ht || data.honoraires_ht <= 0)
    errors.push({ field: "honoraires_ht", message: "Honoraires HT requis et > 0" });
  if (data.honoraires_ht > 500000)
    errors.push({ field: "honoraires_ht", message: "Montant anormalement eleve (> 500 000 EUR)" });
  if (!data.frequence_facturation)
    errors.push({ field: "frequence_facturation", message: "Frequence de facturation requise" });
  if (data.mode_paiement === "prelevement" && data.iban) {
    const iban = data.iban.replace(/\s/g, "");
    if (iban.length > 0 && (!/^FR\d{2}/.test(iban) || iban.length !== 27)) {
      errors.push({ field: "iban", message: "IBAN francais invalide (27 car. commencant par FR)" });
    }
  }
  return errors;
}

/** Step 5 — Preview (always valid) */
export function validateStep5(_data: any): ValidationError[] {
  return [];
}

/** Step 6 — Export (always valid) */
export function validateStep6(_data: any): ValidationError[] {
  return [];
}

/** Map step index (0-based) → validator */
export const VALIDATORS: Record<number, (data: any) => ValidationError[]> = {
  0: validateStep1,
  1: validateStep2,
  2: validateStep3,
  3: validateStep4,
  4: validateStep5,
  5: validateStep6,
};

/** Sanitize HTML/XSS dans les champs texte (safe against double-encoding) */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  // First decode any existing entities to avoid double-encoding
  const decoded = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x[0-9a-fA-F]+;/g, (m) => String.fromCharCode(parseInt(m.slice(3, -1), 16)))
    .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1), 10)));
  return decoded.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] || c;
  });
}

/** Sanitize toutes les données du wizard avant export */
export function sanitizeWizardData<T extends Record<string, any>>(data: T): T {
  const result = { ...data };
  const textFields = [
    "dirigeant", "raison_sociale", "adresse", "ville", "rcs",
    "qualite_dirigeant", "clauses_supplementaires", "associe_signataire",
    "chef_mission", "referent_lcb", "validateur", "email", "telephone",
  ];
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as any)[field] = sanitizeText(result[field]);
    }
  }
  return result;
}
