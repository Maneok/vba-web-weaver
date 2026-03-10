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
  const count = current.year === year ? current.count + 1 : 1;
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
  return Math.round((annuel / 12) * 100) / 100;
}

export function calcHonorairesTrimestriels(annuel: number): number {
  return Math.round((annuel / 4) * 100) / 100;
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
