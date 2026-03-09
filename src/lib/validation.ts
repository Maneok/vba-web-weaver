import { z } from "zod";

// ===== CLIENT =====
export const clientSchema = z.object({
  ref: z.string().min(1, "Reference requise"),
  raisonSociale: z.string().min(1, "Raison sociale requise"),
  siren: z.string().regex(/^\d{9}$/, "SIREN invalide (9 chiffres)"),
  forme: z.string().min(1, "Forme juridique requise"),
  adresse: z.string().optional().default(""),
  cp: z.string().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)").or(z.literal("")),
  ville: z.string().optional().default(""),
  mail: z.string().email("Email invalide").or(z.literal("")),
  tel: z.string().optional().default(""),
  capital: z.number().min(0, "Capital doit etre positif").default(0),
  ape: z.string().optional().default(""),
  dirigeant: z.string().optional().default(""),
  mission: z.string().min(1, "Mission requise"),
  comptable: z.string().optional().default(""),
  honoraires: z.number().min(0).default(0),
  ppe: z.enum(["OUI", "NON"]).default("NON"),
  paysRisque: z.enum(["OUI", "NON"]).default("NON"),
  atypique: z.enum(["OUI", "NON"]).default("NON"),
  distanciel: z.enum(["OUI", "NON"]).default("NON"),
  cash: z.enum(["OUI", "NON"]).default("NON"),
  pression: z.enum(["OUI", "NON"]).default("NON"),
});

export const clientUpdateSchema = clientSchema.partial();

// ===== COLLABORATEUR =====
export const collaborateurSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  fonction: z.string().min(1, "Fonction requise"),
  email: z.string().email("Email invalide").or(z.literal("")),
  referent_lcb: z.boolean().default(false),
  suppleant: z.string().optional().default(""),
  niveau_competence: z.string().optional().default(""),
});

// ===== ALERTE =====
export const alerteSchema = z.object({
  date: z.string().min(1, "Date requise"),
  client_concerne: z.string().min(1, "Client requis"),
  categorie: z.string().min(1, "Categorie requise"),
  details: z.string().min(1, "Details requis"),
  action_prise: z.string().optional().default(""),
  responsable: z.string().optional().default(""),
  qualification: z.string().optional().default(""),
  statut: z.string().optional().default("EN COURS"),
});

// ===== INVITATION =====
export const inviteSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  fullName: z.string().min(2, "Nom trop court").max(100, "Nom trop long"),
  role: z.enum(["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"]),
});

// ===== Helpers =====
export function validateClient(data: unknown) {
  return clientSchema.safeParse(data);
}

export function validateClientUpdate(data: unknown) {
  return clientUpdateSchema.safeParse(data);
}

export function validateCollaborateur(data: unknown) {
  return collaborateurSchema.safeParse(data);
}

export function validateAlerte(data: unknown) {
  return alerteSchema.safeParse(data);
}

export function validateInvite(data: unknown) {
  return inviteSchema.safeParse(data);
}

export function formatZodErrors(error: z.ZodError): string {
  return error.errors.map(e => e.message).join(", ");
}
