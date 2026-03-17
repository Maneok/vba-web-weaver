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
      "Conditions générales en vigueur au 15 Mars 2026\n\n1. Domaine d'application\nLes présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.\n\n2. Définition de la mission\nLes travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes.\n\n3. Résiliation de la mission\nLa mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.\nPour les clients ayant la qualité de consommateur ou de non-professionnel au sens de l'article liminaire du Code de la consommation : conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat. À défaut, le client pourra mettre gratuitement un terme au contrat à tout moment à compter de la date de reconduction.\n\n4. Suspension de la mission\nLes délais de délivrance sont prolongés pour une durée égale à celle de la suspension.\n\n5. Obligations du professionnel\nLe professionnel effectue la mission conformément au Code de déontologie et aux normes NPMQ/NPLAB. Secret professionnel et discrétion assurés.\n\n6. Obligations du client\nLe client s'engage à fournir les documents d'identification KYC (CNI, Kbis, BE), à mettre à disposition les pièces comptables dans les délais, et à porter à connaissance tout fait nouveau.\n\n7. Honoraires\nLes honoraires sont payés par prélèvement à leur échéance. Pénalités de retard au taux BCE + 10 points. Indemnité forfaitaire de 40 € pour frais de recouvrement.\n\n8. Responsabilité civile\nCouverte par contrat MMA IARD. Prescription réduite à 1 an. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation ; les délais de prescription de droit commun s'appliquent alors (article L 218-1 du Code de la consommation).\n\n9. Données personnelles\nTraitement conforme RGPD. Conservation 5 ans après fin de mission.\n\n10. Différends\nEn cas de contestation des conditions d'exercice de la mission ou de différend sur les honoraires, les parties s'engagent, préalablement à toute action en justice, à saisir le président du CROEC compétent aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso). Tribunal de commerce compétent.\n\n11. Non-sollicitation des collaborateurs\nLe client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres d'exécuter des missions en leur nom propre ou de devenir salarié du client, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.\n\n12. Conservation des données LCB-FT\nLe cabinet collecte des données d'identification pour respecter ses obligations LCB-FT. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.",
    type: "annexe",
    editable: true,
  },
];

// ──────────────────────────────────────────────
// Modèle SCI — Société Civile Immobilière
// ──────────────────────────────────────────────

export const SCI_TEMPLATE: TemplateSection[] = [
  {
    id: "destinataire",
    title: "Destinataire",
    content:
      "À l'attention de {{formule_politesse}} {{dirigeant}},\nGérant(e) de la\n{{forme_juridique}} {{raison_sociale}},\n{{adresse}} {{code_postal}} {{ville}}",
    type: "fixed",
    editable: false,
  },
  {
    id: "introduction",
    title: "Introduction",
    content:
      "Nous vous remercions de la confiance que vous nous avez témoignée en envisageant de nous confier, en qualité d'expert-comptable, une mission portant sur la gestion comptable de votre patrimoine immobilier détenu au travers de votre Société Civile Immobilière.\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.",
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
      "Organisation et transmission des documents comptables :\n▪ Périodicité : {{frequence}} – Avant le J+10\n▪ Transmission via notre outil : GRIMY\n\nCompte tenu de la nature patrimoniale de votre SCI, nous vous invitons à nous transmettre systématiquement les avis d'imposition (taxe foncière, CFE), les relevés bancaires, les quittances de loyer, les appels de charges de copropriété et tout acte notarié relatif au patrimoine immobilier.\n\nDurée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires.",
    type: "fixed",
    editable: true,
  },
  {
    id: "mission",
    title: "Notre mission",
    content:
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable, de la norme professionnelle de maîtrise de la qualité (NPMQ) et de la norme professionnelle applicable aux missions de présentation des comptes (NPLAB, arrêté du 13 février 2019).\n\nNotre mission portera sur les travaux suivants :\n\n▪ Tenue de la comptabilité de la SCI conformément au plan comptable applicable ;\n▪ Suivi des loyers encaissés, des charges locatives et des charges de copropriété ;\n▪ Rapprochement bancaire périodique ;\n▪ Établissement des comptes annuels (bilan, compte de résultat, annexe) ;\n▪ Détermination du résultat fiscal et répartition entre les associés au prorata de leurs parts ;\n▪ Établissement et télétransmission de la déclaration de résultats n° 2072 (revenus fonciers des SCI non soumises à l'IS) ou n° 2065 le cas échéant ;\n▪ Suivi des obligations déclaratives relatives à la Cotisation Foncière des Entreprises (CFE) ;\n▪ Suivi de la taxe foncière et des éventuels dégrèvements.\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes.\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre société. Elle n'a pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.\n\nConformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de la société.",
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
      "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre SCI. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités, toutefois nous vous en informerions le cas échéant.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par sondages.\n\nS'agissant d'une SCI à caractère patrimonial, notre mission ne porte pas sur l'évaluation des biens immobiliers inscrits à l'actif, dont la responsabilité incombe à la gérance.",
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
    id: "lcbft_sci_specifique",
    title: "Vigilance spécifique SCI",
    content:
      "En complément des obligations générales LCB-FT, nous attirons votre attention sur les facteurs de risque spécifiques aux Sociétés Civiles Immobilières identifiés par les lignes directrices du Conseil de l'Ordre des Experts-Comptables et par TRACFIN :\n\n▪ Opacité potentielle de la chaîne de détention : identification de l'ensemble des associés et des bénéficiaires effectifs au sens de l'art. L.561-2-2 CMF ;\n▪ Risque de blanchiment par le vecteur immobilier : vérification de l'origine des fonds lors des acquisitions, des apports en compte courant d'associés et des augmentations de capital ;\n▪ Opérations atypiques : cessions de parts à des conditions inhabituelles, loyers manifestement sous-évalués ou surévalués, flux financiers sans cohérence économique avec l'activité patrimoniale.\n\nNous vous demanderons de nous fournir tout justificatif permettant de documenter l'origine licite des fonds transitant par la SCI.",
    type: "fixed",
    editable: true,
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
    id: "mission_juridique",
    title: "Mission de secrétariat juridique annuel",
    content:
      "La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux prévus par les articles 1856 et suivants du Code civil.\n\nElle comprend :\n▪ La préparation et la rédaction de la convocation à l'assemblée générale ordinaire annuelle ;\n▪ La rédaction du procès-verbal d'approbation des comptes annuels et d'affectation du résultat ;\n▪ La tenue et la mise à jour du registre des décisions des associés ;\n▪ Le cas échéant, la rédaction des actes relatifs aux décisions extraordinaires (modification statutaire, cession de parts, etc.).\n\nLa responsabilité de la convocation effective des associés dans les formes et délais statutaires incombe au gérant.",
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
    content:
      "TABLEAU_REPARTITION_SCI\n\nTravaux à la charge du cabinet :\n▪ Enregistrement des écritures comptables courantes\n▪ Rapprochement bancaire\n▪ Établissement des comptes annuels\n▪ Déclaration fiscale 2072 / 2065\n▪ Répartition du résultat entre associés\n▪ Déclaration de CFE\n\nTravaux à la charge du client :\n▪ Transmission des relevés bancaires et pièces justificatives\n▪ Transmission des baux, avenants et quittances\n▪ Transmission des appels de charges et décomptes de copropriété\n▪ Communication des avis de taxe foncière et CFE\n▪ Fourniture de l'état civil à jour des associés et bénéficiaires effectifs\n▪ Information sur toute cession de parts ou modification de la répartition du capital",
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
      "{{raison_sociale}}, représentée par {{dirigeant}}, gérant(e) ayant tous pouvoirs à cet effet, déclare autoriser {{nom_cabinet}} à télétransmettre chaque année sur le portail jedéclare.com la déclaration de résultats n° 2072 (ou n° 2065 le cas échéant) qui la concerne.",
    type: "annexe",
    editable: true,
  },
  {
    id: "annexe_cgv",
    title: "Annexe — Conditions Générales d'Intervention",
    content:
      "Conditions générales en vigueur au 15 Mars 2026\n\n1. Domaine d'application\nLes présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.\n\n2. Définition de la mission\nLes travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes.\n\n3. Résiliation de la mission\nLa mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.\nPour les clients ayant la qualité de consommateur ou de non-professionnel au sens de l'article liminaire du Code de la consommation : conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat. À défaut, le client pourra mettre gratuitement un terme au contrat à tout moment à compter de la date de reconduction.\n\n4. Suspension de la mission\nLes délais de délivrance sont prolongés pour une durée égale à celle de la suspension.\n\n5. Obligations du professionnel\nLe professionnel effectue la mission conformément au Code de déontologie et aux normes NPMQ/NPLAB. Secret professionnel et discrétion assurés.\n\n6. Obligations du client\nLe client s'engage à fournir les documents d'identification KYC (CNI, Kbis, statuts à jour, liste des associés et bénéficiaires effectifs), à mettre à disposition les pièces comptables dans les délais, et à porter à connaissance tout fait nouveau, notamment toute modification de la répartition du capital social.\n\n7. Honoraires\nLes honoraires sont payés par prélèvement à leur échéance. Pénalités de retard au taux BCE + 10 points. Indemnité forfaitaire de 40 € pour frais de recouvrement.\n\n8. Responsabilité civile\nCouverte par contrat MMA IARD. Prescription réduite à 1 an. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation ; les délais de prescription de droit commun s'appliquent alors (article L 218-1 du Code de la consommation).\n\n9. Données personnelles\nTraitement conforme RGPD. Conservation 5 ans après fin de mission.\n\n10. Différends\nEn cas de contestation des conditions d'exercice de la mission ou de différend sur les honoraires, les parties s'engagent, préalablement à toute action en justice, à saisir le président du CROEC compétent aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso). Tribunal de commerce compétent.\n\n11. Non-sollicitation des collaborateurs\nLe client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres d'exécuter des missions en leur nom propre ou de devenir salarié du client, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.\n\n12. Conservation des données LCB-FT\nLe cabinet collecte des données d'identification pour respecter ses obligations LCB-FT. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.",
    type: "annexe",
    editable: true,
  },
];

// ──────────────────────────────────────────────
// Modèle LMNP — Loueur Meublé Non Professionnel
// ──────────────────────────────────────────────

export const LMNP_TEMPLATE: TemplateSection[] = [
  {
    id: "destinataire",
    title: "Destinataire",
    content:
      "À l'attention de {{formule_politesse}} {{dirigeant}},\n{{adresse}} {{code_postal}} {{ville}}\n\nN° SIRET : {{siren}}",
    type: "fixed",
    editable: false,
  },
  {
    id: "introduction",
    title: "Introduction",
    content:
      "Nous vous remercions de la confiance que vous nous avez témoignée en envisageant de nous confier, en qualité d'expert-comptable, une mission portant sur la déclaration de vos revenus de location meublée non professionnelle (LMNP).\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.\n\nVotre activité de location meublée non professionnelle relève de la catégorie des Bénéfices Industriels et Commerciaux (BIC) au sens de l'article 35 bis du Code Général des Impôts.",
    type: "fixed",
    editable: true,
  },
  {
    id: "entite",
    title: "Votre activité",
    content: "TABLEAU_ENTITE",
    type: "fixed",
    editable: false,
  },
  {
    id: "regime_fiscal",
    title: "Régime fiscal applicable",
    content:
      "Régime fiscal retenu pour l'exercice :\n\n☐ Micro-BIC (art. 50-0 CGI) — Abattement forfaitaire de 50 % (ou 71 % pour les meublés de tourisme classés). Ce régime ne nécessite pas la tenue d'une comptabilité complète ; notre mission se limitera à l'assistance déclarative.\n\n☐ Réel simplifié (art. 302 septies A bis CGI) — Tenue d'une comptabilité d'engagement, établissement d'une liasse fiscale BIC (formulaires 2031 et 2033-A à 2033-G), calcul et suivi des amortissements.\n\nLe choix du régime réel simplifié est irrévocable pour une durée minimale de deux ans en application de l'article 50-0 al. 4 du CGI.",
    type: "fixed",
    editable: true,
  },
  {
    id: "organisation",
    title: "Organisation et transmission",
    content:
      "Organisation et transmission des documents :\n▪ Périodicité : {{frequence}}\n▪ Transmission via notre outil : GRIMY\n\nVous veillerez à nous transmettre l'ensemble des pièces suivantes : relevés bancaires du compte dédié à l'activité, factures d'acquisition et de travaux, quittances de loyer, tableaux d'amortissement d'emprunt, avis de taxe foncière et de CFE, ainsi que tout document relatif aux charges déductibles.\n\nDurée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires.",
    type: "fixed",
    editable: true,
  },
  {
    id: "mission",
    title: "Notre mission",
    content:
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable, de la norme professionnelle de maîtrise de la qualité (NPMQ) et de la norme professionnelle applicable aux missions de présentation des comptes (NPLAB, arrêté du 13 février 2019).\n\nDans le cadre du régime réel simplifié, notre mission portera sur les travaux suivants :\n\n▪ Tenue de la comptabilité de votre activité LMNP ;\n▪ Enregistrement des recettes locatives et des charges déductibles ;\n▪ Calcul et suivi du tableau des amortissements des biens immobiliers, du mobilier et des travaux (conformément aux usages BIC et aux articles 39 et suivants du CGI) ;\n▪ Établissement des comptes annuels simplifiés ;\n▪ Établissement et télétransmission de la liasse fiscale BIC (formulaires 2031 et 2033-A à 2033-G) ;\n▪ Suivi de la Cotisation Foncière des Entreprises (CFE) ;\n▪ Le cas échéant, établissement des déclarations de TVA si l'activité y est assujettie (locations de courte durée, parahôtellerie) ;\n▪ Le cas échéant, calcul de la CVAE si le chiffre d'affaires dépasse le seuil d'assujettissement.\n\nDans le cadre du micro-BIC, notre mission se limitera à :\n▪ L'assistance au remplissage de la déclaration complémentaire de revenus n° 2042 C PRO ;\n▪ Le suivi de la CFE.\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité. Elle n'a pas pour objectif de déceler les fraudes ou les actes illégaux. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.",
    type: "fixed",
    editable: true,
  },
  {
    id: "amortissements",
    title: "Suivi des amortissements",
    content:
      "Le suivi des amortissements constitue un livrable essentiel de notre mission en régime réel simplifié. Nous établirons et tiendrons à jour un tableau des amortissements détaillé comprenant :\n\n▪ Amortissement du bien immobilier par composants (gros œuvre, toiture, installations techniques, agencements) conformément à l'article 39 C du CGI ;\n▪ Amortissement du mobilier et des équipements ;\n▪ Amortissement des travaux d'amélioration et de rénovation ;\n▪ Suivi du plafonnement de l'amortissement déductible (l'amortissement ne peut créer de déficit BIC, article 39 C II du CGI).\n\nCe tableau vous sera remis chaque année avec les comptes annuels et la liasse fiscale.",
    type: "fixed",
    editable: true,
  },
  {
    id: "duree",
    title: "Durée de la mission",
    content:
      "Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera sur les revenus de l'exercice commençant le {{date_du_jour}} et se terminant le {{date_cloture}}.\n\nCette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation, de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions Générales d'Intervention.",
    type: "fixed",
    editable: true,
  },
  {
    id: "nature_limite",
    title: "Nature et limite de la mission",
    content:
      "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des éléments déclaratifs relatifs à votre activité de location meublée. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités, toutefois nous vous en informerions le cas échéant.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. La responsabilité de la sincérité et de l'exhaustivité des informations transmises vous incombe en qualité de contribuable.\n\nNotre mission ne porte pas sur l'évaluation des biens immobiliers, ni sur le conseil en investissement immobilier ou en gestion locative.",
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
    id: "lcbft_lmnp_specifique",
    title: "Vigilance spécifique LMNP",
    content:
      "En complément des obligations générales LCB-FT, nous attirons votre attention sur les points de vigilance spécifiques à l'activité de location meublée non professionnelle :\n\n▪ Origine des fonds d'acquisition : justification de l'apport personnel et des financements bancaires lors de l'acquisition du ou des biens meublés ;\n▪ Cohérence des flux financiers : adéquation entre les loyers perçus et les prix de marché constatés, détection de toute anomalie dans les encaissements (paiements en espèces inhabituels, virements de provenance non identifiée) ;\n▪ Identification du bailleur : conformément à l'art. L.561-5 CMF, vérification de votre identité et de votre domicile sur la base de documents probants.\n\nNous pourrons être amenés à vous demander tout justificatif complémentaire relatif à l'origine des fonds investis dans votre activité locative.",
    type: "fixed",
    editable: true,
  },
  {
    id: "mission_fiscal",
    title: "Mission d'assistance au contrôle fiscal (SUR OPTION)",
    content:
      "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle portant sur votre activité de location meublée.\n\nAfin de mutualiser le risque, nous mettons en place une garantie :\n☐ Option A : limite de 5 000 € HT/an — 25 € HT/mois\n☐ Option B : limite de 2 500 € HT/an — 10 € HT/mois\n☐ Renonce à la souscription",
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
    content:
      "TABLEAU_REPARTITION_LMNP\n\nTravaux à la charge du cabinet :\n▪ Enregistrement des écritures comptables\n▪ Calcul et suivi du tableau des amortissements\n▪ Établissement de la liasse fiscale 2031/2033\n▪ Télétransmission des déclarations\n▪ Suivi CFE / TVA le cas échéant\n\nTravaux à la charge du client :\n▪ Transmission des relevés bancaires\n▪ Transmission des quittances de loyer et baux\n▪ Transmission des factures de charges, travaux et acquisitions de mobilier\n▪ Transmission des tableaux d'amortissement d'emprunt\n▪ Communication des avis de taxe foncière et CFE\n▪ Information sur toute acquisition ou cession de bien\n▪ Fourniture d'une pièce d'identité et d'un justificatif de domicile à jour",
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
      "{{dirigeant}}, exerçant une activité de location meublée non professionnelle sous le n° SIRET {{siren}}, déclare autoriser {{nom_cabinet}} à télétransmettre chaque année sur le portail jedéclare.com la liasse fiscale BIC (formulaires 2031 et 2033) qui le/la concerne.",
    type: "annexe",
    editable: true,
  },
  {
    id: "annexe_cgv",
    title: "Annexe — Conditions Générales d'Intervention",
    content:
      "Conditions générales en vigueur au 15 Mars 2026\n\n1. Domaine d'application\nLes présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.\n\n2. Définition de la mission\nLes travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes.\n\n3. Résiliation de la mission\nLa mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.\nPour les clients ayant la qualité de consommateur ou de non-professionnel au sens de l'article liminaire du Code de la consommation : conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat. À défaut, le client pourra mettre gratuitement un terme au contrat à tout moment à compter de la date de reconduction.\n\n4. Suspension de la mission\nLes délais de délivrance sont prolongés pour une durée égale à celle de la suspension.\n\n5. Obligations du professionnel\nLe professionnel effectue la mission conformément au Code de déontologie et aux normes NPMQ/NPLAB. Secret professionnel et discrétion assurés.\n\n6. Obligations du client\nLe client s'engage à fournir les documents d'identification (CNI, justificatif de domicile), à mettre à disposition les pièces comptables dans les délais, et à porter à connaissance tout fait nouveau relatif à son activité de location meublée.\n\n7. Honoraires\nLes honoraires sont payés par prélèvement à leur échéance. Pénalités de retard au taux BCE + 10 points. Indemnité forfaitaire de 40 € pour frais de recouvrement.\n\n8. Responsabilité civile\nCouverte par contrat MMA IARD. Prescription réduite à 1 an. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation ; les délais de prescription de droit commun s'appliquent alors (article L 218-1 du Code de la consommation).\n\n9. Données personnelles\nTraitement conforme RGPD. Conservation 5 ans après fin de mission.\n\n10. Différends\nEn cas de contestation des conditions d'exercice de la mission ou de différend sur les honoraires, les parties s'engagent, préalablement à toute action en justice, à saisir le président du CROEC compétent aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso). Tribunal de commerce compétent.\n\n11. Non-sollicitation des collaborateurs\nLe client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres d'exécuter des missions en leur nom propre ou de devenir salarié du client, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.\n\n12. Conservation des données LCB-FT\nLe cabinet collecte des données d'identification pour respecter ses obligations LCB-FT. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.",
    type: "annexe",
    editable: true,
  },
];

// ──────────────────────────────────────────────
// Presets — Modèles prédéfinis
// ──────────────────────────────────────────────

export const TEMPLATE_PRESETS: Record<string, { label: string; description: string; template: TemplateSection[] }> = {
  default: { label: "Standard", description: "Modèle standard pour SARL, SAS, EURL, EI...", template: DEFAULT_TEMPLATE },
  sci: { label: "SCI", description: "Société Civile Immobilière — Gestion patrimoniale", template: SCI_TEMPLATE },
  lmnp: { label: "LMNP", description: "Loueur Meublé Non Professionnel — Location meublée", template: LMNP_TEMPLATE },
};

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
