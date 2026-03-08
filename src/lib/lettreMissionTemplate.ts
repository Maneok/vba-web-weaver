// ──────────────────────────────────────────────
// Modèle de lettre de mission — Template system
// ──────────────────────────────────────────────

export interface TemplateSection {
  id: string;
  title: string;
  content: string;
  type: "fixed" | "conditional" | "annexe";
  condition?: "sociale" | "juridique" | "fiscal";
  editable: boolean;
}

export const DEFAULT_TEMPLATE: TemplateSection[] = [
  {
    id: "destinataire",
    title: "Destinataire",
    content:
      "À l'attention de {{formule_politesse}} {{dirigeant}},\nMandataire social de la société\n{{forme_juridique}} {{raison_sociale}},\n{{adresse}} {{code_postal}} {{ville}}",
    type: "fixed",
    editable: false,
  },
  {
    id: "introduction",
    title: "Introduction",
    content:
      "Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.",
    type: "fixed",
    editable: true,
  },
  {
    id: "entite",
    title: "Votre entité",
    content: "TABLEAU_ENTITE",
    type: "fixed",
    editable: false,
  },
  {
    id: "organisation",
    title: "Organisation et transmission",
    content:
      "Organisation et transmission des documents comptables :\n▪ Périodicité : {{frequence}} – Avant le J+10\n▪ Transmission via notre outil : GRIMY\n\nDurée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires, indépendamment de la durée de conservation des documents comptables.",
    type: "fixed",
    editable: true,
  },
  {
    id: "mission",
    title: "Notre mission",
    content:
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle de maîtrise de la qualité (NPMQ) et de la norme professionnelle applicable aux missions de présentation des comptes (NPLAB, arrêté du 13 février 2019).\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous nous permettons de rappeler les points suivants :\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n\nIls ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces…) ;\n\nIls n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance ;\n\nNous nous permettons d'attirer votre attention sur le fait que conformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de l'entreprise ;\n\nNous comptons sur votre entière coopération afin qu'il soit mis à notre disposition dans un délai raisonnable tous les documents et autres informations nécessaires qui nous permettront de mener à bien cette mission ;\n\nDans le cadre de cette mission, votre expert-comptable apportera personnellement son concours à la mission en suivant attentivement votre entreprise.",
    type: "fixed",
    editable: true,
  },
  {
    id: "duree",
    title: "Durée de la mission",
    content:
      "Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera sur les comptes de l'exercice comptable commençant le {{date_du_jour}} et se terminant le {{date_cloture}}.\n\nCette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation, de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions Générales d'Intervention.",
    type: "fixed",
    editable: true,
  },
  {
    id: "nature_limite",
    title: "Nature et limite de la mission",
    content:
      "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités, toutefois nous vous en informerions le cas échéant.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par sondages.",
    type: "fixed",
    editable: true,
  },
  {
    id: "lcbft",
    title: "Obligations LCB-FT",
    content: "BLOC_LCBFT",
    type: "fixed",
    editable: false,
  },
  {
    id: "missions_complementaires_intro",
    title: "Missions complémentaires",
    content:
      "Vous avez souhaité également qu'en complément de cette mission nous assurions les prestations suivantes :",
    type: "fixed",
    editable: true,
  },
  {
    id: "mission_sociale",
    title: "Mission sociale",
    content:
      "La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :\n\nÉtablir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;\nÉtablir, télétransmettre et télé-payer les déclarations sociales périodiques liées ;\nTenir le journal des salaires ;\nMettre à disposition de l'entité les documents et états liés au traitement de la paie ;\nFournir les données d'archivage ;\nAssurer la gestion administrative d'évènements occasionnels courants.\n\nIl est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur.",
    type: "conditional",
    condition: "sociale",
    editable: true,
  },
  {
    id: "mission_juridique",
    title: "Mission juridique",
    content:
      "La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux.\n\nElle comprend la rédaction des actes relatifs à l'approbation des comptes annuels.",
    type: "conditional",
    condition: "juridique",
    editable: true,
  },
  {
    id: "mission_fiscal",
    title: "Mission d'assistance au contrôle fiscal (SUR OPTION)",
    content:
      "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle.\n\nAfin de mutualiser le risque, nous mettons en place une garantie :\n☐ Option A : limite de 5 000 € HT/an — 25 € HT/mois\n☐ Option B : limite de 2 500 € HT/an — 10 € HT/mois\n☐ Renonce à la souscription",
    type: "conditional",
    condition: "fiscal",
    editable: true,
  },
  {
    id: "modalites",
    title: "Modalités relationnelles",
    content:
      "Nos relations seront réglées sur le plan juridique par les termes de cette lettre, les conditions générales et le tableau de répartition des obligations respectives (voir annexes).",
    type: "fixed",
    editable: true,
  },
  {
    id: "honoraires",
    title: "Honoraires",
    content: "TABLEAU_HONORAIRES",
    type: "fixed",
    editable: false,
  },
  {
    id: "signature",
    title: "Signature",
    content:
      "Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.\n\nNous vous prions de croire, {{formule_politesse}} {{dirigeant}}, à nos sentiments dévoués.\n\nFait à {{ville_cabinet}}, le {{date_du_jour}}\n\nL'Expert-comptable                    Le client\n{{associe}}                            {{dirigeant}}",
    type: "fixed",
    editable: true,
  },
  {
    id: "annexe_repartition",
    title: "Annexe — Répartition des travaux",
    content: "TABLEAU_REPARTITION",
    type: "annexe",
    editable: false,
  },
  {
    id: "annexe_travail_dissimule",
    title: "Annexe — Attestation travail dissimulé",
    content:
      "Je soussigné(e) {{dirigeant}} agissant en qualité de mandataire de la société {{raison_sociale}} immatriculée au RCS sous le n° {{siren}} et dont le siège social est situé {{adresse}} {{code_postal}} {{ville}} :\n\nAtteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du Travail :\n▪ Avoir immatriculé mon entreprise au RCS\n▪ Employer régulièrement tous mes salariés\n▪ Ne pas employer de salariés étrangers démunis du titre les autorisant à travailler en France",
    type: "annexe",
    editable: true,
  },
  {
    id: "annexe_sepa",
    title: "Annexe — Mandat de prélèvement SEPA",
    content:
      "En signant ce formulaire de mandat, vous autorisez {{nom_cabinet}} à envoyer des instructions à votre banque pour débiter votre compte.\n\nIBAN : {{iban}}\nBIC : {{bic}}",
    type: "annexe",
    editable: true,
  },
  {
    id: "annexe_liasse",
    title: "Annexe — Autorisation de transmission de Liasse Fiscale",
    content:
      "{{raison_sociale}}, représentée par {{dirigeant}}, mandataire social ayant tous pouvoirs à cet effet, déclare autoriser {{nom_cabinet}} à télétransmettre chaque année sur le portail jedéclare.com la liasse fiscale qui la concerne.",
    type: "annexe",
    editable: true,
  },
  {
    id: "annexe_cgv",
    title: "Annexe — Conditions Générales d'Intervention",
    content:
      "Conditions générales en vigueur au 6 Janvier 2025\n\n1. Domaine d'application\nLes présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.\n\n2. Définition de la mission\nLes travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes.\n\n3. Résiliation de la mission\nLa mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.\n\n4. Suspension de la mission\nLes délais de délivrance sont prolongés pour une durée égale à celle de la suspension.\n\n5. Obligations du professionnel\nLe professionnel effectue la mission conformément au Code de déontologie et aux normes NPMQ/NPLAB. Secret professionnel et discrétion assurés.\n\n6. Obligations du client\nLe client s'engage à fournir les documents d'identification KYC (CNI, Kbis, BE), à mettre à disposition les pièces comptables dans les délais, et à porter à connaissance tout fait nouveau.\n\n7. Honoraires\nLes honoraires sont payés par prélèvement à leur échéance. Pénalités de retard au taux BCE + 10 points. Indemnité forfaitaire de 40 € pour frais de recouvrement.\n\n8. Responsabilité civile\nCouverte par contrat MMA IARD. Prescription réduite à 1 an.\n\n9. Données personnelles\nTraitement conforme RGPD. Conservation 5 ans après fin de mission.\n\n10. Différends\nMédiation via le Président du CROEC avant toute action judiciaire. Tribunal de commerce compétent.",
    type: "annexe",
    editable: true,
  },
];

// ── Variable replacement helper ──

export function replaceTemplateVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

// ── Extract variable names from template text ──

export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
