// Annexes de la Lettre de Mission — Textes juridiques complets
// NE PAS MODIFIER sans validation juridique — chaque mot compte

// ---------------------------------------------------------------------------
// 1. RÉPARTITION DES TRAVAUX
// ---------------------------------------------------------------------------

export interface LigneRepartition {
  id: string;
  label: string;
  defautCabinet: boolean;
  defautClient: boolean;
  periodicite: "Mensuel" | "Trimestriel" | "Semestriel" | "Annuel" | "NA";
  categorie: "comptable" | "fiscal" | "social" | "juridique" | "general";
}

export const REPARTITION_TRAVAUX: {
  titre: string;
  colonnes: string[];
  lignes: LigneRepartition[];
} = {
  titre: "ANNEXE — RÉPARTITION DES TRAVAUX ENTRE LE CABINET ET LE CLIENT",
  colonnes: ["Répartition des travaux", "Cabinet", "Client", "Périodicité"],
  lignes: [
    // --- Comptabilité ---
    { id: "tenue_comptes", label: "Tenue des comptes (saisie des pièces comptables)", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "comptable" },
    { id: "editions_journaux", label: "Éditions des journaux comptables", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "comptable" },
    { id: "justification_soldes", label: "Justification des soldes des comptes de tiers", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "comptable" },
    { id: "rapprochement_bancaire", label: "Rapprochement bancaire", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "comptable" },
    { id: "classement_pieces", label: "Classement et tri des pièces justificatives", defautCabinet: false, defautClient: true, periodicite: "Mensuel", categorie: "comptable" },
    { id: "inventaire_stocks", label: "Inventaire physique des stocks et en-cours", defautCabinet: false, defautClient: true, periodicite: "Annuel", categorie: "comptable" },
    { id: "immobilisations", label: "Suivi du tableau des immobilisations et amortissements", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "comptable" },
    { id: "comptes_annuels", label: "Établissement des comptes annuels (bilan, compte de résultat, annexe)", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "comptable" },
    { id: "situations_intermediaires", label: "Établissement de situations intermédiaires", defautCabinet: true, defautClient: false, periodicite: "Semestriel", categorie: "comptable" },
    { id: "previsionnels", label: "Établissement de prévisionnels / budgets", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "comptable" },

    // --- Fiscal ---
    { id: "tva_declarations", label: "Établissement et télétransmission des déclarations de TVA", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "fiscal" },
    { id: "tva_paiement", label: "Paiement de la TVA", defautCabinet: false, defautClient: true, periodicite: "Mensuel", categorie: "fiscal" },
    { id: "liasse_fiscale", label: "Établissement et télétransmission de la liasse fiscale", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "fiscal" },
    { id: "is_ir", label: "Déclaration d'impôt sur les sociétés / sur le revenu (BIC/BNC)", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "fiscal" },
    { id: "cfe_cvae", label: "Déclaration de CFE / CVAE", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "fiscal" },
    { id: "das2", label: "DAS-2 (déclaration des honoraires, commissions, etc.)", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "fiscal" },
    { id: "attestation_fiscale", label: "Attestation de régularité fiscale", defautCabinet: false, defautClient: true, periodicite: "Annuel", categorie: "fiscal" },
    { id: "conformite_factures", label: "Conformité des factures (mentions obligatoires)", defautCabinet: false, defautClient: true, periodicite: "NA", categorie: "fiscal" },
    { id: "caisse_enregistreuse", label: "Caisse enregistreuse certifiée (attestation NF525)", defautCabinet: false, defautClient: true, periodicite: "NA", categorie: "fiscal" },

    // --- Social ---
    { id: "bulletins_paie", label: "Établissement des bulletins de paie", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "social" },
    { id: "dsn", label: "Déclaration Sociale Nominative (DSN)", defautCabinet: true, defautClient: false, periodicite: "Mensuel", categorie: "social" },
    { id: "contrats_travail", label: "Rédaction des contrats de travail simples", defautCabinet: true, defautClient: false, periodicite: "NA", categorie: "social" },
    { id: "dpae", label: "Déclaration Préalable à l'Embauche (DPAE)", defautCabinet: true, defautClient: false, periodicite: "NA", categorie: "social" },
    { id: "fin_contrat", label: "Documents de fin de contrat (STC, attestation France Travail, certificat)", defautCabinet: true, defautClient: false, periodicite: "NA", categorie: "social" },
    { id: "vigilance_sociale", label: "Vigilance sociale (suivi des obligations employeur)", defautCabinet: false, defautClient: true, periodicite: "NA", categorie: "social" },

    // --- Juridique ---
    { id: "ago", label: "Assemblée générale ordinaire d'approbation des comptes", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "juridique" },
    { id: "depot_comptes", label: "Dépôt des comptes annuels au greffe du Tribunal de Commerce", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "juridique" },
    { id: "registres_legaux", label: "Tenue des registres légaux obligatoires", defautCabinet: true, defautClient: false, periodicite: "Annuel", categorie: "juridique" },
    { id: "formalites_juridiques", label: "Formalités juridiques courantes (modification statutaire, transfert siège)", defautCabinet: true, defautClient: false, periodicite: "NA", categorie: "juridique" },

    // --- Général ---
    { id: "conservation_archives", label: "Conservation et archivage des pièces comptables", defautCabinet: false, defautClient: true, periodicite: "NA", categorie: "general" },
    { id: "legislation_activite", label: "Respect de la législation applicable à l'activité", defautCabinet: false, defautClient: true, periodicite: "NA", categorie: "general" },
    { id: "assurance_rc", label: "Assurance responsabilité civile professionnelle", defautCabinet: false, defautClient: true, periodicite: "Annuel", categorie: "general" },
    { id: "attestation_vigilance", label: "Attestation de vigilance URSSAF", defautCabinet: false, defautClient: true, periodicite: "Semestriel", categorie: "general" },
  ],
};

// ---------------------------------------------------------------------------
// 2. ATTESTATION RELATIVE AU TRAVAIL DISSIMULÉ
// ---------------------------------------------------------------------------

export const ATTESTATION_TRAVAIL_DISSIMULE = {
  titre: "ATTESTATION RELATIVE AU TRAVAIL DISSIMULÉ",
  texte: `En application des articles L.8222-1, L.8222-2 et D.8222-5 du Code du travail, le client est tenu, lors de la conclusion du contrat puis tous les six (6) mois jusqu'à la fin de son exécution, de remettre au cabinet les attestations et pièces suivantes :

1. Une attestation de fourniture des déclarations sociales et de paiement des cotisations et contributions de sécurité sociale prévue à l'article L.243-15 du Code de la sécurité sociale, émanant de l'organisme de protection sociale chargé du recouvrement des cotisations et des contributions datant de moins de six mois (attestation de vigilance URSSAF) ;

2. Une attestation sur l'honneur du cocontractant du dépôt auprès de l'administration fiscale, à la date de l'attestation, de l'ensemble des déclarations fiscales obligatoires et le récépissé du dépôt de déclaration auprès d'un centre de formalités des entreprises lorsque le cocontractant n'est pas tenu de s'immatriculer au registre du commerce et des sociétés ou au répertoire des métiers, conformément à l'article R.8222-1 du Code du travail ;

3. Lorsque l'immatriculation du cocontractant au registre du commerce et des sociétés ou au répertoire des métiers est obligatoire, ou lorsqu'il s'agit d'une profession réglementée, l'un des documents suivants :
   a) Un extrait de l'inscription au registre du commerce et des sociétés (K ou Kbis) ;
   b) Une carte d'identification justifiant de l'inscription au répertoire des métiers ;
   c) Un devis, un document publicitaire ou une correspondance professionnelle, à condition qu'y soient mentionnés le nom ou la dénomination sociale, l'adresse complète et le numéro d'immatriculation au registre du commerce et des sociétés ou au répertoire des métiers ou à une liste ou un tableau d'un ordre professionnel, ou la référence de l'agrément délivré par l'autorité compétente ;

4. Lorsque le cocontractant emploie des salariés, une attestation sur l'honneur, établie par ce cocontractant, de la réalisation du travail par des salariés employés régulièrement au regard des articles L.1221-10 (DPAE), L.3243-2 (bulletin de paie) et R.3243-1 du Code du travail.

Le client reconnaît que le non-respect de ces obligations l'expose aux sanctions prévues par les articles L.8222-2 et suivants du Code du travail, notamment la solidarité financière en cas de recours à un cocontractant en situation de travail dissimulé.

Fait à {{ville}}, le {{date}}

{{dirigeant}}
{{qualite_dirigeant}}
Signature :`,
};

// ---------------------------------------------------------------------------
// 3. MANDAT DE PRÉLÈVEMENT SEPA
// ---------------------------------------------------------------------------

export const MANDAT_SEPA = {
  titre: "MANDAT DE PRÉLÈVEMENT SEPA",
  creancier: {
    nom: "COMPTADEC",
    ics: "FR67ZZZ4906200",
    adresse: "158 RUE DU ROUET, 13008 MARSEILLE",
  },
  rum: "RUM-{{ref_client}}-{{annee}}",
  typePrelevement: "Récurrent" as const,
  texteAutorisation: `En signant ce formulaire de mandat, vous autorisez COMPTADEC à envoyer des instructions à votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément aux instructions de COMPTADEC.

Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la convention que vous avez passée avec elle. Toute demande de remboursement doit être présentée :
- dans les 8 semaines suivant la date de débit de votre compte pour un prélèvement autorisé ;
- dans les 13 mois suivant la date de débit de votre compte pour un prélèvement non autorisé.

Vos droits concernant le présent mandat sont expliqués dans un document que vous pouvez obtenir auprès de votre banque.`,
  champDebiteur: [
    { label: "Nom / Raison sociale du débiteur", variable: "raison_sociale" },
    { label: "Adresse du débiteur", variable: "adresse_complete" },
    { label: "Code postal — Ville", variable: "cp_ville" },
    { label: "IBAN", variable: "iban" },
    { label: "BIC", variable: "bic" },
  ],
};

// ---------------------------------------------------------------------------
// 4. AUTORISATION DE TÉLÉTRANSMISSION LIASSE FISCALE
// ---------------------------------------------------------------------------

export const AUTORISATION_LIASSE = {
  titre: "AUTORISATION DE TÉLÉTRANSMISSION DE LA LIASSE FISCALE",
  texte: `Le soussigné, {{dirigeant}}, agissant en qualité de {{qualite_dirigeant}} de la société {{raison_sociale}}, SIREN {{siren}}, dont le siège social est situé {{adresse}} {{cp}} {{ville}},

AUTORISE

le cabinet COMPTADEC, représenté par {{associe}}, expert-comptable inscrit au Tableau de l'Ordre des Experts-Comptables de la région Provence-Alpes-Côte d'Azur, à :

1. Transmettre par voie dématérialisée via la plateforme jedeclare.com (procédure EDI-TDFC) la liasse fiscale et les déclarations de résultats de la société auprès de la Direction Générale des Finances Publiques (DGFiP) ;

2. Transmettre par voie dématérialisée les déclarations de TVA (procédure EDI-TVA) ;

3. Transmettre les déclarations sociales nominatives (DSN) auprès des organismes sociaux compétents ;

4. Recevoir en retour les accusés de réception, les avis d'imposition et les comptes rendus de traitement correspondants.

Cette autorisation est donnée pour l'exercice clos le {{fin_exercice}} et les exercices suivants, pour toute la durée de la mission d'expertise comptable, sauf révocation expresse par lettre recommandée avec accusé de réception.

Le client s'engage à vérifier les déclarations avant leur transmission et à signaler au cabinet toute erreur ou anomalie dans un délai de huit (8) jours à compter de la réception des projets de déclarations.

Le cabinet ne saurait être tenu responsable des conséquences résultant :
- D'informations incomplètes, inexactes ou tardives communiquées par le client ;
- De dysfonctionnements des systèmes de télétransmission de l'administration fiscale ou de la plateforme jedeclare.com ;
- Du non-respect par le client du délai de vérification ci-dessus.

Fait à {{ville}}, le {{date}}

{{dirigeant}}
{{qualite_dirigeant}}
Signature :`,
};

// ---------------------------------------------------------------------------
// 5. CONDITIONS GÉNÉRALES D'INTERVENTION
// ---------------------------------------------------------------------------

export interface SectionCGI {
  numero: string;
  titre: string;
  texte: string;
}

export const CONDITIONS_GENERALES: {
  titre: string;
  sections: SectionCGI[];
} = {
  titre: "CONDITIONS GÉNÉRALES D'INTERVENTION",
  sections: [
    {
      numero: "1",
      titre: "Domaine d'application",
      texte: `Les présentes Conditions Générales d'Intervention (ci-après « CGI ») s'appliquent à toutes les missions confiées au cabinet d'expertise comptable (ci-après « le cabinet ») par le client, personne physique ou morale.

Les CGI font partie intégrante et indissociable de la lettre de mission signée entre les parties. Elles complètent les conditions particulières énoncées dans la lettre de mission. En cas de contradiction entre les CGI et la lettre de mission, les stipulations de la lettre de mission prévalent.

Toute mission confiée au cabinet emporte acceptation pleine et entière des présentes CGI par le client, sauf stipulations contraires expressément convenues par écrit entre les parties.`,
    },
    {
      numero: "2",
      titre: "Définition de la mission",
      texte: `La nature, l'étendue et les limites de la mission sont définies dans la lettre de mission.

La mission est exécutée conformément aux normes professionnelles édictées par le Conseil Supérieur de l'Ordre des Experts-Comptables, et notamment :
- La Norme Professionnelle de Maîtrise de la Qualité (NPMQ) ;
- La norme professionnelle applicable à la mission de présentation des comptes (NP 2300) ;
- Le référentiel normatif et déontologique de la profession.

Les travaux effectués dans le cadre de la mission de présentation des comptes ne constituent ni un audit ni un examen limité des comptes. Ils n'ont pas pour objectif de déceler les fraudes ou les actes illégaux. Le professionnel de l'expertise comptable n'exprime pas d'opinion d'audit sur les comptes mais atteste qu'il n'a pas relevé d'éléments remettant en cause la cohérence et la vraisemblance des comptes annuels pris dans leur ensemble.

Toute mission complémentaire ou nouvelle mission non prévue dans la lettre de mission initiale fera l'objet d'un avenant ou d'une nouvelle lettre de mission.`,
    },
    {
      numero: "3",
      titre: "Résiliation de la mission",
      texte: `La mission est conclue pour la durée prévue dans la lettre de mission. Elle est renouvelable par tacite reconduction, sauf dénonciation par l'une ou l'autre des parties par lettre recommandée avec accusé de réception adressée au moins trois (3) mois avant la date d'échéance.

Le cabinet peut résilier la mission à tout moment, sans préavis ni indemnité, dans les cas suivants :
- Manquement grave du client à ses obligations contractuelles, et notamment défaut de communication des documents et informations nécessaires à l'exécution de la mission ;
- Non-paiement des honoraires échus après mise en demeure restée infructueuse pendant trente (30) jours ;
- Impossibilité de mettre en œuvre les obligations de vigilance LCB-FT prévues par le Code monétaire et financier (art. L.561-8 CMF) ;
- Perte de confiance rendant impossible la poursuite de la mission dans des conditions conformes aux règles déontologiques ;
- Fourniture d'informations volontairement inexactes par le client.

Le client peut résilier la mission à tout moment moyennant un préavis de trois (3) mois notifié par lettre recommandée avec accusé de réception. En cas de résiliation anticipée par le client, celui-ci sera redevable des honoraires correspondant aux travaux déjà réalisés ainsi que d'une indemnité de résiliation égale à vingt-cinq pour cent (25 %) du montant annuel des honoraires prévus, sauf faute du cabinet.

En cas de résiliation, le cabinet restitue au client les documents originaux qui lui ont été remis, après apurement de tout solde dû, dans un délai de trente (30) jours.`,
    },
    {
      numero: "4",
      titre: "Suspension de la mission",
      texte: `Le cabinet se réserve le droit de suspendre l'exécution de la mission dans les cas suivants :
- Non-paiement des honoraires échus ;
- Défaut de communication des documents et informations nécessaires à l'exécution de la mission dans les délais convenus ;
- Impossibilité temporaire de mettre en œuvre les mesures de vigilance LCB-FT ;
- Tout événement rendant temporairement impossible l'exécution de la mission dans des conditions normales.

La suspension prend effet à la date de réception par le client de la notification adressée par le cabinet par tout moyen écrit. Le cabinet ne saurait être tenu responsable des conséquences de la suspension, notamment en termes de retard dans le dépôt des déclarations fiscales et sociales.

La reprise de la mission est subordonnée à la régularisation de la situation ayant motivé la suspension. Les travaux de rattrapage éventuellement nécessaires feront l'objet d'une facturation complémentaire.`,
    },
    {
      numero: "5",
      titre: "Obligations de l'expert-comptable",
      texte: `Le cabinet s'engage à :
- Exécuter sa mission avec compétence, conscience professionnelle et indépendance, conformément aux normes professionnelles et aux règles déontologiques de la profession ;
- Mettre en œuvre les diligences professionnelles nécessaires à la bonne exécution de la mission ;
- Informer le client de toute difficulté rencontrée dans l'exécution de la mission ;
- Respecter le secret professionnel conformément aux dispositions de l'article 226-13 du Code pénal et aux règles déontologiques, sous réserve des dérogations légales (notamment l'obligation de déclaration à Tracfin prévue par les articles L.561-15 et suivants du Code monétaire et financier) ;
- Souscrire et maintenir une assurance responsabilité civile professionnelle couvrant les conséquences pécuniaires de sa responsabilité civile professionnelle ;
- Mettre en œuvre les obligations de vigilance en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme conformément au Code monétaire et financier et à la Norme Professionnelle de Lutte Anti-Blanchiment (NPLAB).

Le cabinet est tenu d'une obligation de moyens et non de résultat. Il n'est pas tenu de vérifier l'exactitude et l'exhaustivité des informations qui lui sont communiquées par le client. Sa responsabilité ne saurait être engagée pour des anomalies qui n'auraient pu être détectées dans le cadre de la mission de présentation des comptes.`,
    },
    {
      numero: "6",
      titre: "Obligations du client",
      texte: `Le client s'engage à :
- Fournir au cabinet, dans les délais convenus et conformément au calendrier annexé, l'ensemble des documents, pièces justificatives et informations nécessaires à l'exécution de la mission ;
- Garantir la sincérité, l'exactitude et l'exhaustivité des informations et documents communiqués ;
- Informer le cabinet, sans délai, de tout événement ou circonstance susceptible d'affecter l'exécution de la mission (contrôle fiscal, litige, procédure collective, changement d'activité, etc.) ;
- Mettre en place et maintenir un système de contrôle interne adapté à la taille et à l'activité de l'entreprise, permettant la production d'informations comptables et financières fiables ;
- Régler les honoraires aux échéances convenues ;
- Coopérer pleinement avec le cabinet dans le cadre des obligations de vigilance LCB-FT et fournir, dans les délais impartis, tout document ou information demandé à ce titre ;
- Conserver les originaux des pièces justificatives pendant la durée légale de conservation (10 ans pour les documents comptables, conformément à l'article L.123-22 du Code de commerce) ;
- Procéder aux inventaires physiques des actifs (stocks, immobilisations, espèces en caisse) à la clôture de chaque exercice.

Le client reste seul responsable de ses obligations légales, fiscales et sociales. L'intervention du cabinet ne saurait être assimilée à une quelconque prise en charge de ces obligations. Le client est seul responsable de l'établissement des comptes annuels au sens de l'article L.123-12 du Code de commerce.`,
    },
    {
      numero: "7",
      titre: "Honoraires",
      texte: `Les honoraires sont fixés dans la lettre de mission conformément aux usages de la profession et à l'article 24 de l'ordonnance du 19 septembre 1945. Ils sont déterminés en fonction de l'importance et de la difficulté des travaux à exécuter.

Les honoraires sont révisables annuellement en fonction de l'évolution des charges du cabinet, de la complexité de la mission et de l'indice Syntec, avec un minimum forfaitaire de trois pour cent (3 %) par an. La révision est notifiée au client au moins trois (3) mois avant sa prise d'effet.

Les honoraires sont soumis à la TVA au taux en vigueur. Ils sont payables aux échéances prévues dans la lettre de mission, par prélèvement SEPA.

Toute prestation non prévue dans la lettre de mission fera l'objet d'un accord préalable du client et d'une facturation complémentaire sur la base des taux horaires en vigueur au sein du cabinet.

En cas de retard de paiement, des pénalités de retard sont exigibles de plein droit, sans qu'un rappel soit nécessaire, au taux de trois fois le taux d'intérêt légal en vigueur, conformément à l'article L.441-10 du Code de commerce. Une indemnité forfaitaire de quarante (40) euros pour frais de recouvrement est également due de plein droit, conformément à l'article D.441-5 du Code de commerce.

Le cabinet se réserve le droit de suspendre l'exécution de la mission en cas de non-paiement des honoraires échus, après mise en demeure restée infructueuse pendant quinze (15) jours.`,
    },
    {
      numero: "8",
      titre: "Responsabilité civile professionnelle",
      texte: `Le cabinet est assuré en responsabilité civile professionnelle auprès d'une compagnie d'assurance notoirement solvable, pour les conséquences pécuniaires de la responsabilité civile qu'il peut encourir du fait de ses négligences, erreurs ou omissions commises dans l'exercice de ses fonctions.

La responsabilité du cabinet ne peut être engagée que dans les limites de la mission qui lui a été confiée et pour les seuls dommages directs résultant d'une faute prouvée dans l'exécution de sa mission.

Le cabinet ne saurait être tenu responsable :
- Des conséquences des décisions de gestion prises par le client ;
- Des informations incomplètes, inexactes ou tardives fournies par le client ;
- Des anomalies, fraudes ou irrégularités qui n'entrent pas dans le champ de la mission de présentation des comptes ;
- Des préjudices indirects, tels que perte de chiffre d'affaires, perte de chance, préjudice d'image ou atteinte à la réputation ;
- Des conséquences résultant du non-respect par le client de ses obligations contractuelles ou légales.

La responsabilité du cabinet est limitée au montant des honoraires perçus au titre de l'exercice au cours duquel le dommage est survenu, sauf faute intentionnelle ou faute lourde. Cette limitation ne s'applique pas aux dommages corporels.

Le client s'engage à informer le cabinet de toute réclamation dans un délai de trois (3) mois à compter de la découverte du fait générateur du dommage.

Tout litige relatif à la responsabilité du cabinet est prescrit par cinq (5) ans à compter de la réalisation du dommage ou de la date à laquelle il est révélé à la victime si celle-ci établit qu'elle n'en avait pas eu précédemment connaissance.`,
    },
    {
      numero: "9",
      titre: "Protection des données personnelles",
      texte: `Le cabinet traite les données personnelles du client, de ses dirigeants, de ses bénéficiaires effectifs et de ses salariés dans le cadre de l'exécution de sa mission, conformément au Règlement (UE) 2016/679 du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du traitement des données à caractère personnel (RGPD) et à la loi n° 78-17 du 6 janvier 1978 modifiée relative à l'informatique, aux fichiers et aux libertés.

Le cabinet agit en qualité de sous-traitant au sens de l'article 28 du RGPD pour les traitements effectués pour le compte du client dans le cadre de la mission. Le client conserve la qualité de responsable du traitement.

Les données personnelles sont traitées pour les finalités suivantes :
- Exécution de la mission d'expertise comptable (tenue, révision, présentation des comptes) ;
- Établissement des bulletins de paie et des déclarations sociales ;
- Établissement et télétransmission des déclarations fiscales ;
- Respect des obligations de vigilance LCB-FT (identification, vérification d'identité, connaissance de la relation d'affaires) ;
- Gestion de la relation contractuelle et facturation.

Le cabinet s'engage à :
- Ne traiter les données personnelles que sur instruction documentée du client et dans le strict cadre de la mission ;
- Garantir la confidentialité des données traitées par l'ensemble de son personnel et de ses sous-traitants ;
- Mettre en œuvre les mesures techniques et organisationnelles appropriées pour assurer la sécurité et l'intégrité des données (chiffrement, contrôle d'accès, sauvegarde) ;
- Ne pas sous-traiter le traitement des données personnelles sans l'autorisation préalable écrite du client ;
- Assister le client dans le respect de ses obligations au titre du RGPD (droits des personnes concernées, notification de violation, analyse d'impact) ;
- Notifier au client toute violation de données personnelles dans un délai de 72 heures ;
- Supprimer ou restituer les données personnelles au terme de la mission, sous réserve des obligations légales de conservation (notamment art. L.561-12 CMF : 5 ans après fin de la relation d'affaires ; art. L.123-22 Code de commerce : 10 ans pour les documents comptables).

Le client peut exercer ses droits d'accès, de rectification, d'effacement et de portabilité en contactant le cabinet par écrit.`,
    },
    {
      numero: "10",
      titre: "Confidentialité et secret professionnel",
      texte: `Le cabinet est tenu au secret professionnel conformément aux dispositions de l'article 226-13 du Code pénal et aux règles déontologiques de la profession (art. 147 du décret du 30 mars 2012).

Cette obligation s'étend à l'ensemble du personnel du cabinet, aux collaborateurs, stagiaires et éventuels sous-traitants, qui sont tenus par des engagements de confidentialité individuels.

Le cabinet s'engage à prendre toutes les mesures nécessaires pour assurer la protection et la confidentialité des données, documents et informations qui lui sont confiés dans le cadre de la mission.

Cette obligation de confidentialité ne s'applique pas :
- Aux informations qui sont ou deviennent publiques sans le fait du cabinet ;
- Aux informations dont la communication est exigée par la loi, par une décision de justice ou par une autorité administrative ou de régulation compétente ;
- Aux obligations de déclaration auprès de Tracfin prévues par les articles L.561-15 et suivants du Code monétaire et financier ;
- Aux échanges d'informations entre professionnels de l'expertise comptable dans le cadre légal prévu à cet effet.

Le client autorise expressément le cabinet à communiquer les données nécessaires à ses sous-traitants (éditeurs de logiciels, plateformes de télétransmission), dans le strict cadre de l'exécution de la mission et sous réserve d'engagements de confidentialité équivalents.`,
    },
    {
      numero: "11",
      titre: "Différends",
      texte: `En cas de différend relatif à l'exécution, l'interprétation ou la résiliation du présent contrat, les parties s'engagent à rechercher une solution amiable dans un délai de trente (30) jours à compter de la notification écrite du différend par l'une des parties.

À défaut d'accord amiable, le différend pourra être soumis à la médiation du Conseil Régional de l'Ordre des Experts-Comptables dont relève le cabinet, conformément à l'article 167 du décret du 30 mars 2012. La procédure de médiation est gratuite pour les parties.

À défaut de résolution par la médiation dans un délai de soixante (60) jours à compter de la saisine du médiateur, le litige sera porté devant le tribunal compétent du ressort du siège social du cabinet.`,
    },
    {
      numero: "12",
      titre: "Droit applicable — Dispositions diverses",
      texte: `Le présent contrat est régi par le droit français.

Nullité partielle — Si l'une quelconque des clauses des présentes conditions générales venait à être déclarée nulle ou inapplicable par une décision de justice devenue définitive, les autres clauses resteront en vigueur et conserveront leur plein effet.

Non-renonciation — Le fait pour l'une des parties de ne pas se prévaloir d'un manquement de l'autre partie à l'une quelconque de ses obligations ne saurait être interprété comme une renonciation à l'obligation en cause ni comme une renonciation à se prévaloir ultérieurement de ce manquement ou de tout autre manquement.

Intégralité — La lettre de mission, ses éventuels avenants, les annexes et les présentes conditions générales d'intervention constituent l'intégralité de l'accord entre les parties et remplacent tout accord, proposition ou communication antérieurs, qu'ils soient écrits ou oraux, relatifs à l'objet du présent contrat.

Cession — Le présent contrat est conclu intuitu personae et ne peut être cédé par le client sans l'accord préalable écrit du cabinet. En cas de fusion, scission ou apport partiel d'actif du cabinet, le contrat sera transféré de plein droit au successeur du cabinet.

Force majeure — Aucune des parties ne pourra être tenue responsable de l'inexécution ou du retard dans l'exécution de ses obligations contractuelles lorsque cette inexécution ou ce retard résulte d'un cas de force majeure au sens de l'article 1218 du Code civil. La partie invoquant la force majeure devra en informer l'autre partie dans les plus brefs délais. Si le cas de force majeure se prolonge au-delà de trois (3) mois, chacune des parties pourra résilier le contrat de plein droit, sans indemnité, par lettre recommandée avec accusé de réception.`,
    },
  ],
};
