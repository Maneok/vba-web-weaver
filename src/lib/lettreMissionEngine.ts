import type { Client } from "@/lib/types";
import type {
  CabinetConfig,
  LettreMission,
  LettreMissionTemplate,
  LettreMissionBloc,
  LettreMissionOptions,
  LettreMissionValidation,
  BlocTemplate,
} from "@/types/lettreMission";
import { DEFAULT_LM_OPTIONS } from "@/types/lettreMission";
import { replaceVariables } from "@/lib/lettreMissionVariables";
import { renderLettreMissionPdf } from "@/lib/lettreMissionPdf";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import type { LMSection, LMModele } from "@/lib/lettreMissionModeles";
import { getModeleById, getDefaultModele, GRIMY_DEFAULT_SECTIONS, GRIMY_DEFAULT_CGV, GRIMY_DEFAULT_REPARTITION } from "@/lib/lettreMissionModeles";

// ──────────────────────────────────────────────
// Numérotation automatique (sessionStorage)
// ──────────────────────────────────────────────
const LM_COUNTER_KEY = "lcb_lm_counter";

function getStoredCounter(): { year: number; count: number } {
  try {
    const stored = sessionStorage.getItem(LM_COUNTER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed?.year === "number" && typeof parsed?.count === "number" && parsed.year === new Date().getFullYear()) {
        return parsed;
      }
    }
  } catch (err) {
    logger.warn("LM", "Failed to parse counter from sessionStorage:", err);
  }
  return { year: new Date().getFullYear(), count: 0 };
}

export function incrementCounter(): string {
  const current = getStoredCounter();
  const year = new Date().getFullYear();
  let count = current.year === year ? current.count + 1 : 1;
  // Guard overflow — restart at 1 if exceeds 9999
  if (count > 9999) count = 1;
  try { sessionStorage.setItem(LM_COUNTER_KEY, JSON.stringify({ year, count })); } catch (err) { logger.warn("LM", "Failed to save counter:", err); }
  return `LM-${year}-${String(count).padStart(3, "0")}`;
}

/**
 * Réinitialise le compteur (utile pour les tests ou initialisation depuis la BDD).
 */
export function resetCounter(value: number = 0): void {
  const year = new Date().getFullYear();
  try { sessionStorage.setItem(LM_COUNTER_KEY, JSON.stringify({ year, count: value })); } catch { /* storage full */ }
}

// ──────────────────────────────────────────────
// Calculs automatiques honoraires
// ──────────────────────────────────────────────
export function calcHonorairesMensuels(annuel: number): number {
  if (!Number.isFinite(annuel) || annuel < 0) return 0;
  return Math.round((annuel / 12) * 100) / 100;
}

export function calcHonorairesTrimestriels(annuel: number): number {
  if (!Number.isFinite(annuel) || annuel < 0) return 0;
  return Math.round((annuel / 4) * 100) / 100;
}

/** Verify yearly total consistency: 12 * monthly should match annual (within 1 cent tolerance) */
export function checkHonorairesConsistency(annuel: number): { mensuel: number; trimestriel: number; annualFromMensuel: number; ecart: number } {
  const mensuel = calcHonorairesMensuels(annuel);
  const trimestriel = calcHonorairesTrimestriels(annuel);
  const annualFromMensuel = Math.round(mensuel * 12 * 100) / 100;
  return { mensuel, trimestriel, annualFromMensuel, ecart: Math.abs(annuel - annualFromMensuel) };
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────
export function validateLettreMission(client: Client, cabinet: CabinetConfig): LettreMissionValidation {
  const champsManquants: string[] = [];

  // Client obligatoire
  if (!client.raisonSociale) champsManquants.push("Raison sociale");
  if (!client.forme) champsManquants.push("Forme juridique");
  if (!client.siren) champsManquants.push("SIREN");
  if (!client.adresse) champsManquants.push("Adresse");
  if (!client.cp) champsManquants.push("Code postal");
  if (!client.ville) champsManquants.push("Ville");
  if (!client.dirigeant) champsManquants.push("Dirigeant");
  if (!client.mission) champsManquants.push("Type de mission");
  if (!client.associe) champsManquants.push("Associé signataire");
  if (client.honoraires === undefined || client.honoraires === null) champsManquants.push("Honoraires");
  else if (client.honoraires < 0) champsManquants.push("Honoraires (montant negatif)");
  if (!client.frequence) champsManquants.push("Fréquence de facturation");

  // Cabinet obligatoire
  if (!cabinet.nom) champsManquants.push("Nom du cabinet");
  if (!cabinet.siret) champsManquants.push("SIRET du cabinet");
  if (!cabinet.numeroOEC) champsManquants.push("N° OEC du cabinet");

  return {
    valid: champsManquants.length === 0,
    champsManquants,
  };
}

// ──────────────────────────────────────────────
// Template par défaut V2
// ──────────────────────────────────────────────
export function getDefaultTemplate(): LettreMissionTemplate {
  const now = new Date().toISOString();
  return {
    id: "default-v2",
    nom: "Lettre de mission standard V2",
    description: "Modèle complet conforme OEC — 10+ pages avec LCB-FT, SEPA, attestations",
    createdAt: now,
    updatedAt: now,
    blocs: [
      {
        id: "bloc-identification",
        type: "identification",
        titre: "Identification du client",
        contenu: "Client : {{raison_sociale}}\nForme : {{forme_juridique}} — SIREN : {{siren}}\nAdresse : {{adresse_complete}}\nDirigeant : {{dirigeant}}\nActivité : {{domaine}} (APE {{ape}})\nCapital : {{capital}} €",
        ordre: 1,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-mission",
        type: "mission",
        titre: "Nature et étendue de la mission",
        contenu: `{{formule_politesse}} {{dirigeant}},

Nous avons l'honneur de vous confirmer les termes et conditions de notre intervention pour la mission de {{mission}} que vous nous confiez, conformément à l'article 151 du Code de déontologie des professionnels de l'expertise comptable.

Type de mission : {{mission}}
Fréquence : {{frequence}}
Associé signataire : {{associe}}
Superviseur : {{superviseur}}
Comptable référent : {{comptable}}
Exercice : du {{exercice_debut}} au {{exercice_fin}}`,
        ordre: 2,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-honoraires",
        type: "honoraires",
        titre: "Honoraires",
        contenu: "Honoraires annuels HT : {{hono}}\nFréquence de facturation : {{frequence}}",
        ordre: 3,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-paiement",
        type: "paiement",
        titre: "Modalités de paiement",
        contenu: `Les honoraires sont payables selon la fréquence convenue ({{frequence}}), par prélèvement SEPA ou virement bancaire.

En cas de retard de paiement, des pénalités de retard seront appliquées conformément à l'article L.441-10 du Code de commerce, au taux d'intérêt appliqué par la Banque Centrale Européenne majoré de 10 points, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.`,
        ordre: 4,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-lcbft",
        type: "lcbft",
        titre: "Obligations LCB-FT",
        contenu: `{{bloc_vigilance_lab}}`,
        ordre: 5,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-kyc",
        type: "kyc",
        titre: "Pièces justificatives (KYC)",
        contenu: `Dans le cadre de nos obligations de vigilance, nous vous remercions de bien vouloir nous fournir les documents suivants :
- Pièce d'identité en cours de validité du dirigeant
- Extrait Kbis de moins de 3 mois
- Statuts à jour
- Justificatif de domiciliation du siège social
- Liste des bénéficiaires effectifs`,
        ordre: 6,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-resiliation",
        type: "resiliation",
        titre: "Résiliation",
        contenu: `La présente lettre de mission est conclue pour une durée d'un an, renouvelable par tacite reconduction.

Chacune des parties peut mettre fin à la mission par lettre recommandée avec accusé de réception, moyennant un préavis de trois mois avant la date anniversaire.

En cas de résiliation, les travaux réalisés jusqu'à la date d'effet de la résiliation seront facturés au prorata temporis.`,
        ordre: 7,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-rgpd",
        type: "rgpd",
        titre: "Protection des données personnelles (RGPD)",
        contenu: `Conformément au Règlement Général sur la Protection des Données (UE) 2016/679 et à la loi Informatique et Libertés, nous vous informons que les données personnelles collectées dans le cadre de notre mission font l'objet d'un traitement dont le responsable est {{cabinet_nom}}.

Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et de limitation du traitement. Contact : {{cabinet_email}}.`,
        ordre: 8,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-signature",
        type: "signature",
        titre: "Signatures",
        contenu: "",
        ordre: 9,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-repartition",
        type: "repartition",
        titre: "Répartition des travaux",
        contenu: "",
        ordre: 10,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-attestation",
        type: "attestation_travail_dissimule",
        titre: "Attestation travail dissimulé",
        contenu: "",
        ordre: 11,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-sepa",
        type: "sepa",
        titre: "Mandat de prélèvement SEPA",
        contenu: "",
        ordre: 12,
        obligatoire: false,
        visible: true,
      },
      {
        id: "bloc-autorisation-liasse",
        type: "autorisation_liasse",
        titre: "Autorisation liasse fiscale",
        contenu: "",
        ordre: 13,
        obligatoire: true,
        visible: true,
      },
      {
        id: "bloc-conditions",
        type: "conditions_generales",
        titre: "Conditions générales",
        contenu: "",
        ordre: 14,
        obligatoire: true,
        visible: true,
      },
    ],
  };
}

// ──────────────────────────────────────────────
// Génération principale
// ──────────────────────────────────────────────

/**
 * Génère un objet LettreMission structuré avec tous les blocs résolus.
 */
export function generateLettreMission(
  client: Client,
  template: LettreMissionTemplate,
  cabinetConfig: CabinetConfig,
  options: LettreMissionOptions = DEFAULT_LM_OPTIONS
): LettreMission {
  const numero = incrementCounter();
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const blocs: LettreMissionBloc[] = template.blocs
    .filter((b) => b.visible)
    .sort((a, b) => a.ordre - b.ordre)
    .map((bloc: BlocTemplate) => ({
      id: bloc.id,
      type: bloc.type,
      titre: bloc.titre,
      contenuBrut: bloc.contenu,
      contenuRendu: replaceVariables(bloc.contenu, client, cabinetConfig, options),
      ordre: bloc.ordre,
      visible: bloc.visible,
    }));

  return {
    numero,
    date,
    client,
    cabinet: cabinetConfig,
    template,
    blocs,
    options,
    metadata: {
      genereLe: new Date().toISOString(),
      genereParUser: client.associe,
      version: 1,
      statut: "brouillon",
    },
  };
}

/**
 * Génère une lettre depuis une référence client (raccourci).
 * Charge les données et retourne la LettreMission structurée.
 */
export function generateFromClient(
  client: Client,
  cabinetConfig: CabinetConfig,
  options: LettreMissionOptions = DEFAULT_LM_OPTIONS
): LettreMission {
  const template = getDefaultTemplate();
  return generateLettreMission(client, template, cabinetConfig, options);
}

/**
 * Génère et télécharge un PDF à partir d'un objet LettreMission.
 */
export function renderToPdf(lettreMission: LettreMission): void {
  try {
    const doc = renderLettreMissionPdf(lettreMission);
    const filename = `LDM_${lettreMission?.numero ?? "draft"}_${(lettreMission?.client?.raisonSociale ?? "client").replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
  } catch (err: unknown) {
    logger.error("PDF", "renderToPdf error", err);
    toast.error("Erreur lors de la génération du PDF. Veuillez réessayer.");
  }
}

/**
 * Génère et télécharge un DOCX (délègue à lettreMissionDocx.ts).
 */
export async function renderToDocx(lettreMission: LettreMission): Promise<void> {
  const { renderLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
  await renderLettreMissionDocx(lettreMission);
}

// ──────────────────────────────────────────────
// LM Instance type (mirrors lm_instances table)
// ──────────────────────────────────────────────

export interface LMInstance {
  id: string;
  cabinet_id: string;
  modele_id: string;
  client_ref: string;
  numero: string;
  status: "brouillon" | "en_validation" | "envoyee" | "signee" | "archivee";
  sections_snapshot: LMSection[];
  cgv_snapshot: string;
  repartition_snapshot: any[];
  variables_resolved: Record<string, string>;
  wizard_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Numérotation Supabase (lm_instances)
// ──────────────────────────────────────────────

export async function getNextLmNumero(cabinetId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LM-${year}-`;

  const { data } = await supabase
    .from("lm_instances")
    .select("numero")
    .eq("cabinet_id", cabinetId)
    .like("numero", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNumero = data[0].numero as string;
    const match = lastNumero.match(/LM-\d{4}-(\d+)/);
    if (match) {
      const next = parseInt(match[1], 10) + 1;
      return `${prefix}${String(next).padStart(3, "0")}`;
    }
  }
  return `${prefix}001`;
}

// ──────────────────────────────────────────────
// Résolution des variables d'un modèle
// ──────────────────────────────────────────────

export function resolveModeleSections(
  sections: LMSection[],
  variablesMap: Record<string, string>,
  missionsSelected?: { section_id: string; selected: boolean }[]
): LMSection[] {
  return sections
    .filter((s) => {
      // Filter hidden sections
      if ((s as any).hidden) return false;
      // Filter conditional sections based on missions
      if (s.type === "conditional" && s.condition && missionsSelected) {
        const condMap: Record<string, string> = {
          sociale: "social",
          juridique: "juridique",
          fiscal: "fiscal",
          clause_resolutoire: "clause_resolutoire",
          mandat_fiscal: "mandat_fiscal",
        };
        const sectionId = condMap[s.condition] || s.condition;
        const mission = missionsSelected.find((m) => m.section_id === sectionId);
        if (mission && !mission.selected) return false;
      }
      return true;
    })
    .map((s, i) => ({
      ...s,
      contenu: resolveVariablesInText(s.contenu, variablesMap),
      ordre: i + 1,
    }));
}

function resolveVariablesInText(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}\\}`, "gi");
    result = result.replace(regex, value ?? "");
  }
  return result;
}

// ──────────────────────────────────────────────
// Build variables map from wizard data
// ──────────────────────────────────────────────

export function buildVariablesMap(wizardData: Record<string, unknown>): Record<string, string> {
  const d = wizardData;
  const now = new Date();
  const fmt = (dt: Date) => dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const year = now.getFullYear();

  return {
    // Client
    raison_sociale: String(d.raison_sociale ?? ""),
    forme_juridique: String(d.forme_juridique ?? ""),
    siren: String(d.siren ?? ""),
    dirigeant: String(d.dirigeant ?? ""),
    adresse: String(d.adresse ?? ""),
    code_postal: String(d.cp ?? ""),
    cp: String(d.cp ?? ""),
    ville: String(d.ville ?? ""),
    capital: String(d.capital ?? ""),
    ape: String(d.ape ?? ""),
    email: String(d.email ?? ""),
    telephone: String(d.telephone ?? ""),
    iban: String(d.iban ?? ""),
    bic: String(d.bic ?? ""),
    adresse_complete: `${d.adresse ?? ""}, ${d.cp ?? ""} ${d.ville ?? ""}`.trim(),
    // Mission
    associe: String(d.associe_signataire ?? ""),
    responsable_mission: String(d.associe_signataire ?? ""),
    chef_mission: String(d.chef_mission ?? ""),
    superviseur: String(d.chef_mission ?? ""),
    referent_lcb: String(d.referent_lcb ?? ""),
    type_mission: String(d.type_mission ?? ""),
    mission: String(d.type_mission ?? ""),
    frequence: String(d.frequence_facturation ?? ""),
    honoraires: Number(d.honoraires_ht ?? 0).toLocaleString("fr-FR"),
    hono: `${Number(d.honoraires_ht ?? 0).toLocaleString("fr-FR")} € HT`,
    honoraires_ttc: (Number(d.honoraires_ht ?? 0) * 1.2).toLocaleString("fr-FR"),
    // Dates
    date_du_jour: fmt(now),
    date_jour: fmt(now),
    date_lettre: fmt(now),
    annee: String(year),
    date_debut_mission: fmt(new Date(year, 0, 1)),
    date_fin_mission: fmt(new Date(year, 11, 31)),
    date_cloture: String(d.date_cloture ?? fmt(new Date(year, 11, 31))),
    date_debut: String(d.date_debut ?? fmt(now)),
    // Options
    formule_politesse: "Monsieur",
    genre: "M.",
    periodicite: String(d.frequence_facturation ?? "MENSUEL"),
    // Modele constants
    referentiel_comptable: "PCG (règlement ANC n°2014-03)",
    forme_rapport: "Attestation de présentation des comptes",
    indice_revision: "Indice INSEE prix services comptables",
    delai_mise_en_demeure: "30 jours",
    // Cabinet (filled later from profile if available)
    nom_cabinet: "",
    cabinet_nom: "",
    ville_cabinet: "",
  };
}

// ──────────────────────────────────────────────
// Génération depuis un modèle
// ──────────────────────────────────────────────

export async function generateFromModele(
  modeleId: string,
  wizardData: Record<string, unknown>,
  cabinetId: string
): Promise<LMInstance> {
  // Load modele
  let modele: LMModele;
  try {
    modele = await getModeleById(modeleId);
  } catch {
    // Fallback to default modele or GRIMY defaults
    const defaultModele = await getDefaultModele(cabinetId);
    if (defaultModele) {
      modele = defaultModele;
    } else {
      modele = {
        id: "grimy-fallback",
        cabinet_id: cabinetId,
        nom: "GRIMY par défaut",
        sections: GRIMY_DEFAULT_SECTIONS,
        cgv_content: GRIMY_DEFAULT_CGV,
        repartition_taches: GRIMY_DEFAULT_REPARTITION,
        is_default: true,
        source: "grimy",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Build variables map
  const variablesMap = buildVariablesMap(wizardData);

  // Resolve sections
  const missionsSelected = (wizardData.missions_selected as { section_id: string; selected: boolean }[]) ?? [];
  const resolvedSections = resolveModeleSections(modele.sections, variablesMap, missionsSelected);

  // Resolve CGV
  const resolvedCgv = resolveVariablesInText(modele.cgv_content, variablesMap);

  // Get next numero
  const numero = await getNextLmNumero(cabinetId);

  // Insert instance
  const { data: instance, error } = await supabase
    .from("lm_instances")
    .insert({
      cabinet_id: cabinetId,
      modele_id: modele.id === "grimy-fallback" ? null : modele.id,
      client_ref: String(wizardData.client_ref ?? ""),
      numero,
      status: "brouillon",
      sections_snapshot: resolvedSections,
      cgv_snapshot: resolvedCgv,
      repartition_snapshot: modele.repartition_taches,
      variables_resolved: variablesMap,
      wizard_data: wizardData,
    })
    .select()
    .single();

  if (error) {
    logger.error("LM_INSTANCE", "generateFromModele error", error);
    throw error;
  }

  return instance as LMInstance;
}
