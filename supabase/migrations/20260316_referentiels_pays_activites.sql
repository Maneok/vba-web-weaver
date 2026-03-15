-- =============================================
-- Migration: 20260315_referentiels_pays_activites.sql
-- Référentiels métier : pays, activités APE, questions KANTA
-- =============================================

-- NOTE: Do not use explicit BEGIN/COMMIT — Supabase migration runner wraps in its own transaction.

-- ============================================================================
-- 1. Table ref_pays
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ref_pays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid REFERENCES public.cabinets(id) ON DELETE CASCADE,
  code text NOT NULL,
  libelle text NOT NULL,
  libelle_nationalite text,
  description text,
  niveau_risque text NOT NULL DEFAULT 'Moyen' CHECK (niveau_risque IN ('Faible', 'Moyen', 'Élevé')),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  est_gafi_noir boolean DEFAULT false,
  est_gafi_gris boolean DEFAULT false,
  est_offshore boolean DEFAULT false,
  est_sanctionne boolean DEFAULT false,
  est_non_cooperatif boolean DEFAULT false,
  parametres_pilotes boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- UNIQUE constraint for non-null cabinet_id
ALTER TABLE public.ref_pays ADD CONSTRAINT ref_pays_cabinet_code_unique UNIQUE (cabinet_id, code);

-- Partial unique index for NULL cabinet_id (default rows)
CREATE UNIQUE INDEX ref_pays_code_default_unique ON public.ref_pays (code) WHERE cabinet_id IS NULL;

-- ============================================================================
-- 2. Table ref_activites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ref_activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid REFERENCES public.cabinets(id) ON DELETE CASCADE,
  code text NOT NULL,
  libelle text NOT NULL,
  description text,
  niveau_risque text NOT NULL DEFAULT 'Moyen' CHECK (niveau_risque IN ('Faible', 'Moyen', 'Élevé')),
  score integer NOT NULL DEFAULT 25 CHECK (score BETWEEN 0 AND 100),
  parametres_pilotes boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- UNIQUE constraint for non-null cabinet_id
ALTER TABLE public.ref_activites ADD CONSTRAINT ref_activites_cabinet_code_unique UNIQUE (cabinet_id, code);

-- Partial unique index for NULL cabinet_id (default rows)
CREATE UNIQUE INDEX ref_activites_code_default_unique ON public.ref_activites (code) WHERE cabinet_id IS NULL;

-- ============================================================================
-- 3. Table ref_questions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ref_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid REFERENCES public.cabinets(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  description text,
  reponse_risquee text,
  parametres_pilotes boolean DEFAULT true,
  ordre integer DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. RLS Policies (même politique que ref_missions)
-- ============================================================================

-- ref_pays RLS
ALTER TABLE public.ref_pays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture ref_pays : defaults + cabinet"
  ON public.ref_pays FOR SELECT
  TO authenticated
  USING (
    cabinet_id IS NULL
    OR cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Gestion ref_pays : propre cabinet"
  ON public.ref_pays FOR INSERT
  TO authenticated
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Modification ref_pays : propre cabinet"
  ON public.ref_pays FOR UPDATE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Suppression ref_pays : propre cabinet"
  ON public.ref_pays FOR DELETE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ref_activites RLS
ALTER TABLE public.ref_activites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture ref_activites : defaults + cabinet"
  ON public.ref_activites FOR SELECT
  TO authenticated
  USING (
    cabinet_id IS NULL
    OR cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Gestion ref_activites : propre cabinet"
  ON public.ref_activites FOR INSERT
  TO authenticated
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Modification ref_activites : propre cabinet"
  ON public.ref_activites FOR UPDATE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Suppression ref_activites : propre cabinet"
  ON public.ref_activites FOR DELETE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ref_questions RLS
ALTER TABLE public.ref_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture ref_questions : defaults + cabinet"
  ON public.ref_questions FOR SELECT
  TO authenticated
  USING (
    cabinet_id IS NULL
    OR cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Gestion ref_questions : propre cabinet"
  ON public.ref_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Modification ref_questions : propre cabinet"
  ON public.ref_questions FOR UPDATE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Suppression ref_questions : propre cabinet"
  ON public.ref_questions FOR DELETE
  TO authenticated
  USING (
    cabinet_id IS NOT NULL
    AND cabinet_id = (SELECT p.cabinet_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ============================================================================
-- 5. Seed data : ref_pays (260+ pays)
-- ============================================================================
-- Règles de classification :
--   "liste noire" ou "appel à action" → est_gafi_noir=true
--   "liste grise" ou "surveillance renforcée" → est_gafi_gris=true
--   "offshore" ou "extraterritoriale" → est_offshore=true
--   "sanctions" ou "embargos" → est_sanctionne=true
--   "non coopératifs" → est_non_cooperatif=true
--   Niveau "Élevé" → score=100
--   Niveau "Moyen" → score=0

INSERT INTO public.ref_pays (cabinet_id, code, libelle, libelle_nationalite, description, niveau_risque, score, est_gafi_noir, est_gafi_gris, est_offshore, est_sanctionne, est_non_cooperatif, is_default) VALUES
-- GAFI Liste noire (appel à action) — Élevé, score 100
(NULL, 'KP', 'Corée du Nord', 'Nord-Coréenne', 'Liste noire GAFI — appel à action renforcée, sanctions internationales, embargos ONU/UE', 'Élevé', 100, true, false, false, true, false, true),
(NULL, 'IR', 'Iran', 'Iranienne', 'Liste noire GAFI — appel à action, sanctions UE/ONU, embargos', 'Élevé', 100, true, false, false, true, false, true),
(NULL, 'MM', 'Myanmar', 'Birmane', 'Liste noire GAFI — appel à action, sanctions UE, embargos', 'Élevé', 100, true, false, false, true, false, true),

-- GAFI Liste grise (surveillance renforcée) — Élevé, score 100
(NULL, 'DZ', 'Algérie', 'Algérienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'AO', 'Angola', 'Angolaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'BG', 'Bulgarie', 'Bulgare', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'BF', 'Burkina Faso', 'Burkinabè', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'CM', 'Cameroun', 'Camerounaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'HR', 'Croatie', 'Croate', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'CD', 'Congo (RDC)', 'Congolaise (RDC)', 'Liste grise GAFI — surveillance renforcée, sanctions UE partielles', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'CI', 'Côte d''Ivoire', 'Ivoirienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'HT', 'Haïti', 'Haïtienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'KE', 'Kenya', 'Kényane', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'LA', 'Laos', 'Laotienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'LB', 'Liban', 'Libanaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'MC', 'Monaco', 'Monégasque', 'Liste grise GAFI — surveillance renforcée, centre financier offshore', 'Élevé', 100, false, true, true, false, false, true),
(NULL, 'MZ', 'Mozambique', 'Mozambicaine', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'NA', 'Namibie', 'Namibienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'NP', 'Népal', 'Népalaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'NG', 'Nigeria', 'Nigériane', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'PH', 'Philippines', 'Philippine', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'SN', 'Sénégal', 'Sénégalaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'SS', 'Soudan du Sud', 'Sud-Soudanaise', 'Liste grise GAFI — surveillance renforcée, sanctions UE, embargos', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'SY', 'Syrie', 'Syrienne', 'Liste grise GAFI — surveillance renforcée, sanctions UE/ONU, embargos', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'TZ', 'Tanzanie', 'Tanzanienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'VE', 'Venezuela', 'Vénézuélienne', 'Liste grise GAFI — surveillance renforcée, sanctions UE partielles', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'VN', 'Viêt Nam', 'Vietnamienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'YE', 'Yémen', 'Yéménite', 'Liste grise GAFI — surveillance renforcée, sanctions UE partielles', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'ML', 'Mali', 'Malienne', 'Liste grise GAFI — surveillance renforcée, sanctions UE partielles', 'Élevé', 100, false, true, false, true, false, true),
(NULL, 'JM', 'Jamaïque', 'Jamaïcaine', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'JO', 'Jordanie', 'Jordanienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'AL', 'Albanie', 'Albanaise', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'BB', 'Barbade', 'Barbadienne', 'Liste grise GAFI — surveillance renforcée, centre financier offshore', 'Élevé', 100, false, true, true, false, false, true),
(NULL, 'BO', 'Bolivie', 'Bolivienne', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'TR', 'Turquie', 'Turque', 'Liste grise GAFI — surveillance renforcée', 'Élevé', 100, false, true, false, false, false, true),
(NULL, 'PA', 'Panama', 'Panaméenne', 'Liste grise GAFI — surveillance renforcée, juridiction offshore, non coopératifs UE', 'Élevé', 100, false, true, true, false, true, true),

-- Pays sous sanctions UE/ONU (hors GAFI) — Élevé, score 100
(NULL, 'RU', 'Russie', 'Russe', 'Sanctions UE massives, embargos multiples', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'BY', 'Biélorussie', 'Biélorusse', 'Sanctions UE, embargos', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'CU', 'Cuba', 'Cubaine', 'Sanctions internationales, embargos', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'SD', 'Soudan', 'Soudanaise', 'Sanctions UE/ONU, embargos', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'SO', 'Somalie', 'Somalienne', 'Sanctions ONU, embargos sur les armes', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'ER', 'Érythrée', 'Érythréenne', 'Sanctions ONU', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'LY', 'Libye', 'Libyenne', 'Sanctions UE/ONU, embargos', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'CF', 'Centrafrique', 'Centrafricaine', 'Sanctions UE/ONU, embargos sur les armes', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'ZW', 'Zimbabwe', 'Zimbabwéenne', 'Sanctions UE partielles', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'NI', 'Nicaragua', 'Nicaraguayenne', 'Sanctions UE ciblées', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'BI', 'Burundi', 'Burundaise', 'Sanctions UE', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'IQ', 'Irak', 'Irakienne', 'Sanctions UE/ONU résiduelles', 'Élevé', 100, false, false, false, true, false, true),
(NULL, 'AF', 'Afghanistan', 'Afghane', 'Sanctions ONU, embargos, risque élevé blanchiment', 'Élevé', 100, false, false, false, true, false, true),

-- Juridictions offshore / non coopératives UE — Élevé, score 100
(NULL, 'VG', 'Îles Vierges britanniques', 'Des Îles Vierges brit.', 'Juridiction offshore, non coopératifs UE', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'VI', 'Îles Vierges américaines', 'Des Îles Vierges amér.', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'KY', 'Îles Caïmans', 'Des Îles Caïmans', 'Juridiction offshore, non coopératifs UE', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'BM', 'Bermudes', 'Bermudienne', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'GG', 'Guernesey', 'Guernesienne', 'Juridiction offshore extraterritoriale', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'JE', 'Jersey', 'Jersienne', 'Juridiction offshore extraterritoriale', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'IM', 'Île de Man', 'Mannoise', 'Juridiction offshore extraterritoriale', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'GI', 'Gibraltar', 'Gibraltarienne', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'TC', 'Îles Turques-et-Caïques', 'Des Îles Turques-et-Caïques', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'AS', 'Samoa américaines', 'Samoane amér.', 'Non coopératifs UE, juridiction offshore', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'WS', 'Samoa', 'Samoane', 'Non coopératifs UE', 'Élevé', 100, false, false, false, false, true, true),
(NULL, 'VU', 'Vanuatu', 'Vanuataise', 'Non coopératifs UE, juridiction offshore', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'FJ', 'Fidji', 'Fidjienne', 'Non coopératifs UE', 'Élevé', 100, false, false, false, false, true, true),
(NULL, 'PW', 'Palaos', 'Palauane', 'Non coopératifs UE', 'Élevé', 100, false, false, false, false, true, true),
(NULL, 'TT', 'Trinité-et-Tobago', 'Trinidadienne', 'Non coopératifs UE', 'Élevé', 100, false, false, false, false, true, true),
(NULL, 'GU', 'Guam', 'Guamanienne', 'Non coopératifs UE, juridiction offshore', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'AG', 'Antigua-et-Barbuda', 'Antiguaise', 'Juridiction offshore, non coopératifs UE', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'AI', 'Anguilla', 'Anguillaise', 'Juridiction offshore extraterritoriale', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'SC', 'Seychelles', 'Seychelloise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'BZ', 'Belize', 'Bélizienne', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'LI', 'Liechtenstein', 'Liechtensteinoise', 'Centre financier offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'MH', 'Îles Marshall', 'Marshallaise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'CW', 'Curaçao', 'Curaçaolaise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'SX', 'Sint Maarten', 'Sint-Maartinoise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'AW', 'Aruba', 'Arubaise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'BQ', 'Bonaire, Saint-Eustache et Saba', 'Bonairoise', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'MS', 'Montserrat', 'Montserratienne', 'Juridiction offshore extraterritoriale', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'CK', 'Îles Cook', 'Cookienne', 'Juridiction offshore, non coopératifs UE', 'Élevé', 100, false, false, true, false, true, true),
(NULL, 'NU', 'Niue', 'Niuéenne', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'NR', 'Nauru', 'Nauruane', 'Juridiction offshore', 'Élevé', 100, false, false, true, false, false, true),

-- Autres pays à risque — Élevé, score 100
(NULL, 'HK', 'Hong Kong', 'Hongkongaise', 'Centre financier offshore, risque blanchiment élevé', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'CN', 'Chine', 'Chinoise', 'Risque élevé blanchiment, opacité financière', 'Élevé', 100, false, false, false, false, false, true),
(NULL, 'CY', 'Chypre', 'Chypriote', 'Centre financier offshore, passeports dorés', 'Élevé', 100, false, false, true, false, false, true),
(NULL, 'AE', 'Émirats arabes unis', 'Émirienne', 'Centre financier offshore, risque blanchiment', 'Élevé', 100, false, false, true, false, false, true),

-- ========================
-- Pays à risque Moyen (score 0) — reste du monde
-- ========================
(NULL, 'FR', 'France', 'Française', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'DE', 'Allemagne', 'Allemande', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IT', 'Italie', 'Italienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ES', 'Espagne', 'Espagnole', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PT', 'Portugal', 'Portugaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GB', 'Royaume-Uni', 'Britannique', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'US', 'États-Unis', 'Américaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CA', 'Canada', 'Canadienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BE', 'Belgique', 'Belge', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NL', 'Pays-Bas', 'Néerlandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LU', 'Luxembourg', 'Luxembourgeoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CH', 'Suisse', 'Suisse', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AT', 'Autriche', 'Autrichienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IE', 'Irlande', 'Irlandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SE', 'Suède', 'Suédoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'DK', 'Danemark', 'Danoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'FI', 'Finlande', 'Finlandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NO', 'Norvège', 'Norvégienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IS', 'Islande', 'Islandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PL', 'Pologne', 'Polonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CZ', 'Tchéquie', 'Tchèque', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SK', 'Slovaquie', 'Slovaque', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SI', 'Slovénie', 'Slovène', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'HU', 'Hongrie', 'Hongroise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'RO', 'Roumanie', 'Roumaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GR', 'Grèce', 'Grecque', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MT', 'Malte', 'Maltaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'EE', 'Estonie', 'Estonienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LV', 'Lettonie', 'Lettonne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LT', 'Lituanie', 'Lituanienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'JP', 'Japon', 'Japonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KR', 'Corée du Sud', 'Sud-Coréenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AU', 'Australie', 'Australienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NZ', 'Nouvelle-Zélande', 'Néo-Zélandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SG', 'Singapour', 'Singapourienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IL', 'Israël', 'Israélienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BR', 'Brésil', 'Brésilienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MX', 'Mexique', 'Mexicaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AR', 'Argentine', 'Argentine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CL', 'Chili', 'Chilienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CO', 'Colombie', 'Colombienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PE', 'Pérou', 'Péruvienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'UY', 'Uruguay', 'Uruguayenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PY', 'Paraguay', 'Paraguayenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'EC', 'Équateur', 'Équatorienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GY', 'Guyana', 'Guyanienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SR', 'Suriname', 'Surinamaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IN', 'Inde', 'Indienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BD', 'Bangladesh', 'Bangladaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LK', 'Sri Lanka', 'Sri Lankaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PK', 'Pakistan', 'Pakistanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TH', 'Thaïlande', 'Thaïlandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MY', 'Malaisie', 'Malaisienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ID', 'Indonésie', 'Indonésienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TW', 'Taïwan', 'Taïwanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MN', 'Mongolie', 'Mongole', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KH', 'Cambodge', 'Cambodgienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BN', 'Brunei', 'Brunéienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TL', 'Timor oriental', 'Est-Timoraise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MV', 'Maldives', 'Maldivienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BT', 'Bhoutan', 'Bhoutanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KG', 'Kirghizistan', 'Kirghize', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TJ', 'Tadjikistan', 'Tadjike', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TM', 'Turkménistan', 'Turkmène', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'UZ', 'Ouzbékistan', 'Ouzbèke', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KZ', 'Kazakhstan', 'Kazakhe', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AZ', 'Azerbaïdjan', 'Azerbaïdjanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GE', 'Géorgie', 'Géorgienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AM', 'Arménie', 'Arménienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ZA', 'Afrique du Sud', 'Sud-Africaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MA', 'Maroc', 'Marocaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TN', 'Tunisie', 'Tunisienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'EG', 'Égypte', 'Égyptienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SA', 'Arabie saoudite', 'Saoudienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'QA', 'Qatar', 'Qatarienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KW', 'Koweït', 'Koweïtienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BH', 'Bahreïn', 'Bahreïnienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'OM', 'Oman', 'Omanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GH', 'Ghana', 'Ghanéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ET', 'Éthiopie', 'Éthiopienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'UG', 'Ouganda', 'Ougandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'RW', 'Rwanda', 'Rwandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MG', 'Madagascar', 'Malgache', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MU', 'Maurice', 'Mauricienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BJ', 'Bénin', 'Béninoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TG', 'Togo', 'Togolaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NE', 'Niger', 'Nigérienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TD', 'Tchad', 'Tchadienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CG', 'Congo', 'Congolaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GA', 'Gabon', 'Gabonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GQ', 'Guinée équatoriale', 'Équato-Guinéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GN', 'Guinée', 'Guinéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GW', 'Guinée-Bissau', 'Bissau-Guinéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SL', 'Sierra Leone', 'Sierra-Léonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LR', 'Liberia', 'Libérienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GM', 'Gambie', 'Gambienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CV', 'Cap-Vert', 'Cap-Verdienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ST', 'São Tomé-et-Príncipe', 'Santoméenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MR', 'Mauritanie', 'Mauritanienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'DJ', 'Djibouti', 'Djiboutienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KM', 'Comores', 'Comorienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BW', 'Botswana', 'Botswanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LS', 'Lesotho', 'Lésothane', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SZ', 'Eswatini', 'Swazie', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MW', 'Malawi', 'Malawienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ZM', 'Zambie', 'Zambienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CR', 'Costa Rica', 'Costaricaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GT', 'Guatemala', 'Guatémaltèque', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'HN', 'Honduras', 'Hondurienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SV', 'Salvador', 'Salvadorienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'DO', 'République dominicaine', 'Dominicaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BS', 'Bahamas', 'Bahaméenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'HT', 'Haïti', 'Haïtienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LC', 'Sainte-Lucie', 'Saint-Lucienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'VC', 'Saint-Vincent-et-les-Grenadines', 'Vincentaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GD', 'Grenade', 'Grenadienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'DM', 'Dominique', 'Dominiquaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KN', 'Saint-Kitts-et-Nevis', 'Kittitienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'UA', 'Ukraine', 'Ukrainienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MD', 'Moldavie', 'Moldave', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'RS', 'Serbie', 'Serbe', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'ME', 'Monténégro', 'Monténégrine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MK', 'Macédoine du Nord', 'Macédonienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BA', 'Bosnie-Herzégovine', 'Bosnienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'XK', 'Kosovo', 'Kosovare', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AD', 'Andorre', 'Andorrane', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SM', 'Saint-Marin', 'Saint-Marinaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'VA', 'Vatican', 'Vaticane', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'FO', 'Îles Féroé', 'Féroïenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GL', 'Groenland', 'Groenlandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GP', 'Guadeloupe', 'Guadeloupéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MQ', 'Martinique', 'Martiniquaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GF', 'Guyane française', 'Guyanaise (FR)', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'RE', 'La Réunion', 'Réunionnaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'YT', 'Mayotte', 'Mahoraise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PM', 'Saint-Pierre-et-Miquelon', 'Saint-Pierraise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'WF', 'Wallis-et-Futuna', 'Wallisienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PF', 'Polynésie française', 'Polynésienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NC', 'Nouvelle-Calédonie', 'Néo-Calédonienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BL', 'Saint-Barthélemy', 'Barthélemoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MF', 'Saint-Martin (FR)', 'Saint-Martinoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TK', 'Tokelau', 'Tokelauane', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TV', 'Tuvalu', 'Tuvaluane', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TO', 'Tonga', 'Tongienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'KI', 'Kiribati', 'I-Kiribati', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'FM', 'Micronésie', 'Micronésienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PG', 'Papouasie-Nouvelle-Guinée', 'Papouane-Néo-Guinéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SB', 'Îles Salomon', 'Salomonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PS', 'Palestine', 'Palestinienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MO', 'Macao', 'Macanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SH', 'Sainte-Hélène', 'Sainte-Hélénoise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'FK', 'Îles Malouines', 'Malouine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PN', 'Îles Pitcairn', 'Pitcairnaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'IO', 'Territoire britannique de l''océan Indien', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AX', 'Îles Åland', 'Ålandaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SJ', 'Svalbard et Jan Mayen', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MP', 'Îles Mariannes du Nord', 'Marianaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'PR', 'Porto Rico', 'Portoricaine', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CC', 'Îles Cocos', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CX', 'Île Christmas', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'NF', 'Île Norfolk', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'HM', 'Îles Heard-et-MacDonald', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BV', 'Île Bouvet', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'TF', 'Terres australes françaises', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'AQ', 'Antarctique', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'UM', 'Îles mineures éloignées des États-Unis', NULL, NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'EH', 'Sahara occidental', 'Sahraouie', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SS', 'Soudan du Sud', 'Sud-Soudanaise', NULL, 'Moyen', 0, false, false, false, false, false, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Seed data : ref_activites (700+ codes APE/NAF Rev. 2)
-- ============================================================================
-- Règles de classification risque :
--   "espèces", "bijouterie", "BTP", "immobilier", "véhicules d'occasion",
--   "E-commerce", "téléphonie" → score=60-80, niveau=Élevé
--   Autres → score=25, niveau=Moyen

INSERT INTO public.ref_activites (cabinet_id, code, libelle, description, niveau_risque, score, is_default) VALUES
-- ========================
-- Section A : Agriculture, sylviculture et pêche
-- ========================
(NULL, '01.11Z', 'Culture de céréales', NULL, 'Moyen', 25, true),
(NULL, '01.12Z', 'Culture de riz', NULL, 'Moyen', 25, true),
(NULL, '01.13Z', 'Culture de légumes, melons, racines et tubercules', NULL, 'Moyen', 25, true),
(NULL, '01.14Z', 'Culture de la canne à sucre', NULL, 'Moyen', 25, true),
(NULL, '01.15Z', 'Culture du tabac', NULL, 'Moyen', 25, true),
(NULL, '01.16Z', 'Culture de plantes à fibres', NULL, 'Moyen', 25, true),
(NULL, '01.19Z', 'Autres cultures non permanentes', NULL, 'Moyen', 25, true),
(NULL, '01.21Z', 'Culture de la vigne', NULL, 'Moyen', 25, true),
(NULL, '01.22Z', 'Culture de fruits tropicaux et subtropicaux', NULL, 'Moyen', 25, true),
(NULL, '01.23Z', 'Culture d''agrumes', NULL, 'Moyen', 25, true),
(NULL, '01.24Z', 'Culture de fruits à pépins et à noyau', NULL, 'Moyen', 25, true),
(NULL, '01.25Z', 'Culture d''autres fruits d''arbres ou d''arbustes et de fruits à coque', NULL, 'Moyen', 25, true),
(NULL, '01.26Z', 'Culture de fruits oléagineux', NULL, 'Moyen', 25, true),
(NULL, '01.27Z', 'Culture de plantes à boissons', NULL, 'Moyen', 25, true),
(NULL, '01.28Z', 'Culture de plantes à épices, aromatiques, médicinales et pharmaceutiques', NULL, 'Moyen', 25, true),
(NULL, '01.29Z', 'Autres cultures permanentes', NULL, 'Moyen', 25, true),
(NULL, '01.30Z', 'Reproduction de plantes', NULL, 'Moyen', 25, true),
(NULL, '01.41Z', 'Élevage de vaches laitières', NULL, 'Moyen', 25, true),
(NULL, '01.42Z', 'Élevage d''autres bovins et de buffles', NULL, 'Moyen', 25, true),
(NULL, '01.43Z', 'Élevage de chevaux et d''autres équidés', NULL, 'Moyen', 25, true),
(NULL, '01.44Z', 'Élevage de chameaux et d''autres camélidés', NULL, 'Moyen', 25, true),
(NULL, '01.45Z', 'Élevage d''ovins et de caprins', NULL, 'Moyen', 25, true),
(NULL, '01.46Z', 'Élevage de porcins', NULL, 'Moyen', 25, true),
(NULL, '01.47Z', 'Élevage de volailles', NULL, 'Moyen', 25, true),
(NULL, '01.49Z', 'Élevage d''autres animaux', NULL, 'Moyen', 25, true),
(NULL, '01.50Z', 'Culture et élevage associés', NULL, 'Moyen', 25, true),
(NULL, '01.61Z', 'Activités de soutien aux cultures', NULL, 'Moyen', 25, true),
(NULL, '01.62Z', 'Activités de soutien à la production animale', NULL, 'Moyen', 25, true),
(NULL, '01.63Z', 'Traitement primaire des récoltes', NULL, 'Moyen', 25, true),
(NULL, '01.64Z', 'Traitement des semences', NULL, 'Moyen', 25, true),
(NULL, '01.70Z', 'Chasse, piégeage et services annexes', NULL, 'Moyen', 25, true),
(NULL, '02.10Z', 'Sylviculture et autres activités forestières', NULL, 'Moyen', 25, true),
(NULL, '02.20Z', 'Exploitation forestière', NULL, 'Moyen', 25, true),
(NULL, '02.30Z', 'Récolte de produits forestiers non ligneux poussant à l''état sauvage', NULL, 'Moyen', 25, true),
(NULL, '02.40Z', 'Services de soutien à l''exploitation forestière', NULL, 'Moyen', 25, true),
(NULL, '03.11Z', 'Pêche en mer', NULL, 'Moyen', 25, true),
(NULL, '03.12Z', 'Pêche en eau douce', NULL, 'Moyen', 25, true),
(NULL, '03.21Z', 'Aquaculture en mer', NULL, 'Moyen', 25, true),
(NULL, '03.22Z', 'Aquaculture en eau douce', NULL, 'Moyen', 25, true),

-- ========================
-- Section B : Industries extractives
-- ========================
(NULL, '05.10Z', 'Extraction de houille', NULL, 'Moyen', 25, true),
(NULL, '05.20Z', 'Extraction de lignite', NULL, 'Moyen', 25, true),
(NULL, '06.10Z', 'Extraction de pétrole brut', NULL, 'Moyen', 25, true),
(NULL, '06.20Z', 'Extraction de gaz naturel', NULL, 'Moyen', 25, true),
(NULL, '07.10Z', 'Extraction de minerais de fer', NULL, 'Moyen', 25, true),
(NULL, '07.21Z', 'Extraction de minerais d''uranium et de thorium', NULL, 'Moyen', 25, true),
(NULL, '07.29Z', 'Extraction d''autres minerais de métaux non ferreux', NULL, 'Moyen', 25, true),
(NULL, '08.11Z', 'Extraction de pierres ornementales et de construction', NULL, 'Moyen', 25, true),
(NULL, '08.12Z', 'Exploitation de gravières et sablières, extraction d''argiles et de kaolin', NULL, 'Moyen', 25, true),
(NULL, '08.91Z', 'Extraction des minéraux chimiques et d''engrais minéraux', NULL, 'Moyen', 25, true),
(NULL, '08.92Z', 'Extraction de tourbe', NULL, 'Moyen', 25, true),
(NULL, '08.93Z', 'Production de sel', NULL, 'Moyen', 25, true),
(NULL, '08.99Z', 'Autres activités extractives n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '09.10Z', 'Activités de soutien à l''extraction d''hydrocarbures', NULL, 'Moyen', 25, true),
(NULL, '09.90Z', 'Activités de soutien aux autres industries extractives', NULL, 'Moyen', 25, true),

-- ========================
-- Section C : Industrie manufacturière
-- ========================
(NULL, '10.11Z', 'Transformation et conservation de la viande de boucherie', NULL, 'Moyen', 25, true),
(NULL, '10.12Z', 'Transformation et conservation de la viande de volaille', NULL, 'Moyen', 25, true),
(NULL, '10.13A', 'Préparation industrielle de produits à base de viande', NULL, 'Moyen', 25, true),
(NULL, '10.13B', 'Charcuterie', NULL, 'Moyen', 25, true),
(NULL, '10.20Z', 'Transformation et conservation de poisson, crustacés et mollusques', NULL, 'Moyen', 25, true),
(NULL, '10.31Z', 'Transformation et conservation de pommes de terre', NULL, 'Moyen', 25, true),
(NULL, '10.32Z', 'Préparation de jus de fruits et légumes', NULL, 'Moyen', 25, true),
(NULL, '10.39A', 'Autre transformation et conservation de légumes', NULL, 'Moyen', 25, true),
(NULL, '10.39B', 'Transformation et conservation de fruits', NULL, 'Moyen', 25, true),
(NULL, '10.41A', 'Fabrication d''huiles et graisses brutes', NULL, 'Moyen', 25, true),
(NULL, '10.41B', 'Fabrication d''huiles et graisses raffinées', NULL, 'Moyen', 25, true),
(NULL, '10.42Z', 'Fabrication de margarine et graisses comestibles similaires', NULL, 'Moyen', 25, true),
(NULL, '10.51A', 'Fabrication de lait liquide et de produits frais', NULL, 'Moyen', 25, true),
(NULL, '10.51B', 'Fabrication de beurre', NULL, 'Moyen', 25, true),
(NULL, '10.51C', 'Fabrication de fromage', NULL, 'Moyen', 25, true),
(NULL, '10.51D', 'Fabrication d''autres produits laitiers', NULL, 'Moyen', 25, true),
(NULL, '10.52Z', 'Fabrication de glaces et sorbets', NULL, 'Moyen', 25, true),
(NULL, '10.61A', 'Meunerie', NULL, 'Moyen', 25, true),
(NULL, '10.61B', 'Autres activités du travail des grains', NULL, 'Moyen', 25, true),
(NULL, '10.62Z', 'Fabrication de produits amylacés', NULL, 'Moyen', 25, true),
(NULL, '10.71A', 'Fabrication industrielle de pain et de pâtisserie fraîche', NULL, 'Moyen', 25, true),
(NULL, '10.71B', 'Cuisson de produits de boulangerie', NULL, 'Moyen', 25, true),
(NULL, '10.71C', 'Boulangerie et boulangerie-pâtisserie', 'Risque espèces — activité cash-intensive', 'Élevé', 60, true),
(NULL, '10.71D', 'Pâtisserie', NULL, 'Moyen', 25, true),
(NULL, '10.72Z', 'Fabrication de biscuits, biscottes et pâtisseries de conservation', NULL, 'Moyen', 25, true),
(NULL, '10.73Z', 'Fabrication de pâtes alimentaires', NULL, 'Moyen', 25, true),
(NULL, '10.81Z', 'Fabrication de sucre', NULL, 'Moyen', 25, true),
(NULL, '10.82Z', 'Fabrication de cacao, chocolat et de produits de confiserie', NULL, 'Moyen', 25, true),
(NULL, '10.83Z', 'Transformation du thé et du café', NULL, 'Moyen', 25, true),
(NULL, '10.84Z', 'Fabrication de condiments et assaisonnements', NULL, 'Moyen', 25, true),
(NULL, '10.85Z', 'Fabrication de plats préparés', NULL, 'Moyen', 25, true),
(NULL, '10.86Z', 'Fabrication d''aliments homogénéisés et diététiques', NULL, 'Moyen', 25, true),
(NULL, '10.89Z', 'Fabrication d''autres produits alimentaires n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '10.91Z', 'Fabrication d''aliments pour animaux de ferme', NULL, 'Moyen', 25, true),
(NULL, '10.92Z', 'Fabrication d''aliments pour animaux de compagnie', NULL, 'Moyen', 25, true),
(NULL, '11.01Z', 'Production de boissons alcooliques distillées', NULL, 'Moyen', 25, true),
(NULL, '11.02A', 'Fabrication de vins effervescents', NULL, 'Moyen', 25, true),
(NULL, '11.02B', 'Vinification', NULL, 'Moyen', 25, true),
(NULL, '11.03Z', 'Fabrication de cidre et de vins de fruits', NULL, 'Moyen', 25, true),
(NULL, '11.04Z', 'Production d''autres boissons fermentées non distillées', NULL, 'Moyen', 25, true),
(NULL, '11.05Z', 'Fabrication de bière', NULL, 'Moyen', 25, true),
(NULL, '11.06Z', 'Fabrication de malt', NULL, 'Moyen', 25, true),
(NULL, '11.07A', 'Industrie des eaux de table', NULL, 'Moyen', 25, true),
(NULL, '11.07B', 'Production de boissons rafraîchissantes', NULL, 'Moyen', 25, true),
(NULL, '12.00Z', 'Fabrication de produits à base de tabac', NULL, 'Moyen', 25, true),
(NULL, '13.10Z', 'Préparation de fibres textiles et filature', NULL, 'Moyen', 25, true),
(NULL, '13.20Z', 'Tissage', NULL, 'Moyen', 25, true),
(NULL, '13.30Z', 'Ennoblissement textile', NULL, 'Moyen', 25, true),
(NULL, '13.91Z', 'Fabrication d''étoffes à mailles', NULL, 'Moyen', 25, true),
(NULL, '13.92Z', 'Fabrication d''articles textiles, sauf habillement', NULL, 'Moyen', 25, true),
(NULL, '13.93Z', 'Fabrication de tapis et moquettes', NULL, 'Moyen', 25, true),
(NULL, '13.94Z', 'Fabrication de ficelles, cordes et filets', NULL, 'Moyen', 25, true),
(NULL, '13.95Z', 'Fabrication de non-tissés, sauf habillement', NULL, 'Moyen', 25, true),
(NULL, '13.96Z', 'Fabrication d''autres textiles techniques et industriels', NULL, 'Moyen', 25, true),
(NULL, '13.99Z', 'Fabrication d''autres textiles n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '14.11Z', 'Fabrication de vêtements en cuir', NULL, 'Moyen', 25, true),
(NULL, '14.12Z', 'Fabrication de vêtements de travail', NULL, 'Moyen', 25, true),
(NULL, '14.13Z', 'Fabrication de vêtements de dessus', NULL, 'Moyen', 25, true),
(NULL, '14.14Z', 'Fabrication de vêtements de dessous', NULL, 'Moyen', 25, true),
(NULL, '14.19Z', 'Fabrication d''autres vêtements et accessoires', NULL, 'Moyen', 25, true),
(NULL, '14.20Z', 'Fabrication d''articles en fourrure', NULL, 'Moyen', 25, true),
(NULL, '14.31Z', 'Fabrication d''articles chaussants à mailles', NULL, 'Moyen', 25, true),
(NULL, '14.39Z', 'Fabrication d''autres articles à mailles', NULL, 'Moyen', 25, true),
(NULL, '15.11Z', 'Apprêt et tannage des cuirs ; préparation et teinture des fourrures', NULL, 'Moyen', 25, true),
(NULL, '15.12Z', 'Fabrication d''articles de voyage, de maroquinerie et de sellerie', NULL, 'Moyen', 25, true),
(NULL, '15.20Z', 'Fabrication de chaussures', NULL, 'Moyen', 25, true),
(NULL, '16.10A', 'Sciage et rabotage du bois, hors imprégnation', NULL, 'Moyen', 25, true),
(NULL, '16.10B', 'Imprégnation du bois', NULL, 'Moyen', 25, true),
(NULL, '16.21Z', 'Fabrication de placage et de panneaux de bois', NULL, 'Moyen', 25, true),
(NULL, '16.22Z', 'Fabrication de parquets assemblés', NULL, 'Moyen', 25, true),
(NULL, '16.23Z', 'Fabrication de charpentes et d''autres menuiseries', NULL, 'Moyen', 25, true),
(NULL, '16.24Z', 'Fabrication d''emballages en bois', NULL, 'Moyen', 25, true),
(NULL, '16.29Z', 'Fabrication d''objets divers en bois ; fabrication d''objets en liège, vannerie et sparterie', NULL, 'Moyen', 25, true),
(NULL, '17.11Z', 'Fabrication de pâte à papier', NULL, 'Moyen', 25, true),
(NULL, '17.12Z', 'Fabrication de papier et de carton', NULL, 'Moyen', 25, true),
(NULL, '17.21A', 'Fabrication de carton ondulé', NULL, 'Moyen', 25, true),
(NULL, '17.21B', 'Fabrication de cartonnages', NULL, 'Moyen', 25, true),
(NULL, '17.21C', 'Fabrication d''emballages en papier', NULL, 'Moyen', 25, true),
(NULL, '17.22Z', 'Fabrication d''articles en papier à usage sanitaire ou domestique', NULL, 'Moyen', 25, true),
(NULL, '17.23Z', 'Fabrication d''articles de papeterie', NULL, 'Moyen', 25, true),
(NULL, '17.24Z', 'Fabrication de papiers peints', NULL, 'Moyen', 25, true),
(NULL, '17.29Z', 'Fabrication d''autres articles en papier ou en carton', NULL, 'Moyen', 25, true),
(NULL, '18.11Z', 'Imprimerie de journaux', NULL, 'Moyen', 25, true),
(NULL, '18.12Z', 'Autre imprimerie (labeur)', NULL, 'Moyen', 25, true),
(NULL, '18.13Z', 'Activités de pré-presse', NULL, 'Moyen', 25, true),
(NULL, '18.14Z', 'Reliure et activités connexes', NULL, 'Moyen', 25, true),
(NULL, '18.20Z', 'Reproduction d''enregistrements', NULL, 'Moyen', 25, true),
(NULL, '19.10Z', 'Cokéfaction', NULL, 'Moyen', 25, true),
(NULL, '19.20Z', 'Raffinage du pétrole', NULL, 'Moyen', 25, true),
(NULL, '20.11Z', 'Fabrication de gaz industriels', NULL, 'Moyen', 25, true),
(NULL, '20.12Z', 'Fabrication de colorants et de pigments', NULL, 'Moyen', 25, true),
(NULL, '20.13A', 'Enrichissement et retraitement de matières nucléaires', NULL, 'Moyen', 25, true),
(NULL, '20.13B', 'Fabrication d''autres produits chimiques inorganiques de base', NULL, 'Moyen', 25, true),
(NULL, '20.14Z', 'Fabrication d''autres produits chimiques organiques de base', NULL, 'Moyen', 25, true),
(NULL, '20.15Z', 'Fabrication de produits azotés et d''engrais', NULL, 'Moyen', 25, true),
(NULL, '20.16Z', 'Fabrication de matières plastiques de base', NULL, 'Moyen', 25, true),
(NULL, '20.17Z', 'Fabrication de caoutchouc synthétique', NULL, 'Moyen', 25, true),
(NULL, '20.20Z', 'Fabrication de pesticides et d''autres produits agrochimiques', NULL, 'Moyen', 25, true),
(NULL, '20.30Z', 'Fabrication de peintures, vernis, encres et mastics', NULL, 'Moyen', 25, true),
(NULL, '20.41Z', 'Fabrication de savons, détergents et produits d''entretien', NULL, 'Moyen', 25, true),
(NULL, '20.42Z', 'Fabrication de parfums et de produits pour la toilette', NULL, 'Moyen', 25, true),
(NULL, '20.51Z', 'Fabrication de produits explosifs', NULL, 'Moyen', 25, true),
(NULL, '20.52Z', 'Fabrication de colles', NULL, 'Moyen', 25, true),
(NULL, '20.53Z', 'Fabrication d''huiles essentielles', NULL, 'Moyen', 25, true),
(NULL, '20.59Z', 'Fabrication d''autres produits chimiques n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '20.60Z', 'Fabrication de fibres artificielles ou synthétiques', NULL, 'Moyen', 25, true),
(NULL, '21.10Z', 'Fabrication de produits pharmaceutiques de base', NULL, 'Moyen', 25, true),
(NULL, '21.20Z', 'Fabrication de préparations pharmaceutiques', NULL, 'Moyen', 25, true),
(NULL, '22.11Z', 'Fabrication et rechapage de pneumatiques', NULL, 'Moyen', 25, true),
(NULL, '22.19Z', 'Fabrication d''autres articles en caoutchouc', NULL, 'Moyen', 25, true),
(NULL, '22.21Z', 'Fabrication de plaques, feuilles, tubes et profilés en matières plastiques', NULL, 'Moyen', 25, true),
(NULL, '22.22Z', 'Fabrication d''emballages en matières plastiques', NULL, 'Moyen', 25, true),
(NULL, '22.23Z', 'Fabrication d''éléments en matières plastiques pour la construction', NULL, 'Moyen', 25, true),
(NULL, '22.29A', 'Fabrication de pièces techniques à base de matières plastiques', NULL, 'Moyen', 25, true),
(NULL, '22.29B', 'Fabrication de produits de consommation courante en matières plastiques', NULL, 'Moyen', 25, true),
(NULL, '23.11Z', 'Fabrication de verre plat', NULL, 'Moyen', 25, true),
(NULL, '23.12Z', 'Façonnage et transformation du verre plat', NULL, 'Moyen', 25, true),
(NULL, '23.13Z', 'Fabrication de verre creux', NULL, 'Moyen', 25, true),
(NULL, '23.14Z', 'Fabrication de fibres de verre', NULL, 'Moyen', 25, true),
(NULL, '23.19Z', 'Fabrication et façonnage d''autres articles en verre', NULL, 'Moyen', 25, true),
(NULL, '23.20Z', 'Fabrication de produits réfractaires', NULL, 'Moyen', 25, true),
(NULL, '23.31Z', 'Fabrication de carreaux en céramique', NULL, 'Moyen', 25, true),
(NULL, '23.32Z', 'Fabrication de briques, tuiles et produits de construction, en terre cuite', NULL, 'Moyen', 25, true),
(NULL, '23.41Z', 'Fabrication d''articles céramiques à usage domestique ou ornemental', NULL, 'Moyen', 25, true),
(NULL, '23.42Z', 'Fabrication d''appareils sanitaires en céramique', NULL, 'Moyen', 25, true),
(NULL, '23.43Z', 'Fabrication d''isolateurs et pièces isolantes en céramique', NULL, 'Moyen', 25, true),
(NULL, '23.44Z', 'Fabrication d''autres produits céramiques à usage technique', NULL, 'Moyen', 25, true),
(NULL, '23.49Z', 'Fabrication d''autres produits céramiques', NULL, 'Moyen', 25, true),
(NULL, '23.51Z', 'Fabrication de ciment', NULL, 'Moyen', 25, true),
(NULL, '23.52Z', 'Fabrication de chaux et plâtre', NULL, 'Moyen', 25, true),
(NULL, '23.61Z', 'Fabrication d''éléments en béton pour la construction', NULL, 'Moyen', 25, true),
(NULL, '23.62Z', 'Fabrication d''éléments en plâtre pour la construction', NULL, 'Moyen', 25, true),
(NULL, '23.63Z', 'Fabrication de béton prêt à l''emploi', NULL, 'Moyen', 25, true),
(NULL, '23.64Z', 'Fabrication de mortiers et bétons secs', NULL, 'Moyen', 25, true),
(NULL, '23.65Z', 'Fabrication d''ouvrages en fibre-ciment', NULL, 'Moyen', 25, true),
(NULL, '23.69Z', 'Fabrication d''autres ouvrages en béton, ciment ou plâtre', NULL, 'Moyen', 25, true),
(NULL, '23.70Z', 'Taille, façonnage et finissage de pierres', NULL, 'Moyen', 25, true),
(NULL, '23.91Z', 'Fabrication de produits abrasifs', NULL, 'Moyen', 25, true),
(NULL, '23.99Z', 'Fabrication d''autres produits minéraux non métalliques n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '24.10Z', 'Sidérurgie', NULL, 'Moyen', 25, true),
(NULL, '24.20Z', 'Fabrication de tubes, tuyaux, profilés creux et accessoires en acier', NULL, 'Moyen', 25, true),
(NULL, '24.31Z', 'Étirage à froid de barres', NULL, 'Moyen', 25, true),
(NULL, '24.32Z', 'Laminage à froid de feuillards', NULL, 'Moyen', 25, true),
(NULL, '24.33Z', 'Profilage à froid par formage ou pliage', NULL, 'Moyen', 25, true),
(NULL, '24.34Z', 'Tréfilage à froid', NULL, 'Moyen', 25, true),
(NULL, '24.41Z', 'Production de métaux précieux', NULL, 'Moyen', 25, true),
(NULL, '24.42Z', 'Métallurgie de l''aluminium', NULL, 'Moyen', 25, true),
(NULL, '24.43Z', 'Métallurgie du plomb, du zinc ou de l''étain', NULL, 'Moyen', 25, true),
(NULL, '24.44Z', 'Métallurgie du cuivre', NULL, 'Moyen', 25, true),
(NULL, '24.45Z', 'Métallurgie des autres métaux non ferreux', NULL, 'Moyen', 25, true),
(NULL, '24.46Z', 'Élaboration et transformation de matières nucléaires', NULL, 'Moyen', 25, true),
(NULL, '24.51Z', 'Fonderie de fonte', NULL, 'Moyen', 25, true),
(NULL, '24.52Z', 'Fonderie d''acier', NULL, 'Moyen', 25, true),
(NULL, '24.53Z', 'Fonderie de métaux légers', NULL, 'Moyen', 25, true),
(NULL, '24.54Z', 'Fonderie d''autres métaux non ferreux', NULL, 'Moyen', 25, true),
(NULL, '25.11Z', 'Fabrication de structures métalliques et de parties de structures', NULL, 'Moyen', 25, true),
(NULL, '25.12Z', 'Fabrication de portes et fenêtres en métal', NULL, 'Moyen', 25, true),
(NULL, '25.21Z', 'Fabrication de radiateurs et chaudières pour le chauffage central', NULL, 'Moyen', 25, true),
(NULL, '25.29Z', 'Fabrication d''autres réservoirs, citernes et conteneurs métalliques', NULL, 'Moyen', 25, true),
(NULL, '25.30Z', 'Fabrication de générateurs de vapeur', NULL, 'Moyen', 25, true),
(NULL, '25.40Z', 'Fabrication d''armes et de munitions', NULL, 'Moyen', 25, true),
(NULL, '25.50A', 'Forge, estampage, matriçage ; métallurgie des poudres', NULL, 'Moyen', 25, true),
(NULL, '25.50B', 'Découpage, emboutissage', NULL, 'Moyen', 25, true),
(NULL, '25.61Z', 'Traitement et revêtement des métaux', NULL, 'Moyen', 25, true),
(NULL, '25.62A', 'Décolletage', NULL, 'Moyen', 25, true),
(NULL, '25.62B', 'Mécanique industrielle', NULL, 'Moyen', 25, true),
(NULL, '25.71Z', 'Fabrication de coutellerie', NULL, 'Moyen', 25, true),
(NULL, '25.72Z', 'Fabrication de serrures et de ferrures', NULL, 'Moyen', 25, true),
(NULL, '25.73A', 'Fabrication de moules et modèles', NULL, 'Moyen', 25, true),
(NULL, '25.73B', 'Fabrication d''autres outillages', NULL, 'Moyen', 25, true),
(NULL, '25.91Z', 'Fabrication de fûts et emballages métalliques similaires', NULL, 'Moyen', 25, true),
(NULL, '25.92Z', 'Fabrication d''emballages métalliques légers', NULL, 'Moyen', 25, true),
(NULL, '25.93Z', 'Fabrication d''articles en fils métalliques, de chaînes et de ressorts', NULL, 'Moyen', 25, true),
(NULL, '25.94Z', 'Fabrication de vis et de boulons', NULL, 'Moyen', 25, true),
(NULL, '25.99A', 'Fabrication d''articles métalliques ménagers', NULL, 'Moyen', 25, true),
(NULL, '25.99B', 'Fabrication d''autres articles métalliques', NULL, 'Moyen', 25, true),
(NULL, '26.11Z', 'Fabrication de composants électroniques', NULL, 'Moyen', 25, true),
(NULL, '26.12Z', 'Fabrication de cartes électroniques assemblées', NULL, 'Moyen', 25, true),
(NULL, '26.20Z', 'Fabrication d''ordinateurs et d''équipements périphériques', NULL, 'Moyen', 25, true),
(NULL, '26.30Z', 'Fabrication d''équipements de communication', NULL, 'Moyen', 25, true),
(NULL, '26.40Z', 'Fabrication de produits électroniques grand public', NULL, 'Moyen', 25, true),
(NULL, '26.51A', 'Fabrication d''équipements d''aide à la navigation', NULL, 'Moyen', 25, true),
(NULL, '26.51B', 'Fabrication d''instrumentation scientifique et technique', NULL, 'Moyen', 25, true),
(NULL, '26.52Z', 'Horlogerie', 'Risque bijouterie — commerce de valeur, espèces', 'Élevé', 70, true),
(NULL, '26.60Z', 'Fabrication d''équipements d''irradiation médicale', NULL, 'Moyen', 25, true),
(NULL, '26.70Z', 'Fabrication de matériels optique et photographique', NULL, 'Moyen', 25, true),
(NULL, '26.80Z', 'Fabrication de supports magnétiques et optiques', NULL, 'Moyen', 25, true),
(NULL, '27.11Z', 'Fabrication de moteurs, génératrices et transformateurs électriques', NULL, 'Moyen', 25, true),
(NULL, '27.12Z', 'Fabrication de matériel de distribution et de commande électrique', NULL, 'Moyen', 25, true),
(NULL, '27.20Z', 'Fabrication de piles et d''accumulateurs électriques', NULL, 'Moyen', 25, true),
(NULL, '27.31Z', 'Fabrication de câbles de fibres optiques', NULL, 'Moyen', 25, true),
(NULL, '27.32Z', 'Fabrication d''autres fils et câbles électroniques ou électriques', NULL, 'Moyen', 25, true),
(NULL, '27.33Z', 'Fabrication de matériel d''installation électrique', NULL, 'Moyen', 25, true),
(NULL, '27.40Z', 'Fabrication d''appareils d''éclairage électrique', NULL, 'Moyen', 25, true),
(NULL, '27.51Z', 'Fabrication d''appareils électroménagers', NULL, 'Moyen', 25, true),
(NULL, '27.52Z', 'Fabrication d''appareils ménagers non électriques', NULL, 'Moyen', 25, true),
(NULL, '27.90Z', 'Fabrication d''autres matériels électriques', NULL, 'Moyen', 25, true),
(NULL, '28.11Z', 'Fabrication de moteurs et turbines', NULL, 'Moyen', 25, true),
(NULL, '28.12Z', 'Fabrication d''équipements hydrauliques et pneumatiques', NULL, 'Moyen', 25, true),
(NULL, '28.13Z', 'Fabrication d''autres pompes et compresseurs', NULL, 'Moyen', 25, true),
(NULL, '28.14Z', 'Fabrication d''autres articles de robinetterie', NULL, 'Moyen', 25, true),
(NULL, '28.15Z', 'Fabrication d''engrenages et d''organes mécaniques de transmission', NULL, 'Moyen', 25, true),
(NULL, '28.21Z', 'Fabrication de fours et brûleurs', NULL, 'Moyen', 25, true),
(NULL, '28.22Z', 'Fabrication de matériel de levage et de manutention', NULL, 'Moyen', 25, true),
(NULL, '28.23Z', 'Fabrication de machines et d''équipements de bureau', NULL, 'Moyen', 25, true),
(NULL, '28.24Z', 'Fabrication d''outillage portatif à moteur', NULL, 'Moyen', 25, true),
(NULL, '28.25Z', 'Fabrication d''équipements aérauliques et frigorifiques industriels', NULL, 'Moyen', 25, true),
(NULL, '28.29A', 'Fabrication d''équipements d''emballage, de conditionnement et de pesage', NULL, 'Moyen', 25, true),
(NULL, '28.29B', 'Fabrication d''autres machines d''usage général', NULL, 'Moyen', 25, true),
(NULL, '28.30Z', 'Fabrication de machines agricoles et forestières', NULL, 'Moyen', 25, true),
(NULL, '28.41Z', 'Fabrication de machines-outils pour le travail des métaux', NULL, 'Moyen', 25, true),
(NULL, '28.49Z', 'Fabrication d''autres machines-outils', NULL, 'Moyen', 25, true),
(NULL, '28.91Z', 'Fabrication de machines pour la métallurgie', NULL, 'Moyen', 25, true),
(NULL, '28.92Z', 'Fabrication de machines pour l''extraction ou la construction', NULL, 'Moyen', 25, true),
(NULL, '28.93Z', 'Fabrication de machines pour l''industrie agro-alimentaire', NULL, 'Moyen', 25, true),
(NULL, '28.94Z', 'Fabrication de machines pour les industries textiles', NULL, 'Moyen', 25, true),
(NULL, '28.95Z', 'Fabrication de machines pour les industries du papier et du carton', NULL, 'Moyen', 25, true),
(NULL, '28.96Z', 'Fabrication de machines pour le travail du caoutchouc ou des plastiques', NULL, 'Moyen', 25, true),
(NULL, '28.99A', 'Fabrication de machines d''imprimerie', NULL, 'Moyen', 25, true),
(NULL, '28.99B', 'Fabrication d''autres machines spécialisées', NULL, 'Moyen', 25, true),
(NULL, '29.10Z', 'Construction de véhicules automobiles', NULL, 'Moyen', 25, true),
(NULL, '29.20Z', 'Fabrication de carrosseries et remorques', NULL, 'Moyen', 25, true),
(NULL, '29.31Z', 'Fabrication d''équipements électriques et électroniques automobiles', NULL, 'Moyen', 25, true),
(NULL, '29.32Z', 'Fabrication d''autres équipements automobiles', NULL, 'Moyen', 25, true),
(NULL, '30.11Z', 'Construction de navires et de structures flottantes', NULL, 'Moyen', 25, true),
(NULL, '30.12Z', 'Construction de bateaux de plaisance', NULL, 'Moyen', 25, true),
(NULL, '30.20Z', 'Construction de locomotives et d''autre matériel ferroviaire roulant', NULL, 'Moyen', 25, true),
(NULL, '30.30Z', 'Construction aéronautique et spatiale', NULL, 'Moyen', 25, true),
(NULL, '30.40Z', 'Construction de véhicules militaires de combat', NULL, 'Moyen', 25, true),
(NULL, '30.91Z', 'Fabrication de motocycles', NULL, 'Moyen', 25, true),
(NULL, '30.92Z', 'Fabrication de bicyclettes et de véhicules pour invalides', NULL, 'Moyen', 25, true),
(NULL, '30.99Z', 'Fabrication d''autres équipements de transport n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '31.01Z', 'Fabrication de meubles de bureau et de magasin', NULL, 'Moyen', 25, true),
(NULL, '31.02Z', 'Fabrication de meubles de cuisine', NULL, 'Moyen', 25, true),
(NULL, '31.03Z', 'Fabrication de matelas', NULL, 'Moyen', 25, true),
(NULL, '31.09A', 'Fabrication de sièges d''ameublement d''intérieur', NULL, 'Moyen', 25, true),
(NULL, '31.09B', 'Fabrication d''autres meubles et industries connexes de l''ameublement', NULL, 'Moyen', 25, true),
(NULL, '32.11Z', 'Frappe de monnaie', NULL, 'Moyen', 25, true),
(NULL, '32.12Z', 'Fabrication d''articles de joaillerie et bijouterie', 'Risque bijouterie — commerce de luxe, espèces', 'Élevé', 80, true),
(NULL, '32.13Z', 'Fabrication d''articles de bijouterie fantaisie et articles similaires', NULL, 'Moyen', 25, true),
(NULL, '32.20Z', 'Fabrication d''instruments de musique', NULL, 'Moyen', 25, true),
(NULL, '32.30Z', 'Fabrication d''articles de sport', NULL, 'Moyen', 25, true),
(NULL, '32.40Z', 'Fabrication de jeux et jouets', NULL, 'Moyen', 25, true),
(NULL, '32.50A', 'Fabrication de matériel médico-chirurgical et dentaire', NULL, 'Moyen', 25, true),
(NULL, '32.50B', 'Fabrication de lunettes', NULL, 'Moyen', 25, true),
(NULL, '32.91Z', 'Fabrication d''articles de brosserie', NULL, 'Moyen', 25, true),
(NULL, '32.99Z', 'Autres activités manufacturières n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '33.11Z', 'Réparation d''ouvrages en métaux', NULL, 'Moyen', 25, true),
(NULL, '33.12Z', 'Réparation de machines et équipements mécaniques', NULL, 'Moyen', 25, true),
(NULL, '33.13Z', 'Réparation de matériels électroniques et optiques', NULL, 'Moyen', 25, true),
(NULL, '33.14Z', 'Réparation d''équipements électriques', NULL, 'Moyen', 25, true),
(NULL, '33.15Z', 'Réparation et maintenance navale', NULL, 'Moyen', 25, true),
(NULL, '33.16Z', 'Réparation et maintenance d''aéronefs et d''engins spatiaux', NULL, 'Moyen', 25, true),
(NULL, '33.17Z', 'Réparation et maintenance d''autres équipements de transport', NULL, 'Moyen', 25, true),
(NULL, '33.19Z', 'Réparation d''autres équipements', NULL, 'Moyen', 25, true),
(NULL, '33.20A', 'Installation de structures métalliques, chaudronnées et de tuyauterie', NULL, 'Moyen', 25, true),
(NULL, '33.20B', 'Installation de machines et équipements mécaniques', NULL, 'Moyen', 25, true),
(NULL, '33.20C', 'Conception d''ensemble et assemblage sur site industriel d''équipements de contrôle des processus industriels', NULL, 'Moyen', 25, true),
(NULL, '33.20D', 'Installation d''équipements électriques, de matériels électroniques et optiques', NULL, 'Moyen', 25, true),

-- ========================
-- Section D : Production et distribution d'électricité, gaz, vapeur
-- ========================
(NULL, '35.11Z', 'Production d''électricité', NULL, 'Moyen', 25, true),
(NULL, '35.12Z', 'Transport d''électricité', NULL, 'Moyen', 25, true),
(NULL, '35.13Z', 'Distribution d''électricité', NULL, 'Moyen', 25, true),
(NULL, '35.14Z', 'Commerce d''électricité', NULL, 'Moyen', 25, true),
(NULL, '35.21Z', 'Production de combustibles gazeux', NULL, 'Moyen', 25, true),
(NULL, '35.22Z', 'Distribution de combustibles gazeux par conduites', NULL, 'Moyen', 25, true),
(NULL, '35.23Z', 'Commerce de combustibles gazeux par conduites', NULL, 'Moyen', 25, true),
(NULL, '35.30Z', 'Production et distribution de vapeur et d''air conditionné', NULL, 'Moyen', 25, true),

-- ========================
-- Section E : Eau, assainissement, déchets, dépollution
-- ========================
(NULL, '36.00Z', 'Captage, traitement et distribution d''eau', NULL, 'Moyen', 25, true),
(NULL, '37.00Z', 'Collecte et traitement des eaux usées', NULL, 'Moyen', 25, true),
(NULL, '38.11Z', 'Collecte des déchets non dangereux', NULL, 'Moyen', 25, true),
(NULL, '38.12Z', 'Collecte des déchets dangereux', NULL, 'Moyen', 25, true),
(NULL, '38.21Z', 'Traitement et élimination des déchets non dangereux', NULL, 'Moyen', 25, true),
(NULL, '38.22Z', 'Traitement et élimination des déchets dangereux', NULL, 'Moyen', 25, true),
(NULL, '38.31Z', 'Démantèlement d''épaves', NULL, 'Moyen', 25, true),
(NULL, '38.32Z', 'Récupération de déchets triés', NULL, 'Moyen', 25, true),
(NULL, '39.00Z', 'Dépollution et autres services de gestion des déchets', NULL, 'Moyen', 25, true),

-- ========================
-- Section F : Construction (BTP — risque élevé)
-- ========================
(NULL, '41.10A', 'Promotion immobilière de logements', 'Risque immobilier — promotion immobilière', 'Élevé', 70, true),
(NULL, '41.10B', 'Promotion immobilière de bureaux', 'Risque immobilier — promotion immobilière', 'Élevé', 70, true),
(NULL, '41.10C', 'Promotion immobilière d''autres bâtiments', 'Risque immobilier — promotion immobilière', 'Élevé', 70, true),
(NULL, '41.10D', 'Supports juridiques de programmes', 'Risque immobilier', 'Élevé', 65, true),
(NULL, '41.20A', 'Construction de maisons individuelles', 'Risque BTP — construction', 'Élevé', 65, true),
(NULL, '41.20B', 'Construction d''autres bâtiments', 'Risque BTP — construction', 'Élevé', 65, true),
(NULL, '42.11Z', 'Construction de routes et autoroutes', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.12Z', 'Construction de voies ferrées de surface et souterraines', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.13A', 'Construction d''ouvrages d''art', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.13B', 'Construction et entretien de tunnels', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.21Z', 'Construction de réseaux pour fluides', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.22Z', 'Construction de réseaux électriques et de télécommunications', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.91Z', 'Construction d''ouvrages maritimes et fluviaux', 'Risque BTP', 'Élevé', 60, true),
(NULL, '42.99Z', 'Construction d''autres ouvrages de génie civil n.c.a.', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.11Z', 'Travaux de démolition', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.12A', 'Travaux de terrassement courants et travaux préparatoires', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.12B', 'Travaux de terrassement spécialisés ou de grande masse', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.13Z', 'Forages et sondages', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.21A', 'Travaux d''installation électrique dans tous locaux', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.21B', 'Travaux d''installation électrique sur la voie publique', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.22A', 'Travaux d''installation d''eau et de gaz en tous locaux', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.22B', 'Travaux d''installation d''équipements thermiques et de climatisation', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.29A', 'Travaux d''isolation', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.29B', 'Autres travaux d''installation n.c.a.', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.31Z', 'Travaux de plâtrerie', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.32A', 'Travaux de menuiserie bois et PVC', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.32B', 'Travaux de menuiserie métallique et serrurerie', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.32C', 'Agencement de lieux de vente', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.33Z', 'Travaux de revêtement des sols et des murs', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.34Z', 'Travaux de peinture et vitrerie', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.39Z', 'Autres travaux de finition', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.91A', 'Travaux de charpente', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.91B', 'Travaux de couverture par éléments', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.99A', 'Travaux d''étanchéification', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.99B', 'Travaux de montage de structures métalliques', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.99C', 'Travaux de maçonnerie générale et gros œuvre de bâtiment', 'Risque BTP — maçonnerie, espèces fréquentes', 'Élevé', 65, true),
(NULL, '43.99D', 'Autres travaux spécialisés de construction', 'Risque BTP', 'Élevé', 60, true),
(NULL, '43.99E', 'Location avec opérateur de matériel de construction', 'Risque BTP', 'Élevé', 60, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.ref_activites (cabinet_id, code, libelle, description, niveau_risque, score, is_default) VALUES
-- ========================
-- Section G : Commerce ; réparation d'automobiles et de motocycles
-- ========================
(NULL, '45.11Z', 'Commerce de voitures et de véhicules automobiles légers', 'Risque véhicules d''occasion — cash, fraude TVA', 'Élevé', 70, true),
(NULL, '45.19Z', 'Commerce d''autres véhicules automobiles', 'Risque véhicules d''occasion', 'Élevé', 65, true),
(NULL, '45.20A', 'Entretien et réparation de véhicules automobiles légers', NULL, 'Moyen', 25, true),
(NULL, '45.20B', 'Entretien et réparation d''autres véhicules automobiles', NULL, 'Moyen', 25, true),
(NULL, '45.31Z', 'Commerce de gros d''équipements automobiles', NULL, 'Moyen', 25, true),
(NULL, '45.32Z', 'Commerce de détail d''équipements automobiles', NULL, 'Moyen', 25, true),
(NULL, '45.40Z', 'Commerce et réparation de motocycles', NULL, 'Moyen', 25, true),
(NULL, '46.11Z', 'Intermédiaires du commerce en matières premières agricoles, animaux vivants, matières premières textiles et produits semi-finis', NULL, 'Moyen', 25, true),
(NULL, '46.12A', 'Centrales d''achat de carburant', NULL, 'Moyen', 25, true),
(NULL, '46.12B', 'Autres intermédiaires du commerce en combustibles, métaux, minéraux et produits chimiques', NULL, 'Moyen', 25, true),
(NULL, '46.13Z', 'Intermédiaires du commerce en bois et matériaux de construction', NULL, 'Moyen', 25, true),
(NULL, '46.14Z', 'Intermédiaires du commerce en machines, équipements industriels, navires et avions', NULL, 'Moyen', 25, true),
(NULL, '46.15Z', 'Intermédiaires du commerce en meubles, articles de ménage et quincaillerie', NULL, 'Moyen', 25, true),
(NULL, '46.16Z', 'Intermédiaires du commerce en textiles, habillement, fourrures, chaussures et articles en cuir', NULL, 'Moyen', 25, true),
(NULL, '46.17A', 'Intermédiaires du commerce en denrées, boissons et tabac', NULL, 'Moyen', 25, true),
(NULL, '46.17B', 'Intermédiaires du commerce en produits divers', NULL, 'Moyen', 25, true),
(NULL, '46.18Z', 'Intermédiaires spécialisés dans le commerce d''autres produits spécifiques', NULL, 'Moyen', 25, true),
(NULL, '46.19A', 'Centrales d''achat alimentaires', NULL, 'Moyen', 25, true),
(NULL, '46.19B', 'Autres centrales d''achat non alimentaires', NULL, 'Moyen', 25, true),
(NULL, '46.21Z', 'Commerce de gros de céréales, de tabac non manufacturé, de semences et d''aliments pour le bétail', NULL, 'Moyen', 25, true),
(NULL, '46.22Z', 'Commerce de gros de fleurs et plantes', NULL, 'Moyen', 25, true),
(NULL, '46.23Z', 'Commerce de gros d''animaux vivants', NULL, 'Moyen', 25, true),
(NULL, '46.24Z', 'Commerce de gros de cuirs et peaux', NULL, 'Moyen', 25, true),
(NULL, '46.31Z', 'Commerce de gros de fruits et légumes', NULL, 'Moyen', 25, true),
(NULL, '46.32A', 'Commerce de gros de viandes de boucherie', NULL, 'Moyen', 25, true),
(NULL, '46.32B', 'Commerce de gros de produits à base de viande', NULL, 'Moyen', 25, true),
(NULL, '46.32C', 'Commerce de gros de volailles et gibier', NULL, 'Moyen', 25, true),
(NULL, '46.33Z', 'Commerce de gros de produits laitiers, œufs, huiles et matières grasses comestibles', NULL, 'Moyen', 25, true),
(NULL, '46.34Z', 'Commerce de gros de boissons', NULL, 'Moyen', 25, true),
(NULL, '46.35Z', 'Commerce de gros de produits à base de tabac', NULL, 'Moyen', 25, true),
(NULL, '46.36Z', 'Commerce de gros de sucre, chocolat et confiserie', NULL, 'Moyen', 25, true),
(NULL, '46.37Z', 'Commerce de gros de café, thé, cacao et épices', NULL, 'Moyen', 25, true),
(NULL, '46.38A', 'Commerce de gros de poissons, crustacés et mollusques', NULL, 'Moyen', 25, true),
(NULL, '46.38B', 'Commerce de gros alimentaire spécialisé divers', NULL, 'Moyen', 25, true),
(NULL, '46.39A', 'Commerce de gros de produits surgelés', NULL, 'Moyen', 25, true),
(NULL, '46.39B', 'Commerce de gros alimentaire non spécialisé', NULL, 'Moyen', 25, true),
(NULL, '46.41Z', 'Commerce de gros de textiles', NULL, 'Moyen', 25, true),
(NULL, '46.42Z', 'Commerce de gros d''habillement et de chaussures', NULL, 'Moyen', 25, true),
(NULL, '46.43Z', 'Commerce de gros d''appareils électroménagers', NULL, 'Moyen', 25, true),
(NULL, '46.44Z', 'Commerce de gros de vaisselle, verrerie et produits d''entretien', NULL, 'Moyen', 25, true),
(NULL, '46.45Z', 'Commerce de gros de parfumerie et de produits de beauté', NULL, 'Moyen', 25, true),
(NULL, '46.46Z', 'Commerce de gros de produits pharmaceutiques', NULL, 'Moyen', 25, true),
(NULL, '46.47Z', 'Commerce de gros de meubles, de tapis et d''appareils d''éclairage', NULL, 'Moyen', 25, true),
(NULL, '46.48Z', 'Commerce de gros d''articles d''horlogerie et de bijouterie', 'Risque bijouterie — commerce de luxe', 'Élevé', 70, true),
(NULL, '46.49Z', 'Commerce de gros d''autres biens domestiques', NULL, 'Moyen', 25, true),
(NULL, '46.51Z', 'Commerce de gros d''ordinateurs, d''équipements informatiques périphériques et de logiciels', NULL, 'Moyen', 25, true),
(NULL, '46.52Z', 'Commerce de gros de composants et d''équipements électroniques et de télécommunication', 'Risque téléphonie', 'Élevé', 60, true),
(NULL, '46.61Z', 'Commerce de gros de matériel agricole', NULL, 'Moyen', 25, true),
(NULL, '46.62Z', 'Commerce de gros de machines-outils', NULL, 'Moyen', 25, true),
(NULL, '46.63Z', 'Commerce de gros de machines pour l''extraction, la construction et le génie civil', NULL, 'Moyen', 25, true),
(NULL, '46.64Z', 'Commerce de gros de machines pour l''industrie textile et l''habillement', NULL, 'Moyen', 25, true),
(NULL, '46.65Z', 'Commerce de gros de mobilier de bureau', NULL, 'Moyen', 25, true),
(NULL, '46.66Z', 'Commerce de gros d''autres machines et équipements de bureau', NULL, 'Moyen', 25, true),
(NULL, '46.69A', 'Commerce de gros de matériel électrique', NULL, 'Moyen', 25, true),
(NULL, '46.69B', 'Commerce de gros de fournitures et équipements industriels divers', NULL, 'Moyen', 25, true),
(NULL, '46.69C', 'Commerce de gros de fournitures et équipements divers pour le commerce et les services', NULL, 'Moyen', 25, true),
(NULL, '46.71Z', 'Commerce de gros de combustibles et de produits annexes', NULL, 'Moyen', 25, true),
(NULL, '46.72Z', 'Commerce de gros de minerais et métaux', NULL, 'Moyen', 25, true),
(NULL, '46.73A', 'Commerce de gros de bois et de matériaux de construction', NULL, 'Moyen', 25, true),
(NULL, '46.73B', 'Commerce de gros d''appareils sanitaires et de produits de décoration', NULL, 'Moyen', 25, true),
(NULL, '46.74A', 'Commerce de gros de quincaillerie', NULL, 'Moyen', 25, true),
(NULL, '46.74B', 'Commerce de gros de fournitures pour la plomberie et le chauffage', NULL, 'Moyen', 25, true),
(NULL, '46.75Z', 'Commerce de gros de produits chimiques', NULL, 'Moyen', 25, true),
(NULL, '46.76Z', 'Commerce de gros d''autres produits intermédiaires', NULL, 'Moyen', 25, true),
(NULL, '46.77Z', 'Commerce de gros de déchets et débris', 'Risque ferraille — espèces, traçabilité', 'Élevé', 80, true),
(NULL, '46.90Z', 'Commerce de gros non spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.11A', 'Commerce de détail de produits surgelés', NULL, 'Moyen', 25, true),
(NULL, '47.11B', 'Commerce d''alimentation générale', 'Risque espèces — cash-intensive', 'Élevé', 60, true),
(NULL, '47.11C', 'Supérettes', 'Risque espèces — cash-intensive', 'Élevé', 60, true),
(NULL, '47.11D', 'Supermarchés', 'Risque espèces — cash-intensive', 'Élevé', 60, true),
(NULL, '47.11E', 'Magasins multi-commerces', NULL, 'Moyen', 25, true),
(NULL, '47.11F', 'Hypermarchés', NULL, 'Moyen', 25, true),
(NULL, '47.19A', 'Grands magasins', NULL, 'Moyen', 25, true),
(NULL, '47.19B', 'Autres commerces de détail en magasin non spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.21Z', 'Commerce de détail de fruits et légumes en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.22Z', 'Commerce de détail de viandes et de produits à base de viande en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.23Z', 'Commerce de détail de poissons, crustacés et mollusques en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.24Z', 'Commerce de détail de pain, pâtisserie et confiserie en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.25Z', 'Commerce de détail de boissons en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.26Z', 'Commerce de détail de produits à base de tabac en magasin spécialisé', 'Risque espèces — tabac, cash-intensive', 'Élevé', 65, true),
(NULL, '47.29Z', 'Autres commerces de détail alimentaires en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.30Z', 'Commerce de détail de carburants en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.41Z', 'Commerce de détail d''ordinateurs, d''unités périphériques et de logiciels en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.42Z', 'Commerce de détail de matériels de télécommunication en magasin spécialisé', 'Risque téléphonie — téléphonie mobile', 'Élevé', 65, true),
(NULL, '47.43Z', 'Commerce de détail de matériels audio et vidéo en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.51Z', 'Commerce de détail de textiles en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.52A', 'Commerce de détail de quincaillerie, peintures et verres en petites surfaces', NULL, 'Moyen', 25, true),
(NULL, '47.52B', 'Commerce de détail de quincaillerie, peintures et verres en grandes surfaces', NULL, 'Moyen', 25, true),
(NULL, '47.53Z', 'Commerce de détail de tapis, moquettes et revêtements de murs et de sols en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.54Z', 'Commerce de détail d''appareils électroménagers en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.59A', 'Commerce de détail de meubles', NULL, 'Moyen', 25, true),
(NULL, '47.59B', 'Commerce de détail d''autres équipements du foyer', NULL, 'Moyen', 25, true),
(NULL, '47.61Z', 'Commerce de détail de livres en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.62Z', 'Commerce de détail de journaux et papeterie en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.63Z', 'Commerce de détail d''enregistrements musicaux et vidéo en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.64Z', 'Commerce de détail d''articles de sport en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.65Z', 'Commerce de détail de jeux et jouets en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.71Z', 'Commerce de détail d''habillement en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.72A', 'Commerce de détail de la chaussure', NULL, 'Moyen', 25, true),
(NULL, '47.72B', 'Commerce de détail de maroquinerie et d''articles de voyage', NULL, 'Moyen', 25, true),
(NULL, '47.73Z', 'Commerce de détail de produits pharmaceutiques en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.74Z', 'Commerce de détail d''articles médicaux et orthopédiques en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.75Z', 'Commerce de détail de parfumerie et de produits de beauté en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.76Z', 'Commerce de détail de fleurs, plantes, graines, engrais, animaux de compagnie et aliments pour ces animaux en magasin spécialisé', NULL, 'Moyen', 25, true),
(NULL, '47.77Z', 'Commerce de détail d''articles d''horlogerie et de bijouterie en magasin spécialisé', 'Risque bijouterie — espèces, commerce de luxe', 'Élevé', 80, true),
(NULL, '47.78A', 'Commerces de détail d''optique', NULL, 'Moyen', 25, true),
(NULL, '47.78B', 'Commerces de détail de charbons et combustibles', NULL, 'Moyen', 25, true),
(NULL, '47.78C', 'Autres commerces de détail spécialisés divers', NULL, 'Moyen', 25, true),
(NULL, '47.79Z', 'Commerce de détail de biens d''occasion en magasin', NULL, 'Moyen', 25, true),
(NULL, '47.81Z', 'Commerce de détail alimentaire sur éventaires et marchés', 'Risque espèces — marché, cash', 'Élevé', 60, true),
(NULL, '47.82Z', 'Commerce de détail de textiles, d''habillement et de chaussures sur éventaires et marchés', NULL, 'Moyen', 25, true),
(NULL, '47.89Z', 'Autres commerces de détail sur éventaires et marchés', NULL, 'Moyen', 25, true),
(NULL, '47.91A', 'Vente à distance sur catalogue général', 'Risque E-commerce', 'Élevé', 60, true),
(NULL, '47.91B', 'Vente à distance sur catalogue spécialisé', 'Risque E-commerce', 'Élevé', 60, true),
(NULL, '47.99A', 'Vente à domicile', NULL, 'Moyen', 25, true),
(NULL, '47.99B', 'Vente par automates et autres commerces de détail hors magasin, éventaires ou marchés n.c.a.', NULL, 'Moyen', 25, true),

-- ========================
-- Section H : Transports et entreposage
-- ========================
(NULL, '49.10Z', 'Transport ferroviaire interurbain de voyageurs', NULL, 'Moyen', 25, true),
(NULL, '49.20Z', 'Transports ferroviaires de fret', NULL, 'Moyen', 25, true),
(NULL, '49.31Z', 'Transports urbains et suburbains de voyageurs', NULL, 'Moyen', 25, true),
(NULL, '49.32Z', 'Transports de voyageurs par taxis', 'Risque espèces — taxis/VTC, cash', 'Élevé', 60, true),
(NULL, '49.39A', 'Transports routiers réguliers de voyageurs', NULL, 'Moyen', 25, true),
(NULL, '49.39B', 'Autres transports routiers de voyageurs', NULL, 'Moyen', 25, true),
(NULL, '49.39C', 'Téléphériques et remontées mécaniques', NULL, 'Moyen', 25, true),
(NULL, '49.41A', 'Transports routiers de fret interurbains', NULL, 'Moyen', 25, true),
(NULL, '49.41B', 'Transports routiers de fret de proximité', NULL, 'Moyen', 25, true),
(NULL, '49.41C', 'Location de camions avec chauffeur', NULL, 'Moyen', 25, true),
(NULL, '49.42Z', 'Services de déménagement', NULL, 'Moyen', 25, true),
(NULL, '49.50Z', 'Transports par conduites', NULL, 'Moyen', 25, true),
(NULL, '50.10Z', 'Transports maritimes et côtiers de passagers', NULL, 'Moyen', 25, true),
(NULL, '50.20Z', 'Transports maritimes et côtiers de fret', NULL, 'Moyen', 25, true),
(NULL, '50.30Z', 'Transports fluviaux de passagers', NULL, 'Moyen', 25, true),
(NULL, '50.40Z', 'Transports fluviaux de fret', NULL, 'Moyen', 25, true),
(NULL, '51.10Z', 'Transports aériens de passagers', NULL, 'Moyen', 25, true),
(NULL, '51.21Z', 'Transports aériens de fret', NULL, 'Moyen', 25, true),
(NULL, '51.22Z', 'Transports spatiaux', NULL, 'Moyen', 25, true),
(NULL, '52.10A', 'Entreposage et stockage frigorifique', NULL, 'Moyen', 25, true),
(NULL, '52.10B', 'Entreposage et stockage non frigorifique', NULL, 'Moyen', 25, true),
(NULL, '52.21Z', 'Services auxiliaires des transports terrestres', NULL, 'Moyen', 25, true),
(NULL, '52.22Z', 'Services auxiliaires des transports par eau', NULL, 'Moyen', 25, true),
(NULL, '52.23Z', 'Services auxiliaires des transports aériens', NULL, 'Moyen', 25, true),
(NULL, '52.24A', 'Manutention portuaire', NULL, 'Moyen', 25, true),
(NULL, '52.24B', 'Manutention non portuaire', NULL, 'Moyen', 25, true),
(NULL, '52.29A', 'Messagerie, fret express', NULL, 'Moyen', 25, true),
(NULL, '52.29B', 'Affrètement et organisation des transports', NULL, 'Moyen', 25, true),
(NULL, '53.10Z', 'Activités de poste dans le cadre d''une obligation de service universel', NULL, 'Moyen', 25, true),
(NULL, '53.20Z', 'Autres activités de poste et de courrier', NULL, 'Moyen', 25, true),

-- ========================
-- Section I : Hébergement et restauration
-- ========================
(NULL, '55.10Z', 'Hôtels et hébergement similaire', NULL, 'Moyen', 25, true),
(NULL, '55.20Z', 'Hébergement touristique et autre hébergement de courte durée', NULL, 'Moyen', 25, true),
(NULL, '55.30Z', 'Terrains de camping et parcs pour caravanes ou véhicules de loisirs', NULL, 'Moyen', 25, true),
(NULL, '55.90Z', 'Autres hébergements', NULL, 'Moyen', 25, true),
(NULL, '56.10A', 'Restauration traditionnelle', 'Risque espèces — restauration, cash-intensive', 'Élevé', 65, true),
(NULL, '56.10B', 'Cafétérias et autres libres-services', 'Risque espèces', 'Élevé', 60, true),
(NULL, '56.10C', 'Restauration de type rapide', 'Risque espèces — très fort risque cash', 'Élevé', 75, true),
(NULL, '56.21Z', 'Services des traiteurs', NULL, 'Moyen', 25, true),
(NULL, '56.29A', 'Restauration collective sous contrat', NULL, 'Moyen', 25, true),
(NULL, '56.29B', 'Autres services de restauration n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '56.30Z', 'Débits de boissons', 'Risque espèces — bars, cash-intensive', 'Élevé', 65, true),

-- ========================
-- Section J : Information et communication
-- ========================
(NULL, '58.11Z', 'Édition de livres', NULL, 'Moyen', 25, true),
(NULL, '58.12Z', 'Édition de répertoires et de fichiers d''adresses', NULL, 'Moyen', 25, true),
(NULL, '58.13Z', 'Édition de journaux', NULL, 'Moyen', 25, true),
(NULL, '58.14Z', 'Édition de revues et périodiques', NULL, 'Moyen', 25, true),
(NULL, '58.19Z', 'Autres activités d''édition', NULL, 'Moyen', 25, true),
(NULL, '58.21Z', 'Édition de jeux électroniques', NULL, 'Moyen', 25, true),
(NULL, '58.29A', 'Édition de logiciels système et de réseau', NULL, 'Moyen', 25, true),
(NULL, '58.29B', 'Édition de logiciels outils de développement et de langages', NULL, 'Moyen', 25, true),
(NULL, '58.29C', 'Édition de logiciels applicatifs', NULL, 'Moyen', 25, true),
(NULL, '59.11A', 'Production de films et de programmes pour la télévision', NULL, 'Moyen', 25, true),
(NULL, '59.11B', 'Production de films institutionnels et publicitaires', NULL, 'Moyen', 25, true),
(NULL, '59.11C', 'Production de films pour le cinéma', NULL, 'Moyen', 25, true),
(NULL, '59.12Z', 'Post-production de films cinématographiques, de vidéo et de programmes de télévision', NULL, 'Moyen', 25, true),
(NULL, '59.13A', 'Distribution de films cinématographiques', NULL, 'Moyen', 25, true),
(NULL, '59.13B', 'Édition et distribution vidéo', NULL, 'Moyen', 25, true),
(NULL, '59.14Z', 'Projection de films cinématographiques', NULL, 'Moyen', 25, true),
(NULL, '59.20Z', 'Enregistrement sonore et édition musicale', NULL, 'Moyen', 25, true),
(NULL, '60.10Z', 'Édition et diffusion de programmes radio', NULL, 'Moyen', 25, true),
(NULL, '60.20A', 'Édition de chaînes généralistes', NULL, 'Moyen', 25, true),
(NULL, '60.20B', 'Édition de chaînes thématiques', NULL, 'Moyen', 25, true),
(NULL, '61.10Z', 'Télécommunications filaires', 'Risque téléphonie', 'Élevé', 60, true),
(NULL, '61.20Z', 'Télécommunications sans fil', 'Risque téléphonie', 'Élevé', 60, true),
(NULL, '61.30Z', 'Télécommunications par satellite', 'Risque téléphonie', 'Élevé', 60, true),
(NULL, '61.90Z', 'Autres activités de télécommunication', 'Risque téléphonie', 'Élevé', 60, true),
(NULL, '62.01Z', 'Programmation informatique', NULL, 'Moyen', 25, true),
(NULL, '62.02A', 'Conseil en systèmes et logiciels informatiques', NULL, 'Moyen', 25, true),
(NULL, '62.02B', 'Tierce maintenance de systèmes et d''applications informatiques', NULL, 'Moyen', 25, true),
(NULL, '62.03Z', 'Gestion d''installations informatiques', NULL, 'Moyen', 25, true),
(NULL, '62.09Z', 'Autres activités informatiques', NULL, 'Moyen', 25, true),
(NULL, '63.11Z', 'Traitement de données, hébergement et activités connexes', NULL, 'Moyen', 25, true),
(NULL, '63.12Z', 'Portails Internet', NULL, 'Moyen', 25, true),
(NULL, '63.91Z', 'Activités des agences de presse', NULL, 'Moyen', 25, true),
(NULL, '63.99Z', 'Autres services d''information n.c.a.', NULL, 'Moyen', 25, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.ref_activites (cabinet_id, code, libelle, description, niveau_risque, score, is_default) VALUES
-- ========================
-- Section K : Activités financières et d'assurance
-- ========================
(NULL, '64.11Z', 'Activités de banque centrale', NULL, 'Moyen', 25, true),
(NULL, '64.19Z', 'Autres intermédiations monétaires', 'Risque financier — intermédiations monétaires', 'Élevé', 70, true),
(NULL, '64.20Z', 'Activités des sociétés holding', 'Risque structure — holding, opacité', 'Élevé', 65, true),
(NULL, '64.30Z', 'Fonds de placement et entités financières similaires', NULL, 'Moyen', 25, true),
(NULL, '64.91Z', 'Crédit-bail', NULL, 'Moyen', 25, true),
(NULL, '64.92Z', 'Autre distribution de crédit', NULL, 'Moyen', 25, true),
(NULL, '64.99Z', 'Autres activités des services financiers, hors assurance et caisses de retraite, n.c.a.', 'Risque financier — services financiers opaques', 'Élevé', 80, true),
(NULL, '65.11Z', 'Assurance vie', NULL, 'Moyen', 25, true),
(NULL, '65.12Z', 'Autres assurances', NULL, 'Moyen', 25, true),
(NULL, '65.20Z', 'Réassurance', NULL, 'Moyen', 25, true),
(NULL, '65.30Z', 'Caisses de retraite', NULL, 'Moyen', 25, true),
(NULL, '66.11Z', 'Administration de marchés financiers', NULL, 'Moyen', 25, true),
(NULL, '66.12Z', 'Courtage de valeurs mobilières et de marchandises', NULL, 'Moyen', 25, true),
(NULL, '66.19A', 'Activités des agents et courtiers d''assurances', NULL, 'Moyen', 25, true),
(NULL, '66.19B', 'Autres activités auxiliaires de services financiers, hors assurance et caisses de retraite', 'Risque financier', 'Élevé', 60, true),
(NULL, '66.21Z', 'Évaluation des risques et dommages', NULL, 'Moyen', 25, true),
(NULL, '66.22Z', 'Activités des agents et courtiers d''assurances', NULL, 'Moyen', 25, true),
(NULL, '66.29Z', 'Autres activités auxiliaires d''assurance et de caisses de retraite', NULL, 'Moyen', 25, true),
(NULL, '66.30Z', 'Gestion de fonds', NULL, 'Moyen', 25, true),

-- ========================
-- Section L : Activités immobilières
-- ========================
(NULL, '68.10Z', 'Activités des marchands de biens immobiliers', 'Risque immobilier — blanchiment immobilier, espèces', 'Élevé', 80, true),
(NULL, '68.20A', 'Location de logements', 'Risque immobilier', 'Élevé', 60, true),
(NULL, '68.20B', 'Location de terrains et d''autres biens immobiliers', 'Risque immobilier', 'Élevé', 60, true),
(NULL, '68.31Z', 'Agences immobilières', 'Risque immobilier — intermédiaire immobilier', 'Élevé', 70, true),
(NULL, '68.32A', 'Administration d''immeubles et autres biens immobiliers', 'Risque immobilier', 'Élevé', 60, true),
(NULL, '68.32B', 'Supports juridiques de gestion de patrimoine immobilier', 'Risque immobilier', 'Élevé', 65, true),

-- ========================
-- Section M : Activités spécialisées, scientifiques et techniques
-- ========================
(NULL, '69.10Z', 'Activités juridiques', NULL, 'Moyen', 25, true),
(NULL, '69.20Z', 'Activités comptables', NULL, 'Moyen', 25, true),
(NULL, '70.10Z', 'Activités des sièges sociaux', NULL, 'Moyen', 25, true),
(NULL, '70.21Z', 'Conseil en relations publiques et communication', NULL, 'Moyen', 25, true),
(NULL, '70.22Z', 'Conseil pour les affaires et autres conseils de gestion', NULL, 'Moyen', 25, true),
(NULL, '71.11Z', 'Activités d''architecture', NULL, 'Moyen', 25, true),
(NULL, '71.12A', 'Activité des géomètres', NULL, 'Moyen', 25, true),
(NULL, '71.12B', 'Ingénierie, études techniques', NULL, 'Moyen', 25, true),
(NULL, '71.20A', 'Contrôle technique automobile', NULL, 'Moyen', 25, true),
(NULL, '71.20B', 'Analyses, essais et inspections techniques', NULL, 'Moyen', 25, true),
(NULL, '72.11Z', 'Recherche-développement en biotechnologie', NULL, 'Moyen', 25, true),
(NULL, '72.19Z', 'Recherche-développement en autres sciences physiques et naturelles', NULL, 'Moyen', 25, true),
(NULL, '72.20Z', 'Recherche-développement en sciences humaines et sociales', NULL, 'Moyen', 25, true),
(NULL, '73.11Z', 'Activités des agences de publicité', NULL, 'Moyen', 25, true),
(NULL, '73.12Z', 'Régie publicitaire de médias', NULL, 'Moyen', 25, true),
(NULL, '73.20Z', 'Études de marché et sondages', NULL, 'Moyen', 25, true),
(NULL, '74.10Z', 'Activités spécialisées de design', NULL, 'Moyen', 25, true),
(NULL, '74.20Z', 'Activités photographiques', NULL, 'Moyen', 25, true),
(NULL, '74.30Z', 'Traduction et interprétation', NULL, 'Moyen', 25, true),
(NULL, '74.90A', 'Activité des économistes de la construction', NULL, 'Moyen', 25, true),
(NULL, '74.90B', 'Activités spécialisées, scientifiques et techniques diverses', NULL, 'Moyen', 25, true),
(NULL, '75.00Z', 'Activités vétérinaires', NULL, 'Moyen', 25, true),

-- ========================
-- Section N : Activités de services administratifs et de soutien
-- ========================
(NULL, '77.11A', 'Location de courte durée de voitures et de véhicules automobiles légers', NULL, 'Moyen', 25, true),
(NULL, '77.11B', 'Location de longue durée de voitures et de véhicules automobiles légers', NULL, 'Moyen', 25, true),
(NULL, '77.12Z', 'Location et location-bail de camions', NULL, 'Moyen', 25, true),
(NULL, '77.21Z', 'Location et location-bail d''articles de loisirs et de sport', NULL, 'Moyen', 25, true),
(NULL, '77.22Z', 'Location de vidéocassettes et disques vidéo', NULL, 'Moyen', 25, true),
(NULL, '77.29Z', 'Location et location-bail d''autres biens personnels et domestiques', NULL, 'Moyen', 25, true),
(NULL, '77.31Z', 'Location et location-bail de machines et équipements agricoles', NULL, 'Moyen', 25, true),
(NULL, '77.32Z', 'Location et location-bail de machines et équipements pour la construction', NULL, 'Moyen', 25, true),
(NULL, '77.33Z', 'Location et location-bail de machines de bureau et de matériel informatique', NULL, 'Moyen', 25, true),
(NULL, '77.34Z', 'Location et location-bail de matériels de transport par eau', NULL, 'Moyen', 25, true),
(NULL, '77.35Z', 'Location et location-bail de matériels de transport aérien', NULL, 'Moyen', 25, true),
(NULL, '77.39Z', 'Location et location-bail d''autres machines, équipements et biens matériels n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '77.40Z', 'Location-bail de propriété intellectuelle et de produits similaires', NULL, 'Moyen', 25, true),
(NULL, '78.10Z', 'Activités des agences de placement de main-d''œuvre', NULL, 'Moyen', 25, true),
(NULL, '78.20Z', 'Activités des agences de travail temporaire', NULL, 'Moyen', 25, true),
(NULL, '78.30Z', 'Autre mise à disposition de ressources humaines', NULL, 'Moyen', 25, true),
(NULL, '79.11Z', 'Activités des agences de voyage', NULL, 'Moyen', 25, true),
(NULL, '79.12Z', 'Activités des voyagistes', NULL, 'Moyen', 25, true),
(NULL, '79.90Z', 'Autres services de réservation et activités connexes', NULL, 'Moyen', 25, true),
(NULL, '80.10Z', 'Activités de sécurité privée', NULL, 'Moyen', 25, true),
(NULL, '80.20Z', 'Activités liées aux systèmes de sécurité', NULL, 'Moyen', 25, true),
(NULL, '80.30Z', 'Activités d''enquête', NULL, 'Moyen', 25, true),
(NULL, '81.10Z', 'Activités combinées de soutien lié aux bâtiments', NULL, 'Moyen', 25, true),
(NULL, '81.21Z', 'Nettoyage courant des bâtiments', NULL, 'Moyen', 25, true),
(NULL, '81.22Z', 'Autres activités de nettoyage des bâtiments et nettoyage industriel', NULL, 'Moyen', 25, true),
(NULL, '81.29A', 'Désinfection, désinsectisation, dératisation', NULL, 'Moyen', 25, true),
(NULL, '81.29B', 'Autres activités de nettoyage n.c.a.', NULL, 'Moyen', 25, true),
(NULL, '81.30Z', 'Services d''aménagement paysager', NULL, 'Moyen', 25, true),
(NULL, '82.11Z', 'Services administratifs combinés de bureau', NULL, 'Moyen', 25, true),
(NULL, '82.19Z', 'Photocopie, préparation de documents et autres activités spécialisées de soutien de bureau', NULL, 'Moyen', 25, true),
(NULL, '82.20Z', 'Activités de centres d''appels', NULL, 'Moyen', 25, true),
(NULL, '82.30Z', 'Organisation de foires, salons professionnels et congrès', NULL, 'Moyen', 25, true),
(NULL, '82.91Z', 'Activités des agences de recouvrement de factures et des sociétés d''information financière sur la clientèle', NULL, 'Moyen', 25, true),
(NULL, '82.92Z', 'Activités de conditionnement', NULL, 'Moyen', 25, true),
(NULL, '82.99Z', 'Autres activités de soutien aux entreprises n.c.a.', 'Risque domiciliation — sociétés écran possibles', 'Élevé', 65, true),

-- ========================
-- Section O : Administration publique
-- ========================
(NULL, '84.11Z', 'Administration publique générale', NULL, 'Moyen', 25, true),
(NULL, '84.12Z', 'Administration publique (tutelle) de la santé, de la formation, de la culture et des services sociaux, autre que sécurité sociale', NULL, 'Moyen', 25, true),
(NULL, '84.13Z', 'Administration publique (tutelle) des activités économiques', NULL, 'Moyen', 25, true),
(NULL, '84.21Z', 'Affaires étrangères', NULL, 'Moyen', 25, true),
(NULL, '84.22Z', 'Défense', NULL, 'Moyen', 25, true),
(NULL, '84.23Z', 'Justice', NULL, 'Moyen', 25, true),
(NULL, '84.24Z', 'Activités d''ordre public et de sécurité', NULL, 'Moyen', 25, true),
(NULL, '84.25Z', 'Services du feu et de secours', NULL, 'Moyen', 25, true),
(NULL, '84.30A', 'Activités générales de sécurité sociale', NULL, 'Moyen', 25, true),
(NULL, '84.30B', 'Gestion des retraites complémentaires', NULL, 'Moyen', 25, true),
(NULL, '84.30C', 'Distribution sociale de revenus', NULL, 'Moyen', 25, true),

-- ========================
-- Section P : Enseignement
-- ========================
(NULL, '85.10Z', 'Enseignement pré-primaire', NULL, 'Moyen', 25, true),
(NULL, '85.20Z', 'Enseignement primaire', NULL, 'Moyen', 25, true),
(NULL, '85.31Z', 'Enseignement secondaire général', NULL, 'Moyen', 25, true),
(NULL, '85.32Z', 'Enseignement secondaire technique ou professionnel', NULL, 'Moyen', 25, true),
(NULL, '85.41Z', 'Enseignement post-secondaire non supérieur', NULL, 'Moyen', 25, true),
(NULL, '85.42Z', 'Enseignement supérieur', NULL, 'Moyen', 25, true),
(NULL, '85.51Z', 'Enseignement de disciplines sportives et d''activités de loisirs', NULL, 'Moyen', 25, true),
(NULL, '85.52Z', 'Enseignement culturel', NULL, 'Moyen', 25, true),
(NULL, '85.53Z', 'Enseignement de la conduite', NULL, 'Moyen', 25, true),
(NULL, '85.59A', 'Formation continue d''adultes', NULL, 'Moyen', 25, true),
(NULL, '85.59B', 'Autres enseignements', NULL, 'Moyen', 25, true),
(NULL, '85.60Z', 'Activités de soutien à l''enseignement', NULL, 'Moyen', 25, true),

-- ========================
-- Section Q : Santé humaine et action sociale
-- ========================
(NULL, '86.10Z', 'Activités hospitalières', NULL, 'Moyen', 25, true),
(NULL, '86.21Z', 'Activités des médecins généralistes', NULL, 'Moyen', 25, true),
(NULL, '86.22A', 'Activités de radiodiagnostic et de radiothérapie', NULL, 'Moyen', 25, true),
(NULL, '86.22B', 'Activités chirurgicales', NULL, 'Moyen', 25, true),
(NULL, '86.22C', 'Autres activités des médecins spécialistes', NULL, 'Moyen', 25, true),
(NULL, '86.23Z', 'Pratique dentaire', NULL, 'Moyen', 25, true),
(NULL, '86.90A', 'Ambulances', NULL, 'Moyen', 25, true),
(NULL, '86.90B', 'Laboratoires d''analyses médicales', NULL, 'Moyen', 25, true),
(NULL, '86.90C', 'Centres de collecte et banques d''organes', NULL, 'Moyen', 25, true),
(NULL, '86.90D', 'Activités des infirmiers et des sages-femmes', NULL, 'Moyen', 25, true),
(NULL, '86.90E', 'Activités des professionnels de la rééducation, de l''appareillage et des pédicures-podologues', NULL, 'Moyen', 25, true),
(NULL, '86.90F', 'Activités de santé humaine non classées ailleurs', NULL, 'Moyen', 25, true),
(NULL, '87.10A', 'Hébergement médicalisé pour personnes âgées', NULL, 'Moyen', 25, true),
(NULL, '87.10B', 'Hébergement médicalisé pour enfants handicapés', NULL, 'Moyen', 25, true),
(NULL, '87.10C', 'Hébergement médicalisé pour adultes handicapés et autre hébergement médicalisé', NULL, 'Moyen', 25, true),
(NULL, '87.20Z', 'Hébergement social pour handicapés mentaux, malades mentaux et toxicomanes', NULL, 'Moyen', 25, true),
(NULL, '87.30A', 'Hébergement social pour personnes âgées', NULL, 'Moyen', 25, true),
(NULL, '87.30B', 'Hébergement social pour handicapés physiques', NULL, 'Moyen', 25, true),
(NULL, '87.90A', 'Hébergement social pour enfants en difficulté', NULL, 'Moyen', 25, true),
(NULL, '87.90B', 'Hébergement social pour adultes et familles en difficultés et autre hébergement social', NULL, 'Moyen', 25, true),
(NULL, '88.10A', 'Aide à domicile', NULL, 'Moyen', 25, true),
(NULL, '88.10B', 'Accueil ou accompagnement sans hébergement d''adultes handicapés ou de personnes âgées', NULL, 'Moyen', 25, true),
(NULL, '88.10C', 'Aide par le travail', NULL, 'Moyen', 25, true),
(NULL, '88.91A', 'Accueil de jeunes enfants', NULL, 'Moyen', 25, true),
(NULL, '88.91B', 'Accueil ou accompagnement sans hébergement d''enfants handicapés', NULL, 'Moyen', 25, true),
(NULL, '88.99A', 'Autre accueil ou accompagnement sans hébergement d''enfants et d''adolescents', NULL, 'Moyen', 25, true),
(NULL, '88.99B', 'Action sociale sans hébergement n.c.a.', NULL, 'Moyen', 25, true),

-- ========================
-- Section R : Arts, spectacles et activités récréatives
-- ========================
(NULL, '90.01Z', 'Arts du spectacle vivant', NULL, 'Moyen', 25, true),
(NULL, '90.02Z', 'Activités de soutien au spectacle vivant', NULL, 'Moyen', 25, true),
(NULL, '90.03A', 'Création artistique relevant des arts plastiques', NULL, 'Moyen', 25, true),
(NULL, '90.03B', 'Autre création artistique', 'Risque œuvres d''art — blanchiment par le marché de l''art', 'Élevé', 70, true),
(NULL, '90.04Z', 'Gestion de salles de spectacles', NULL, 'Moyen', 25, true),
(NULL, '91.01Z', 'Gestion des bibliothèques et des archives', NULL, 'Moyen', 25, true),
(NULL, '91.02Z', 'Gestion des musées', NULL, 'Moyen', 25, true),
(NULL, '91.03Z', 'Gestion des sites et monuments historiques et des attractions touristiques similaires', NULL, 'Moyen', 25, true),
(NULL, '91.04Z', 'Gestion des jardins botaniques et zoologiques et des réserves naturelles', NULL, 'Moyen', 25, true),
(NULL, '92.00Z', 'Organisation de jeux de hasard et d''argent', 'Risque critique — jeux d''argent, blanchiment, espèces', 'Élevé', 100, true),
(NULL, '93.11Z', 'Gestion d''installations sportives', NULL, 'Moyen', 25, true),
(NULL, '93.12Z', 'Activités de clubs de sports', NULL, 'Moyen', 25, true),
(NULL, '93.13Z', 'Activités des centres de culture physique', NULL, 'Moyen', 25, true),
(NULL, '93.19Z', 'Autres activités liées au sport', NULL, 'Moyen', 25, true),
(NULL, '93.21Z', 'Activités des parcs d''attractions et parcs à thèmes', NULL, 'Moyen', 25, true),
(NULL, '93.29Z', 'Autres activités récréatives et de loisirs', NULL, 'Moyen', 25, true),

-- ========================
-- Section S : Autres activités de services
-- ========================
(NULL, '94.11Z', 'Activités des organisations patronales et consulaires', NULL, 'Moyen', 25, true),
(NULL, '94.12Z', 'Activités des organisations professionnelles', NULL, 'Moyen', 25, true),
(NULL, '94.20Z', 'Activités des syndicats de salariés', NULL, 'Moyen', 25, true),
(NULL, '94.91Z', 'Activités des organisations religieuses', NULL, 'Moyen', 25, true),
(NULL, '94.92Z', 'Activités des organisations politiques', NULL, 'Moyen', 25, true),
(NULL, '94.99Z', 'Autres organisations fonctionnant par adhésion volontaire', NULL, 'Moyen', 25, true),
(NULL, '95.11Z', 'Réparation d''ordinateurs et d''équipements périphériques', NULL, 'Moyen', 25, true),
(NULL, '95.12Z', 'Réparation d''équipements de communication', NULL, 'Moyen', 25, true),
(NULL, '95.21Z', 'Réparation de produits électroniques grand public', NULL, 'Moyen', 25, true),
(NULL, '95.22Z', 'Réparation d''appareils électroménagers et d''équipements pour la maison et le jardin', NULL, 'Moyen', 25, true),
(NULL, '95.23Z', 'Réparation de chaussures et d''articles en cuir', NULL, 'Moyen', 25, true),
(NULL, '95.24Z', 'Réparation de meubles et d''équipements du foyer', NULL, 'Moyen', 25, true),
(NULL, '95.25Z', 'Réparation d''articles d''horlogerie et de bijouterie', 'Risque bijouterie', 'Élevé', 60, true),
(NULL, '95.29Z', 'Réparation d''autres biens personnels et domestiques', NULL, 'Moyen', 25, true),
(NULL, '96.01A', 'Blanchisserie-teinturerie de gros', NULL, 'Moyen', 25, true),
(NULL, '96.01B', 'Blanchisserie-teinturerie de détail', 'Risque espèces — pressing, cash', 'Élevé', 60, true),
(NULL, '96.02A', 'Coiffure', 'Risque espèces — coiffure, cash-intensive', 'Élevé', 60, true),
(NULL, '96.02B', 'Soins de beauté', 'Risque espèces — esthétique, cash-intensive', 'Élevé', 60, true),
(NULL, '96.03Z', 'Services funéraires', NULL, 'Moyen', 25, true),
(NULL, '96.04Z', 'Entretien corporel', 'Risque espèces — spa, cash-intensive', 'Élevé', 60, true),
(NULL, '96.09Z', 'Autres services personnels n.c.a.', NULL, 'Moyen', 25, true),

-- ========================
-- Section T : Activités des ménages
-- ========================
(NULL, '97.00Z', 'Activités des ménages en tant qu''employeurs de personnel domestique', NULL, 'Moyen', 25, true),
(NULL, '98.10Z', 'Activités indifférenciées des ménages en tant que producteurs de biens pour usage propre', NULL, 'Moyen', 25, true),
(NULL, '98.20Z', 'Activités indifférenciées des ménages en tant que producteurs de services pour usage propre', NULL, 'Moyen', 25, true),

-- ========================
-- Section U : Activités extraterritoriales
-- ========================
(NULL, '99.00Z', 'Activités des organisations et organismes extraterritoriaux', NULL, 'Moyen', 25, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Seed data : ref_questions (22 questions KANTA)
-- ============================================================================

INSERT INTO public.ref_questions (cabinet_id, libelle, categories, description, reponse_risquee, ordre, is_default) VALUES
-- Questions PPE / Sanctions
(NULL,
 'Le client ou son représentant est-il une Personne Politiquement Exposée (PPE) ?',
 '{"LAB - Personne morale","LAB - Personne physique","Acceptation mission"}',
 'Art. L.561-10 II CMF — Vérifier le statut PPE du client, de ses bénéficiaires effectifs et de ses proches',
 'Oui', 1, true),

(NULL,
 'Le client est-il lié à un pays à risque (liste GAFI / UE) ?',
 '{"LAB - Personne morale","LAB - Personne physique","Acceptation mission"}',
 'Art. L.561-10 I 4° CMF — Vérifier les liens géographiques avec des juridictions à haut risque',
 'Oui', 2, true),

(NULL,
 'Le client fait-il l''objet de mesures de gel des avoirs ou de sanctions internationales ?',
 '{"LAB - Personne morale","LAB - Personne physique","Acceptation mission"}',
 'Art. L.562-1 CMF — Vérifier les listes de gel des avoirs (UE, ONU, OFAC)',
 'Oui', 3, true),

-- Questions structurelles
(NULL,
 'Le montage juridique du client est-il atypique ou complexe sans justification économique ?',
 '{"LAB - Personne morale","Acceptation mission"}',
 'Art. L.561-10-2 CMF — Montages opaques, structures imbriquées sans logique économique',
 'Oui', 4, true),

(NULL,
 'La structure capitalistique est-elle opaque ou anormalement complexe ?',
 '{"LAB - Personne morale","Acceptation mission"}',
 'Art. L.561-10 II CMF — Chaînes de détention complexes, sociétés écran, prête-noms',
 'Oui', 5, true),

(NULL,
 'Le capital social est-il détenu par des personnes non identifiées ou des sociétés écran ?',
 '{"LAB - Personne morale","Vigilance renforcée"}',
 'Art. L.561-2-2 CMF — Bénéficiaires effectifs non identifiables ou dissimulés',
 'Oui', 6, true),

(NULL,
 'Le bénéficiaire effectif est-il difficilement identifiable ?',
 '{"LAB - Personne morale","Vigilance renforcée"}',
 'Art. L.561-2-2 CMF — Impossibilité ou difficulté d''identifier le bénéficiaire effectif réel',
 'Oui', 7, true),

-- Questions géographiques
(NULL,
 'Le client détient-il des filiales dans des pays à fiscalité privilégiée ?',
 '{"LAB - Personne morale","Acceptation mission"}',
 'Art. L.561-10 I 4° CMF — Présence dans des paradis fiscaux ou juridictions opaques',
 'Oui', 8, true),

(NULL,
 'Des transactions significatives sont-elles réalisées avec des pays à risque ?',
 '{"LAB - Personne morale","Maintien relation"}',
 'Art. L.561-15 II CMF — Flux financiers vers/depuis des juridictions à haut risque',
 'Oui', 9, true),

(NULL,
 'Les principaux fournisseurs sont-ils situés dans des pays à risque ?',
 '{"LAB - Personne morale","Maintien relation"}',
 'Art. L.561-10 I CMF — Chaîne d''approvisionnement liée à des juridictions sensibles',
 'Oui', 10, true),

-- Questions opérationnelles
(NULL,
 'La relation d''affaires est-elle intégralement à distance (jamais de rencontre physique) ?',
 '{"LAB - Personne morale","LAB - Personne physique","Acceptation mission"}',
 'Art. R.561-5-2 CMF — Absence de contact en face-à-face augmente le risque d''usurpation d''identité',
 'Oui', 11, true),

(NULL,
 'L''activité du client implique-t-elle la manipulation d''espèces significatives ?',
 '{"LAB - Personne morale","Acceptation mission","Maintien relation"}',
 'Art. L.561-15 CMF — Flux d''espèces importants, risque de blanchiment',
 'Oui', 12, true),

(NULL,
 'Des mouvements d''argent liquide inhabituels sont-ils constatés ?',
 '{"LAB - Personne morale","Maintien relation","Vigilance renforcée"}',
 'Art. L.561-15 CMF — Retraits/dépôts en espèces incohérents avec l''activité déclarée',
 'Oui', 13, true),

(NULL,
 'Le client exerce-t-il une pression ou une urgence inhabituelle sur les délais ?',
 '{"LAB - Personne morale","LAB - Personne physique","Maintien relation"}',
 'Art. L.561-10-2 3° CMF — Pression pour accélérer sans raison légitime',
 'Oui', 14, true),

(NULL,
 'Le client a-t-il effectué des changements juridiques fréquents (forme, siège, objet social) ?',
 '{"LAB - Personne morale","Maintien relation"}',
 'Art. R.561-38 CMF — Modifications statutaires fréquentes pouvant masquer des opérations',
 'Oui', 15, true),

(NULL,
 'Le client a-t-il changé fréquemment d''expert-comptable ou de conseil ?',
 '{"Acceptation mission","Maintien relation"}',
 'Indicateur de risque — Changements fréquents de professionnels sans explication satisfaisante',
 'Oui', 16, true),

(NULL,
 'Le client refuse-t-il de communiquer des pièces justificatives ou des informations nécessaires ?',
 '{"LAB - Personne morale","LAB - Personne physique","Maintien relation","Vigilance renforcée"}',
 'Art. L.561-5 CMF — Refus de fournir les éléments d''identification ou de justification',
 'Oui', 17, true),

(NULL,
 'Existe-t-il une incohérence entre le chiffre d''affaires déclaré et les moyens d''exploitation ?',
 '{"LAB - Personne morale","Maintien relation","Vigilance renforcée"}',
 'Art. L.561-15 CMF — Chiffre d''affaires disproportionné par rapport aux moyens humains et matériels',
 'Oui', 18, true),

(NULL,
 'Des opérations sans logique économique apparente sont-elles constatées ?',
 '{"LAB - Personne morale","Maintien relation","Vigilance renforcée"}',
 'Art. L.561-10-2 CMF — Opérations atypiques sans justification économique ou juridique',
 'Oui', 19, true),

(NULL,
 'Le client est-il soumis à des procédures judiciaires en cours (pénale, civile, fiscale) ?',
 '{"LAB - Personne morale","LAB - Personne physique","Acceptation mission"}',
 'Indicateur contextuel — Procédures en cours pouvant impacter l''évaluation de risque',
 'Oui', 20, true),

(NULL,
 'Le client a-t-il recours à des paiements en espèces de montants élevés ou fractionnés ?',
 '{"LAB - Personne morale","Maintien relation","Vigilance renforcée"}',
 'Art. L.561-15 CMF — Paiements cash élevés ou fractionnés sous les seuils déclaratifs',
 'Oui', 21, true),

(NULL,
 'L''activité du client est-elle en lien avec des zones de conflit ou des secteurs sous embargo ?',
 '{"LAB - Personne morale","Acceptation mission","Vigilance renforcée"}',
 'Art. L.561-10 I CMF — Liens commerciaux avec des zones de conflit armé ou sous embargo',
 'Oui', 22, true)
ON CONFLICT DO NOTHING;

-- Pays supplémentaires pour compléter la liste
INSERT INTO public.ref_pays (cabinet_id, code, libelle, libelle_nationalite, description, niveau_risque, score, est_gafi_noir, est_gafi_gris, est_offshore, est_sanctionne, est_non_cooperatif, is_default) VALUES
(NULL, 'TW', 'Taïwan', 'Taïwanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'XK', 'Kosovo', 'Kosovare', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MO', 'Macao', 'Macanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CG', 'Congo-Brazzaville', 'Congolaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BN', 'Brunei Darussalam', 'Brunéienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SG', 'Singapour', 'Singapourienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GN', 'Guinée', 'Guinéenne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'SL', 'Sierra Leone', 'Sierra-Léonaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'LR', 'Liberia', 'Libérienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'GM', 'Gambie', 'Gambienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'CV', 'Cap-Vert', 'Cap-Verdienne', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'BW', 'Botswana', 'Botswanaise', NULL, 'Moyen', 0, false, false, false, false, false, true),
(NULL, 'MW', 'Malawi', 'Malawienne', NULL, 'Moyen', 0, false, false, false, false, false, true)
ON CONFLICT DO NOTHING;
