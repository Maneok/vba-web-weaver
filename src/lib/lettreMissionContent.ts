// Contenu textuel complet de la Lettre de Mission — Présentation des comptes annuels
// Chaque mot est juridiquement significatif — NE PAS MODIFIER sans validation juridique

export type Genre = "M" | "Mme";

export function getFormulePolitesse(genre: Genre): string {
  return genre === "M" ? "Monsieur" : "Madame";
}

export function getCherGenre(genre: Genre): string {
  return genre === "M" ? "Cher Monsieur" : "Chère Madame";
}

export interface ControleFiscalOption {
  id: "A" | "B" | "RENONCE";
  label: string;
  montant: number | null;
  texte: string;
}

export const CONTROLE_FISCAL_OPTIONS: ControleFiscalOption[] = [
  {
    id: "A",
    label: "Option A — Assistance complète",
    montant: 5000,
    texte: `En cas de vérification de comptabilité ou d'examen de comptabilité, le cabinet assistera le client dans la préparation et le suivi du contrôle fiscal. Cette assistance comprend :
- La préparation des documents comptables et pièces justificatives demandés par l'administration fiscale ;
- L'assistance lors des entretiens avec le vérificateur ;
- L'analyse des redressements proposés et la rédaction des observations du contribuable ;
- L'assistance dans le cadre des recours hiérarchiques et des commissions départementales ou nationales ;
- Le suivi de la procédure jusqu'à la mise en recouvrement.

Honoraires forfaitaires : 5 000 € HT.`,
  },
  {
    id: "B",
    label: "Option B — Assistance limitée",
    montant: 2500,
    texte: `En cas de vérification de comptabilité ou d'examen de comptabilité, le cabinet assistera le client dans la seule phase de préparation du contrôle. Cette assistance comprend :
- La préparation des documents comptables et pièces justificatives demandés par l'administration fiscale ;
- La mise en forme du fichier des écritures comptables (FEC) ;
- Un entretien préparatoire avec le client avant le début des opérations de contrôle.

Les phases ultérieures du contrôle (assistance aux entretiens, analyse des redressements, recours) ne sont pas incluses et feront, le cas échéant, l'objet d'une convention complémentaire.

Honoraires forfaitaires : 2 500 € HT.`,
  },
  {
    id: "RENONCE",
    label: "Renonciation",
    montant: null,
    texte: `Le client déclare renoncer à l'assistance du cabinet en cas de vérification de comptabilité ou d'examen de comptabilité. Le client reconnaît avoir été informé des conséquences de cette renonciation et s'engage à ne formuler aucune réclamation à l'encontre du cabinet au titre de l'absence d'assistance lors d'un contrôle fiscal.`,
  },
];

export const LETTRE_MISSION_TEMPLATE = {
  introduction: {
    titre: "LETTRE DE MISSION\nPRÉSENTATION DES COMPTES ANNUELS",
    salutation: `{{formule_politesse}} {{dirigeant}},

Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.

La présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.`,
  },

  entite: {
    titre: "VOTRE ENTITÉ",
    champs: [
      { cle: "raison_sociale", label: "Raison sociale" },
      { cle: "forme_juridique", label: "Forme juridique" },
      { cle: "capital", label: "Capital social" },
      { cle: "adresse", label: "Adresse du siège social" },
      { cle: "siren", label: "N° SIREN" },
      { cle: "ape", label: "Code APE / NAF" },
      { cle: "dirigeant", label: "Dirigeant / Représentant légal" },
      { cle: "date_creation", label: "Date de création" },
      { cle: "date_cloture", label: "Date de clôture de l'exercice" },
    ],
  },

  lcbft: {
    titre: "OBLIGATIONS DE VIGILANCE – LUTTE CONTRE LE BLANCHIMENT",
    soustitre:
      "CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Paquet AML 2024-2026",
    engagements: `Le client reconnaît avoir été informé des obligations de vigilance qui s'appliquent au cabinet en sa qualité de professionnel assujetti. Il s'engage à répondre sans délai à toute demande de justificatif émanant du cabinet dans ce cadre. Le non-respect de cet engagement constitue une cause légitime de suspension ou de résiliation de la mission, sans indemnité (art. L.561-8 CMF).`,
    conservation: `Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires, indépendamment des délais comptables.`,
  },

  mission: {
    titre: "NOTRE MISSION",
    texte: `Nous vous proposons d'effectuer la mission suivante, selon les normes professionnelles applicables à la profession d'expert-comptable et dans le respect des textes légaux et réglementaires :

Mission de présentation des comptes annuels

Conformément à la norme professionnelle de maîtrise de la qualité (NPMQ) et à la norme professionnelle applicable à la mission de présentation des comptes (NP 2300), nous effectuerons une mission de présentation des comptes annuels de votre entreprise.

Cette mission a pour objectif de permettre à l'expert-comptable, sur la base des informations fournies par le client complétées par les travaux propres du professionnel, d'exprimer une opinion, sous forme d'attestation, indiquant qu'il n'a pas relevé d'éléments remettant en cause la cohérence et la vraisemblance des comptes annuels pris dans leur ensemble, au regard des règles et normes comptables en vigueur.

Cette mission ne constitue ni un audit ni un examen limité des comptes et ne saurait donc avoir pour effet de garantir la fiabilité des comptes. Notre responsabilité ne saurait être engagée pour des anomalies qui n'auraient pu être détectées dans le cadre de notre mission de présentation.`,
  },

  duree: {
    titre: "DURÉE DE LA MISSION",
    texte: `La présente mission prend effet à compter du {{date_effet}} pour une durée d'un (1) an, correspondant à l'exercice comptable du {{debut_exercice}} au {{fin_exercice}}.

Elle est renouvelable par tacite reconduction pour des périodes successives d'un (1) an, sauf dénonciation par l'une ou l'autre des parties par lettre recommandée avec accusé de réception adressée au moins trois (3) mois avant la date d'échéance.

En cas de résiliation anticipée par le client, celui-ci sera redevable des honoraires correspondant aux travaux déjà réalisés, ainsi que d'une indemnité de résiliation égale à 25 % du montant annuel des honoraires prévus, sauf faute du cabinet.`,
  },

  nature: {
    titre: "NATURE ET LIMITES DE LA MISSION",
    texte: `La mission de présentation des comptes annuels est régie par la norme professionnelle NP 2300 de l'Ordre des Experts-Comptables.

Elle consiste à :
- Prendre connaissance de l'entité, de son environnement et de son organisation comptable ;
- Analyser la cohérence et la vraisemblance des comptes annuels, sans procéder à une vérification exhaustive des opérations ;
- Obtenir de la direction les déclarations qu'il estime nécessaires ;
- Attester qu'il n'a pas relevé d'éléments remettant en cause la cohérence et la vraisemblance des comptes annuels.

La mission de présentation ne comprend pas :
- La recherche systématique de fraudes ou d'erreurs ;
- La vérification exhaustive des pièces justificatives ;
- L'évaluation du contrôle interne de l'entité ;
- La mise en œuvre de procédures d'audit ou d'examen limité.

Le client reste seul responsable de l'établissement des comptes annuels et de la mise en place d'un système de contrôle interne approprié. Il est responsable de la sincérité et de l'exhaustivité des informations communiquées au cabinet.`,
  },

  missionSociale: {
    titre: "MISSION SOCIALE",
    texte: `Dans le cadre de la mission sociale, le cabinet s'engage à assurer, pour le compte du client, les prestations suivantes :

1. ÉTABLISSEMENT DES BULLETINS DE PAIE
Le cabinet établit mensuellement les bulletins de paie des salariés du client, sur la base des éléments variables communiqués par le client avant le 20 de chaque mois (heures travaillées, absences, primes, avantages en nature, etc.).

Le cabinet ne saurait être tenu responsable des erreurs résultant d'informations incomplètes, inexactes ou tardives communiquées par le client.

2. DÉCLARATIONS SOCIALES
Le cabinet établit et transmet les déclarations sociales obligatoires :
- Déclaration Sociale Nominative (DSN) mensuelle ;
- Déclaration annuelle des données sociales ;
- Attestations de salaire (maladie, maternité, accident du travail) ;
- Attestations Pôle Emploi en cas de fin de contrat.

3. GESTION DES ENTRÉES ET SORTIES
- Déclaration Préalable à l'Embauche (DPAE) ;
- Rédaction des contrats de travail simples (CDI, CDD) conformes aux dispositions légales et conventionnelles applicables ;
- Établissement des documents de fin de contrat (certificat de travail, attestation Pôle Emploi, reçu pour solde de tout compte) ;
- Calcul des indemnités de rupture.

4. VEILLE SOCIALE
Le cabinet informe le client des principales évolutions législatives et réglementaires en matière de droit du travail et de protection sociale susceptibles d'avoir un impact sur la gestion de son personnel.

5. OBLIGATIONS DU CLIENT
Le client s'engage à :
- Communiquer les éléments variables de paie avant le 20 de chaque mois ;
- Informer le cabinet de toute embauche, modification de contrat ou départ de salarié dans les 48 heures ;
- Fournir les informations nécessaires à l'application de la convention collective applicable ;
- Assurer le respect des obligations d'affichage et d'information des salariés qui lui incombent directement ;
- Communiquer au cabinet toute notification de l'URSSAF, de l'inspection du travail ou de tout autre organisme social.

Les contrats de travail complexes (clauses de non-concurrence, forfait jours, aménagement du temps de travail, expatriation) font l'objet d'une tarification complémentaire.`,
  },

  missionJuridique: {
    titre: "MISSION JURIDIQUE ANNUELLE",
    texte: `Dans le cadre de la mission juridique annuelle, le cabinet assure, pour le compte du client, les prestations suivantes :

1. APPROBATION DES COMPTES
- Rédaction du rapport de gestion (pour les entités soumises à cette obligation) ;
- Rédaction des résolutions de l'assemblée générale ordinaire annuelle (AGO) d'approbation des comptes ;
- Établissement du procès-verbal d'assemblée générale ;
- Accomplissement des formalités de dépôt des comptes annuels auprès du greffe du tribunal de commerce.

2. SECRÉTARIAT JURIDIQUE COURANT
- Tenue du registre des assemblées générales ;
- Mise à jour des registres obligatoires ;
- Rédaction des actes courants de la vie sociale (changement de gérant, modification de l'objet social, transfert de siège dans le même ressort).

3. LIMITES DE LA MISSION
La mission juridique annuelle ne comprend pas :
- Les opérations de restructuration (fusion, scission, apport partiel d'actif) ;
- Les augmentations ou réductions de capital ;
- Les transformations de forme juridique ;
- Les cessions de parts sociales ou d'actions ;
- Le contentieux juridique.

Ces opérations exceptionnelles feront, le cas échéant, l'objet d'une convention d'honoraires complémentaire.

Honoraires forfaitaires annuels : {{honoraires_juridique}} € HT.`,
  },

  missionControleFiscal: {
    titre: "ASSISTANCE EN CAS DE CONTRÔLE FISCAL",
    texte: `Le cabinet informe le client de la possibilité de souscrire à une mission d'assistance en cas de vérification de comptabilité ou d'examen de comptabilité, dans les conditions ci-après.

Le client est invité à choisir l'une des options suivantes :`,
    options: CONTROLE_FISCAL_OPTIONS,
  },

  honoraires: {
    titre: "HONORAIRES",
    introduction: `Les honoraires sont fixés d'un commun accord entre les parties, conformément aux usages de la profession et à l'article 24 de l'ordonnance du 19 septembre 1945.

Ils sont déterminés en fonction de l'importance et de la difficulté des travaux à exécuter, des frais exposés ainsi que de la notoriété du professionnel.`,
    comptable: {
      titre: "Mission comptable",
      lignes: [
        {
          label: "Forfait annuel de tenue / surveillance",
          variable: "honoraires",
          suffixe: "€ HT",
        },
        {
          label: "Constitution du dossier permanent",
          variable: "setup",
          suffixe: "€ HT",
        },
        {
          label: "Honoraires expert-comptable (hors forfait)",
          fixe: 200,
          suffixe: "€ HT / heure",
        },
        {
          label: "Honoraires collaborateur (hors forfait)",
          fixe: 100,
          suffixe: "€ HT / heure",
        },
      ],
    },
    sociale: {
      titre: "Mission sociale",
      lignes: [
        { label: "Bulletin de paie", fixe: 32, suffixe: "€ HT / bulletin" },
        {
          label: "Fin de contrat (STC + attestations)",
          fixe: 30,
          suffixe: "€ HT",
        },
        {
          label: "Contrat de travail simple (CDI / CDD)",
          fixe: 100,
          suffixe: "€ HT",
        },
        { label: "Entrée salarié (DPAE + dossier)", fixe: 30, suffixe: "€ HT" },
        {
          label: "Attestation maladie / AT",
          fixe: 30,
          suffixe: "€ HT",
        },
      ],
    },
    juridique: {
      titre: "Mission juridique annuelle",
      lignes: [
        {
          label: "Forfait annuel juridique",
          variable: "honoraires_juridique",
          suffixe: "€ HT",
        },
      ],
    },
    controleFiscal: {
      titre: "Assistance contrôle fiscal",
      lignes: [
        {
          label: "Selon option choisie",
          variable: "controle_fiscal_montant",
          suffixe: "€ HT",
        },
      ],
    },
    paiement: `Les honoraires sont payables selon l'échéancier suivant :

- Forfait comptable : {{frequence_paiement}} par prélèvement SEPA, soit {{montant_periodique}} € HT par échéance ;
- Constitution du dossier : à la signature de la présente lettre de mission ;
- Honoraires complémentaires (hors forfait) : sur présentation de note d'honoraires, payable à 30 jours ;
- Mission sociale : facturation mensuelle sur la base des bulletins établis ;
- Mission juridique : facturation annuelle à la date d'approbation des comptes.

Tout retard de paiement entraînera l'application de pénalités de retard au taux de trois fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement, conformément aux articles L.441-10 et D.441-5 du Code de commerce.`,
  },

  conclusion: {
    titre: "CONCLUSION",
    texte: `Nous vous prions de bien vouloir nous retourner un exemplaire de la présente lettre de mission, revêtu de votre signature précédée de la mention « lu et approuvé », accompagné des annexes paraphées, afin de marquer votre accord sur l'ensemble de ses termes et conditions.

Nous vous prions d'agréer, {{formule_politesse}} {{dirigeant}}, l'expression de nos salutations distinguées.`,
    signatureCabinet: {
      label: "Pour le cabinet",
      champs: ["Nom : {{associe}}", "Qualité : Associé signataire", "Date :", "Signature :"],
    },
    signatureClient: {
      label: "Pour le client — Lu et approuvé",
      champs: [
        "Nom : {{dirigeant}}",
        "Qualité : {{qualite_dirigeant}}",
        "Date :",
        "Signature :",
      ],
    },
  },

  repartitionTravaux: {
    titre: "ANNEXE — RÉPARTITION DES TRAVAUX",
    colonnes: ["Répartition des travaux", "Cabinet", "Client", "Périodicité"],
    lignes: [
      {
        id: "saisie",
        label: "Saisie des pièces comptables",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Mensuel",
      },
      {
        id: "classement",
        label: "Classement et tri des pièces justificatives",
        defautCabinet: false,
        defautClient: true,
        periodicite: "Mensuel",
      },
      {
        id: "rapprochement",
        label: "Rapprochement bancaire",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Mensuel",
      },
      {
        id: "tva_declarations",
        label: "Établissement des déclarations de TVA",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Mensuel",
      },
      {
        id: "tva_paiement",
        label: "Paiement de la TVA",
        defautCabinet: false,
        defautClient: true,
        periodicite: "Mensuel",
      },
      {
        id: "revision",
        label: "Révision des comptes",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "bilan",
        label: "Établissement du bilan et du compte de résultat",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "liasse",
        label: "Établissement de la liasse fiscale",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "is",
        label: "Déclaration d'impôt sur les sociétés / résultat",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "cfe",
        label: "Déclaration de CFE / CVAE",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "das2",
        label: "DAS-2 (déclaration des honoraires versés)",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "inventaire",
        label: "Inventaire physique des stocks",
        defautCabinet: false,
        defautClient: true,
        periodicite: "Annuel",
      },
      {
        id: "immobilisations",
        label: "Suivi du tableau des immobilisations",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "paie",
        label: "Établissement des bulletins de paie",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Mensuel",
      },
      {
        id: "dsn",
        label: "Déclaration Sociale Nominative (DSN)",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Mensuel",
      },
      {
        id: "contrats",
        label: "Rédaction des contrats de travail",
        defautCabinet: true,
        defautClient: false,
        periodicite: "NA",
      },
      {
        id: "dpae",
        label: "Déclaration Préalable à l'Embauche (DPAE)",
        defautCabinet: true,
        defautClient: false,
        periodicite: "NA",
      },
      {
        id: "fin_contrat",
        label: "Documents de fin de contrat",
        defautCabinet: true,
        defautClient: false,
        periodicite: "NA",
      },
      {
        id: "ago",
        label: "Assemblée générale d'approbation des comptes",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
      {
        id: "depot_comptes",
        label: "Dépôt des comptes annuels au greffe",
        defautCabinet: true,
        defautClient: false,
        periodicite: "Annuel",
      },
    ],
  },

  attestationTravailDissimule: {
    titre: "ATTESTATION RELATIVE AU TRAVAIL DISSIMULÉ",
    texte: `En application des articles L.8221-1 et suivants du Code du travail, le client atteste sur l'honneur :

1. Qu'il procède ou a procédé aux déclarations et formalités prévues par les articles L.8221-3 à L.8221-5 du Code du travail relatives à la lutte contre le travail dissimulé par dissimulation d'activité, à savoir :
   - Immatriculation au registre du commerce et des sociétés ou au répertoire des métiers ;
   - Déclarations fiscales et sociales obligatoires ;
   - Déclarations relatives aux salaires et aux cotisations sociales.

2. Qu'il a satisfait aux obligations de déclaration et de paiement des cotisations sociales auprès de l'URSSAF ou de la MSA dont il relève.

3. Qu'il n'emploie pas de salariés dans des conditions constitutives du travail dissimulé par dissimulation d'emploi salarié, tel que défini à l'article L.8221-5 du Code du travail, notamment :
   - Absence de déclaration préalable à l'embauche ;
   - Absence de délivrance de bulletins de paie ;
   - Mention sur les bulletins de paie d'un nombre d'heures de travail inférieur à celui réellement accompli.

Le client s'engage à fournir au cabinet, sur simple demande, les attestations et certificats justifiant du respect de ces obligations (attestation de vigilance URSSAF, certificat de régularité fiscale).

Le client reconnaît que toute fausse déclaration l'expose aux sanctions pénales prévues par les articles L.8224-1 et suivants du Code du travail.

Fait à {{ville}}, le {{date}}

{{dirigeant}}
{{qualite_dirigeant}}
Signature :`,
  },

  mandatSepa: {
    titre: "MANDAT DE PRÉLÈVEMENT SEPA",
    texteAutorisation: `En signant ce formulaire de mandat, vous autorisez le cabinet à envoyer des instructions à votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément aux instructions du cabinet.

Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la convention que vous avez passée avec elle. Toute demande de remboursement doit être présentée dans les 8 semaines suivant la date de débit de votre compte pour un prélèvement autorisé, et dans les 13 mois pour un prélèvement non autorisé.`,
    typePrelevement: "Récurrent",
    champCreancier: [
      { label: "Nom du créancier", variable: "cabinet_nom" },
      { label: "Identifiant créancier SEPA (ICS)", variable: "cabinet_ics" },
      { label: "Adresse du créancier", variable: "cabinet_adresse" },
    ],
    champDebiteur: [
      { label: "Nom / Raison sociale du débiteur", variable: "raison_sociale" },
      { label: "Adresse du débiteur", variable: "adresse_complete" },
      { label: "IBAN", variable: "iban" },
      { label: "BIC", variable: "bic" },
    ],
    rum: "RUM-{{ref_client}}-{{annee}}",
  },

  autorisationLiasse: {
    titre: "AUTORISATION DE TRANSMISSION DE LA LIASSE FISCALE PAR VOIE DÉMATÉRIALISÉE",
    texte: `Le soussigné, {{dirigeant}}, agissant en qualité de {{qualite_dirigeant}} de la société {{raison_sociale}}, autorise par la présente le cabinet {{cabinet_nom}}, représenté par {{associe}}, expert-comptable inscrit au Tableau de l'Ordre, à :

1. Transmettre par voie dématérialisée (procédure EDI-TDFC) la liasse fiscale et les déclarations fiscales professionnelles de la société auprès de la Direction Générale des Finances Publiques (DGFiP) ;

2. Transmettre par voie dématérialisée les attestations fiscales requises ;

3. Recevoir en retour les accusés de réception et les avis d'imposition correspondants.

Cette autorisation est donnée pour l'exercice clos le {{fin_exercice}} et les exercices suivants, pour la durée de la mission d'expertise comptable, sauf révocation expresse par lettre recommandée avec accusé de réception.

Le client reconnaît que le cabinet agit en qualité de mandataire pour cette transmission et ne saurait être tenu responsable des dysfonctionnements du système de télétransmission de l'administration fiscale.

Le client s'engage à vérifier les déclarations transmises et à signaler au cabinet toute erreur ou anomalie dans un délai de 15 jours à compter de la réception de l'accusé de réception.

Fait à {{ville}}, le {{date}}

{{dirigeant}}
{{qualite_dirigeant}}
Signature :`,
  },

  conditionsGenerales: {
    titre: "CONDITIONS GÉNÉRALES D'INTERVENTION",
    sections: [
      {
        numero: "1",
        titre: "Objet",
        texte: `Les présentes conditions générales d'intervention (ci-après « CGI ») ont pour objet de définir les modalités et conditions dans lesquelles le cabinet d'expertise comptable (ci-après « le cabinet ») réalise les missions qui lui sont confiées par le client.

Les CGI sont indissociables de la lettre de mission et de ses éventuels avenants. En cas de contradiction entre les CGI et la lettre de mission, les stipulations de la lettre de mission prévalent.`,
      },
      {
        numero: "2",
        titre: "Cadre contractuel et réglementaire",
        texte: `Le cabinet exerce ses missions dans le respect :
- De l'ordonnance n° 45-2138 du 19 septembre 1945 portant institution de l'Ordre des Experts-Comptables et réglementant le titre et la profession d'expert-comptable ;
- Du décret n° 2012-432 du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable, et notamment de son titre IV relatif à la déontologie (art. 141 à 170) ;
- Des normes professionnelles de l'Ordre des Experts-Comptables, notamment la Norme Professionnelle de Maîtrise de la Qualité (NPMQ) et la norme relative à la mission de présentation des comptes (NP 2300) ;
- Du Code monétaire et financier, et notamment de ses dispositions relatives à la lutte contre le blanchiment de capitaux et le financement du terrorisme (art. L.561-1 et suivants).`,
      },
      {
        numero: "3",
        titre: "Obligations du cabinet",
        texte: `Le cabinet s'engage à :
- Exécuter sa mission avec compétence, conscience professionnelle et indépendance, conformément aux normes professionnelles et aux règles déontologiques ;
- Mettre en œuvre les diligences nécessaires à la bonne exécution de la mission ;
- Informer le client de toute difficulté rencontrée dans l'exécution de la mission ;
- Respecter le secret professionnel, sous réserve des dérogations légales (notamment l'obligation de déclaration à Tracfin) ;
- Souscrire et maintenir une assurance responsabilité civile professionnelle couvrant les conséquences pécuniaires de sa responsabilité civile professionnelle.

Le cabinet est tenu d'une obligation de moyens et non de résultat. Il n'est pas tenu de vérifier l'exactitude et l'exhaustivité des informations qui lui sont communiquées par le client.`,
      },
      {
        numero: "4",
        titre: "Obligations du client",
        texte: `Le client s'engage à :
- Fournir au cabinet, dans les délais convenus, l'ensemble des documents et informations nécessaires à l'exécution de la mission ;
- Garantir la sincérité et l'exhaustivité des informations et documents communiqués ;
- Informer le cabinet de tout événement ou circonstance susceptible d'affecter l'exécution de la mission ;
- Mettre en place et maintenir un système de contrôle interne adapté à la taille et à l'activité de l'entreprise ;
- Régler les honoraires aux échéances convenues ;
- Coopérer avec le cabinet dans le cadre des obligations de vigilance LCB-FT.

Le client reste seul responsable de ses obligations légales, fiscales et sociales. L'intervention du cabinet ne saurait être assimilée à une quelconque prise en charge de ces obligations.`,
      },
      {
        numero: "5",
        titre: "Honoraires et conditions de paiement",
        texte: `Les honoraires sont fixés dans la lettre de mission. Ils sont révisables annuellement en fonction de l'évolution des charges du cabinet et de la complexité de la mission, sous réserve d'une notification préalable de trois (3) mois.

Les honoraires sont soumis à la TVA au taux en vigueur.

Toute prestation non prévue dans la lettre de mission fera l'objet d'un accord préalable du client et d'une facturation complémentaire sur la base des taux horaires en vigueur au sein du cabinet.

En cas de retard de paiement, des pénalités de retard sont exigibles de plein droit, sans qu'un rappel soit nécessaire, au taux de trois fois le taux d'intérêt légal en vigueur, conformément à l'article L.441-10 du Code de commerce. Une indemnité forfaitaire de 40 euros pour frais de recouvrement est également due de plein droit, conformément à l'article D.441-5 du Code de commerce.

Le cabinet se réserve le droit de suspendre l'exécution de la mission en cas de non-paiement des honoraires échus.`,
      },
      {
        numero: "6",
        titre: "Responsabilité",
        texte: `La responsabilité du cabinet ne peut être engagée que dans les limites de la mission qui lui a été confiée.

Le cabinet ne saurait être tenu responsable :
- Des conséquences des décisions de gestion prises par le client ;
- Des informations incomplètes, inexactes ou tardives fournies par le client ;
- Des anomalies ou irrégularités qui n'entrent pas dans le champ de la mission ;
- Des préjudices indirects, tels que perte de chiffre d'affaires, perte de chance, préjudice d'image.

La responsabilité du cabinet est limitée au montant des honoraires perçus au titre de l'exercice au cours duquel le dommage est survenu, sauf faute intentionnelle ou faute lourde.

Le client s'engage à informer le cabinet de toute réclamation dans un délai de trois (3) mois à compter de la découverte du fait générateur du dommage.`,
      },
      {
        numero: "7",
        titre: "Confidentialité et secret professionnel",
        texte: `Le cabinet est tenu au secret professionnel conformément aux dispositions de l'article 226-13 du Code pénal et aux règles déontologiques de la profession.

Cette obligation s'étend à l'ensemble du personnel du cabinet et aux éventuels sous-traitants.

Le cabinet s'engage à prendre toutes les mesures nécessaires pour assurer la protection et la confidentialité des données et documents qui lui sont confiés.

Cette obligation de confidentialité ne s'applique pas :
- Aux informations qui sont ou deviennent publiques sans le fait du cabinet ;
- Aux informations dont la communication est exigée par la loi ou par une autorité judiciaire ou administrative ;
- Aux obligations de déclaration auprès de Tracfin prévues par le Code monétaire et financier.`,
      },
      {
        numero: "8",
        titre: "Protection des données personnelles",
        texte: `Le cabinet traite les données personnelles du client et de ses salariés dans le cadre de l'exécution de sa mission, conformément au Règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 modifiée.

Le cabinet agit en qualité de sous-traitant au sens du RGPD pour les traitements effectués pour le compte du client. Le client conserve la qualité de responsable du traitement.

Les données personnelles sont traitées pour les finalités suivantes : exécution de la mission d'expertise comptable, établissement des bulletins de paie et déclarations sociales, obligations fiscales et légales, obligations de vigilance LCB-FT.

Le cabinet s'engage à :
- Ne traiter les données personnelles que sur instruction documentée du client ;
- Garantir la confidentialité des données traitées ;
- Mettre en œuvre les mesures techniques et organisationnelles appropriées pour assurer la sécurité des données ;
- Ne pas sous-traiter sans l'autorisation préalable écrite du client ;
- Assister le client dans le respect de ses obligations au titre du RGPD ;
- Supprimer ou restituer les données personnelles au terme de la mission, sous réserve des obligations légales de conservation.`,
      },
      {
        numero: "9",
        titre: "Lutte contre le blanchiment et le financement du terrorisme",
        texte: `Conformément aux dispositions du Code monétaire et financier (art. L.561-1 et suivants) et à la Norme Professionnelle de Lutte Anti-Blanchiment (NPLAB — arrêté du 13 février 2019), le cabinet est assujetti aux obligations de vigilance en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme.

À ce titre, le cabinet met en œuvre :
- L'identification et la vérification de l'identité du client et de ses bénéficiaires effectifs ;
- La connaissance de la relation d'affaires ;
- Une vigilance constante tout au long de la relation ;
- Le cas échéant, des mesures de vigilance complémentaires ou renforcées.

Le client s'engage à coopérer pleinement avec le cabinet dans le cadre de ces obligations et à fournir, dans les délais impartis, tout document ou information demandé à ce titre.

Le défaut de coopération ou l'impossibilité de mettre en œuvre les mesures de vigilance requises pourra conduire le cabinet à suspendre ou résilier la mission, conformément à l'article L.561-8 du Code monétaire et financier.`,
      },
      {
        numero: "10",
        titre: "Propriété intellectuelle",
        texte: `Les méthodes, outils, logiciels et documents développés par le cabinet dans le cadre de l'exécution de la mission restent la propriété intellectuelle du cabinet.

Le client dispose d'un droit d'usage des livrables produits dans le cadre de la mission pour ses besoins propres. Toute reproduction, communication ou utilisation au-delà de ce droit d'usage est interdite sans l'accord préalable écrit du cabinet.`,
      },
      {
        numero: "11",
        titre: "Sous-traitance",
        texte: `Le cabinet se réserve le droit de confier tout ou partie de la mission à des collaborateurs ou sous-traitants de son choix, sous sa responsabilité, dans le respect des obligations de confidentialité et de secret professionnel.

Le client en sera informé préalablement. Le cabinet demeure seul interlocuteur du client et assume l'entière responsabilité des travaux sous-traités.`,
      },
      {
        numero: "12",
        titre: "Force majeure",
        texte: `Aucune des parties ne pourra être tenue responsable de l'inexécution ou du retard dans l'exécution de ses obligations contractuelles lorsque cette inexécution ou ce retard résulte d'un cas de force majeure au sens de l'article 1218 du Code civil.

La partie invoquant la force majeure devra en informer l'autre partie dans les plus brefs délais et prendre toutes les mesures raisonnables pour en limiter les effets.

Si le cas de force majeure se prolonge au-delà de trois (3) mois, chacune des parties pourra résilier le contrat de plein droit, sans indemnité, par lettre recommandée avec accusé de réception.`,
      },
      {
        numero: "13",
        titre: "Résiliation",
        texte: `Outre les cas de résiliation prévus dans la lettre de mission, chacune des parties peut résilier le contrat en cas de manquement grave de l'autre partie à ses obligations contractuelles, après mise en demeure restée infructueuse pendant un délai de trente (30) jours.

Le cabinet peut également résilier la mission :
- En cas de perte de confiance rendant impossible la poursuite de la mission ;
- En cas d'impossibilité de mettre en œuvre les obligations de vigilance LCB-FT ;
- En cas de non-paiement des honoraires ;
- En cas de fourniture d'informations volontairement inexactes par le client.

En cas de résiliation, le cabinet restitue au client les documents qui lui ont été remis, après apurement de tout solde dû. Les travaux réalisés jusqu'à la date de résiliation sont facturés au prorata.`,
      },
      {
        numero: "14",
        titre: "Médiation et règlement des litiges",
        texte: `En cas de différend relatif à l'exécution ou à l'interprétation du présent contrat, les parties s'engagent à rechercher une solution amiable.

À défaut d'accord amiable dans un délai de trente (30) jours, le différend pourra être soumis à la médiation du Conseil Régional de l'Ordre des Experts-Comptables dont relève le cabinet.

À défaut de résolution par la médiation dans un délai de soixante (60) jours, le litige sera porté devant le tribunal compétent du ressort du siège social du cabinet.`,
      },
      {
        numero: "15",
        titre: "Dispositions diverses",
        texte: `Nullité partielle — Si l'une des clauses des présentes conditions générales venait à être déclarée nulle ou inapplicable, les autres clauses resteront en vigueur et conserveront leur plein effet.

Non-renonciation — Le fait pour l'une des parties de ne pas se prévaloir d'un manquement de l'autre partie à l'une de ses obligations ne saurait être interprété comme une renonciation à l'obligation en cause.

Intégralité — La lettre de mission, ses annexes et les présentes conditions générales constituent l'intégralité de l'accord entre les parties et remplacent tout accord, proposition ou communication antérieurs, écrits ou oraux.

Loi applicable — Le présent contrat est régi par le droit français.`,
      },
    ],
  },
} as const;
