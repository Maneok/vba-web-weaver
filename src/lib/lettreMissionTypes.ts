// =====================================================================
// Types de missions — Référentiel normatif OEC
// =====================================================================

export type MissionCategory =
  | 'assurance_comptes'    // Missions d'assurance sur comptes complets historiques
  | 'autres_assurance'     // Autres missions d'assurance
  | 'sans_assurance'       // Missions sans assurance
  | 'activites';           // Cadre des activités

export interface SpecificVariable {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

export interface MissionTypeConfig {
  id: string;
  label: string;
  shortLabel: string;
  category: MissionCategory;
  categoryLabel: string;
  categoryColor: string;
  normeRef: string;
  description: string;
  tooltipText: string;
  requiredSections: string[];
  optionalSections: string[];
  hiddenSections: string[];
  missionText: string;
  natureLimiteText: string;
  formeRapport: string;
  referentielApplicable: string;
  honorairesSuccesAutorises: boolean;
  specificVariables: SpecificVariable[];
  cgvSpecificClauses: string[];
}

export type MissionTypeId = keyof typeof MISSION_TYPES;

export const MISSION_TYPES = {

  // ──────────────────────────────────────────────────────────────
  // A. MISSIONS D'ASSURANCE — COMPTES COMPLETS HISTORIQUES
  // ──────────────────────────────────────────────────────────────

  presentation: {
    id: 'presentation',
    label: 'Mission de présentation des comptes',
    shortLabel: 'Présentation',
    category: 'assurance_comptes' as MissionCategory,
    categoryLabel: "Missions d'assurance — comptes complets historiques",
    categoryColor: 'blue',
    normeRef: 'NP 2300',
    description: "Exprimer une opinion sur la cohérence et la vraisemblance des comptes annuels.",
    tooltipText: "Mission la plus courante. L'expert-comptable exprime une opinion modérée sur la cohérence et la vraisemblance des comptes.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'referentiel_comptable', 'forme_rapport', 'duree', 'lcbft', 'honoraires'],
    optionalSections: ['mission_sociale', 'mission_juridique', 'mission_controle_fiscal', 'clause_resolutoire', 'mandat_fiscal'],
    hiddenSections: [],
    missionText: "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission de présentation des comptes (NP 2300).\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous rappelons les points suivants :\n\n— La mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n— Elle ne comporte ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs à la clôture de l'exercice comptable (stocks, immobilisations, espèces en caisse notamment) ;\n— Elle n'a pas pour objectif de déceler les fraudes ou les actes illégaux. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.\n\nVous restez responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes, ainsi que des procédures de contrôle interne concourant à leur élaboration.",
    natureLimiteText: "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Nous sommes juridiquement redevables d'une simple obligation de moyens. La vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par sondages.",
    formeRapport: "Attestation de présentation des comptes annuels",
    referentielApplicable: "Plan Comptable Général (PCG) — règlement ANC n°2014-03 modifié",
    honorairesSuccesAutorises: false,
    specificVariables: [],
    cgvSpecificClauses: []
  },

  examen_limite: {
    id: 'examen_limite',
    label: "Mission d'examen limité des comptes",
    shortLabel: 'Examen limité',
    category: 'assurance_comptes' as MissionCategory,
    categoryLabel: "Missions d'assurance — comptes complets historiques",
    categoryColor: 'blue',
    normeRef: 'NP 2400',
    description: "Obtenir une assurance modérée que les comptes ne comportent pas d'anomalies significatives.",
    tooltipText: "Niveau d'assurance intermédiaire. Procédures analytiques et entretiens, sans les contrôles de substance d'un audit.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'referentiel_comptable', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'informations_client'],
    optionalSections: ['mission_sociale', 'mission_juridique', 'clause_resolutoire', 'mandat_fiscal'],
    hiddenSections: [],
    missionText: "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable, de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission d'examen limité des comptes (NP 2400).\n\nL'examen limité est exclusif d'une mission de présentation et d'une mission d'audit. Les procédures mises en œuvre ne fournissent pas tous les éléments probants qu'exigerait un audit. En conséquence, nous n'exprimerons pas d'opinion d'audit.\n\nNos procédures consisteront principalement en :\n— des entretiens avec les membres de la direction et les personnes responsables des questions comptables et financières ;\n— des procédures analytiques appliquées aux données financières ;\n— d'autres procédures que nous jugerons nécessaires.\n\nVous restez responsable de la fiabilité, de l'exhaustivité et de l'exactitude des informations fournies.",
    natureLimiteText: "L'examen limité ne comporte pas l'appréciation des procédures de contrôle interne. Son objectif est d'obtenir une assurance modérée que les comptes, pris dans leur ensemble, ne comportent pas d'anomalies significatives. Une assurance modérée est un niveau d'assurance inférieur à celui d'un audit.",
    formeRapport: "Rapport d'examen limité des comptes",
    referentielApplicable: "Plan Comptable Général (PCG) — règlement ANC n°2014-03 modifié",
    honorairesSuccesAutorises: false,
    specificVariables: [
      { key: 'nature_informations_client', label: 'Nature des informations à communiquer par le client', placeholder: 'Documents comptables, pièces justificatives, analyses de comptes...', required: true }
    ],
    cgvSpecificClauses: []
  },

  audit_contractuel: {
    id: 'audit_contractuel',
    label: "Mission d'audit contractuel",
    shortLabel: 'Audit contractuel',
    category: 'assurance_comptes' as MissionCategory,
    categoryLabel: "Missions d'assurance — comptes complets historiques",
    categoryColor: 'blue',
    normeRef: 'ISA 210',
    description: "Obtenir une assurance raisonnable que les états financiers ne comportent pas d'anomalies significatives.",
    tooltipText: "Niveau d'assurance le plus élevé. Nécessite une équipe dédiée, un planning d'intervention et des déclarations écrites de la direction.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'referentiel_comptable', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'equipe_audit', 'planning_audit', 'declarations_ecrites'],
    optionalSections: ['mission_sociale', 'mission_juridique', 'clause_resolutoire', 'mandat_fiscal', 'auditeur_precedent', 'autres_auditeurs'],
    hiddenSections: [],
    missionText: "La mission que vous envisagez de nous confier sera effectuée conformément aux normes internationales d'audit (ISA) telles qu'adoptées par le référentiel normatif de l'Ordre des Experts-Comptables (ISA 210 et normes connexes).\n\nL'audit a pour objectif d'obtenir une assurance raisonnable que les états financiers, pris dans leur ensemble, ne comportent pas d'anomalies significatives, que celles-ci proviennent de fraudes ou résultent d'erreurs, et d'exprimer une opinion.\n\nUne assurance raisonnable correspond à un niveau élevé d'assurance qui ne garantit toutefois pas qu'un audit réalisé conformément aux normes ISA permettra toujours de détecter toute anomalie significative existante.\n\nNous vous demanderons de nous fournir des déclarations écrites confirmant certaines des déclarations faites au cours de l'audit.\n\nVous êtes responsable de l'établissement et de la présentation sincère des états financiers conformément au référentiel comptable applicable, ainsi que du contrôle interne que vous considérez comme nécessaire.",
    natureLimiteText: "En raison des limites inhérentes à un audit, il existe un risque inévitable que certaines anomalies significatives contenues dans les états financiers ne soient pas détectées, même si l'audit est correctement planifié et réalisé conformément aux normes ISA. Ce risque est plus élevé en cas de fraude, car la fraude peut impliquer la collusion, la falsification, les omissions volontaires, les fausses déclarations ou le contournement du contrôle interne.",
    formeRapport: "Rapport d'audit des états financiers",
    referentielApplicable: "Plan Comptable Général (PCG) — règlement ANC n°2014-03 modifié",
    honorairesSuccesAutorises: false,
    specificVariables: [
      { key: 'composition_equipe', label: "Composition de l'équipe d'audit", placeholder: 'Noms et fonctions des intervenants', required: true },
      { key: 'planning_audit', label: "Planning d'intervention", placeholder: 'Dates prévisionnelles des phases (intérimaire, final)', required: true },
      { key: 'auditeur_precedent', label: 'Auditeur précédent (si audit initial)', placeholder: 'Nom du cabinet précédent ou N/A', required: false }
    ],
    cgvSpecificClauses: [
      "Le client s'engage à donner accès à l'ensemble des informations, documents et explications demandés par l'équipe d'audit, y compris l'accès sans restriction aux personnes au sein de l'entité.",
      "Le client s'engage à fournir des déclarations écrites à la demande de l'auditeur, conformément à la norme ISA 580."
    ]
  },

  // ──────────────────────────────────────────────────────────────
  // B. AUTRES MISSIONS D'ASSURANCE
  // ──────────────────────────────────────────────────────────────

  attestation_particuliere: {
    id: 'attestation_particuliere',
    label: "Mission d'assurance — attestation particulière",
    shortLabel: 'Attestation',
    category: 'autres_assurance' as MissionCategory,
    categoryLabel: "Autres missions d'assurance",
    categoryColor: 'purple',
    normeRef: 'NP 3100',
    description: "Exprimer une assurance sur des informations autres que des comptes complets historiques.",
    tooltipText: "Attestation sur une information spécifique (CA, effectifs, covenants...). Peut être en assurance raisonnable ou modérée.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'objet_attestation', 'nature_travaux_attestation'],
    optionalSections: ['clause_resolutoire', 'mandat_fiscal'],
    hiddenSections: ['referentiel_comptable', 'mission_sociale', 'mission_juridique', 'mission_controle_fiscal'],
    missionText: "La mission que vous envisagez de nous confier sera effectuée conformément à la norme professionnelle applicable aux missions d'assurance sur des informations autres que des comptes complets historiques (NP 3100).\n\nCette mission a pour objet : {{objet_attestation}}.\n\nNos travaux consisteront à mettre en œuvre les diligences prévues par la norme NP 3100 afin d'exprimer une conclusion sur l'information objet de l'attestation.\n\nLa nature de nos travaux comprend notamment : {{nature_travaux_attestation}}.\n\nLa participation ou non du responsable de la mission à l'élaboration de l'information objet de l'attestation est précisée comme suit : {{participation_elaboration}}.",
    natureLimiteText: "Cette mission a pour objectif d'exprimer une assurance, modérée ou raisonnable selon le niveau retenu, sur l'information objet de l'attestation. Elle ne constitue pas un audit, un examen limité ni une mission de présentation des comptes. Elle ne porte que sur l'information spécifiquement visée.",
    formeRapport: "Attestation particulière (NP 3100)",
    referentielApplicable: "Selon la nature de l'information attestée",
    honorairesSuccesAutorises: false,
    specificVariables: [
      { key: 'objet_attestation', label: "Objet de l'attestation (information sur laquelle portera l'attestation)", placeholder: "Ex : chiffre d'affaires, effectifs, respect d'un covenant bancaire...", required: true },
      { key: 'nature_travaux_attestation', label: 'Nature des travaux à réaliser', placeholder: "Ex : rapprochement avec la comptabilité, contrôle de pièces, entretiens...", required: true },
      { key: 'participation_elaboration', label: "Participation à l'élaboration de l'information", placeholder: "Le responsable de mission a / n'a pas participé à l'élaboration de l'information", required: true },
      { key: 'niveau_assurance', label: "Niveau d'assurance (raisonnable ou modéré)", placeholder: 'Assurance raisonnable / Assurance modérée', required: true }
    ],
    cgvSpecificClauses: []
  },

  previsionnel: {
    id: 'previsionnel',
    label: "Examen d'informations financières prévisionnelles",
    shortLabel: 'Prévisionnel',
    category: 'autres_assurance' as MissionCategory,
    categoryLabel: "Autres missions d'assurance",
    categoryColor: 'purple',
    normeRef: 'NP 3400',
    description: "Examiner des informations financières prévisionnelles (budgets, business plans).",
    tooltipText: "Examen de budgets ou business plans. Opinion sur le caractère raisonnable des hypothèses, sans garantie de réalisation.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'utilisation_prevue', 'destinataires_info', 'nature_hypotheses', 'periode_couverte'],
    optionalSections: ['clause_resolutoire'],
    hiddenSections: ['referentiel_comptable', 'mission_sociale', 'mission_juridique', 'mission_controle_fiscal'],
    missionText: "La mission que vous envisagez de nous confier sera effectuée conformément à la norme professionnelle applicable à l'examen d'informations financières prévisionnelles (NP 3400).\n\nCet examen portera sur les informations prévisionnelles couvrant la période du {{periode_debut_prev}} au {{periode_fin_prev}}.\n\nL'utilisation prévue de ces informations est : {{utilisation_prevue}}.\nLes destinataires sont : {{destinataires_info}} (diffusion {{type_diffusion}}).\n\nLes hypothèses retenues sont de nature : {{nature_hypotheses}} (estimations les plus plausibles / hypothèses théoriques).\n\nLes commentaires à donner dans les notes annexes aux informations prévisionnelles seront définis d'un commun accord.",
    natureLimiteText: "Les informations financières prévisionnelles reposent sur des hypothèses relatives à des événements futurs et à des actions de la direction dont la réalisation est incertaine. En conséquence, nous ne pouvons pas exprimer d'opinion quant à la réalisation des résultats prévisionnels. Les écarts entre les résultats réels et les résultats prévisionnels peuvent être significatifs.",
    formeRapport: "Rapport sur l'examen d'informations financières prévisionnelles",
    referentielApplicable: "Selon le référentiel retenu pour les informations prévisionnelles",
    honorairesSuccesAutorises: false,
    specificVariables: [
      { key: 'periode_debut_prev', label: 'Début de la période prévisionnelle', placeholder: 'JJ/MM/AAAA', required: true },
      { key: 'periode_fin_prev', label: 'Fin de la période prévisionnelle', placeholder: 'JJ/MM/AAAA', required: true },
      { key: 'utilisation_prevue', label: 'Utilisation prévue des informations', placeholder: "Ex : recherche de financement, plan d'affaires, business plan cession...", required: true },
      { key: 'destinataires_info', label: 'Destinataires des informations', placeholder: 'Ex : établissements bancaires, investisseurs, direction', required: true },
      { key: 'type_diffusion', label: 'Type de diffusion', placeholder: 'Générale / Restreinte', required: true },
      { key: 'nature_hypotheses', label: 'Nature des hypothèses', placeholder: 'Estimations les plus plausibles / Hypothèses théoriques', required: true }
    ],
    cgvSpecificClauses: []
  },

  // ──────────────────────────────────────────────────────────────
  // C. MISSIONS SANS ASSURANCE
  // ──────────────────────────────────────────────────────────────

  procedures_convenues: {
    id: 'procedures_convenues',
    label: "Examen d'informations sur la base de procédures convenues",
    shortLabel: 'Procédures convenues',
    category: 'sans_assurance' as MissionCategory,
    categoryLabel: 'Missions sans assurance',
    categoryColor: 'amber',
    normeRef: 'NP 4400',
    description: "Mettre en œuvre des procédures convenues et rapporter les constats de manière factuelle, sans expression d'assurance.",
    tooltipText: "Aucune assurance exprimée. Le professionnel applique les procédures définies avec le client et rapporte factuellement ses constats.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'contexte_mission', 'informations_examinees', 'procedures_detail', 'calendrier_procedures', 'diffusion_rapport'],
    optionalSections: ['clause_resolutoire'],
    hiddenSections: ['referentiel_comptable', 'mission_sociale', 'mission_juridique', 'mission_controle_fiscal'],
    missionText: "La mission que vous envisagez de nous confier sera effectuée conformément à la norme professionnelle applicable aux missions d'examen d'informations sur la base de procédures convenues (NP 4400).\n\nCette mission est exclusive d'une mission de présentation, d'examen limité ou d'audit. Nous ne délivrerons aucune assurance.\n\nLe contexte de la mission est le suivant : {{contexte_mission}}.\n\nLes informations sur lesquelles vont porter les procédures sont : {{informations_examinees}}.\n\nLes procédures à mettre en œuvre, définies d'un commun accord, sont les suivantes :\n{{procedures_detail}}\n\nLe calendrier prévu est : {{calendrier_procedures}}.\n\nNos constats seront rapportés de manière factuelle dans un rapport dont la diffusion est limitée à : {{diffusion_rapport}}.",
    natureLimiteText: "Cette mission a pour seul objectif de mettre en œuvre les procédures définies d'un commun accord et de rapporter nos constats de manière factuelle. Aucune assurance n'est exprimée. Il vous appartient et il appartient aux destinataires convenus de tirer vos propres conclusions des constats rapportés.",
    formeRapport: "Rapport relatant les constats issus des procédures convenues",
    referentielApplicable: "Sans objet",
    honorairesSuccesAutorises: true,
    specificVariables: [
      { key: 'contexte_mission', label: 'Contexte de la mission', placeholder: "Ex : due diligence, vérification d'un accord contractuel...", required: true },
      { key: 'informations_examinees', label: 'Informations sur lesquelles portent les procédures', placeholder: "Ex : comptes de charges, contrats fournisseurs, état des créances...", required: true },
      { key: 'procedures_detail', label: 'Détail des procédures à mettre en œuvre', placeholder: "Lister chaque procédure numérotée : 1. Rapprochement de... 2. Vérification de...", required: true },
      { key: 'calendrier_procedures', label: 'Calendrier des procédures', placeholder: "Ex : Phase 1 en mars, Phase 2 en avril, rapport en mai", required: true },
      { key: 'diffusion_rapport', label: 'Limites de diffusion du rapport', placeholder: "Ex : Diffusion restreinte aux parties au contrat", required: true }
    ],
    cgvSpecificClauses: [
      "Le rapport émis dans le cadre de cette mission est destiné exclusivement aux parties convenues. Sa diffusion à des tiers non autorisés est interdite sans l'accord préalable écrit du cabinet."
    ]
  },

  compilation: {
    id: 'compilation',
    label: 'Mission de compilation',
    shortLabel: 'Compilation',
    category: 'sans_assurance' as MissionCategory,
    categoryLabel: 'Missions sans assurance',
    categoryColor: 'amber',
    normeRef: 'NP 4410',
    description: "Utiliser l'expertise comptable pour collecter, classer et présenter des informations financières sans expression d'assurance.",
    tooltipText: "Mise en forme d'informations financières sans aucun contrôle de substance ni expression d'assurance.",
    requiredSections: ['introduction', 'entite', 'mission', 'nature_limite', 'responsable_mission', 'referentiel_comptable', 'forme_rapport', 'duree', 'lcbft', 'honoraires', 'informations_client'],
    optionalSections: ['mission_sociale', 'mission_juridique', 'clause_resolutoire', 'mandat_fiscal'],
    hiddenSections: ['mission_controle_fiscal'],
    missionText: "La mission que vous envisagez de nous confier sera effectuée conformément à la norme professionnelle applicable à la mission de compilation (NP 4410).\n\nCette mission est exclusive d'une mission de présentation, d'examen limité ou d'audit. Nous ne délivrerons aucune assurance et nous n'effectuerons aucun contrôle portant sur la substance des comptes.\n\nNotre mission consiste à utiliser notre expertise comptable pour collecter, classer, résumer et présenter des informations financières. Nos travaux ne comprennent pas :\n— le contrôle de la réalité et de l'exhaustivité des opérations ;\n— le contrôle des inventaires physiques ;\n— l'appréciation des procédures de contrôle interne.\n\nVous restez responsable de la fiabilité, de l'exhaustivité et de l'exactitude des informations fournies.",
    natureLimiteText: "Cette mission n'a pas pour objectif de déceler des erreurs, actes illégaux ou autres irrégularités. Aucune assurance n'est délivrée sur les comptes compilés. Les utilisateurs des comptes compilés doivent être informés qu'aucune assurance n'est exprimée.",
    formeRapport: "Rapport de compilation",
    referentielApplicable: "Plan Comptable Général (PCG) — règlement ANC n°2014-03 modifié",
    honorairesSuccesAutorises: true,
    specificVariables: [
      { key: 'nature_informations_client', label: 'Nature des informations à communiquer par le client', placeholder: 'Grand livre, balances, pièces justificatives...', required: true }
    ],
    cgvSpecificClauses: []
  },

  // ──────────────────────────────────────────────────────────────
  // D. CADRE DES ACTIVITÉS
  // ──────────────────────────────────────────────────────────────

  activite_commerciale: {
    id: 'activite_commerciale',
    label: "Activités commerciales et actes d'intermédiaire",
    shortLabel: 'Activité commerciale',
    category: 'activites' as MissionCategory,
    categoryLabel: 'Cadre des activités',
    categoryColor: 'teal',
    normeRef: 'Norme activités',
    description: "Activités commerciales et actes d'intermédiaire autorisés par l'article 22 de l'ordonnance de 1945.",
    tooltipText: "Prestations hors missions normées : intermédiation en assurances, vente de logiciels, formation, etc.",
    requiredSections: ['introduction', 'entite', 'mission', 'responsable_mission', 'duree', 'lcbft', 'honoraires'],
    optionalSections: ['clause_resolutoire'],
    hiddenSections: ['referentiel_comptable', 'nature_limite', 'forme_rapport', 'mission_sociale', 'mission_juridique', 'mission_controle_fiscal'],
    missionText: "La prestation que vous envisagez de nous confier relève du cadre des activités tel que défini par le référentiel normatif de l'Ordre des Experts-Comptables, et sera effectuée dans le respect des dispositions du Code de déontologie.\n\nLa nature de la prestation est : {{description_activite}}.\n\nNos travaux consisteront à : {{detail_travaux_activite}}.\n\nCette prestation ne constitue pas une mission au sens du cadre des missions du référentiel normatif.",
    natureLimiteText: "",
    formeRapport: "Selon la nature de la prestation",
    referentielApplicable: "Sans objet",
    honorairesSuccesAutorises: true,
    specificVariables: [
      { key: 'description_activite', label: "Description de l'activité", placeholder: "Ex : intermédiation en assurances, vente de logiciels, formation...", required: true },
      { key: 'detail_travaux_activite', label: 'Détail des travaux', placeholder: "Décrire les prestations concrètes", required: true }
    ],
    cgvSpecificClauses: []
  },

  autre_prestation: {
    id: 'autre_prestation',
    label: 'Autre prestation (conseil, accompagnement)',
    shortLabel: 'Autre prestation',
    category: 'activites' as MissionCategory,
    categoryLabel: 'Autres prestations',
    categoryColor: 'teal',
    normeRef: 'Art. 22 Ord. 1945',
    description: "Assistance, conseil, accompagnement (création, cession, évaluation, social, fiscalité, organisation...).",
    tooltipText: "Missions de conseil pur (création, cession, évaluation, organisation). Obligation de moyens, sans opinion sur les comptes.",
    requiredSections: ['introduction', 'entite', 'mission', 'responsable_mission', 'duree', 'lcbft', 'honoraires'],
    optionalSections: ['mission_sociale', 'mission_juridique', 'clause_resolutoire', 'mandat_fiscal'],
    hiddenSections: ['referentiel_comptable', 'nature_limite', 'forme_rapport', 'mission_controle_fiscal'],
    missionText: "La prestation que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable.\n\nLa nature de la prestation est : {{description_prestation}}.\n\nNos travaux consisteront à : {{detail_travaux_prestation}}.\n\nCette prestation relève d'une obligation de moyens. Nous ne délivrerons aucune opinion sur des comptes ou des informations financières.",
    natureLimiteText: "",
    formeRapport: "Selon la nature de la prestation",
    referentielApplicable: "Sans objet",
    honorairesSuccesAutorises: true,
    specificVariables: [
      { key: 'description_prestation', label: 'Description de la prestation', placeholder: "Ex : accompagnement à la création, évaluation d'entreprise, conseil en organisation...", required: true },
      { key: 'detail_travaux_prestation', label: 'Détail des travaux', placeholder: "Décrire les prestations concrètes", required: true }
    ],
    cgvSpecificClauses: []
  }

} as const satisfies Record<string, MissionTypeConfig>;

// Groupement par catégorie pour le menu déroulant
export const MISSION_CATEGORIES: { label: string; category: MissionCategory; color: string; missions: string[] }[] = [
  {
    label: "Missions d'assurance — comptes complets historiques",
    category: 'assurance_comptes',
    color: 'blue',
    missions: ['presentation', 'examen_limite', 'audit_contractuel']
  },
  {
    label: "Autres missions d'assurance",
    category: 'autres_assurance',
    color: 'purple',
    missions: ['attestation_particuliere', 'previsionnel']
  },
  {
    label: 'Missions sans assurance',
    category: 'sans_assurance',
    color: 'amber',
    missions: ['procedures_convenues', 'compilation']
  },
  {
    label: 'Activités et autres prestations',
    category: 'activites',
    color: 'teal',
    missions: ['activite_commerciale', 'autre_prestation']
  }
];

// OPT-6: Type pour le groupement
export type MissionCategoryType = typeof MISSION_CATEGORIES[number];

/** Helper: get config for a mission type ID, with fallback to presentation */
export function getMissionTypeConfig(missionTypeId: string): MissionTypeConfig {
  return MISSION_TYPES[missionTypeId as keyof typeof MISSION_TYPES] ?? MISSION_TYPES.presentation;
}

/** OPT-7: Get all mission types for a given category */
export function getMissionTypesByCategory(category: MissionCategory): MissionTypeConfig[] {
  return Object.values(MISSION_TYPES).filter((m) => m.category === category);
}

/** OPT-8: Get the category of a mission type */
export function getMissionCategory(missionTypeId: string): MissionCategory | null {
  const config = MISSION_TYPES[missionTypeId as keyof typeof MISSION_TYPES];
  return config?.category ?? null;
}

/** OPT-9: Check if comptable mode (referentiel comptable) is applicable */
export function isModeComptableApplicable(missionTypeId: string): boolean {
  return missionTypeId === 'presentation' || missionTypeId === 'compilation';
}

/** OPT-10: Get specific variables for a mission type */
export function getSpecificVariablesForType(missionTypeId: string): SpecificVariable[] {
  const config = MISSION_TYPES[missionTypeId as keyof typeof MISSION_TYPES];
  return config?.specificVariables ? [...config.specificVariables] : [];
}

// =====================================================================
// Types de clients — Ce que l'utilisateur choisit
// =====================================================================

export type ClientTypeCategory =
  | 'societes_commerciales'
  | 'societes_civiles'
  | 'entreprises_individuelles'
  | 'immobilier_patrimoine'
  | 'particuliers'
  | 'autres';

export interface ClientTypeConfig {
  id: string;
  label: string;
  shortLabel: string;
  category: ClientTypeCategory;
  categoryLabel: string;
  categoryIcon: string;
  categoryColor: string;
  description: string;
  defaultMissionType: string;
  defaultModeComptable: 'TENUE' | 'SURVEILLANCE' | 'REVISION' | null;
  defaultMissions: {
    comptabilite: boolean;
    fiscal: boolean;
    social: boolean;
    juridique: boolean;
    conseil: boolean;
  };
  regimeFiscal: 'IS' | 'IR' | 'micro' | 'bnc' | null;
  matchingFormes: string[];
  hasCAC: boolean;
  hasSalaries: boolean;
  needsJuridique: boolean;
  specificClauses: string[];
}

export const CLIENT_TYPES: Record<string, ClientTypeConfig> = {
  // ── SOCIÉTÉS COMMERCIALES ──
  'sas_is': {
    id: 'sas_is', label: 'SAS / SASU à l\'IS', shortLabel: 'SAS/SASU',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'Société par actions simplifiée soumise à l\'impôt sur les sociétés.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: ['SAS', 'SASU', 'SAS À CAPITAL VARIABLE'],
    hasCAC: true, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'sarl_is': {
    id: 'sarl_is', label: 'SARL / EURL à l\'IS', shortLabel: 'SARL/EURL',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'Société à responsabilité limitée soumise à l\'impôt sur les sociétés.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: ['SARL', 'EURL', 'SARL À CAPITAL VARIABLE', 'SARL UNIPERSONNELLE'],
    hasCAC: false, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'sarl_ir': {
    id: 'sarl_ir', label: 'SARL / EURL à l\'IR (option)', shortLabel: 'SARL IR',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'SARL/EURL ayant opté pour l\'impôt sur le revenu (BIC).',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: [],
    hasCAC: false, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'sarl_famille': {
    id: 'sarl_famille', label: 'SARL de famille (IR)', shortLabel: 'SARL famille',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'SARL entre membres d\'une même famille, soumise de droit à l\'IR (art. 239 bis AA CGI).',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['SARL DE FAMILLE'],
    hasCAC: false, hasSalaries: false, needsJuridique: true,
    specificClauses: ['mandat_fiscal'],
  },
  'sa': {
    id: 'sa', label: 'SA (Société Anonyme)', shortLabel: 'SA',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'Société anonyme — CAC obligatoire si seuils dépassés.',
    defaultMissionType: 'presentation', defaultModeComptable: 'SURVEILLANCE',
    defaultMissions: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: ['SA', 'SA À DIRECTOIRE', 'SA À CONSEIL D\'ADMINISTRATION'],
    hasCAC: true, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'snc': {
    id: 'snc', label: 'SNC (Société en Nom Collectif)', shortLabel: 'SNC',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'building-2', categoryColor: 'blue',
    description: 'Société en nom collectif — responsabilité solidaire et illimitée des associés.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['SNC'],
    hasCAC: false, hasSalaries: false, needsJuridique: true,
    specificClauses: ['mandat_fiscal'],
  },
  'selarl': {
    id: 'selarl', label: 'SELARL / SELURL', shortLabel: 'SELARL',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'briefcase', categoryColor: 'blue',
    description: 'Société d\'exercice libéral à responsabilité limitée.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: ['SELARL', 'SELURL', 'SOCIÉTÉ D\'EXERCICE LIBÉRAL À RESPONSABILITÉ LIMITÉE'],
    hasCAC: false, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'selas': {
    id: 'selas', label: 'SELAS / SELASU', shortLabel: 'SELAS',
    category: 'societes_commerciales', categoryLabel: 'Sociétés commerciales',
    categoryIcon: 'briefcase', categoryColor: 'blue',
    description: 'Société d\'exercice libéral par actions simplifiée.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: ['SELAS', 'SELASU', 'SELAFA'],
    hasCAC: true, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  // ── SOCIÉTÉS CIVILES ──
  'sci_ir': {
    id: 'sci_ir', label: 'SCI à l\'IR (revenus fonciers)', shortLabel: 'SCI IR',
    category: 'societes_civiles', categoryLabel: 'Sociétés civiles',
    categoryIcon: 'home', categoryColor: 'purple',
    description: 'SCI soumise à l\'IR — déclaration revenus fonciers (2072).',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['SCI', 'SOCIÉTÉ CIVILE IMMOBILIÈRE'],
    hasCAC: false, hasSalaries: false, needsJuridique: true,
    specificClauses: ['mandat_fiscal'],
  },
  'sci_is': {
    id: 'sci_is', label: 'SCI à l\'IS', shortLabel: 'SCI IS',
    category: 'societes_civiles', categoryLabel: 'Sociétés civiles',
    categoryIcon: 'home', categoryColor: 'purple',
    description: 'SCI ayant opté pour l\'IS — comptabilité d\'engagement, bilan, liasse fiscale.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IS', matchingFormes: [],
    hasCAC: false, hasSalaries: false, needsJuridique: true,
    specificClauses: ['mandat_fiscal'],
  },
  'scm': {
    id: 'scm', label: 'SCM (Société Civile de Moyens)', shortLabel: 'SCM',
    category: 'societes_civiles', categoryLabel: 'Sociétés civiles',
    categoryIcon: 'users', categoryColor: 'purple',
    description: 'Mise en commun de moyens entre professionnels libéraux.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['SCM', 'SOCIÉTÉ CIVILE DE MOYENS'],
    hasCAC: false, hasSalaries: false, needsJuridique: true,
    specificClauses: [],
  },
  'scp': {
    id: 'scp', label: 'SCP (Société Civile Professionnelle)', shortLabel: 'SCP',
    category: 'societes_civiles', categoryLabel: 'Sociétés civiles',
    categoryIcon: 'users', categoryColor: 'purple',
    description: 'Exercice en commun d\'une profession libérale réglementée.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['SCP', 'SOCIÉTÉ CIVILE PROFESSIONNELLE'],
    hasCAC: false, hasSalaries: true, needsJuridique: true,
    specificClauses: ['mandat_fiscal'],
  },
  // ── ENTREPRISES INDIVIDUELLES ──
  'ei_reel': {
    id: 'ei_reel', label: 'Entreprise individuelle au réel (BIC/BNC)', shortLabel: 'EI réel',
    category: 'entreprises_individuelles', categoryLabel: 'Entreprises individuelles',
    categoryIcon: 'user', categoryColor: 'teal',
    description: 'Entrepreneur individuel au régime réel — bilan, compte de résultat, liasse.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['ENTREPRISE INDIVIDUELLE', 'EI', 'EIRL', 'ENTREPRENEUR INDIVIDUEL'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: ['mandat_fiscal'],
  },
  'micro': {
    id: 'micro', label: 'Micro-entreprise / Auto-entrepreneur', shortLabel: 'Micro',
    category: 'entreprises_individuelles', categoryLabel: 'Entreprises individuelles',
    categoryIcon: 'user', categoryColor: 'teal',
    description: 'Régime micro — comptabilité simplifiée, pas de bilan.',
    defaultMissionType: 'compilation', defaultModeComptable: null,
    defaultMissions: { comptabilite: false, fiscal: true, social: false, juridique: false, conseil: true },
    regimeFiscal: 'micro', matchingFormes: ['MICRO-ENTREPRISE', 'AUTO-ENTREPRENEUR', 'MICRO ENTREPRISE'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: [],
  },
  'profession_liberale': {
    id: 'profession_liberale', label: 'Profession libérale (BNC)', shortLabel: 'BNC',
    category: 'entreprises_individuelles', categoryLabel: 'Entreprises individuelles',
    categoryIcon: 'briefcase', categoryColor: 'teal',
    description: 'Professionnel libéral en nom propre — déclaration 2035.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['PROFESSION LIBÉRALE', 'BNC', 'PROFESSIONNEL LIBÉRAL'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: ['mandat_fiscal'],
  },
  // ── IMMOBILIER / PATRIMOINE ──
  'lmnp': {
    id: 'lmnp', label: 'LMNP (Loueur Meublé Non Professionnel)', shortLabel: 'LMNP',
    category: 'immobilier_patrimoine', categoryLabel: 'Immobilier & patrimoine',
    categoryIcon: 'key-round', categoryColor: 'amber',
    description: 'Location meublée non professionnelle — régime BIC, amortissements.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['LMNP', 'LOUEUR MEUBLÉ NON PROFESSIONNEL'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: ['mandat_fiscal'],
  },
  'lmp': {
    id: 'lmp', label: 'LMP (Loueur Meublé Professionnel)', shortLabel: 'LMP',
    category: 'immobilier_patrimoine', categoryLabel: 'Immobilier & patrimoine',
    categoryIcon: 'key-round', categoryColor: 'amber',
    description: 'Location meublée professionnelle — cotisations sociales, plus-values professionnelles.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: true, juridique: false, conseil: false },
    regimeFiscal: 'IR', matchingFormes: ['LMP', 'LOUEUR MEUBLÉ PROFESSIONNEL'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: ['mandat_fiscal'],
  },
  // ── PARTICULIERS ──
  'irpp': {
    id: 'irpp', label: 'IRPP (Déclaration de revenus)', shortLabel: 'IRPP',
    category: 'particuliers', categoryLabel: 'Particuliers',
    categoryIcon: 'user-circle', categoryColor: 'pink',
    description: 'Déclaration de revenus des personnes physiques.',
    defaultMissionType: 'autre_prestation', defaultModeComptable: null,
    defaultMissions: { comptabilite: false, fiscal: true, social: false, juridique: false, conseil: true },
    regimeFiscal: null, matchingFormes: ['PARTICULIER', 'PERSONNE PHYSIQUE'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: [],
  },
  // ── AUTRES ──
  'association': {
    id: 'association', label: 'Association loi 1901', shortLabel: 'Association',
    category: 'autres', categoryLabel: 'Autres structures',
    categoryIcon: 'heart-handshake', categoryColor: 'gray',
    description: 'Association à but non lucratif — comptabilité spécifique.',
    defaultMissionType: 'presentation', defaultModeComptable: 'TENUE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: false },
    regimeFiscal: null, matchingFormes: ['ASSOCIATION', 'ASSOCIATION LOI 1901', 'ASSOCIATION DÉCLARÉE'],
    hasCAC: true, hasSalaries: true, needsJuridique: false,
    specificClauses: [],
  },
  'holding': {
    id: 'holding', label: 'Holding', shortLabel: 'Holding',
    category: 'autres', categoryLabel: 'Autres structures',
    categoryIcon: 'network', categoryColor: 'gray',
    description: 'Société holding — gestion de participations.',
    defaultMissionType: 'presentation', defaultModeComptable: 'SURVEILLANCE',
    defaultMissions: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: true },
    regimeFiscal: 'IS', matchingFormes: ['HOLDING', 'SOCIÉTÉ HOLDING'],
    hasCAC: true, hasSalaries: false, needsJuridique: true,
    specificClauses: ['mandat_fiscal', 'clause_rgpd'],
  },
  'creation': {
    id: 'creation', label: 'Création d\'entreprise (prévisionnel)', shortLabel: 'Création',
    category: 'autres', categoryLabel: 'Autres structures',
    categoryIcon: 'rocket', categoryColor: 'gray',
    description: 'Accompagnement à la création — prévisionnel, choix de statut, business plan.',
    defaultMissionType: 'previsionnel', defaultModeComptable: null,
    defaultMissions: { comptabilite: false, fiscal: false, social: false, juridique: false, conseil: true },
    regimeFiscal: null, matchingFormes: [],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: [],
  },
  'syndicat_copro': {
    id: 'syndicat_copro', label: 'Syndicat de copropriété', shortLabel: 'Copro',
    category: 'autres', categoryLabel: 'Autres structures',
    categoryIcon: 'building', categoryColor: 'gray',
    description: 'Syndicat de copropriétaires — vérification des comptes du syndic.',
    defaultMissionType: 'procedures_convenues', defaultModeComptable: null,
    defaultMissions: { comptabilite: false, fiscal: false, social: false, juridique: false, conseil: false },
    regimeFiscal: null, matchingFormes: ['SYNDICAT DE COPROPRIÉTÉ', 'COPROPRIÉTÉ'],
    hasCAC: false, hasSalaries: false, needsJuridique: false,
    specificClauses: [],
  },
};

export const CLIENT_TYPE_CATEGORIES: { label: string; category: ClientTypeCategory; icon: string; color: string; types: string[] }[] = [
  { label: 'Sociétés commerciales', category: 'societes_commerciales', icon: 'building-2', color: 'blue',
    types: ['sas_is', 'sarl_is', 'sarl_ir', 'sarl_famille', 'sa', 'snc', 'selarl', 'selas'] },
  { label: 'Sociétés civiles', category: 'societes_civiles', icon: 'home', color: 'purple',
    types: ['sci_ir', 'sci_is', 'scm', 'scp'] },
  { label: 'Entreprises individuelles', category: 'entreprises_individuelles', icon: 'user', color: 'teal',
    types: ['ei_reel', 'micro', 'profession_liberale'] },
  { label: 'Immobilier & patrimoine', category: 'immobilier_patrimoine', icon: 'key-round', color: 'amber',
    types: ['lmnp', 'lmp'] },
  { label: 'Particuliers', category: 'particuliers', icon: 'user-circle', color: 'pink',
    types: ['irpp'] },
  { label: 'Autres structures', category: 'autres', icon: 'layers', color: 'gray',
    types: ['association', 'holding', 'creation', 'syndicat_copro'] },
];

export function recommendClientType(formeJuridique: string): { recommended: string; alternatives: string[] } {
  const forme = (formeJuridique || '').toUpperCase().trim();
  if (!forme) return { recommended: 'sas_is', alternatives: ['sarl_is', 'ei_reel'] };

  // Exact match
  for (const [id, config] of Object.entries(CLIENT_TYPES)) {
    for (const match of config.matchingFormes) {
      if (forme === match || forme.includes(match) || match.includes(forme)) {
        const cat = CLIENT_TYPE_CATEGORIES.find(c => c.types.includes(id));
        const alternatives = cat ? cat.types.filter(t => t !== id).slice(0, 3) : [];
        return { recommended: id, alternatives };
      }
    }
  }

  // Keyword fallback
  if (forme.includes('SAS') || forme.includes('SASU')) return { recommended: 'sas_is', alternatives: [] };
  if (forme.includes('SELARL') || forme.includes('SELURL')) return { recommended: 'selarl', alternatives: [] };
  if (forme.includes('SELAS') || forme.includes('SELASU') || forme.includes('SELAFA')) return { recommended: 'selas', alternatives: [] };
  if (forme.includes('SARL') && forme.includes('FAMILLE')) return { recommended: 'sarl_famille', alternatives: ['sarl_is', 'sarl_ir'] };
  if (forme.includes('SARL') || forme.includes('EURL')) return { recommended: 'sarl_is', alternatives: ['sarl_ir', 'sarl_famille'] };
  if (forme.includes('SCI')) return { recommended: 'sci_ir', alternatives: ['sci_is'] };
  if (forme.includes('SCM')) return { recommended: 'scm', alternatives: [] };
  if (forme.includes('SCP')) return { recommended: 'scp', alternatives: [] };
  if (forme.includes('SNC')) return { recommended: 'snc', alternatives: [] };
  if (forme === 'SA' || forme.startsWith('SA ')) return { recommended: 'sa', alternatives: [] };
  if (forme.includes('INDIVIDU') || forme === 'EI' || forme.includes('EIRL')) return { recommended: 'ei_reel', alternatives: ['micro', 'profession_liberale'] };
  if (forme.includes('MICRO') || forme.includes('AUTO')) return { recommended: 'micro', alternatives: ['ei_reel'] };
  if (forme.includes('LIBÉRAL') || forme.includes('LIBERAL') || forme.includes('BNC')) return { recommended: 'profession_liberale', alternatives: ['ei_reel'] };
  if (forme.includes('ASSOCIATION') || forme.includes('ASSO')) return { recommended: 'association', alternatives: [] };
  if (forme.includes('LMNP')) return { recommended: 'lmnp', alternatives: ['lmp'] };
  if (forme.includes('LMP')) return { recommended: 'lmp', alternatives: ['lmnp'] };

  return { recommended: 'sas_is', alternatives: ['sarl_is', 'ei_reel'] };
}

export function getClientTypeConfig(clientTypeId: string): ClientTypeConfig | null {
  return CLIENT_TYPES[clientTypeId] || null;
}

/** Get Tailwind color classes for a mission category */
export function getCategoryColorClasses(category: MissionCategory): { bg: string; text: string; border: string; badge: string } {
  const colors: Record<MissionCategory, { bg: string; text: string; border: string; badge: string }> = {
    'assurance_comptes': {
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    },
    'autres_assurance': {
      bg: 'bg-purple-50 dark:bg-purple-950',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    },
    'sans_assurance': {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    },
    'activites': {
      bg: 'bg-teal-50 dark:bg-teal-950',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800',
      badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
    }
  };
  return colors[category];
}
