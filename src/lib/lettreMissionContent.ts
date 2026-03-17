// =====================================================================
// Contenu template pour les lettres de mission
// =====================================================================
//
// RÔLE DE CE FICHIER :
//   Tronc commun (attestation travail dissimulé, mandat SEPA, autorisation
//   liasse, contrôle fiscal, clauses normatives, CGV génériques, répartition).
//
// SOURCES DE VÉRITÉ :
//   - Textes normatifs par type de mission → lettreMissionTypes.ts
//   - Sections par défaut, CGV par type, répartition par type → lettreMissionModeles.ts
//
// CORRECTIONS CNOEC intégrées :
//   #1-5 : Section "mission" (réf NP 2300, responsable, référentiel, rapport, responsabilité client)
//   #6   : Clause résolutoire (art. 1225 Code civil, CNOEC Titre III §7)
//   #7   : Mandat fiscal et social (CNOEC Titre II §2.1)
//   #8-9 : Honoraires — exclusion succès (art. 24 ord. 1945) + indexation INSEE
//   #10  : Pénalités de retard (BCE+10pts, art. L 441-10 + 40€ art. D 441-5)
//   #11  : Assurance RC Pro avec variables {{assureur_nom}} / {{assureur_adresse}}
//   #12  : LCB-FT articles L 561-12 + L 561-10-2 CMF
//   #13  : RGPD — responsable de traitement par défaut
//   #14  : Droit applicable avec {{ville_tribunal}}
//   #15  : Non-sollicitation + conciliation CROEC
// =====================================================================

export type Genre = "M" | "Mme";

export interface ControleFiscalOption {
  id: "A" | "B" | "RENONCE";
  label: string;
  montant: number | null;
}

export const CONTROLE_FISCAL_OPTIONS: ControleFiscalOption[] = [
  {
    id: "A",
    label: "Option A — Assistance en cas de contrôle fiscal",
    montant: 1500,
  },
  {
    id: "B",
    label: "Option B — Assistance et représentation en contrôle fiscal",
    montant: 3000,
  },
  {
    id: "RENONCE",
    label: "Le client renonce à cette option",
    montant: null,
  },
];

// ── OPT-39 : Textes d'aide par section (tooltip / description) ──
export const SECTION_HELP_TEXTS: Record<string, string> = {
  introduction: "Contexte de la relation professionnelle et présentation des parties.",
  entite: "Identification complète de l'entité cliente (forme juridique, SIREN, adresse du siège).",
  mission: "Nature et étendue de la mission confiée, référence normative applicable.",
  nature_limite: "Précise les limites inhérentes à la mission et ce qu'elle ne couvre pas.",
  responsable_mission: "Expert-comptable signataire responsable de la bonne exécution de la mission.",
  referentiel_comptable: "Référentiel comptable applicable (PCG, IFRS, autre).",
  forme_rapport: "Type de document émis à l'issue de la mission (attestation, rapport, etc.).",
  duree: "Durée de la mission, conditions de renouvellement et de résiliation.",
  lcbft: "Obligations LCB-FT : identification, vigilance, conservation des pièces (L 561-12, L 561-10-2 CMF).",
  honoraires: "Montant, modalités de paiement, clause d'indexation et exclusion honoraires de succès si applicable.",
  mission_sociale: "Prestations sociales complémentaires (paie, DSN, contrats de travail).",
  mission_juridique: "Prestations juridiques complémentaires (AG, PV, secrétariat juridique).",
  mission_controle_fiscal: "Option d'assistance ou représentation en cas de contrôle fiscal.",
  clause_resolutoire: "Résolution de plein droit en cas d'inexécution (art. 1225 Code civil).",
  mandat_fiscal: "Mandat pour télétransmettre les déclarations fiscales et sociales.",
  informations_client: "Informations que le client doit communiquer pour l'exécution de la mission.",
  equipe_audit: "Composition de l'équipe d'audit et rôles des intervenants.",
  planning_audit: "Calendrier des phases d'intervention (intérimaire, final).",
  declarations_ecrites: "Déclarations écrites de la direction requises par ISA 580.",
  objet_attestation: "Information spécifique sur laquelle porte l'attestation (NP 3100).",
  nature_travaux_attestation: "Diligences mises en œuvre pour l'attestation.",
  utilisation_prevue: "Utilisation prévue des informations prévisionnelles.",
  destinataires_info: "Destinataires identifiés des informations prévisionnelles.",
  nature_hypotheses: "Caractère des hypothèses : estimations les plus plausibles ou hypothèses théoriques.",
  periode_couverte: "Période couverte par les informations prévisionnelles.",
  contexte_mission: "Contexte ayant conduit à la mise en œuvre des procédures convenues.",
  informations_examinees: "Informations sur lesquelles portent les procédures convenues.",
  procedures_detail: "Liste détaillée des procédures à mettre en œuvre.",
  calendrier_procedures: "Calendrier prévu pour la réalisation des procédures.",
  diffusion_rapport: "Limites de diffusion du rapport de constats.",
  repartition_taches: "Répartition des travaux entre le cabinet et le client, avec périodicité.",
  cgv: "Conditions générales d'intervention jointes à la lettre de mission.",
  sepa: "Mandat de prélèvement SEPA pour le règlement des honoraires.",
};

export const LETTRE_MISSION_TEMPLATE = {
  repartitionTravaux: {
    colonnes: ["Travaux", "Cabinet", "Client", "Périodicité"],
    lignes: [
      { id: "tenue", label: "Tenue comptable courante", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "saisie", label: "Saisie des écritures comptables", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "pointage", label: "Pointage et lettrage des comptes", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "rapprochement", label: "Rapprochement bancaire", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "tva", label: "Déclaration de TVA", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "justification", label: "Justification des soldes de comptes", defautCabinet: true, defautClient: false, periodicite: "Trimestriel" },
      { id: "classement", label: "Classement des pièces justificatives", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "factures", label: "Émission des factures clients", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "relances", label: "Relances clients / suivi créances", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "inventaire", label: "Inventaire physique des stocks", defautCabinet: false, defautClient: true, periodicite: "Annuel" },
      { id: "bilan", label: "Établissement du bilan et compte de résultat", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "liasse", label: "Établissement de la liasse fiscale", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "attestation", label: "Attestation de présentation des comptes", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "plaquette", label: "Plaquette annuelle de présentation des comptes", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "ag", label: "Procès-verbaux d'assemblée générale", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "archives", label: "Archivage et conservation des documents", defautCabinet: true, defautClient: true, periodicite: "Permanent" },
    ],
  },
  attestationTravailDissimule: {
    titre: "Attestation relative au travail dissimulé",
    texte:
      "En application de l'article D.8222-5 du Code du travail, le client s'engage à fournir :\n\n" +
      "— Une attestation de fourniture de déclarations sociales émanant de l'URSSAF datant de moins de 6 mois ;\n" +
      "— Un extrait de l'inscription au registre du commerce et des sociétés (K ou Kbis) ou au répertoire des métiers (D1), " +
      "ou un récépissé de dépôt de déclaration auprès d'un centre de formalités des entreprises ;\n" +
      "— Une attestation sur l'honneur de la réalisation du travail par des salariés employés régulièrement.\n\n" +
      "Le client certifie sur l'honneur que le travail sera réalisé par des salariés employés régulièrement " +
      "au regard des articles L.1221-10, L.3243-2 et R.3243-1 du Code du travail.",
  },
  mandatSepa: {
    titre: "Mandat de prélèvement SEPA",
    texteAutorisation:
      "En signant ce mandat, vous autorisez le cabinet à envoyer des instructions à votre banque " +
      "pour débiter votre compte conformément aux instructions du cabinet. Vous bénéficiez du droit " +
      "d'être remboursé par votre banque selon les conditions décrites dans la convention que vous avez " +
      "passée avec elle. Toute demande de remboursement doit être présentée dans les 8 semaines suivant " +
      "la date de débit de votre compte pour un prélèvement autorisé.",
    champCreancier: [
      { label: "Nom du cabinet", variable: "cabinet_nom" },
      { label: "Adresse", variable: "cabinet_adresse" },
      { label: "ICS (Identifiant Créancier SEPA)", variable: "cabinet_ics" },
    ],
    champDebiteur: [
      { label: "Nom du débiteur", variable: "client_nom" },
      { label: "Adresse", variable: "client_adresse" },
      { label: "IBAN", variable: "client_iban" },
      { label: "BIC", variable: "client_bic" },
    ],
    typePrelevement: "Récurrent",
    rum: "{{numero_lettre}}-SEPA",
  },
  autorisationLiasse: {
    titre: "Autorisation de transmission de la liasse fiscale",
    texte:
      "Le client autorise expressément le cabinet à transmettre par voie électronique (procédure EDI) " +
      "la liasse fiscale et les déclarations de résultats aux services fiscaux compétents.\n\n" +
      "Cette autorisation est donnée pour la durée de la mission et sera renouvelée tacitement " +
      "chaque année sauf dénonciation écrite par le client au moins 3 mois avant la date de clôture de l'exercice.",
  },
  // ── CORRECTIONS CNOEC #1-5 : Contenu normatif de la section "mission" ──
  // NOTE : Les textes normatifs complets par type de mission sont dans lettreMissionTypes.ts.
  // Ce bloc sert de tronc commun / fallback pour la mission de présentation (NP 2300).
  mission: {
    titre: "Nature et étendue de la mission",
    referenceNormative:
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission de présentation des comptes (NP 2300). Nos travaux seront réalisés conformément au référentiel normatif du Conseil Supérieur de l'Ordre des Experts-Comptables.",
    responsableMission:
      "Le responsable de la mission est {{responsable_mission}}, expert-comptable inscrit au tableau de l'Ordre, qui apportera personnellement son concours à la mission et en garantira la bonne réalisation au nom de notre structure d'exercice.",
    referentielComptable:
      "Les comptes annuels seront présentés conformément au référentiel comptable applicable, à savoir le Plan Comptable Général (PCG) tel que défini par le règlement ANC n°2014-03 modifié, et aux dispositions du Code de commerce relatives à la comptabilité des commerçants.",
    formeRapport:
      "À l'issue de notre mission, nous émettrons une attestation de présentation des comptes, document dans lequel nous exprimerons notre opinion sur la cohérence et la vraisemblance des comptes annuels de votre entité.",
    responsabiliteClient:
      "Vous restez responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes, ainsi que des procédures de contrôle interne concourant à l'élaboration de ces comptes. Cela implique notamment le respect des règles applicables à la tenue d'une comptabilité en France et du référentiel comptable applicable à votre secteur d'activité.",
  },
  // ── CORRECTION CNOEC #6 : Clause résolutoire (art. 1225 Code civil, CNOEC Titre III §7) ──
  clauseResolutoire: {
    id: "clause_resolutoire",
    titre: "Clause résolutoire",
    contenu:
      "Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations suivantes : (i) transmission des documents comptables dans les délais convenus, (ii) paiement des honoraires à leur échéance, (iii) fourniture des informations d'identification requises au titre de la LCB-FT, la présente lettre de mission pourra être résolue de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.",
    obligatoire: false,
    type: "conditional" as const,
    condition: "clause_resolutoire",
  },
  // ── CORRECTION CNOEC #7 : Mandat fiscal et social (CNOEC Titre II §2.1 note) ──
  mandatFiscal: {
    id: "mandat_fiscal",
    titre: "Mandat pour agir auprès des administrations",
    contenu:
      "Le client mandate expressément le cabinet pour accomplir en son nom et pour son compte les formalités et démarches suivantes auprès de l'administration fiscale et des organismes de sécurité sociale :\n\n" +
      "— Télétransmission des déclarations fiscales périodiques et annuelles (TVA, IS/IR, CVAE, CFE, liasses fiscales) ;\n" +
      "— Télétransmission des déclarations sociales (DSN et déclarations connexes) ;\n" +
      "— Relations courantes avec les services des impôts des entreprises (SIE) et les organismes sociaux.\n\n" +
      "Ce mandat est donné pour la durée de la mission. Il peut être révoqué à tout moment par lettre recommandée avec accusé de réception. Le cabinet conserve les mandats signés conformément à l'article 151 du Code de déontologie.",
    obligatoire: false,
    type: "conditional" as const,
    condition: "mandat_fiscal",
  },
  // ── CORRECTIONS CNOEC #8-9 : Honoraires — exclusion succès + indexation licite ──
  honoraires: {
    titre: "Honoraires",
    exclusionSucces:
      "Conformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive (tenue de comptabilité, révision comptable, présentation des comptes) ou participant à l'établissement de l'assiette fiscale ou sociale du client ne peuvent donner lieu à des honoraires complémentaires de succès.",
    indexation:
      "Les honoraires prévus au présent contrat seront révisables annuellement à la date anniversaire de la lettre de mission, selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE (référence : Indice des prix de production des services aux entreprises — Services comptables). La formule de révision est : Honoraires révisés = Honoraires d'origine × (dernier indice publié / indice de référence à la date de signature). À défaut de publication de cet indice, les honoraires seront révisés avec un minimum forfaitaire de 3 % par an.",
  },
  // ── CGV — Conditions Générales d'Intervention (corrections CNOEC #10-15) ──
  // NOTE : Les CGV complètes par type de mission sont dans lettreMissionModeles.ts
  //        (GRIMY_DEFAULT_CGV + getDefaultCgvForMissionType).
  //        Ce bloc sert de référence structurée pour l'affichage par section.
  conditionsGenerales: {
    titre: "Conditions générales d'intervention",
    sections: [
      {
        numero: 1,
        titre: "Objet",
        texte:
          "Les présentes conditions générales régissent les relations entre le cabinet et le client " +
          "dans le cadre de la mission d'expertise comptable définie dans la lettre de mission, " +
          "conformément au référentiel normatif applicable.",
      },
      {
        numero: 2,
        titre: "Obligations du cabinet",
        texte:
          "Le cabinet s'engage à exécuter la mission qui lui est confiée conformément aux normes professionnelles " +
          "en vigueur et avec la diligence requise. Il est tenu à une obligation de moyens.",
      },
      {
        numero: 3,
        titre: "Obligations du client",
        texte:
          "Le client s'engage à mettre à la disposition du cabinet, dans les délais convenus, l'ensemble des " +
          "documents et informations nécessaires à l'exécution de la mission. Il certifie l'exactitude des " +
          "informations transmises.",
      },
      {
        // CORRECTION #10 : Pénalités conformes (BCE+10pts + 40€ art. D 441-5)
        numero: 4,
        titre: "Honoraires et modalités de paiement",
        texte:
          "Les honoraires sont déterminés conformément aux dispositions de la lettre de mission. " +
          "Ils sont payables selon les modalités prévues. Tout retard de paiement entraînera de plein droit " +
          "l'application de pénalités de retard au taux égal à celui de la Banque Centrale Européenne majoré " +
          "de dix (10) points de pourcentage (art. L 441-10 du Code de commerce), ainsi qu'une indemnité " +
          "forfaitaire pour frais de recouvrement de quarante (40) euros (art. D 441-5 du Code de commerce).",
      },
      {
        // CORRECTION #11 : Assurance RC Pro avec variables
        numero: 5,
        titre: "Responsabilité et assurance",
        texte:
          "La responsabilité du cabinet ne peut être engagée qu'en cas de faute prouvée dans l'exécution de ses obligations. " +
          "Elle est limitée au montant des honoraires perçus au titre de l'exercice concerné. " +
          "Le cabinet est couvert par une assurance responsabilité civile professionnelle souscrite " +
          "auprès de {{assureur_nom}}, dont le siège est situé {{assureur_adresse}}.",
      },
      {
        numero: 6,
        titre: "Secret professionnel et confidentialité",
        texte:
          "Le cabinet est tenu au secret professionnel dans les conditions prévues par les textes en vigueur. " +
          "Toutes les informations recueillies à l'occasion de la mission sont strictement confidentielles.",
      },
      {
        // CORRECTION #12 : LCB-FT avec articles L 561-12 + L 561-10-2 CMF
        numero: 7,
        titre: "Lutte contre le blanchiment (LCB-FT)",
        texte:
          "Conformément aux articles L 561-1 et suivants du Code monétaire et financier, le cabinet est soumis " +
          "aux obligations de vigilance en matière de lutte contre le blanchiment de capitaux et le financement " +
          "du terrorisme. Le client s'engage à fournir les informations nécessaires à l'identification et à la " +
          "vérification de son identité, ainsi qu'à celle du bénéficiaire effectif.\n\n" +
          "Conformément à l'article L 561-12 du CMF, le cabinet conserve les documents relatifs à l'identité " +
          "de ses clients pendant cinq (5) ans après la fin de la relation d'affaires. Les documents relatifs " +
          "aux opérations sont conservés cinq (5) ans à compter de leur exécution (art. L 561-10-2 du CMF).",
      },
      {
        // CORRECTION #13 : RGPD — responsable de traitement
        numero: 8,
        titre: "Protection des données personnelles (RGPD)",
        texte:
          "Dans le cadre de l'exécution de la mission, le cabinet agit en qualité de responsable de traitement " +
          "au sens du Règlement (UE) 2016/679 (RGPD) pour les données à caractère personnel qu'il collecte " +
          "et traite pour les besoins de la mission. Les données sont traitées pour la seule finalité de " +
          "l'exécution de la mission contractuellement définie. Le client dispose d'un droit d'accès, " +
          "de rectification, d'effacement, de limitation et de portabilité de ses données, qu'il peut exercer " +
          "par courrier adressé au cabinet.",
      },
      {
        numero: 9,
        titre: "Durée et résiliation",
        texte:
          "La mission prend effet à la date de signature de la lettre de mission pour la durée indiquée. " +
          "Elle est renouvelable par tacite reconduction. Chaque partie peut y mettre fin par lettre recommandée " +
          "avec accusé de réception moyennant un préavis de trois (3) mois avant la date anniversaire.",
      },
      {
        // CORRECTION #14 : Droit applicable avec {{ville_tribunal}}
        numero: 10,
        titre: "Droit applicable et litiges",
        texte:
          "Les présentes conditions sont soumises au droit français. En cas de litige, les parties s'engagent " +
          "à rechercher une solution amiable, notamment par la voie de la conciliation organisée par le Conseil " +
          "régional de l'Ordre des Experts-Comptables (CROEC). À défaut de résolution amiable dans un délai de " +
          "deux (2) mois, le litige sera porté devant le Tribunal compétent de {{ville_tribunal}}.",
      },
      {
        // CORRECTION #15 : Non-sollicitation du personnel
        numero: 11,
        titre: "Non-sollicitation",
        texte:
          "Pendant la durée de la mission et pendant une durée de douze (12) mois suivant sa cessation, " +
          "le client s'interdit de solliciter ou d'embaucher, directement ou indirectement, tout collaborateur " +
          "du cabinet ayant participé à l'exécution de la mission, sauf accord écrit préalable du cabinet.",
      },
    ],
  },
};
