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
        let remainder = "";
        for (const digit of numeric) {
          remainder = String(Number(remainder + digit) % 97);
        }
        if (remainder !== "1") {
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
  return text.replace(/[<>&"']/g, (c) => {
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
export function sanitizeWizardData<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  const textFields = [
    "dirigeant", "raison_sociale", "adresse", "ville", "rcs",
    "qualite_dirigeant", "clauses_supplementaires", "associe_signataire",
    "chef_mission", "referent_lcb",
  ];
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = sanitizeText(result[field] as string);
    }
  }
  return result;
}
