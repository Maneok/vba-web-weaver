// NOTE: Currently unused — regulatory clauses are defined in lettreMissionVariables.ts VIGILANCE_TEXTES
// Bibliothèque de clauses réglementaires LCB-FT

export interface ClauseReglementaire {
  id: string;
  titre: string;
  texte: string;
  reference_legale: string;
  obligatoire: boolean;
}

export const CLAUSES_REGLEMENTAIRES: ClauseReglementaire[] = [
  {
    id: "cooperation",
    titre: "Clause de coopération",
    texte: `Le client s'engage à coopérer pleinement avec le cabinet dans le cadre de la mise en œuvre des obligations de vigilance prévues par le Code monétaire et financier. À ce titre, le client s'engage à :

- Fournir l'ensemble des documents et informations nécessaires à l'identification et à la vérification de son identité, ainsi qu'à celle de ses bénéficiaires effectifs ;
- Répondre dans les délais impartis à toute demande d'information complémentaire formulée par le cabinet ;
- Informer spontanément le cabinet de tout changement significatif affectant sa situation (modification des bénéficiaires effectifs, changement d'activité, modification de la structure de contrôle) ;
- Permettre au cabinet d'exercer sa vigilance constante sur la relation d'affaires.

Le défaut de coopération pourra conduire le cabinet à mettre fin à la relation d'affaires conformément aux dispositions de l'article L.561-8 du Code monétaire et financier.`,
    reference_legale: "Art. L.561-6 du Code monétaire et financier",
    obligatoire: true,
  },
  {
    id: "rupture_lcbft",
    titre: "Clause de rupture LCB-FT",
    texte: `Conformément à l'article L.561-8 du Code monétaire et financier, le cabinet se réserve le droit de ne pas établir ou de mettre fin à la relation d'affaires dans les cas suivants :

- Impossibilité d'identifier le client ou de vérifier son identité ;
- Impossibilité d'identifier les bénéficiaires effectifs ou de vérifier leur identité ;
- Impossibilité d'obtenir des informations sur l'objet et la nature de la relation d'affaires ;
- Impossibilité de mettre en œuvre les mesures de vigilance requises par le niveau de risque identifié ;
- Doute persistant sur l'identité du client ou du bénéficiaire effectif malgré les vérifications effectuées.

Dans ces hypothèses, le cabinet procédera, le cas échéant, à une déclaration de soupçon auprès de Tracfin conformément à l'article L.561-15 du Code monétaire et financier. La rupture de la relation d'affaires ne constitue pas une faute contractuelle du cabinet.`,
    reference_legale: "Art. L.561-8 du Code monétaire et financier",
    obligatoire: true,
  },
  {
    id: "secret_professionnel",
    titre: "Clause de secret professionnel et dérogation Tracfin",
    texte: `Le cabinet est tenu au secret professionnel conformément aux dispositions de l'article 226-13 du Code pénal et aux règles déontologiques de la profession.

Toutefois, en application des articles L.561-15 et L.561-22 du Code monétaire et financier, le cabinet est tenu de déclarer à Tracfin (Traitement du renseignement et action contre les circuits financiers clandestins) :

- Les sommes ou opérations dont il sait, soupçonne ou a de bonnes raisons de soupçonner qu'elles proviennent d'une infraction passible d'une peine privative de liberté supérieure à un an ou participent au financement du terrorisme ;
- Les sommes ou opérations dont il sait, soupçonne ou a de bonnes raisons de soupçonner qu'elles proviennent d'une fraude fiscale.

Cette obligation de déclaration constitue une dérogation légale au secret professionnel. Conformément à l'article L.561-19 du Code monétaire et financier, le cabinet ne peut en aucun cas informer le client ou des tiers de l'existence ou du contenu d'une déclaration de soupçon.

Le client est informé que le respect de cette obligation légale ne saurait engager la responsabilité du cabinet.`,
    reference_legale:
      "Art. 226-13 du Code pénal ; Art. L.561-15, L.561-19 et L.561-22 du Code monétaire et financier",
    obligatoire: true,
  },
  {
    id: "conservation_donnees",
    titre: "Clause de conservation des données",
    texte: `Conformément à l'article L.561-12 du Code monétaire et financier, le cabinet conserve pendant une durée de cinq ans à compter de la fin de la relation d'affaires :

- Les documents relatifs à l'identité du client et, le cas échéant, du bénéficiaire effectif (documents d'identification, copies de pièces d'identité, extraits Kbis, statuts) ;
- Les éléments d'information relatifs aux opérations réalisées dans le cadre de la relation d'affaires ;
- Les résultats de l'ensemble des analyses et examens réalisés dans le cadre des obligations de vigilance.

Ces documents sont conservés dans des conditions garantissant leur confidentialité et leur intégrité, conformément aux exigences de la réglementation en vigueur et du Règlement général sur la protection des données (RGPD).

À l'expiration du délai de conservation, les données sont détruites de manière sécurisée, sauf obligation légale de conservation plus longue.`,
    reference_legale: "Art. L.561-12 du Code monétaire et financier",
    obligatoire: true,
  },
  {
    id: "nplab",
    titre: "Clause NPLAB — Norme Professionnelle de Lutte Anti-Blanchiment",
    texte: `Le cabinet applique la Norme Professionnelle de Lutte Anti-Blanchiment (NPLAB) issue de l'arrêté du 13 février 2019, qui définit les obligations des experts-comptables et commissaires aux comptes en matière de LCB-FT.

Conformément à cette norme, le cabinet met en œuvre :

- Une classification des risques selon une approche par les risques, tenant compte des facteurs de risque liés au client, à l'activité, au pays et à la nature de la mission ;
- Des procédures internes de vigilance adaptées au niveau de risque identifié (simplifiée, standard ou renforcée) ;
- Une formation continue des collaborateurs aux obligations LCB-FT ;
- Un dispositif de contrôle interne et de suivi des obligations de vigilance ;
- Un correspondant Tracfin désigné au sein du cabinet.

Le client est informé que ces mesures s'inscrivent dans le cadre des obligations professionnelles du cabinet et ne constituent pas une mise en cause de sa probité.`,
    reference_legale:
      "Arrêté du 13 février 2019 portant homologation de la norme professionnelle de lutte anti-blanchiment",
    obligatoire: true,
  },
];

export function getClauseById(id: string): ClauseReglementaire | undefined {
  return CLAUSES_REGLEMENTAIRES.find((c) => c.id === id);
}

export function getClausesObligatoires(): ClauseReglementaire[] {
  return CLAUSES_REGLEMENTAIRES.filter((c) => c.obligatoire);
}
