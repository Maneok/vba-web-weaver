// ──────────────────────────────────────────────
// Avenants aux Lettres de Mission
// OPT 36-42: structured content, signature integration, getAvenantsForLettre, counter
// ──────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { formatDateFr } from "./dateUtils";
import type { LMInstance } from "@/lib/lettreMissionEngine";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface LMAvenant {
  id: string;
  cabinet_id: string;
  instance_id: string;
  numero: string;
  objet: string;
  sections_modifiees: SectionModifiee[];
  honoraires_ancien?: string;
  honoraires_nouveau?: string;
  missions_ajoutees?: string[];
  missions_retirees?: string[];
  autres_modifications?: string;
  clause_reference: string;
  status: "brouillon" | "envoyee" | "signee" | "archivee";
  pdf_storage_path?: string;
  docx_storage_path?: string;
  signed_at?: string;
  signed_by?: string;
  signature_token_id?: string;
  responsable_ancien?: string;
  responsable_nouveau?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SectionModifiee {
  sectionId: string;
  ancienContenu: string;
  nouveauContenu: string;
}

export interface AvenantModifications {
  honorairesChange?: { ancien: string; nouveau: string };
  missionsAjoutees?: string[];
  missionsRetirees?: string[];
  sectionsModifiees?: SectionModifiee[];
  autresModifications?: string;
  changementResponsable?: { ancien: string; nouveau: string };
}

// OPT-38: Structured content block for richer generation
export interface AvenantArticle {
  numero: number;
  titre: string;
  contenu: string;
}

// ──────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────

export async function getAvenants(instanceId: string): Promise<LMAvenant[]> {
  const { data, error } = await supabase
    .from("lm_avenants")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("AVENANT", "getAvenants error", error);
    throw error;
  }
  return (data ?? []) as unknown as LMAvenant[];
}

// OPT-40: Alias for getAvenants with count
export async function getAvenantsForLettre(instanceId: string): Promise<{
  avenants: LMAvenant[];
  count: number;
  lastAvenant?: LMAvenant;
}> {
  const avenants = await getAvenants(instanceId);
  return {
    avenants,
    count: avenants.length,
    lastAvenant: avenants.length > 0 ? avenants[avenants.length - 1] : undefined,
  };
}

export async function createAvenant(payload: Partial<LMAvenant>): Promise<LMAvenant> {
  const { data, error } = await supabase
    .from("lm_avenants")
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    logger.error("AVENANT", "createAvenant error", error);
    throw error;
  }
  return data as unknown as LMAvenant;
}

export async function updateAvenant(id: string, updates: Partial<LMAvenant>): Promise<LMAvenant> {
  const { data, error } = await supabase
    .from("lm_avenants")
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("AVENANT", "updateAvenant error", error);
    throw error;
  }
  return data as unknown as LMAvenant;
}

export async function deleteAvenant(id: string): Promise<void> {
  const { error } = await supabase
    .from("lm_avenants")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("AVENANT", "deleteAvenant error", error);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Numérotation : AV-{YYYY}-{NNN}
// ──────────────────────────────────────────────

export async function getNextAvenantNumero(cabinetId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AV-${year}-`;

  const { data } = await supabase
    .from("lm_avenants")
    .select("numero")
    .eq("cabinet_id", cabinetId)
    .like("numero", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNumero = (data[0] as any).numero as string;
    const match = lastNumero.match(/AV-\d{4}-(\d+)/);
    if (match) {
      const next = parseInt(match[1], 10) + 1;
      return `${prefix}${String(next).padStart(3, "0")}`;
    }
  }
  return `${prefix}001`;
}

// OPT-42: Counter verification — nombre d'avenants pour une instance
export async function getAvenantCount(instanceId: string): Promise<number> {
  const { count, error } = await supabase
    .from("lm_avenants")
    .select("*", { count: "exact", head: true })
    .eq("instance_id", instanceId);

  if (error) {
    logger.error("AVENANT", "getAvenantCount error", error);
    return 0;
  }
  return count || 0;
}

// ──────────────────────────────────────────────
// OPT-39: Signature integration for avenants
// ──────────────────────────────────────────────

export async function markAvenantSigned(
  avenantId: string,
  signedBy: string,
  signatureTokenId?: string
): Promise<LMAvenant> {
  return updateAvenant(avenantId, {
    status: "signee",
    signed_at: new Date().toISOString(),
    signed_by: signedBy,
    signature_token_id: signatureTokenId,
  });
}

export async function markAvenantSent(avenantId: string): Promise<LMAvenant> {
  return updateAvenant(avenantId, { status: "envoyee" });
}

// ──────────────────────────────────────────────
// OPT-36/37/38: Structured content generation
// ──────────────────────────────────────────────

export function generateAvenantArticles(
  originalInstance: LMInstance,
  modifications: AvenantModifications
): AvenantArticle[] {
  const articles: AvenantArticle[] = [];
  let num = 1;

  if (modifications.honorairesChange) {
    articles.push({
      numero: num++,
      titre: "Modification des honoraires",
      contenu: `Les honoraires annuels sont modifies comme suit :\n  \u2022 Ancien montant : ${modifications.honorairesChange.ancien} \u20AC HT\n  \u2022 Nouveau montant : ${modifications.honorairesChange.nouveau} \u20AC HT`,
    });
  }

  if (modifications.missionsAjoutees && modifications.missionsAjoutees.length > 0) {
    articles.push({
      numero: num++,
      titre: "Mission(s) complementaire(s) ajoutee(s)",
      contenu: `Les missions suivantes sont ajoutees au perimetre de notre intervention :\n${modifications.missionsAjoutees.map((m) => `  \u2022 ${m}`).join("\n")}`,
    });
  }

  if (modifications.missionsRetirees && modifications.missionsRetirees.length > 0) {
    articles.push({
      numero: num++,
      titre: "Mission(s) retiree(s)",
      contenu: `Les missions suivantes sont retirees du perimetre de notre intervention :\n${modifications.missionsRetirees.map((m) => `  \u2022 ${m}`).join("\n")}`,
    });
  }

  if (modifications.changementResponsable) {
    articles.push({
      numero: num++,
      titre: "Changement de responsable de dossier",
      contenu: `Le responsable de dossier est modifie comme suit :\n  \u2022 Ancien responsable : ${modifications.changementResponsable.ancien}\n  \u2022 Nouveau responsable : ${modifications.changementResponsable.nouveau}`,
    });
  }

  if (modifications.sectionsModifiees && modifications.sectionsModifiees.length > 0) {
    for (const section of modifications.sectionsModifiees) {
      articles.push({
        numero: num++,
        titre: `Modification de la section \u00AB ${section.sectionId} \u00BB`,
        contenu: `Ancienne redaction :\n${section.ancienContenu}\n\nNouvelle redaction :\n${section.nouveauContenu}`,
      });
    }
  }

  if (modifications.autresModifications) {
    articles.push({
      numero: num++,
      titre: "Autres modifications",
      contenu: modifications.autresModifications,
    });
  }

  return articles;
}

export function generateAvenantContent(
  originalInstance: LMInstance,
  modifications: AvenantModifications
): string {
  const dateLmOrigine = formatDateFr(originalInstance.created_at);
  const dateJour = formatDateFr(new Date());

  const clientName = originalInstance.variables_resolved?.raison_sociale ?? "";
  const lines: string[] = [];

  // En-tête
  lines.push(`AVENANT \u00C0 LA LETTRE DE MISSION N\u00B0 ${originalInstance.numero}`);
  lines.push("");
  lines.push(`Client : ${clientName}`);
  lines.push(`Date : ${dateJour}`);
  lines.push("");

  // Clause de référence
  lines.push(
    `Le pr\u00E9sent document constitue un avenant \u00E0 notre lettre de mission n\u00B0 ${originalInstance.numero} \u00E9tablie le ${dateLmOrigine}. ` +
    `Les dispositions de la lettre de mission initiale non modifi\u00E9es par le pr\u00E9sent avenant restent en vigueur.`
  );
  lines.push("");

  // OPT-38: Use structured articles
  const articles = generateAvenantArticles(originalInstance, modifications);
  for (const article of articles) {
    lines.push(`ARTICLE ${article.numero} \u2014 ${article.titre}`);
    lines.push("");
    lines.push(article.contenu);
    lines.push("");
  }

  // Clause de maintien
  lines.push("\u2500".repeat(40));
  lines.push("");
  lines.push(
    "Toutes les autres dispositions de la lettre de mission initiale et de ses \u00E9ventuels avenants ant\u00E9rieurs, " +
    "non modifi\u00E9es par le pr\u00E9sent avenant, demeurent pleinement en vigueur."
  );
  lines.push("");

  // Signatures
  lines.push(`Fait \u00E0 ______________, le ${dateJour}`);
  lines.push("");
  lines.push("Pour le cabinet :                          Pour le client :");
  lines.push("");
  lines.push("Signature : ________________               Signature : ________________");

  return lines.join("\n");
}
