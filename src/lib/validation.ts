/**
 * Zod validation schemas with French error messages.
 * Used across forms for consistent client-side validation.
 */
import { z } from "zod";

/** Schema for client creation / editing */
export const clientSchema = z.object({
  raisonSociale: z
    .string({ required_error: "La raison sociale est obligatoire" })
    .min(1, "La raison sociale est obligatoire")
    .max(200, "La raison sociale ne doit pas depasser 200 caracteres"),
  forme: z
    .string({ required_error: "La forme juridique est obligatoire" })
    .min(1, "La forme juridique est obligatoire"),
  siren: z
    .string()
    .regex(/^\d{3}\s?\d{3}\s?\d{3}$/, "Le SIREN doit contenir 9 chiffres")
    .or(z.literal(""))
    .optional(),
  adresse: z
    .string({ required_error: "L'adresse est obligatoire" })
    .min(1, "L'adresse est obligatoire"),
  cp: z
    .string({ required_error: "Le code postal est obligatoire" })
    .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z
    .string({ required_error: "La ville est obligatoire" })
    .min(1, "La ville est obligatoire"),
  dirigeant: z
    .string({ required_error: "Le nom du dirigeant est obligatoire" })
    .min(1, "Le nom du dirigeant est obligatoire"),
  mail: z
    .string()
    .email("L'adresse email est invalide")
    .or(z.literal(""))
    .optional(),
  tel: z
    .string()
    .regex(/^[\d\s+()-]{10,20}$/, "Le numero de telephone est invalide")
    .or(z.literal(""))
    .optional(),
});

/** Schema for collaborateur */
export const collaborateurSchema = z.object({
  nom: z
    .string({ required_error: "Le nom est obligatoire" })
    .min(1, "Le nom est obligatoire"),
  fonction: z
    .string({ required_error: "La fonction est obligatoire" })
    .min(1, "La fonction est obligatoire"),
  email: z
    .string({ required_error: "L'email est obligatoire" })
    .email("L'adresse email est invalide"),
});

/** Schema for alerte registre */
export const alerteSchema = z.object({
  date: z
    .string({ required_error: "La date est obligatoire" })
    .min(1, "La date est obligatoire"),
  clientConcerne: z
    .string({ required_error: "Le client concerne est obligatoire" })
    .min(1, "Le client concerne est obligatoire"),
  categorie: z
    .string({ required_error: "La categorie est obligatoire" })
    .min(1, "La categorie est obligatoire"),
  details: z
    .string({ required_error: "Les details sont obligatoires" })
    .min(1, "Les details sont obligatoires"),
  responsable: z
    .string({ required_error: "Le responsable est obligatoire" })
    .min(1, "Le responsable est obligatoire"),
});

/** Standalone email validation schema with French error message */
export const emailSchema = z
  .string()
  .email("Adresse email invalide. Veuillez saisir une adresse au format valide (ex: nom@domaine.fr)");

/** Validate an email string — returns null if valid, or a French error message */
export function validateEmail(email: string): string | null {
  if (!email || email.trim() === "") return null; // empty is valid (not required)
  const result = emailSchema.safeParse(email);
  return result.success ? null : result.error.errors[0]?.message ?? "Adresse email invalide";
}

export type ClientFormData = z.infer<typeof clientSchema>;
export type CollaborateurFormData = z.infer<typeof collaborateurSchema>;
export type AlerteFormData = z.infer<typeof alerteSchema>;
