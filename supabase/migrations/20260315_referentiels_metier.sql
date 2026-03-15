-- =============================================
-- Référentiels métier paramétrables — Phase 1
-- Tables: ref_missions, ref_types_juridiques
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Table ref_missions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ref_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid,
  code text NOT NULL,
  libelle text NOT NULL,
  type_mission text NOT NULL,
  description text,
  niveau_risque text NOT NULL DEFAULT 'Moyen'
    CHECK (niveau_risque IN ('Faible', 'Moyen', 'Élevé')),
  score integer NOT NULL DEFAULT 25
    CHECK (score BETWEEN 0 AND 100),
  parametres_pilotes boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cabinet_id, code)
);

-- ─────────────────────────────────────────────
-- 2. Table ref_types_juridiques
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ref_types_juridiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid,
  code text NOT NULL,
  libelle text NOT NULL,
  type_client text NOT NULL
    CHECK (type_client IN ('Personne morale', 'Personne physique')),
  description text,
  niveau_risque text NOT NULL DEFAULT 'Moyen'
    CHECK (niveau_risque IN ('Faible', 'Moyen', 'Élevé')),
  score integer NOT NULL DEFAULT 20
    CHECK (score BETWEEN 0 AND 100),
  parametres_pilotes boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cabinet_id, code)
);

-- ─────────────────────────────────────────────
-- 3. RLS — Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.ref_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_types_juridiques ENABLE ROW LEVEL SECURITY;

-- ref_missions: lecture/écriture sur les lignes du cabinet OU les lignes template (cabinet_id IS NULL)
CREATE POLICY "ref_missions_select"
  ON public.ref_missions FOR SELECT
  USING (
    cabinet_id IS NULL
    OR cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_missions_insert"
  ON public.ref_missions FOR INSERT
  WITH CHECK (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_missions_update"
  ON public.ref_missions FOR UPDATE
  USING (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_missions_delete"
  ON public.ref_missions FOR DELETE
  USING (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

-- ref_types_juridiques: même logique
CREATE POLICY "ref_types_juridiques_select"
  ON public.ref_types_juridiques FOR SELECT
  USING (
    cabinet_id IS NULL
    OR cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_types_juridiques_insert"
  ON public.ref_types_juridiques FOR INSERT
  WITH CHECK (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_types_juridiques_update"
  ON public.ref_types_juridiques FOR UPDATE
  USING (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ref_types_juridiques_delete"
  ON public.ref_types_juridiques FOR DELETE
  USING (
    cabinet_id = (SELECT cabinet_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 4. Trigger auto_fill_cabinet_id
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_fill_cabinet_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.cabinet_id IS NULL THEN
    SELECT cabinet_id INTO NEW.cabinet_id
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_fill_cabinet_id_ref_missions
  BEFORE INSERT ON public.ref_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_cabinet_id();

CREATE TRIGGER auto_fill_cabinet_id_ref_types_juridiques
  BEFORE INSERT ON public.ref_types_juridiques
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_cabinet_id();

-- ─────────────────────────────────────────────
-- 5. Données de seed (cabinet_id = NULL → template)
-- ─────────────────────────────────────────────

-- 5a. ref_missions — 31 missions KANTA
INSERT INTO public.ref_missions (cabinet_id, code, libelle, type_mission, niveau_risque, score, is_default) VALUES
  (NULL, 'PRESENTATION_COMPTES_ANNUELS',         'Présentation des comptes annuels',                              'Mission d''assurance sur les comptes complets historiques', 'Moyen', 25,  true),
  (NULL, 'EXAMEN_LIMITE_COMPTES_ANNUELS',         'Examen limité des comptes annuels',                             'Mission d''assurance sur les comptes complets historiques', 'Moyen', 25,  true),
  (NULL, 'AUDIT_ETATS_FINANCIERS',                'Audit des états financiers',                                    'Mission d''assurance sur les comptes complets historiques', 'Moyen', 30,  true),
  (NULL, 'AUDIT_PE',                              'Audit PE',                                                      'Mission d''assurance sur les comptes complets historiques', 'Élevé', 60,  true),
  (NULL, 'ATTESTATIONS_PARTICULIERES',            'Attestations particulières',                                    'Autres missions d''assurance',                              'Moyen', 25,  true),
  (NULL, 'INFO_FINANCIERES_PREVISIONNELLES',      'Informations financières prévisionnelles',                      'Autres missions d''assurance',                              'Faible', 10, true),
  (NULL, 'CONSULTATION_CSE',                      'Consultation du CSE',                                           'Missions légales',                                          'Élevé', 60,  true),
  (NULL, 'PRESENTATION_COMPTES_CSE',              'Présentation des comptes du CSE',                               'Missions légales',                                          'Moyen', 25,  true),
  (NULL, 'COMPTES_CAMPAGNE',                      'Comptes de campagne',                                           'Missions légales',                                          'Élevé', 70,  true),
  (NULL, 'VISA_FISCAL',                           'Visa fiscal',                                                   'Missions légales',                                          'Élevé', 60,  true),
  (NULL, 'AFFECTATION_PATRIMOINE_EIRL',           'Affectation du patrimoine de l''EIRL',                          'Missions légales',                                          'Faible', 10, true),
  (NULL, 'TIERS_DE_CONFIANCE',                    'Tiers de confiance',                                            'Missions légales',                                          'Élevé', 80,  true),
  (NULL, 'TENUE_COMPTABLE',                       'Tenue comptable',                                               'Autres prestations',                                        'Moyen', 10,  true),
  (NULL, 'CONSEIL_PATRIMONIAL',                   'Conseil Patrimonial',                                           'Autres prestations',                                        'Élevé', 60,  true),
  (NULL, 'CREATION_ENTREPRISE_SUP_50K',           'Création d''entreprise (fonds propres > 50k€)',                  'Autres prestations',                                        'Élevé', 60,  true),
  (NULL, 'CREATION_ENTREPRISE_INF_50K',           'Création d''entreprise (fonds propres < 50k€)',                  'Autres prestations',                                        'Moyen', 30,  true),
  (NULL, 'EVALUATION_ENTREPRISE',                 'Evaluation d''entreprise',                                      'Autres prestations',                                        'Faible', 10, true),
  (NULL, 'FINANCEMENT_INF_100K',                  'Financement (<100k€ par apporteur)',                             'Autres prestations',                                        'Moyen', 25,  true),
  (NULL, 'FINANCEMENT_SUP_100K',                  'Financement (>100k€ par apporteur)',                             'Autres prestations',                                        'Élevé', 70,  true),
  (NULL, 'DEV_DURABLE_RSE',                       'Mission de développement durable et RSE',                       'Autres prestations',                                        'Faible', 5,  true),
  (NULL, 'MISSION_SOCIALE',                       'Mission sociale',                                               'Autres prestations',                                        'Faible', 10, true),
  (NULL, 'TRANSMISSION_CESSION',                  'Transmission / Cession',                                        'Autres prestations',                                        'Élevé', 60,  true),
  (NULL, 'ENTREPRISE_EN_DIFFICULTE',              'Entreprise en difficulté',                                      'Autres prestations',                                        'Élevé', 70,  true),
  (NULL, 'DECLARATIONS_FISCALES_PERSO',           'Déclarations fiscales personnelles',                            'Autres prestations',                                        'Moyen', 20,  true),
  (NULL, 'MANDAT_GESTION_DETTES_CREANCES',        'Mandat de gestion amiable des dettes et créances',              'Autres prestations',                                        'Élevé', 70,  true),
  (NULL, 'PAIEMENT_DETTES_FOURNISSEURS',          'Paiement des dettes fournisseurs',                              'Autres prestations',                                        'Élevé', 70,  true),
  (NULL, 'RECOUVREMENT_AMIABLE_CREANCES',         'Recouvrement amiable des créances',                             'Autres prestations',                                        'Élevé', 70,  true),
  (NULL, 'TUP_TRANSNATIONALE',                    'TUP transnationale',                                            'Autres prestations',                                        'Élevé', 80,  true),
  (NULL, 'DOMICILIATION',                         'Domiciliation',                                                 'Autres prestations',                                        'Élevé', 80,  true),
  (NULL, 'MISSION_JURIDIQUE',                     'Mission juridique',                                             'Missions sans assurance',                                   'Moyen', 25,  true),
  (NULL, 'AUDIT_LEGAL',                           'Audit Legal',                                                   'Commissaire au compte',                                     'Moyen', 30,  true),
  (NULL, 'SERVICE_AUTRE_CERTIFICATION',           'Service autre que la certification des comptes',                'Commissaire au compte',                                     'Élevé', 60,  true);

-- 5b. ref_types_juridiques — 17 types KANTA
INSERT INTO public.ref_types_juridiques (cabinet_id, code, libelle, type_client, niveau_risque, score, is_default) VALUES
  (NULL, 'SARL',   'Société à responsabilité limitée',                          'Personne morale',    'Moyen', 20,  true),
  (NULL, 'EURL',   'Entreprise unipersonnelle à responsabilité limitée',        'Personne morale',    'Moyen', 20,  true),
  (NULL, 'SAS',    'Société par actions simplifiée',                            'Personne morale',    'Moyen', 40,  true),
  (NULL, 'SASU',   'Société par actions simplifiée unipersonnelle',             'Personne morale',    'Moyen', 40,  true),
  (NULL, 'SA',     'Société anonyme',                                           'Personne morale',    'Moyen', 40,  true),
  (NULL, 'SNC',    'Société en nom collectif',                                  'Personne morale',    'Élevé', 60,  true),
  (NULL, 'SCI',    'Société civile immobilière',                                'Personne morale',    'Moyen', 35,  true),
  (NULL, 'SC',     'Société civile',                                            'Personne morale',    'Moyen', 30,  true),
  (NULL, 'EI',     'Entreprise Individuelle',                                   'Personne physique',  'Moyen', 0,   true),
  (NULL, 'ASSO',   'Association',                                               'Personne morale',    'Élevé', 50,  true),
  (NULL, 'CSE',    'Comité social et économique',                               'Personne morale',    'Élevé', 60,  true),
  (NULL, 'SCCV',   'Société civile de construction vente',                      'Personne morale',    'Élevé', 70,  true),
  (NULL, 'SELAS',  'Société d''exercice libérale par actions simplifiée',       'Personne morale',    'Moyen', 30,  true),
  (NULL, 'SELARL', 'Société d''exercice libéral à responsabilité limitée',      'Personne morale',    'Moyen', 30,  true),
  (NULL, 'EARL',   'Entreprise Agricole à Responsabilité Limitée',              'Personne morale',    'Moyen', 20,  true),
  (NULL, 'GAEC',   'Groupement agricole d''exploitation en commun',             'Personne morale',    'Élevé', 60,  true),
  (NULL, 'PART',   'Particulier',                                               'Personne physique',  'Moyen', 20,  true);
