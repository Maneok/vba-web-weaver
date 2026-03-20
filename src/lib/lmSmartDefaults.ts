// ──────────────────────────────────────────────
// Pré-remplissage intelligent du wizard LM
// Génère des défauts pour honoraires, clauses, durée, missions
// en fonction du type de client et de ses données
// ──────────────────────────────────────────────

import { CLIENT_TYPES } from './lettreMissionTypes';
import { getMissionsForClientType, type ClientMissionPrestation } from './lmClientMissions';
import type { LMWizardData, MissionSelection } from './lmWizardTypes';
import type { Client } from './types';

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

export function generateSmartDefaults(
  clientTypeId: string,
  client: Client,
): Partial<LMWizardData> {
  const config = CLIENT_TYPES[clientTypeId];
  if (!config) return {};

  return {
    ...getSmartDuree(clientTypeId),
    ...getSmartHonoraires(clientTypeId, config, client),
    ...getSmartClauses(clientTypeId, client),
    ...getSmartPaiement(client),
    frequence_facturation: ['irpp', 'lmnp', 'lmp', 'creation'].includes(clientTypeId) ? 'ANNUEL' : 'MENSUEL',
  };
}

// ============================================================
// MISSIONS PRÉ-COCHÉES intelligentes
// ============================================================

export function getSmartMissionSelections(
  clientTypeId: string,
  client: Client,
  missions: ClientMissionPrestation[],
): MissionSelection[] {
  const effectif = parseInt(client.effectif || '0', 10);

  return missions.map(m => {
    let autoSelected = m.defaultSelected;

    // Règle 1 : Social activé si effectif > 0
    if (m.id === 'social' && effectif > 0) {
      autoSelected = true;
    }

    // Règle 2 : Juridique désactivé pour les formes sans AG
    if (m.id === 'juridique') {
      const noJuridique = ['ei_reel', 'micro', 'profession_liberale', 'lmnp', 'lmp', 'irpp'].includes(clientTypeId);
      autoSelected = !noJuridique;
    }

    // Règle 3 : Conseil activé si micro ou création
    if (m.id === 'conseil' && ['micro', 'creation'].includes(clientTypeId)) {
      autoSelected = true;
    }

    // Règle 4 : SCI → toujours juridique (AG obligatoire)
    if (m.id === 'juridique' && ['sci_ir', 'sci_is', 'scm', 'scp'].includes(clientTypeId)) {
      autoSelected = true;
    }

    // Adapter les sous-options
    const sous_options = m.sous_options.map((s) => {
      let subSelected = s.defaultSelected;

      // TNS si gérant SARL/EURL/SELARL
      if (s.id === 'tns_gerant' && ['sarl_is', 'sarl_ir', 'sarl_famille', 'selarl'].includes(clientTypeId)) {
        subSelected = true;
      }

      // DAS2 si honoraires client élevés (proxy pour CA élevé)
      if (s.id === 'das2' && (client.honoraires || 0) > 5000) {
        subSelected = true;
      }

      // CFE par défaut ON
      if ((s.id === 'cfe' || s.id === 'cfe_initiale') && !['irpp'].includes(clientTypeId)) {
        subSelected = true;
      }

      // Annexe légale si capital élevé
      if (s.id === 'annexe_legale' && (client.capital || 0) > 100000) {
        subSelected = true;
      }

      return { id: s.id, label: s.label, selected: subSelected };
    });

    return {
      section_id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      selected: autoSelected || m.locked,
      locked: m.locked,
      sous_options,
    };
  });
}

// ============================================================
// DURÉE
// ============================================================

function getSmartDuree(clientTypeId: string): Partial<LMWizardData> {
  const ponctuels = ['irpp', 'creation'];
  if (ponctuels.includes(clientTypeId)) {
    return {
      duree: '1',
      tacite_reconduction: false,
      preavis_mois: 0,
    };
  }

  return {
    duree: '1',
    tacite_reconduction: true,
    preavis_mois: 3,
  };
}

// ============================================================
// HONORAIRES — estimation selon type + volume
// ============================================================

const BAREME: Record<string, {
  comptabilite: number; fiscal: number; social_par_bulletin: number;
  juridique: number; conseil: number; taux_horaire: number;
}> = {
  'sas_is':             { comptabilite: 250, fiscal: 80, social_par_bulletin: 30, juridique: 50, conseil: 0, taux_horaire: 150 },
  'sarl_is':            { comptabilite: 200, fiscal: 70, social_par_bulletin: 30, juridique: 50, conseil: 0, taux_horaire: 150 },
  'sarl_ir':            { comptabilite: 200, fiscal: 70, social_par_bulletin: 30, juridique: 50, conseil: 0, taux_horaire: 150 },
  'sarl_famille':       { comptabilite: 180, fiscal: 60, social_par_bulletin: 0,  juridique: 40, conseil: 0, taux_horaire: 150 },
  'sa':                 { comptabilite: 400, fiscal: 120, social_par_bulletin: 30, juridique: 80, conseil: 0, taux_horaire: 180 },
  'snc':                { comptabilite: 200, fiscal: 70, social_par_bulletin: 30, juridique: 50, conseil: 0, taux_horaire: 150 },
  'selarl':             { comptabilite: 250, fiscal: 80, social_par_bulletin: 30, juridique: 60, conseil: 0, taux_horaire: 150 },
  'selas':              { comptabilite: 280, fiscal: 90, social_par_bulletin: 30, juridique: 60, conseil: 0, taux_horaire: 150 },
  'sci_ir':             { comptabilite: 80,  fiscal: 50, social_par_bulletin: 0,  juridique: 40, conseil: 0, taux_horaire: 150 },
  'sci_is':             { comptabilite: 150, fiscal: 70, social_par_bulletin: 0,  juridique: 50, conseil: 0, taux_horaire: 150 },
  'scm':                { comptabilite: 100, fiscal: 50, social_par_bulletin: 0,  juridique: 40, conseil: 0, taux_horaire: 150 },
  'scp':                { comptabilite: 200, fiscal: 70, social_par_bulletin: 30, juridique: 50, conseil: 0, taux_horaire: 150 },
  'ei_reel':            { comptabilite: 150, fiscal: 60, social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 150 },
  'micro':              { comptabilite: 0,   fiscal: 40, social_par_bulletin: 0,  juridique: 0,  conseil: 30, taux_horaire: 120 },
  'profession_liberale':{ comptabilite: 120, fiscal: 50, social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 150 },
  'lmnp':               { comptabilite: 40,  fiscal: 30, social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 120 },
  'lmp':                { comptabilite: 60,  fiscal: 40, social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 120 },
  'irpp':               { comptabilite: 0,   fiscal: 50, social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 120 },
  'association':        { comptabilite: 150, fiscal: 40, social_par_bulletin: 30, juridique: 0,  conseil: 0, taux_horaire: 130 },
  'holding':            { comptabilite: 300, fiscal: 100, social_par_bulletin: 0, juridique: 80, conseil: 0, taux_horaire: 180 },
  'creation':           { comptabilite: 0,   fiscal: 0,  social_par_bulletin: 0,  juridique: 0,  conseil: 100, taux_horaire: 150 },
  'syndicat_copro':     { comptabilite: 80,  fiscal: 0,  social_par_bulletin: 0,  juridique: 0,  conseil: 0, taux_horaire: 120 },
};

function getSmartHonoraires(
  clientTypeId: string,
  config: { needsJuridique: boolean },
  client: Client,
): Partial<LMWizardData> {
  const effectif = parseInt(client.effectif || '0', 10);
  const b = BAREME[clientTypeId] || BAREME['sas_is'];

  let comptaMensuel = b.comptabilite;
  let fiscalMensuel = b.fiscal;
  let socialMensuel = effectif > 0 ? effectif * b.social_par_bulletin : 0;
  let juridiqueMensuel = config.needsJuridique ? b.juridique : 0;

  // Ajustements volume : utiliser effectif comme proxy
  if (effectif > 10) { comptaMensuel *= 1.3; fiscalMensuel *= 1.2; socialMensuel *= 1.2; }
  if (effectif > 50) { comptaMensuel *= 1.3; socialMensuel *= 1.3; juridiqueMensuel *= 1.5; }

  const totalMensuel = Math.round(comptaMensuel + fiscalMensuel + socialMensuel + juridiqueMensuel + b.conseil);
  const totalAnnuel = totalMensuel * 12;

  // Build detail only for non-zero values
  const honoraires_detail: Record<string, string> = {};
  if (comptaMensuel > 0) honoraires_detail.comptabilite = String(Math.round(comptaMensuel * 12));
  if (fiscalMensuel > 0) honoraires_detail.fiscal = String(Math.round(fiscalMensuel * 12));
  if (socialMensuel > 0) honoraires_detail.social = String(Math.round(socialMensuel * 12));
  if (juridiqueMensuel > 0) honoraires_detail.juridique = String(Math.round(juridiqueMensuel * 12));
  if (b.conseil > 0) honoraires_detail.conseil = String(Math.round(b.conseil * 12));

  const parts: string[] = [];
  if (effectif > 0) parts.push(`${effectif} salarie(s)`);
  parts.push(clientTypeId);

  return {
    honoraires_ht: totalAnnuel,
    honoraires_detail,
    taux_horaire_complementaire: b.taux_horaire,
    honoraires_estimation: true,
    honoraires_estimation_label: `Estimation basee sur ${parts.join(' · ')} — ajustez selon votre tarification`,
  };
}

// ============================================================
// CLAUSES
// ============================================================

function getSmartClauses(clientTypeId: string, client: Client): Partial<LMWizardData> {
  const effectif = parseInt(client.effectif || '0', 10);
  const societes = ['sas_is', 'sarl_is', 'sarl_ir', 'sarl_famille', 'sa', 'selarl', 'selas', 'snc'];

  return {
    clause_lcbft: true,
    clause_rgpd: true,
    clause_conciliation_croec: true,
    clause_travail_dissimule: societes.includes(clientTypeId) || effectif > 0,
  };
}

// ============================================================
// PAIEMENT
// ============================================================

function getSmartPaiement(client: Client): Partial<LMWizardData> {
  if (client.iban && client.iban.length > 10) {
    return { mode_paiement: 'prelevement', iban: client.iban, bic: client.bic || '' };
  }
  return { mode_paiement: 'virement' };
}

// ============================================================
// TEXTE ENRICHI pour la mission
// ============================================================

export function getSmartMissionText(clientTypeId: string): string {
  const texts: Record<string, string> = {
    'sci_ir': "Compte tenu de la nature de votre entite (SCI soumise a l'impot sur le revenu), la comptabilite sera tenue en tresorerie conformement aux usages applicables aux societes civiles.",
    'sci_is': "Votre SCI ayant opte pour l'impot sur les societes, une comptabilite d'engagement complete sera tenue, incluant le calcul des amortissements des biens immobiliers.",
    'lmnp': "Dans le cadre de votre activite de loueur en meuble non professionnel (LMNP), nous assurerons le calcul des amortissements (bien, meubles, travaux) et la tenue de la comptabilite BIC au regime reel.",
    'lmp': "En qualite de loueur en meuble professionnel (LMP), vous etes soumis aux cotisations sociales SSI. Nous assurerons le suivi de ces cotisations en complement de la mission comptable et fiscale.",
    'micro': "Dans le cadre du regime micro-entreprise, notre mission porte essentiellement sur l'assistance aux declarations et le conseil pour optimiser votre situation fiscale et anticiper un eventuel changement de regime.",
    'holding': "En qualite de societe holding, nous veillerons particulierement au suivi des participations, au regime mere-fille, et le cas echeant a l'integration fiscale du groupe.",
    'association': "Notre mission sera conduite conformement au plan comptable des associations et fondations. Le rapport financier annuel sera etabli en vue de la presentation a l'assemblee generale.",
    'creation': "Dans le cadre de la creation de votre entreprise, nous vous accompagnerons dans le choix du statut juridique, l'elaboration du previsionnel et les formalites de constitution.",
  };
  return texts[clientTypeId] || '';
}

// ============================================================
// CLIENT CONSOMMATEUR (art. L 215-1 Code conso)
// ============================================================

export function isClientConsommateur(clientTypeId: string): boolean {
  return ['ei_reel', 'micro', 'profession_liberale', 'lmnp', 'lmp', 'irpp'].includes(clientTypeId);
}
