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
  wizardData?: Partial<LMWizardData>,
): Partial<LMWizardData> {
  const config = CLIENT_TYPES[clientTypeId];
  if (!config) return {};

  // Auto-detect regime_benefices from APE if not already set
  const autoRegime = detectRegimeBenefices(client.ape);
  const enrichedWizard = {
    ...wizardData,
    regime_benefices: wizardData?.regime_benefices || autoRegime || undefined,
  };

  return {
    ...getSmartDuree(clientTypeId),
    ...getSmartHonoraires(clientTypeId, config, client, enrichedWizard),
    ...getSmartClauses(clientTypeId, client),
    ...getSmartPaiement(client),
    frequence_facturation: ['irpp', 'lmnp', 'lmp', 'creation'].includes(clientTypeId) ? 'ANNUEL' : 'MENSUEL',
    regime_benefices: enrichedWizard.regime_benefices,
  };
}

// ============================================================
// MISSIONS PRÉ-COCHÉES intelligentes
// ============================================================

export function getSmartMissionSelections(
  clientTypeId: string,
  client: Client,
  missions: ClientMissionPrestation[],
  wizardData?: Partial<LMWizardData>,
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

    // Règle 5 : Holding animatrice → conseil activé
    if (m.id === 'conseil' && clientTypeId === 'holding' && wizardData?.holding_type === 'animatrice') {
      autoSelected = true;
    }

    // Règle 6 : Association activités lucratives → fiscal renforcé
    if (m.id === 'fiscal' && clientTypeId === 'association' && wizardData?.association_activites_lucratives) {
      autoSelected = true;
    }

    // Adapter les sous-options
    const sous_options = m.sous_options.map((s) => {
      let subSelected = s.defaultSelected;

      // TNS si gérant majoritaire SARL/EURL/SELARL (correction: conditionné par gerant_majoritaire)
      if (s.id === 'tns_gerant') {
        if (['sarl_is', 'sarl_ir', 'sarl_famille', 'selarl'].includes(clientTypeId)) {
          subSelected = wizardData?.gerant_majoritaire !== false; // default true for SARL
        }
      }

      // Bulletin dirigeant SAS si président rémunéré
      if (s.id === 'bulletin_president' && ['sas_is', 'selas'].includes(clientTypeId)) {
        subSelected = wizardData?.president_remunere === true;
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

      // Location courte durée → TVA sub-option ON
      if (s.id === 'tva_meuble' && wizardData?.type_location && ['courte_duree', 'mixte'].includes(wizardData.type_location)) {
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
  wizardData?: Partial<LMWizardData>,
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

  // Correction 1: gérant majoritaire SARL → TNS = cotisations SSI supplémentaires
  if (wizardData?.gerant_majoritaire && ['sarl_is', 'sarl_ir', 'sarl_famille', 'selarl'].includes(clientTypeId)) {
    const nbTns = wizardData.nombre_associes_tns || 1;
    socialMensuel += nbTns * 25; // forfait TNS par associé gérant
  }

  // Correction 2: président SAS rémunéré → bulletins dirigeant
  if (wizardData?.president_remunere && ['sas_is', 'selas'].includes(clientTypeId)) {
    socialMensuel += 35; // bulletin dirigeant assimilé salarié
  }

  // Correction 3: nombre de biens SCI/LMNP → multiplicateur compta
  if (wizardData?.nombre_biens && wizardData.nombre_biens > 1 && ['sci_ir', 'sci_is', 'lmnp', 'lmp'].includes(clientTypeId)) {
    comptaMensuel *= (1 + (wizardData.nombre_biens - 1) * 0.4);
  }

  // Correction 4: holding nombre filiales → suivi participations
  if (wizardData?.nombre_filiales && wizardData.nombre_filiales > 1 && clientTypeId === 'holding') {
    comptaMensuel *= (1 + (wizardData.nombre_filiales - 1) * 0.25);
    juridiqueMensuel *= (1 + (wizardData.nombre_filiales - 1) * 0.2);
  }

  // Correction 5: location courte durée → TVA + déclarations supplémentaires
  if (wizardData?.type_location && ['courte_duree', 'mixte'].includes(wizardData.type_location)) {
    fiscalMensuel *= 1.4;
  }

  // Correction 6: association activités lucratives → IS partiel
  if (wizardData?.association_activites_lucratives && clientTypeId === 'association') {
    fiscalMensuel *= 1.5;
  }

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
  if (wizardData?.nombre_biens && wizardData.nombre_biens > 1) parts.push(`${wizardData.nombre_biens} biens`);
  if (wizardData?.gerant_majoritaire) parts.push('gerant majoritaire TNS');
  if (wizardData?.president_remunere) parts.push('president remunere');
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

// ============================================================
// DÉTECTION BIC / BNC depuis le code APE
// ============================================================

/** Codes APE typiquement BNC (professions libérales, services intellectuels) */
const APE_BNC_PREFIXES = [
  '69', // Activités juridiques et comptables
  '70', // Conseil de gestion
  '71', // Architecture, ingénierie, contrôle
  '72', // Recherche-développement scientifique
  '73', // Publicité et études de marché
  '74', // Autres activités spécialisées (design, photo, traduction)
  '75', // Activités vétérinaires
  '85', // Enseignement (partiel)
  '86', // Activités pour la santé humaine
  '87', // Hébergement médico-social (partiel)
  '90', // Activités créatives, artistiques, spectacle
  '91', // Bibliothèques, musées
];

export function detectRegimeBenefices(codeApe: string): 'BIC' | 'BNC' | null {
  if (!codeApe) return null;
  const cleaned = codeApe.replace(/[.\s]/g, '');
  const prefix2 = cleaned.substring(0, 2);
  if (APE_BNC_PREFIXES.includes(prefix2)) return 'BNC';
  // Par défaut si code APE connu → BIC (commerce, industrie, artisanat)
  if (cleaned.length >= 2) return 'BIC';
  return null;
}

// ============================================================
// SEUILS CAC (Commissaire aux comptes)
// ============================================================

export interface CACSeuilResult {
  obligatoire: boolean;
  motif: string;
}

export function checkCACSeuils(
  clientTypeId: string,
  ca?: number,
  totalBilan?: number,
  effectif?: number,
): CACSeuilResult {
  // Seuils 2024-2025 (ordonnance 2023)
  // SA: 2/3 seuils parmi CA > 8M€, bilan > 4M€, effectif > 50
  // SAS/SARL: 2/3 seuils parmi CA > 8M€, bilan > 4M€, effectif > 50
  // Association: subventions > 153k€ ou CA > 200k€
  const eff = effectif || 0;
  const caVal = ca || 0;
  const bilanVal = totalBilan || 0;

  if (['sa'].includes(clientTypeId)) {
    let count = 0;
    if (caVal > 8_000_000) count++;
    if (bilanVal > 4_000_000) count++;
    if (eff > 50) count++;
    if (count >= 2) return { obligatoire: true, motif: 'SA depassant 2 des 3 seuils legaux (CA 8M€, bilan 4M€, 50 salaries)' };
  }

  if (['sas_is', 'sarl_is', 'sarl_ir'].includes(clientTypeId)) {
    let count = 0;
    if (caVal > 8_000_000) count++;
    if (bilanVal > 4_000_000) count++;
    if (eff > 50) count++;
    if (count >= 2) return { obligatoire: true, motif: 'Societe commerciale depassant 2 des 3 seuils legaux' };
  }

  return { obligatoire: false, motif: '' };
}

// ============================================================
// QUESTIONS CONTEXTUELLES — quelles questions poser par type
// ============================================================

export interface ContextualQuestion {
  id: string;
  label: string;
  description: string;
  type: 'boolean' | 'select' | 'number';
  options?: { value: string; label: string }[];
  field: string; // key in LMWizardData
}

export function getContextualQuestions(clientTypeId: string): ContextualQuestion[] {
  const questions: ContextualQuestion[] = [];

  // SARL: gérant majoritaire vs minoritaire
  if (['sarl_is', 'sarl_ir', 'sarl_famille'].includes(clientTypeId)) {
    questions.push({
      id: 'gerant_majoritaire',
      label: 'Le gerant est-il majoritaire ?',
      description: 'Gerant majoritaire = TNS (SSI). Minoritaire/egalitaire = assimile salarie (regime general).',
      type: 'boolean',
      field: 'gerant_majoritaire',
    });
    questions.push({
      id: 'nombre_associes_tns',
      label: 'Nombre d\'associes TNS (gerants + conjoints)',
      description: 'Pour le calcul des bulletins/declarations sociales TNS.',
      type: 'number',
      field: 'nombre_associes_tns',
    });
  }

  // SELARL: gérant majoritaire
  if (clientTypeId === 'selarl') {
    questions.push({
      id: 'gerant_majoritaire',
      label: 'Le gerant est-il majoritaire ?',
      description: 'Gerant majoritaire SELARL = TNS (SSI).',
      type: 'boolean',
      field: 'gerant_majoritaire',
    });
  }

  // SAS/SASU: président rémunéré
  if (['sas_is', 'selas'].includes(clientTypeId)) {
    questions.push({
      id: 'president_remunere',
      label: 'Le president est-il remunere ?',
      description: 'Si oui, bulletins de paie et declarations sociales du dirigeant a prevoir.',
      type: 'boolean',
      field: 'president_remunere',
    });
  }

  // EI: BIC vs BNC
  if (['ei_reel', 'profession_liberale'].includes(clientTypeId)) {
    questions.push({
      id: 'regime_benefices',
      label: 'Regime de benefices',
      description: 'Determine le plan comptable et les declarations applicables.',
      type: 'select',
      options: [
        { value: 'BIC', label: 'BIC (Benefices Industriels et Commerciaux)' },
        { value: 'BNC', label: 'BNC (Benefices Non Commerciaux)' },
      ],
      field: 'regime_benefices',
    });
  }

  // Micro: micro-BIC vs micro-BNC
  if (clientTypeId === 'micro') {
    questions.push({
      id: 'regime_benefices',
      label: 'Regime micro applicable',
      description: 'Micro-BIC (commerce/artisanat) ou micro-BNC (services/liberal).',
      type: 'select',
      options: [
        { value: 'BIC', label: 'Micro-BIC (vente/artisanat — abattement 50-71%)' },
        { value: 'BNC', label: 'Micro-BNC (services/liberal — abattement 34%)' },
      ],
      field: 'regime_benefices',
    });
  }

  // LMNP/LMP: régime fiscal détaillé + type location + nombre biens
  if (['lmnp', 'lmp'].includes(clientTypeId)) {
    questions.push({
      id: 'regime_fiscal_detail',
      label: 'Regime fiscal applicable',
      description: clientTypeId === 'lmnp'
        ? 'Micro-BIC (recettes < 77 700€) ou reel simplifie (amortissements deductibles).'
        : 'LMP : reel simplifie obligatoire.',
      type: 'select',
      options: clientTypeId === 'lmnp'
        ? [
            { value: 'micro_bic', label: 'Micro-BIC (recettes < 77 700€)' },
            { value: 'reel_simplifie', label: 'Reel simplifie (amortissements)' },
          ]
        : [
            { value: 'reel_simplifie', label: 'Reel simplifie' },
            { value: 'reel_normal', label: 'Reel normal' },
          ],
      field: 'regime_fiscal_detail',
    });
    questions.push({
      id: 'type_location',
      label: 'Type de location',
      description: 'La location courte duree implique des obligations TVA et declarations specifiques.',
      type: 'select',
      options: [
        { value: 'classique', label: 'Location classique (bail meuble)' },
        { value: 'courte_duree', label: 'Courte duree (Airbnb, saisonnier)' },
        { value: 'mixte', label: 'Mixte (classique + courte duree)' },
      ],
      field: 'type_location',
    });
    questions.push({
      id: 'nombre_biens',
      label: 'Nombre de biens immobiliers',
      description: 'Impacte le volume de travail comptable et le montant des honoraires.',
      type: 'number',
      field: 'nombre_biens',
    });
  }

  // SCI: nombre de biens + régime IR/IS
  if (['sci_ir', 'sci_is'].includes(clientTypeId)) {
    questions.push({
      id: 'nombre_biens',
      label: 'Nombre de biens immobiliers detenus',
      description: 'Chaque bien genere des ecritures comptables supplementaires.',
      type: 'number',
      field: 'nombre_biens',
    });
  }

  // Ambiguous IR/IS forms
  if (['sarl_ir', 'sarl_famille'].includes(clientTypeId)) {
    questions.push({
      id: 'regime_fiscal_societe',
      label: 'Regime fiscal de la societe',
      description: 'La SARL de famille peut opter pour l\'IR. Cela impacte les obligations declaratives.',
      type: 'select',
      options: [
        { value: 'IR', label: 'Impot sur le revenu (IR)' },
        { value: 'IS', label: 'Impot sur les societes (IS)' },
      ],
      field: 'regime_fiscal_societe',
    });
  }

  // Profession libérale: caisse retraite
  if (clientTypeId === 'profession_liberale') {
    questions.push({
      id: 'caisse_retraite',
      label: 'Caisse de retraite',
      description: 'Determine les declarations sociales specifiques a produire.',
      type: 'select',
      options: [
        { value: 'CIPAV', label: 'CIPAV (architectes, ingenieurs, consultants)' },
        { value: 'CARCDSF', label: 'CARCDSF (medecins, chirurgiens-dentistes, sages-femmes)' },
        { value: 'CARPIMKO', label: 'CARPIMKO (infirmiers, kines, orthophonistes)' },
        { value: 'CNBF', label: 'CNBF (avocats)' },
        { value: 'CAVEC', label: 'CAVEC (experts-comptables)' },
        { value: 'autre', label: 'Autre caisse' },
      ],
      field: 'caisse_retraite',
    });
  }

  // Holding: type + nombre filiales
  if (clientTypeId === 'holding') {
    questions.push({
      id: 'holding_type',
      label: 'Type de holding',
      description: 'Holding animatrice = prestations de services aux filiales. Passive = gestion de participations uniquement.',
      type: 'select',
      options: [
        { value: 'animatrice', label: 'Animatrice (services aux filiales)' },
        { value: 'passive', label: 'Passive (gestion patrimoniale)' },
        { value: 'mixte', label: 'Mixte (animatrice + patrimoniale)' },
      ],
      field: 'holding_type',
    });
    questions.push({
      id: 'nombre_filiales',
      label: 'Nombre de filiales',
      description: 'Impacte la consolidation et le suivi des participations.',
      type: 'number',
      field: 'nombre_filiales',
    });
  }

  // Association: activités lucratives + subventions
  if (clientTypeId === 'association') {
    questions.push({
      id: 'association_activites_lucratives',
      label: 'L\'association a-t-elle des activites lucratives ?',
      description: 'Si oui, soumission partielle a l\'IS et obligations declaratives supplementaires.',
      type: 'boolean',
      field: 'association_activites_lucratives',
    });
    questions.push({
      id: 'montant_subventions',
      label: 'Tranche de subventions annuelles',
      description: 'Au-dela de 153 000€, le commissaire aux comptes est obligatoire.',
      type: 'select',
      options: [
        { value: '< 153k', label: 'Moins de 153 000€' },
        { value: '> 153k', label: 'Plus de 153 000€ (CAC obligatoire)' },
      ],
      field: 'montant_subventions',
    });
  }

  return questions;
}
