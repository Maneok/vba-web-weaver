// LCB-FT Templates — Textes complets par niveau de vigilance

export interface LcbftTemplate {
  titre: string;
  corps: string;
  obligations_client: string[];
  consequences_non_conformite: string[];
  frequence_revue: string;
}

export const LCBFT_SIMPLIFIEE: LcbftTemplate = {
  titre: "Obligations LCB-FT — Vigilance Simplifiée",
  corps: `Conformément aux articles L.561-2 et L.561-9 du Code monétaire et financier, notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de la vigilance simplifiée applicable à votre dossier, nous procédons aux mesures suivantes :

1. Identification du client (art. L.561-5 CMF) : recueil des éléments d'identification de la personne morale (dénomination, forme juridique, numéro SIREN, adresse du siège social) et de son représentant légal.

2. Vérification de l'identité (art. L.561-5-1 CMF) : contrôle des éléments d'identification sur présentation de tout document écrit probant (extrait Kbis, pièce d'identité du dirigeant).

3. Identification du bénéficiaire effectif (art. L.561-2-2 CMF) : identification des personnes physiques qui détiennent, directement ou indirectement, plus de 25 % du capital ou des droits de vote, ou qui exercent un contrôle sur la direction.

4. Examen périodique (art. L.561-6 CMF) : mise à jour des éléments d'identification tous les 3 ans.

Le niveau de vigilance simplifiée a été retenu au regard de la nature de l'activité, de la forme juridique et de l'analyse des risques effectuée conformément à l'approche par les risques prévue par la réglementation.`,
  obligations_client: [
    "Fournir un extrait Kbis de moins de 3 mois",
    "Fournir une copie de la pièce d'identité en cours de validité du dirigeant",
    "Informer le cabinet de tout changement de bénéficiaire effectif",
    "Répondre aux demandes de mise à jour des informations dans un délai raisonnable",
  ],
  consequences_non_conformite: [
    "Impossibilité de poursuivre la mission en l'absence des documents d'identification requis",
    "Obligation pour le cabinet de procéder à une déclaration de soupçon auprès de Tracfin en cas de doute",
  ],
  frequence_revue: "Tous les 3 ans",
};

export const LCBFT_STANDARD: LcbftTemplate = {
  titre: "Obligations LCB-FT — Vigilance Standard",
  corps: `Conformément aux articles L.561-2 et L.561-5 à L.561-14-2 du Code monétaire et financier, notre cabinet est soumis aux obligations de vigilance standard en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de cette vigilance, nous mettons en œuvre les mesures suivantes :

1. Identification et vérification de l'identité du client (art. L.561-5 et L.561-5-1 CMF) : recueil et contrôle de l'ensemble des éléments d'identification de la personne morale et de son représentant légal sur la base de documents probants (extrait Kbis, statuts, pièce d'identité).

2. Identification du bénéficiaire effectif (art. L.561-2-2 CMF) : identification de toutes les personnes physiques détenant directement ou indirectement plus de 25 % du capital ou des droits de vote, ou exerçant un pouvoir de contrôle sur la direction. Vérification sur la base des statuts et du registre des bénéficiaires effectifs (RBE).

3. Connaissance de la relation d'affaires (art. L.561-6 CMF) : recueil d'informations sur l'objet et la nature de la relation d'affaires, ainsi que sur la situation financière du client.

4. Vigilance constante (art. L.561-6 CMF) : exercice d'une vigilance constante sur la relation d'affaires, incluant un examen attentif des opérations effectuées afin de s'assurer qu'elles sont cohérentes avec la connaissance du client.

5. Examen périodique (art. L.561-6 CMF) : mise à jour des éléments d'identification et de connaissance du client tous les 2 ans.

6. Mise à jour régulière : actualisation des documents et informations en cas de changement significatif affectant la situation du client ou la nature de la relation d'affaires.`,
  obligations_client: [
    "Fournir un extrait Kbis de moins de 3 mois",
    "Fournir une copie des statuts à jour",
    "Fournir une copie de la pièce d'identité en cours de validité du dirigeant",
    "Fournir un relevé d'identité bancaire (RIB)",
    "Communiquer toute modification des bénéficiaires effectifs dans un délai de 30 jours",
    "Informer le cabinet de tout changement significatif (activité, structure, dirigeants)",
    "Répondre aux demandes de mise à jour des informations sous 15 jours",
  ],
  consequences_non_conformite: [
    "Impossibilité de poursuivre la mission en l'absence des documents d'identification requis (art. L.561-8 CMF)",
    "Obligation pour le cabinet de procéder à une déclaration de soupçon auprès de Tracfin en cas de doute (art. L.561-15 CMF)",
    "Suspension possible de l'exécution de la mission jusqu'à réception des documents manquants",
  ],
  frequence_revue: "Tous les 2 ans",
};

export const LCBFT_RENFORCEE: LcbftTemplate = {
  titre: "Obligations LCB-FT — Vigilance Renforcée",
  corps: `Conformément aux articles L.561-2, L.561-10 et L.561-10-2 du Code monétaire et financier, votre dossier fait l'objet de mesures de vigilance renforcée en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Les mesures de vigilance renforcée sont mises en œuvre en raison d'un ou plusieurs facteurs de risque identifiés lors de notre analyse (activité à risque, exposition géographique, structure complexe, personne politiquement exposée, ou tout autre élément justifiant un niveau de vigilance accru).

Dans ce cadre, nous procédons aux mesures suivantes :

1. Identification approfondie du client et du bénéficiaire effectif (art. L.561-10 CMF) : recueil renforcé des éléments d'identification, incluant l'ensemble de la chaîne de détention et de contrôle, l'organigramme du groupe le cas échéant, et la vérification de l'identité de chaque bénéficiaire effectif.

2. Obtention d'informations sur l'origine des fonds (art. L.561-10 CMF) : collecte de justificatifs relatifs à l'origine des fonds et des ressources impliqués dans la relation d'affaires.

3. Suivi renforcé et continu (art. L.561-10-2 CMF) : exercice d'une surveillance renforcée et continue de la relation d'affaires, avec un examen annuel minimum de l'ensemble du dossier et des opérations réalisées.

4. Examen approfondi des opérations complexes ou inhabituelles (art. L.561-10-2 CMF) : analyse détaillée de toute opération paraissant complexe, d'un montant inhabituellement élevé, ou ne paraissant pas avoir de justification économique.

5. Fin possible de la relation d'affaires (art. L.561-8 CMF) : en cas d'impossibilité de mettre en œuvre les mesures de vigilance renforcée, ou en cas de doute persistant sur l'identité du client ou la licéité des opérations, le cabinet se réserve le droit de mettre fin à la relation d'affaires.`,
  obligations_client: [
    "Fournir un extrait Kbis de moins de 3 mois",
    "Fournir une copie des statuts à jour certifiée conforme",
    "Fournir une copie de la pièce d'identité en cours de validité du dirigeant",
    "Fournir une copie de la pièce d'identité de chaque bénéficiaire effectif",
    "Fournir un relevé d'identité bancaire (RIB)",
    "Fournir un justificatif de domicile du siège social de moins de 3 mois",
    "Fournir l'organigramme complet de la structure (groupe, filiales, participations)",
    "Fournir les justificatifs relatifs à l'origine des fonds",
    "Communiquer immédiatement toute modification des bénéficiaires effectifs",
    "Informer le cabinet sans délai de tout changement significatif",
    "Se soumettre aux demandes d'information complémentaires dans un délai de 10 jours",
  ],
  consequences_non_conformite: [
    "Impossibilité de poursuivre ou d'établir la relation d'affaires en l'absence des documents requis (art. L.561-8 CMF)",
    "Obligation pour le cabinet de procéder à une déclaration de soupçon auprès de Tracfin (art. L.561-15 CMF)",
    "Rupture de la relation d'affaires en cas d'impossibilité de mise en œuvre des mesures de vigilance renforcée",
    "Signalement au conseil de l'Ordre en cas de manquement grave aux obligations de coopération",
  ],
  frequence_revue: "Annuelle (minimum)",
};

export const LCBFT_TEMPLATES = {
  SIMPLIFIEE: LCBFT_SIMPLIFIEE,
  STANDARD: LCBFT_STANDARD,
  RENFORCEE: LCBFT_RENFORCEE,
} as const;
