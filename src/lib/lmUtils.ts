import type { LMWizardData } from "@/lib/lmWizardTypes";
import type { Client, EtatDossier, MissionType, OuiNon, VigilanceLevel, EtatPilotage, StatutClient } from "@/lib/types";

/** Format number as EUR currency */
export function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

/** Format number with space separators */
export function formatMontant(value: string): string {
  const num = value.replace(/[^\d]/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Vigilance level color classes */
export function vigilanceColor(niv: string): string {
  if (niv === "SIMPLIFIEE") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (niv === "STANDARD") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

/** Build a Client object from wizard data for PDF/DOCX export */
export function buildClientFromWizardData(data: LMWizardData): Client {
  return {
    ref: data.client_ref,
    raisonSociale: data.raison_sociale,
    forme: data.forme_juridique,
    siren: data.siren,
    dirigeant: data.dirigeant,
    adresse: data.adresse,
    cp: data.cp,
    ville: data.ville,
    capital: Number(data.capital) || 0,
    ape: data.ape,
    mail: data.email,
    tel: data.telephone,
    iban: data.iban,
    bic: data.bic,
    etat: "EN COURS" as EtatDossier,
    comptable: "",
    mission: (data.type_mission || "TENUE COMPTABLE") as MissionType,
    domaine: "",
    effectif: "",
    dateCreation: "",
    dateReprise: "",
    honoraires: data.honoraires_ht,
    reprise: 0,
    juridique: 0,
    frequence: data.frequence_facturation,
    associe: data.associe_signataire,
    superviseur: data.chef_mission,
    ppe: "NON" as OuiNon,
    paysRisque: "NON" as OuiNon,
    atypique: "NON" as OuiNon,
    distanciel: "NON" as OuiNon,
    cash: "NON" as OuiNon,
    pression: "NON" as OuiNon,
    scoreActivite: 0,
    scorePays: 0,
    scoreMission: 0,
    scoreMaturite: 0,
    scoreStructure: 0,
    malus: 0,
    scoreGlobal: 0,
    nivVigilance: "STANDARD" as VigilanceLevel,
    dateCreationLigne: "",
    dateDerniereRevue: "",
    dateButoir: "",
    etatPilotage: "A JOUR" as EtatPilotage,
    dateExpCni: "",
    statut: "ACTIF" as StatutClient,
    be: "",
  };
}
