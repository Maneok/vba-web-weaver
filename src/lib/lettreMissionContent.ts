// Types and constants for lettre de mission components

export type Genre = "M" | "Mme";

export interface ControleFiscalOption {
  id: "A" | "B" | "RENONCE";
  label: string;
  montant: number | null;
}

export const CONTROLE_FISCAL_OPTIONS: ControleFiscalOption[] = [
  {
    id: "A",
    label: "Option A — Assistance en cas de controle fiscal",
    montant: 1500,
  },
  {
    id: "B",
    label: "Option B — Assistance et representation en controle fiscal",
    montant: 3000,
  },
  {
    id: "RENONCE",
    label: "Le client renonce a cette option",
    montant: null,
  },
];

export const LETTRE_MISSION_TEMPLATE = {
  repartitionTravaux: {
    colonnes: ["Travaux", "Cabinet", "Client", "Periodicite"],
    lignes: [
      { id: "saisie", label: "Saisie des ecritures comptables", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "pointage", label: "Pointage et lettrage des comptes", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "rapprochement", label: "Rapprochement bancaire", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "tva", label: "Declaration de TVA", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "classement", label: "Classement des pieces justificatives", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "factures", label: "Emission des factures clients", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "relances", label: "Relances clients / suivi creances", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "inventaire", label: "Inventaire physique des stocks", defautCabinet: false, defautClient: true, periodicite: "Annuel" },
      { id: "bilan", label: "Etablissement du bilan et compte de resultat", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "liasse", label: "Etablissement de la liasse fiscale", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "plaquette", label: "Plaquette annuelle de presentation des comptes", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "ag", label: "Proces-verbaux d'assemblee generale", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
    ],
  },
  attestationTravailDissimule: {
    titre: "Attestation relative au travail dissimule",
    texte:
      "En application de l'article D.8222-5 du Code du travail, le client s'engage a fournir :\n\n" +
      "- Une attestation de fourniture de declarations sociales emanant de l'URSSAF datant de moins de 6 mois ;\n" +
      "- Un extrait de l'inscription au registre du commerce et des societes (K ou Kbis) ou au repertoire des metiers (D1), " +
      "ou un recepisse de depot de declaration aupres d'un centre de formalites des entreprises ;\n" +
      "- Une attestation sur l'honneur de la realisation du travail par des salaries employes regulierement.\n\n" +
      "Le client certifie sur l'honneur que le travail sera realise par des salaries employes regulierement " +
      "au regard des articles L.1221-10, L.3243-2 et R.3243-1 du Code du travail.",
  },
  mandatSepa: {
    titre: "Mandat de prelevement SEPA",
    texteAutorisation:
      "En signant ce mandat, vous autorisez le cabinet a envoyer des instructions a votre banque " +
      "pour debiter votre compte conformement aux instructions du cabinet. Vous beneficiez du droit " +
      "d'etre rembourse par votre banque selon les conditions decrites dans la convention que vous avez " +
      "passee avec elle. Toute demande de remboursement doit etre presentee dans les 8 semaines suivant " +
      "la date de debit de votre compte pour un prelevement autorise.",
    champCreancier: [
      { label: "Nom du cabinet", variable: "cabinet_nom" },
      { label: "Adresse", variable: "cabinet_adresse" },
      { label: "ICS (Identifiant Creancier SEPA)", variable: "cabinet_ics" },
    ],
    champDebiteur: [
      { label: "Nom du debiteur", variable: "client_nom" },
      { label: "Adresse", variable: "client_adresse" },
      { label: "IBAN", variable: "client_iban" },
      { label: "BIC", variable: "client_bic" },
    ],
    typePrelevement: "Recurrent",
    rum: "{{numero_lettre}}-SEPA",
  },
  autorisationLiasse: {
    titre: "Autorisation de transmission de la liasse fiscale",
    texte:
      "Le client autorise expressement le cabinet a transmettre par voie electronique (procedure EDI) " +
      "la liasse fiscale et les declarations de resultats aux services fiscaux competents.\n\n" +
      "Cette autorisation est donnee pour la duree de la mission et sera renouvelee tacitement " +
      "chaque annee sauf denonciation ecrite par le client au moins 3 mois avant la date de cloture de l'exercice.",
  },
  conditionsGenerales: {
    titre: "Conditions generales",
    sections: [
      {
        numero: 1,
        titre: "Objet",
        texte:
          "Les presentes conditions generales regissent les relations entre le cabinet et le client " +
          "dans le cadre de la mission d'expertise comptable definie dans la lettre de mission.",
      },
      {
        numero: 2,
        titre: "Obligations du cabinet",
        texte:
          "Le cabinet s'engage a executer la mission qui lui est confiee conformement aux normes professionnelles " +
          "en vigueur et avec la diligence requise. Il est tenu a une obligation de moyens.",
      },
      {
        numero: 3,
        titre: "Obligations du client",
        texte:
          "Le client s'engage a mettre a la disposition du cabinet, dans les delais convenus, l'ensemble des " +
          "documents et informations necessaires a l'execution de la mission. Il certifie l'exactitude des " +
          "informations transmises.",
      },
      {
        numero: 4,
        titre: "Honoraires et modalites de paiement",
        texte:
          "Les honoraires sont determines conformement aux dispositions de la lettre de mission. " +
          "Ils sont payables selon les modalites prevues. Tout retard de paiement entrainera l'application " +
          "de penalites de retard au taux legal en vigueur, ainsi qu'une indemnite forfaitaire pour frais " +
          "de recouvrement de 40 euros.",
      },
      {
        numero: 5,
        titre: "Responsabilite",
        texte:
          "La responsabilite du cabinet ne peut etre engagee qu'en cas de faute prouvee. " +
          "Elle est limitee au montant des honoraires percus au titre de l'exercice concerne. " +
          "Le cabinet est couvert par une assurance responsabilite civile professionnelle.",
      },
      {
        numero: 6,
        titre: "Secret professionnel et confidentialite",
        texte:
          "Le cabinet est tenu au secret professionnel dans les conditions prevues par les textes en vigueur. " +
          "Toutes les informations recueillies a l'occasion de la mission sont strictement confidentielles.",
      },
      {
        numero: 7,
        titre: "Lutte contre le blanchiment (LCB-FT)",
        texte:
          "Conformement aux articles L.561-1 et suivants du Code monetaire et financier, le cabinet est soumis " +
          "aux obligations de vigilance en matiere de lutte contre le blanchiment de capitaux et le financement " +
          "du terrorisme. Le client s'engage a fournir les informations necessaires a l'identification et a la " +
          "verification de son identite, ainsi qu'a celle du beneficiaire effectif.",
      },
      {
        numero: 8,
        titre: "Protection des donnees personnelles",
        texte:
          "Le cabinet s'engage a respecter la reglementation en vigueur relative a la protection des donnees " +
          "personnelles (RGPD). Les donnees collectees sont traitees pour les seuls besoins de la mission. " +
          "Le client dispose d'un droit d'acces, de rectification et de suppression de ses donnees.",
      },
      {
        numero: 9,
        titre: "Duree et resiliation",
        texte:
          "La mission prend effet a la date de signature de la lettre de mission pour la duree indiquee. " +
          "Elle est renouvelable par tacite reconduction. Chaque partie peut y mettre fin par lettre recommandee " +
          "avec accuse de reception moyennant un preavis de 3 mois avant la date anniversaire.",
      },
      {
        numero: 10,
        titre: "Droit applicable et litiges",
        texte:
          "Les presentes conditions sont soumises au droit francais. En cas de litige, les parties s'engagent " +
          "a rechercher une solution amiable. A defaut, le litige sera porte devant les juridictions competentes.",
      },
    ],
  },
};
