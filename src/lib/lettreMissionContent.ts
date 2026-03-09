// ──────────────────────────────────────────────
// Contenu structuré lettre de mission
// Types et données partagés par les composants lettre-mission
// ──────────────────────────────────────────────

// ====== Genre (civilité) ======

export type Genre = "M" | "Mme";

// ====== Contrôle fiscal options ======

export interface ControleFiscalOption {
  id: "A" | "B" | "RENONCE";
  label: string;
  montant: number | null;
}

export const CONTROLE_FISCAL_OPTIONS: ControleFiscalOption[] = [
  { id: "A", label: "Option A — Limite de 5 000 € HT/an", montant: 300 },
  { id: "B", label: "Option B — Limite de 2 500 € HT/an", montant: 120 },
  { id: "RENONCE", label: "Renonce à la souscription", montant: null },
];

// ====== Template structuré (utilisé par AnnexesPreview) ======

export interface RepartitionLigne {
  id: string;
  label: string;
  defautCabinet: boolean;
  defautClient: boolean;
  periodicite: string;
}

export interface SepaChamp {
  label: string;
  variable: string;
}

export interface CgvSection {
  numero: number;
  titre: string;
  texte: string;
}

export interface LettreMissionTemplateStructure {
  repartitionTravaux: {
    colonnes: string[];
    lignes: RepartitionLigne[];
  };
  attestationTravailDissimule: {
    titre: string;
    texte: string;
  };
  mandatSepa: {
    titre: string;
    texteAutorisation: string;
    champCreancier: SepaChamp[];
    champDebiteur: SepaChamp[];
    typePrelevement: string;
    rum: string;
  };
  autorisationLiasse: {
    titre: string;
    texte: string;
  };
  conditionsGenerales: {
    titre: string;
    sections: CgvSection[];
  };
}

export const LETTRE_MISSION_TEMPLATE: LettreMissionTemplateStructure = {
  repartitionTravaux: {
    colonnes: ["Travaux", "Cabinet", "Client", "Periodicite"],
    lignes: [
      { id: "saisie", label: "Saisie des ecritures comptables", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "rapprochement", label: "Rapprochement bancaire", defautCabinet: true, defautClient: false, periodicite: "Mensuel" },
      { id: "tva", label: "Declarations de TVA", defautCabinet: true, defautClient: false, periodicite: "Mensuel / Trimestriel" },
      { id: "revision", label: "Revision des comptes", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "bilan", label: "Etablissement du bilan et compte de resultat", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "liasse", label: "Liasse fiscale et teletransmission", defautCabinet: true, defautClient: false, periodicite: "Annuel" },
      { id: "classement", label: "Classement et archivage des pieces", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "transmission", label: "Transmission des pieces comptables", defautCabinet: false, defautClient: true, periodicite: "Mensuel" },
      { id: "inventaire", label: "Inventaire physique des stocks", defautCabinet: false, defautClient: true, periodicite: "Annuel" },
      { id: "caisse", label: "Tenue du brouillard de caisse", defautCabinet: false, defautClient: true, periodicite: "Quotidien" },
      { id: "releve_bancaire", label: "Transmission des releves bancaires", defautCabinet: false, defautClient: true, periodicite: "Mensuel" },
      { id: "facturation", label: "Facturation clients", defautCabinet: false, defautClient: true, periodicite: "Permanent" },
      { id: "kyc", label: "Fourniture des pieces KYC (CNI, Kbis, BE)", defautCabinet: false, defautClient: true, periodicite: "A l'entree" },
    ],
  },
  attestationTravailDissimule: {
    titre: "Attestation relative au travail dissimule",
    texte:
      "Je soussigne(e) {{dirigeant}}, agissant en qualite de mandataire social de la societe {{raison_sociale}}, immatriculee au RCS sous le numero {{siren}} et dont le siege social est situe {{adresse}} {{code_postal}} {{ville}} :\n\nAtteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du Travail :\n\n▪ Avoir procede a l'immatriculation de mon entreprise au Registre du Commerce et des Societes ;\n▪ Employer regulierement l'ensemble de mes salaries conformement aux dispositions legales ;\n▪ Ne pas employer de salaries etrangers depourvus du titre les autorisant a exercer une activite salariee en France ;\n▪ Etre en regle vis-a-vis de mes obligations sociales et fiscales.\n\nFait pour servir et valoir ce que de droit.\n\nFait a {{ville}}, le {{date_du_jour}}\n\nSignature :\n{{dirigeant}}",
  },
  mandatSepa: {
    titre: "Mandat de prelevement SEPA",
    texteAutorisation:
      "En signant ce formulaire de mandat, vous autorisez le cabinet a envoyer des instructions a votre banque pour debiter votre compte, et votre banque a debiter votre compte conformement aux instructions du cabinet.",
    champCreancier: [
      { label: "Nom du creancier", variable: "nom_cabinet" },
      { label: "Adresse", variable: "adresse_cabinet" },
      { label: "Code postal – Ville", variable: "ville_cabinet" },
      { label: "ICS (Identifiant Creancier SEPA)", variable: "ics_cabinet" },
    ],
    champDebiteur: [
      { label: "Nom du debiteur", variable: "raison_sociale" },
      { label: "Adresse", variable: "adresse" },
      { label: "Code postal – Ville", variable: "ville" },
      { label: "IBAN", variable: "iban" },
      { label: "BIC", variable: "bic" },
    ],
    typePrelevement: "Recurrent",
    rum: "{{reference_mandat}}",
  },
  autorisationLiasse: {
    titre: "Autorisation de transmission de la Liasse Fiscale",
    texte:
      "{{raison_sociale}}, representee par {{dirigeant}}, mandataire social ayant tous pouvoirs a cet effet, declare autoriser {{nom_cabinet}} a teletransmettre chaque annee sur le portail jedeclare.com la liasse fiscale qui la concerne.\n\nCette autorisation est valable pour la duree de la mission telle que definie dans la lettre de mission.\n\nFait a {{ville}}, le {{date_du_jour}}\n\nSignature :\n{{dirigeant}}",
  },
  conditionsGenerales: {
    titre: "Conditions Generales d'Intervention",
    sections: [
      {
        numero: 1,
        titre: "Domaine d'application",
        texte:
          "Les presentes conditions sont applicables aux conventions portant sur les missions conclues entre notre societe d'expertise comptable et son client.",
      },
      {
        numero: 2,
        titre: "Definition de la mission",
        texte:
          "Les travaux incombant au professionnel sont detailles dans la lettre de mission et ses annexes. Toute mission complementaire fera l'objet d'un avenant ou d'un accord ecrit prealable.",
      },
      {
        numero: 3,
        titre: "Resiliation de la mission",
        texte:
          "La mission sera tacitement renouvelee chaque annee. Le client ou le professionnel peut y mettre fin par lettre recommandee avec accuse de reception dans un delai de 3 mois avant la fin de la periode en cours.",
      },
      {
        numero: 4,
        titre: "Suspension de la mission",
        texte:
          "En cas de suspension de la mission pour quelque cause que ce soit, les delais de delivrance des travaux sont prolonges pour une duree egale a celle de la suspension.",
      },
      {
        numero: 5,
        titre: "Obligations du professionnel",
        texte:
          "Le professionnel effectue la mission conformement au Code de deontologie et aux normes professionnelles applicables (NPMQ, NPLAB). Le professionnel est tenu au secret professionnel et a la discretion.",
      },
      {
        numero: 6,
        titre: "Obligations du client",
        texte:
          "Le client s'engage a fournir les documents d'identification KYC (CNI, Kbis, beneficiaires effectifs), a mettre a disposition les pieces comptables dans les delais convenus, et a porter a connaissance du professionnel tout fait nouveau susceptible d'affecter la mission.",
      },
      {
        numero: 7,
        titre: "Honoraires",
        texte:
          "Les honoraires sont payables par prelevement a leur echeance. A defaut de paiement a la date convenue, des penalites de retard seront exigibles au taux de la BCE majoree de 10 points. Une indemnite forfaitaire de 40 EUR pour frais de recouvrement sera due de plein droit (art. D.441-5 C. com.).",
      },
      {
        numero: 8,
        titre: "Responsabilite civile professionnelle",
        texte:
          "La responsabilite civile professionnelle du cabinet est couverte par un contrat d'assurance souscrit aupres de MMA IARD. La prescription est reduite a un (1) an a compter de la date de remise des travaux.",
      },
      {
        numero: 9,
        titre: "Donnees personnelles",
        texte:
          "Le traitement des donnees personnelles est realise conformement au Reglement General sur la Protection des Donnees (RGPD). Les donnees sont conservees pendant 5 ans apres la fin de la mission.",
      },
      {
        numero: 10,
        titre: "Differends",
        texte:
          "En cas de differend, les parties s'engagent a rechercher une solution amiable par voie de mediation aupres du President du Conseil Regional de l'Ordre des Experts-Comptables avant toute action judiciaire. A defaut, le Tribunal de commerce sera competent.",
      },
    ],
  },
};
