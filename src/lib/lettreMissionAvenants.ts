import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
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

// ──────────────────────────────────────────────
// Génération du contenu textuel de l'avenant
// ──────────────────────────────────────────────

export function generateAvenantContent(
  originalInstance: LMInstance,
  modifications: AvenantModifications
): string {
  const dateLmOrigine = new Date(originalInstance.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateJour = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const clientName = originalInstance.variables_resolved?.raison_sociale ?? "";
  const lines: string[] = [];

  // En-tête
  lines.push(`AVENANT À LA LETTRE DE MISSION N° ${originalInstance.numero}`);
  lines.push("");
  lines.push(`Client : ${clientName}`);
  lines.push(`Date : ${dateJour}`);
  lines.push("");

  // Clause de référence
  lines.push(
    `Le présent document constitue un avenant à notre lettre de mission n° ${originalInstance.numero} établie le ${dateLmOrigine}. ` +
    `Les dispositions de la lettre de mission initiale non modifiées par le présent avenant restent en vigueur.`
  );
  lines.push("");

  // Modifications des honoraires
  if (modifications.honorairesChange) {
    lines.push("ARTICLE — Modification des honoraires");
    lines.push("");
    lines.push("Les honoraires annuels sont modifiés comme suit :");
    lines.push(`  • Ancien montant : ${modifications.honorairesChange.ancien} € HT`);
    lines.push(`  • Nouveau montant : ${modifications.honorairesChange.nouveau} € HT`);
    lines.push("");
  }

  // Missions ajoutées
  if (modifications.missionsAjoutees && modifications.missionsAjoutees.length > 0) {
    lines.push("ARTICLE — Mission(s) complémentaire(s) ajoutée(s)");
    lines.push("");
    lines.push("Les missions suivantes sont ajoutées au périmètre de notre intervention :");
    for (const m of modifications.missionsAjoutees) {
      lines.push(`  • ${m}`);
    }
    lines.push("");
  }

  // Missions retirées
  if (modifications.missionsRetirees && modifications.missionsRetirees.length > 0) {
    lines.push("ARTICLE — Mission(s) retirée(s)");
    lines.push("");
    lines.push("Les missions suivantes sont retirées du périmètre de notre intervention :");
    for (const m of modifications.missionsRetirees) {
      lines.push(`  • ${m}`);
    }
    lines.push("");
  }

  // Sections modifiées
  if (modifications.sectionsModifiees && modifications.sectionsModifiees.length > 0) {
    for (const section of modifications.sectionsModifiees) {
      lines.push(`ARTICLE — Modification de la section « ${section.sectionId} »`);
      lines.push("");
      lines.push("Ancienne rédaction :");
      lines.push(section.ancienContenu);
      lines.push("");
      lines.push("Nouvelle rédaction :");
      lines.push(section.nouveauContenu);
      lines.push("");
    }
  }

  // Autres modifications
  if (modifications.autresModifications) {
    lines.push("ARTICLE — Autres modifications");
    lines.push("");
    lines.push(modifications.autresModifications);
    lines.push("");
  }

  // Clause de maintien
  lines.push("─".repeat(40));
  lines.push("");
  lines.push(
    "Toutes les autres dispositions de la lettre de mission initiale et de ses éventuels avenants antérieurs, " +
    "non modifiées par le présent avenant, demeurent pleinement en vigueur."
  );
  lines.push("");

  // Signatures
  lines.push(`Fait à ______________, le ${dateJour}`);
  lines.push("");
  lines.push("Pour le cabinet :                          Pour le client :");
  lines.push("");
  lines.push("Signature : ________________               Signature : ________________");

  return lines.join("\n");
}
