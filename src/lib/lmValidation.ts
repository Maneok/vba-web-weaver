// ──────────────────────────────────────────────
// Validation & sanitization pour le wizard LM
// ──────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateStep1(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.client_id) errors.push({ field: "client_id", message: "Selectionnez un client" });
  if (!data.raison_sociale) errors.push({ field: "raison_sociale", message: "Client sans raison sociale" });
  return errors;
}

export function validateStep2(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.forme_juridique) errors.push({ field: "forme_juridique", message: "Selectionnez un type de lettre" });
  if (!data.type_mission) errors.push({ field: "type_mission", message: "Selectionnez le type de mission" });
  return errors;
}

export function validateStep3(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.dirigeant) errors.push({ field: "dirigeant", message: "Nom du dirigeant requis" });
  if (!data.adresse) errors.push({ field: "adresse", message: "Adresse requise" });
  if (!data.cp || !/^\d{5}$/.test(data.cp)) errors.push({ field: "cp", message: "Code postal invalide (5 chiffres)" });
  if (!data.ville) errors.push({ field: "ville", message: "Ville requise" });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.push({ field: "email", message: "Email invalide" });
  return errors;
}

export function validateStep4(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const selected = (data.missions_selected || []).filter((m: any) => m.selected);
  if (selected.length === 0) errors.push({ field: "missions", message: "Selectionnez au moins une mission" });
  // Vérifier missions incompatibles
  const hasT = selected.some((m: any) =>
    m.sous_options?.some((s: any) => s.id === "tenue" && s.selected)
  );
  const hasS = selected.some((m: any) =>
    m.sous_options?.some((s: any) => s.id === "surveillance" && s.selected)
  );
  if (hasT && hasS) errors.push({ field: "missions", message: "Tenue et surveillance sont incompatibles" });
  return errors;
}

export function validateStep5(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.duree) errors.push({ field: "duree", message: "Duree requise" });
  if (!data.date_debut) errors.push({ field: "date_debut", message: "Date de debut requise" });
  if (data.date_debut && new Date(data.date_debut) < new Date("2020-01-01"))
    errors.push({ field: "date_debut", message: "Date de debut invalide" });
  return errors;
}

export function validateStep6(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.honoraires_ht || data.honoraires_ht <= 0)
    errors.push({ field: "honoraires_ht", message: "Honoraires HT requis et > 0" });
  if (data.honoraires_ht > 500000)
    errors.push({ field: "honoraires_ht", message: "Montant anormalement eleve (> 500 000 EUR)" });
  if (data.mode_paiement === "prelevement" && data.iban) {
    const iban = data.iban.replace(/\s/g, "");
    if (iban.length > 0 && (!/^FR\d{2}/.test(iban) || iban.length !== 27)) {
      errors.push({ field: "iban", message: "IBAN francais invalide (27 caracteres commencant par FR)" });
    }
  }
  if (!data.frequence_facturation)
    errors.push({ field: "frequence_facturation", message: "Frequence de facturation requise" });
  return errors;
}

export function validateStep7(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.associe_signataire)
    errors.push({ field: "associe_signataire", message: "Associe signataire requis" });
  return errors;
}

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
export function sanitizeWizardData<T extends Record<string, any>>(data: T): T {
  const result = { ...data };
  const textFields = [
    "dirigeant",
    "raison_sociale",
    "adresse",
    "ville",
    "rcs",
    "qualite_dirigeant",
    "clauses_supplementaires",
    "associe_signataire",
    "chef_mission",
    "referent_lcb",
  ];
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as any)[field] = sanitizeText(result[field]);
    }
  }
  return result;
}

/** Map step index (0-based) → validator */
export const VALIDATORS: Record<number, (data: any) => ValidationError[]> = {
  0: validateStep1,
  1: validateStep2,
  2: validateStep3,
  3: validateStep4,
  4: validateStep5,
  5: validateStep6,
  6: validateStep7,
};
