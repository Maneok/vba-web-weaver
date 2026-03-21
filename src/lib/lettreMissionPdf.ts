import { logger } from "@/lib/logger";
import { formatDateFr } from "./dateUtils";
import type { LettreMission, CabinetConfig } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import type {
  LettreMissionPdfData,
  CabinetInfo,
  ClientLmData,
  MissionConfig,
  HonorairesData,
  LcbftData,
  PdfRepartitionRow,
} from "@/types/lettreMissionPdf";
import { DEFAULT_REPARTITION, DEFAULT_CABINET } from "@/lib/lettreMissionDefaults";
import { getMissionTypeConfig } from "@/lib/lettreMissionTypes";
import { normalizeSiren } from "@/components/lettre-mission/pdf/pdfStyles";

// ══════════════════════════════════════════════
// IMPORTANT: @react-pdf/renderer and PDF components are loaded via dynamic
// import() ONLY when actually generating a PDF. This prevents the heavy WASM
// bundle from being pulled in at page-load time (which triggers CSP errors
// and "unsupported number" crashes during module evaluation).
// ══════════════════════════════════════════════

async function renderToBlob(data: LettreMissionPdfData): Promise<Blob> {
  const React = await import("react");
  const { pdf } = await import("@react-pdf/renderer");
  const { default: LettreMissionPdfDocument } = await import(
    "@/components/lettre-mission/pdf/LettreMissionPdfDocument"
  );
  return pdf(React.createElement(LettreMissionPdfDocument, { data })).toBlob();
}

export async function generateLettreMissionPdf(data: LettreMissionPdfData): Promise<void> {
  console.time("[PDF] generateLettreMissionPdf");
  try {
    // A15 — validate & sanitize data before rendering
    const validatedData = validatePdfData(data);
    const { saveAs } = await import("file-saver");
    const blob = await renderToBlob(validatedData);
    // E3 — sanitize filename: strip special chars, limit length
    const safeNumero = (validatedData.numero_lm || "LM").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const safeDate = (validatedData.date_generation || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);
    const filename = `LDM_${safeNumero}_${safeDate}.pdf`;
    saveAs(blob, filename);
  } finally {
    console.timeEnd("[PDF] generateLettreMissionPdf");
  }
}

export async function getLettreMissionPdfBlobUrl(data: LettreMissionPdfData): Promise<string> {
  const validatedData = validatePdfData(data);
  const blob = await renderToBlob(validatedData);
  return URL.createObjectURL(blob);
}

/**
 * A15 / B — Validate and provide safe defaults for all PDF data fields.
 * Ensures no undefined/null/NaN reaches the PDF renderer.
 */
function validatePdfData(data: LettreMissionPdfData): LettreMissionPdfData {
  const safeStr = (v: unknown, fallback = ""): string => {
    if (v === null || v === undefined) return fallback;
    return String(v);
  };

  return {
    ...data,
    numero_lm: safeStr(data.numero_lm, `LM-${new Date().getFullYear()}-001`),
    date_generation: safeStr(data.date_generation, new Date().toISOString().slice(0, 10)),
    cabinet: {
      ...data.cabinet,
      nom: safeStr(data.cabinet?.nom, "Cabinet"),
      adresse: safeStr(data.cabinet?.adresse),
      cp: safeStr(data.cabinet?.cp),
      ville: safeStr(data.cabinet?.ville),
      telephone: safeStr(data.cabinet?.telephone),
      email: safeStr(data.cabinet?.email),
      siret: safeStr(data.cabinet?.siret),
      oec_numero: safeStr(data.cabinet?.oec_numero),
      assurance_nom: safeStr(data.cabinet?.assurance_nom),
      assurance_contrat: safeStr(data.cabinet?.assurance_contrat),
      assurance_adresse: safeStr(data.cabinet?.assurance_adresse),
      couleur_primaire: safeStr(data.cabinet?.couleur_primaire, "#2E75B6"),
      couleur_secondaire: safeStr(data.cabinet?.couleur_secondaire, "#1B3A5C"),
    },
    client: {
      ...data.client,
      civilite: (data.client?.civilite === "Mme" ? "Mme" : "M.") as "M." | "Mme",
      nom_dirigeant: safeStr(data.client?.nom_dirigeant),
      raison_sociale: safeStr(data.client?.raison_sociale),
      forme_juridique: safeStr(data.client?.forme_juridique),
      adresse: safeStr(data.client?.adresse),
      code_postal: safeStr(data.client?.code_postal),
      ville: safeStr(data.client?.ville),
      siren: safeStr(data.client?.siren),
      siret: safeStr(data.client?.siret),
      code_ape: safeStr(data.client?.code_ape),
      activite_principale: safeStr(data.client?.activite_principale),
      regime_fiscal: safeStr(data.client?.regime_fiscal),
      exercice_debut: safeStr(data.client?.exercice_debut, `01/01/${new Date().getFullYear()}`),
      exercice_fin: safeStr(data.client?.exercice_fin, `31/12/${new Date().getFullYear()}`),
      tva: Boolean(data.client?.tva),
      cac: Boolean(data.client?.cac),
    },
    expert_responsable: safeStr(data.expert_responsable),
    periodicite_transmission: safeStr(data.periodicite_transmission, "Mensuelle"),
    outil_transmission: safeStr(data.outil_transmission, "GRIMY"),
    is_brouillon: Boolean(data.is_brouillon),
    sections_visibles: data.sections_visibles || [],
    repartition: Array.isArray(data.repartition) && data.repartition.length > 0 ? data.repartition : DEFAULT_REPARTITION,
    // B15 — filter out empty snapshot sections
    sections_snapshot: data.sections_snapshot?.filter(sec => sec && sec.id),
  };
}

// ══════════════════════════════════════════════
// Backward-compatible exports
// ══════════════════════════════════════════════

/** Safe string coercion */
function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Safe number coercion — never returns NaN/Infinity */
function safeNum(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function cabinetConfigToInfo(cab: Partial<CabinetConfig> & { nom: string }): CabinetInfo {
  return {
    nom: cab.nom || DEFAULT_CABINET.nom,
    adresse: cab.adresse || DEFAULT_CABINET.adresse,
    cp: cab.cp || DEFAULT_CABINET.cp,
    ville: cab.ville || DEFAULT_CABINET.ville,
    telephone: (cab as any).telephone || "",
    email: (cab as any).email || "",
    siret: cab.siret || DEFAULT_CABINET.siret,
    oec_numero: (cab as any).numeroOEC || (cab as any).oec_numero || "",
    logo_base64: (cab as any).logo || (cab as any).logo_base64,
    assurance_nom: DEFAULT_CABINET.assurance_nom,
    assurance_contrat: DEFAULT_CABINET.assurance_contrat,
    assurance_adresse: DEFAULT_CABINET.assurance_adresse,
    couleur_primaire: (cab as any).couleurPrimaire || DEFAULT_CABINET.couleur_primaire,
    couleur_secondaire: (cab as any).couleurSecondaire || DEFAULT_CABINET.couleur_secondaire,
  };
}

function clientToLmData(client: any): ClientLmData {
  // Helper to pick the first non-empty value from multiple possible field names
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = client[k];
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
    return "";
  };

  return {
    civilite: client.genre === "F" || client.civilite === "Mme" ? "Mme" : "M.",
    nom_dirigeant: pick("dirigeant", "nom_dirigeant", "nomDirigeant", "dirigeant_nom", "representant_legal"),
    raison_sociale: pick("raison_sociale", "raisonSociale", "nom", "denomination", "name"),
    nom_commercial: pick("nom_commercial", "nomCommercial", "enseigne"),
    forme_juridique: pick("forme_juridique", "formeJuridique", "forme_sociale", "forme"),
    adresse: pick("adresse", "adresse_siege", "adresseSiege", "siege_social", "address"),
    code_postal: pick("code_postal", "codePostal", "cp"),
    ville: pick("ville", "city"),
    siren: normalizeSiren(pick("siren", "numero_siren")),
    siret: normalizeSiren(pick("siret", "numero_siret")),
    code_ape: pick("code_ape", "codeAPE", "codeApe", "ape", "naf"),
    activite_principale: pick("activite_principale", "activitePrincipale", "activite", "objet_social", "domaine"),
    capital_social: pick("capital_social", "capitalSocial", "capital"),
    date_creation: pick("date_creation", "dateCreation", "date_immatriculation"),
    regime_fiscal: pick("regime_fiscal", "regimeFiscal", "regime"),
    exercice_debut: pick("exercice_debut", "exerciceDebut") || `01/01/${new Date().getFullYear()}`,
    exercice_fin: pick("exercice_fin", "exerciceFin", "date_cloture") || `31/12/${new Date().getFullYear()}`,
    tva: Boolean(client.tva ?? client.assujetti_tva),
    cac: Boolean(client.cac ?? client.commissaire_aux_comptes),
    effectif: client.effectif != null ? safeNum(client.effectif) : undefined,
    volume_comptable: pick("volume_comptable", "volumeComptable"),
  };
}

function buildDefaultHonoraires(lm?: any): HonorairesData {
  const opts = lm?.options || {};
  return {
    forfait_annuel_ht: safeNum(opts.honorairesComptable ?? opts.forfait_annuel_ht, 0),
    constitution_dossier_ht: safeNum(opts.fraisConstitution ?? opts.constitution_dossier_ht, 0),
    honoraires_ec_heure: safeNum(opts.honoraires_ec_heure, 200),
    honoraires_collab_heure: safeNum(opts.honoraires_collab_heure, 100),
    juridique_annuel_ht: safeNum(opts.honorairesJuridique ?? opts.juridique_annuel_ht, 0),
    frequence_facturation: (opts.periodicite === "Trimestrielle" ? "TRIMESTRIEL" : opts.periodicite === "Annuelle" ? "ANNUEL" : "MENSUEL") as any,
    social_bulletin_unite: safeNum(opts.social_bulletin_unite, 32),
    social_fin_contrat: safeNum(opts.social_fin_contrat, 30),
    social_contrat_simple: safeNum(opts.social_contrat_simple, 100),
    social_entree_sans_contrat: safeNum(opts.social_entree_sans_contrat, 30),
    social_attestation_maladie: safeNum(opts.social_attestation_maladie, 30),
  };
}

function buildDefaultLcbft(client?: Client): LcbftData {
  return {
    score_risque: safeNum((client as any)?.scoreRisque ?? (client as any)?.score_risque, 0),
    niveau_vigilance: ((client as any)?.niveauVigilance ?? (client as any)?.niveau_vigilance ?? "STANDARD") as any,
    statut_ppe: Boolean((client as any)?.ppe || (client as any)?.statut_ppe),
    derniere_diligence_kyc: s((client as any)?.derniereDiligenceKyc || ""),
    prochaine_maj_kyc: s((client as any)?.prochaineMajKyc || ""),
  };
}

/**
 * Legacy export — renders and downloads a PDF from a LettreMission object.
 * Previously returned a jsPDF; now returns void (async) and triggers download via file-saver.
 */
export async function renderLettreMissionPdf(
  lm: Partial<LettreMission> & { numero?: string; date?: string; client?: Client; cabinet?: any; options?: any },
  options?: { watermark?: boolean }
): Promise<void> {
  try {
    const client = lm.client;
    const cab = lm.cabinet || {};
    const opts = lm.options || {};

    const pdfData: LettreMissionPdfData = {
      numero_lm: lm.numero || `LM-${new Date().getFullYear()}-001`,
      // opt 47: generate long French date for PDF display
      date_generation: lm.date || formatDateFr(new Date(), "long"),
      cabinet: cabinetConfigToInfo(cab),
      client: client ? clientToLmData(client) : {
        civilite: "M.",
        nom_dirigeant: "",
        raison_sociale: "",
        forme_juridique: "",
        adresse: "",
        code_postal: "",
        ville: "",
        siren: "",
        siret: "",
        code_ape: "",
        activite_principale: "",
        regime_fiscal: "",
        exercice_debut: `01/01/${new Date().getFullYear()}`,
        exercice_fin: `31/12/${new Date().getFullYear()}`,
        tva: false,
        cac: false,
      },
      mission: (() => {
        const mtConf = getMissionTypeConfig(opts.missionTypeId || "presentation");
        return {
          type_principal: mtConf.label || "Présentation des comptes",
          norme_applicable: mtConf.normeRef || "NP 2300",
          mission_sociale: Boolean(opts.missionSociale),
          mission_juridique: Boolean(opts.missionJuridique),
          controle_fiscal: Boolean(opts.missionControleFiscal),
        };
      })(),
      honoraires: buildDefaultHonoraires(lm),
      lcbft: buildDefaultLcbft(client),
      repartition: DEFAULT_REPARTITION,
      // BUG 6 fix: prefer actual person name, never fall back to cabinet name
      expert_responsable: s(opts.associeSignataire || opts.expert_responsable || (cab as any).responsable_nom || (cab as any).responsable || (cab as any).expert_nom || (cab as any).associe || ""),
      periodicite_transmission: s(opts.periodicite || "Mensuelle"),
      outil_transmission: "GRIMY",
      is_brouillon: Boolean(options?.watermark) || (lm.metadata?.statut === "brouillon"),
      sections_visibles: [],
      // Use editorSections if available
      sections_snapshot: lm.editorSections?.map((es) => ({
        id: es.id,
        titre: es.title,
        contenu: es.content,
        type: "fixed",
        ordre: 0,
      })),
    };

    await generateLettreMissionPdf(pdfData);
  } catch (err) {
    logger.error("PDF", "renderLettreMissionPdf error", err);
    throw err;
  }
}

/**
 * Generate PDF from a modele-based instance.
 */
export async function generatePdfFromInstance(
  instance: {
    sections_snapshot: { id: string; titre: string; contenu: string; type: string; ordre: number; cnoec_obligatoire?: boolean }[];
    cgv_snapshot: string;
    repartition_snapshot?: { label: string; cabinet: boolean; client: boolean; periodicite?: string }[];
    numero: string;
    status?: string;
    mission_type?: string;
    variables_resolved?: Record<string, string>;
  },
  cabinet: { nom: string; adresse: string; cp: string; ville: string; siret: string; numeroOEC: string; email: string; telephone: string },
  options?: { signatureExpert?: string; signatureClient?: string; client?: any; honoraires?: any }
): Promise<void> {
  try {
    // BUG G — if old snapshot has < 15 rows, use new complete DEFAULT_REPARTITION
    const repartition: PdfRepartitionRow[] = instance.repartition_snapshot && instance.repartition_snapshot.length > 15
      ? instance.repartition_snapshot.map((r) => ({
          tache: r.label,
          cabinet: r.cabinet,
          client: r.client,
          periodicite: r.periodicite || "—",
        }))
      : DEFAULT_REPARTITION;

    // Resolve mission type label
    const { getMissionTypeConfig } = await import("@/lib/lettreMissionTypes");
    const mtConfig = getMissionTypeConfig(instance.mission_type || "presentation");

    const clientData: ClientLmData = options?.client
      ? clientToLmData(options.client)
      : {
          civilite: "M.",
          nom_dirigeant: "",
          raison_sociale: "",
          forme_juridique: "",
          adresse: "",
          code_postal: "",
          ville: "",
          siren: "",
          siret: "",
          code_ape: "",
          activite_principale: "",
          regime_fiscal: "",
          exercice_debut: `01/01/${new Date().getFullYear()}`,
          exercice_fin: `31/12/${new Date().getFullYear()}`,
          tva: false,
          cac: false,
        };

    const pdfData: LettreMissionPdfData = {
      numero_lm: instance.numero,
      date_generation: formatDateFr(new Date(), "long"),
      cabinet: cabinetConfigToInfo(cabinet as any),
      client: clientData,
      mission: {
        type_principal: mtConfig.label || "Présentation des comptes",
        norme_applicable: mtConfig.normeRef || "NP 2300",
        mission_sociale: false,
        mission_juridique: false,
        controle_fiscal: false,
      },
      honoraires: options?.honoraires ? buildDefaultHonoraires({ options: options.honoraires }) : buildDefaultHonoraires(),
      lcbft: options?.client ? buildDefaultLcbft(options.client) : { score_risque: 0, niveau_vigilance: "STANDARD", statut_ppe: false },
      repartition,
      // BUG 6/E fix: prefer actual person name, never fall back to cabinet name
      expert_responsable: (options as any)?.associeSignataire || (options as any)?.expert_responsable || (cabinet as any)?.responsable_nom || (cabinet as any)?.responsable || (cabinet as any)?.expert_nom || "",
      periodicite_transmission: "Mensuelle",
      outil_transmission: "GRIMY",
      is_brouillon: instance.status === "brouillon" || instance.status === "en_validation",
      sections_visibles: instance.sections_snapshot.map((s) => s.id),
      sections_snapshot: instance.sections_snapshot,
      cgv_snapshot: instance.cgv_snapshot,
      signature_expert: options?.signatureExpert,
      signature_client: options?.signatureClient,
    };

    await generateLettreMissionPdf(pdfData);
  } catch (err) {
    logger.error("PDF", "generatePdfFromInstance error", err);
    throw err;
  }
}
