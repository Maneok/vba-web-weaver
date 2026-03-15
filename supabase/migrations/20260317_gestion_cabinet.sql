-- ============================================================================
-- Migration: Gestion multi-cabinet (inspiré KANTA)
-- Date: 2026-03-17
-- Tables: cabinets, cabinet_membres, cabinet_roles, cabinet_reglages,
--         cabinet_connecteurs, cabinet_api_keys
-- ============================================================================

-- =========================
-- 1. TABLE cabinets (ALTER existing table to add missing columns)
-- =========================
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS cp text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS siret text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS numero_oec text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS telephone text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS couleur_primaire text DEFAULT '#3b82f6';
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS is_principal boolean DEFAULT false;
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS parent_cabinet_id uuid REFERENCES public.cabinets(id);
ALTER TABLE public.cabinets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- =========================
-- 2. TABLE cabinet_membres
-- =========================
CREATE TABLE IF NOT EXISTS public.cabinet_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES public.cabinets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'COLLABORATEUR'
    CHECK (role IN ('ADMIN', 'SUPERVISEUR', 'COLLABORATEUR', 'CONTROLEUR', 'SECRETAIRE', 'STAGIAIRE')),
  is_active boolean DEFAULT true,
  date_ajout timestamptz DEFAULT now(),
  UNIQUE(cabinet_id, user_id)
);

-- =========================
-- 3. TABLE cabinet_roles
-- =========================
CREATE TABLE IF NOT EXISTS public.cabinet_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES public.cabinets(id) ON DELETE CASCADE,
  role text NOT NULL,
  permission text NOT NULL
    CHECK (permission IN ('VISIONNER', 'TRAVAILLER', 'AFFECTER', 'VALIDER', 'SUPPRIMER', 'EXPORTER', 'PARAMETRER', 'INVITER')),
  granted boolean NOT NULL DEFAULT false,
  UNIQUE(cabinet_id, role, permission)
);

-- =========================
-- 4. TABLE cabinet_reglages
-- =========================
CREATE TABLE IF NOT EXISTS public.cabinet_reglages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES public.cabinets(id) ON DELETE CASCADE UNIQUE,
  restreindre_visibilite_affectations boolean DEFAULT false,
  restreindre_visibilite_cabinet boolean DEFAULT false,
  restreindre_validation_responsables boolean DEFAULT false,
  limiter_exports_auteur boolean DEFAULT false,
  limiter_notifications_affectes boolean DEFAULT false,
  bloquer_demandes_validation_incompletes boolean DEFAULT false,
  bloquer_validations_incompletes boolean DEFAULT false,
  generation_auto_maintiens boolean DEFAULT true,
  documents_expires_manquants boolean DEFAULT true,
  mises_a_jour_externes boolean DEFAULT true,
  delai_suspension_jours integer DEFAULT 90,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 5. TABLE cabinet_connecteurs
-- =========================
CREATE TABLE IF NOT EXISTS public.cabinet_connecteurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES public.cabinets(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL,
  statut text DEFAULT 'deconnecte'
    CHECK (statut IN ('connecte', 'deconnecte', 'erreur')),
  config jsonb DEFAULT '{}',
  derniere_connexion timestamptz,
  derniere_activite timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 6. TABLE cabinet_api_keys
-- =========================
CREATE TABLE IF NOT EXISTS public.cabinet_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES public.cabinets(id) ON DELETE CASCADE,
  nom text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions text[] DEFAULT '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 7. RLS sur toutes les tables
-- =========================

-- Helper: get cabinet IDs for current user
CREATE OR REPLACE FUNCTION public.get_user_cabinet_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(cabinet_id), '{}')
  FROM public.cabinet_membres
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- cabinets (RLS already enabled, drop old policy)
DROP POLICY IF EXISTS "cabinet_select" ON public.cabinets;

CREATE POLICY "cabinets_select" ON public.cabinets
  FOR SELECT USING (id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinets_insert" ON public.cabinets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "cabinets_update" ON public.cabinets
  FOR UPDATE USING (id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinets_delete" ON public.cabinets
  FOR DELETE USING (id = ANY(public.get_user_cabinet_ids()));

-- cabinet_membres
ALTER TABLE public.cabinet_membres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_membres_select" ON public.cabinet_membres
  FOR SELECT USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_membres_insert" ON public.cabinet_membres
  FOR INSERT WITH CHECK (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_membres_update" ON public.cabinet_membres
  FOR UPDATE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_membres_delete" ON public.cabinet_membres
  FOR DELETE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

-- cabinet_roles
ALTER TABLE public.cabinet_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_roles_select" ON public.cabinet_roles
  FOR SELECT USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_roles_insert" ON public.cabinet_roles
  FOR INSERT WITH CHECK (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_roles_update" ON public.cabinet_roles
  FOR UPDATE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_roles_delete" ON public.cabinet_roles
  FOR DELETE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

-- cabinet_reglages
ALTER TABLE public.cabinet_reglages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_reglages_select" ON public.cabinet_reglages
  FOR SELECT USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_reglages_insert" ON public.cabinet_reglages
  FOR INSERT WITH CHECK (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_reglages_update" ON public.cabinet_reglages
  FOR UPDATE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_reglages_delete" ON public.cabinet_reglages
  FOR DELETE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

-- cabinet_connecteurs
ALTER TABLE public.cabinet_connecteurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_connecteurs_select" ON public.cabinet_connecteurs
  FOR SELECT USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_connecteurs_insert" ON public.cabinet_connecteurs
  FOR INSERT WITH CHECK (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_connecteurs_update" ON public.cabinet_connecteurs
  FOR UPDATE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_connecteurs_delete" ON public.cabinet_connecteurs
  FOR DELETE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

-- cabinet_api_keys
ALTER TABLE public.cabinet_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_api_keys_select" ON public.cabinet_api_keys
  FOR SELECT USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_api_keys_insert" ON public.cabinet_api_keys
  FOR INSERT WITH CHECK (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_api_keys_update" ON public.cabinet_api_keys
  FOR UPDATE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

CREATE POLICY "cabinet_api_keys_delete" ON public.cabinet_api_keys
  FOR DELETE USING (cabinet_id = ANY(public.get_user_cabinet_ids()));

-- =========================
-- 8. SEED: permissions par defaut
-- =========================

-- Function to seed default permissions for a cabinet
CREATE OR REPLACE FUNCTION public.seed_cabinet_roles(p_cabinet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles text[] := ARRAY['ADMIN', 'SUPERVISEUR', 'COLLABORATEUR', 'CONTROLEUR', 'SECRETAIRE', 'STAGIAIRE'];
  v_permissions text[] := ARRAY['VISIONNER', 'TRAVAILLER', 'AFFECTER', 'VALIDER', 'SUPPRIMER', 'EXPORTER', 'PARAMETRER', 'INVITER'];
  v_role text;
  v_perm text;
  v_granted boolean;
BEGIN
  FOREACH v_role IN ARRAY v_roles LOOP
    FOREACH v_perm IN ARRAY v_permissions LOOP
      v_granted := CASE
        -- ADMIN: tout
        WHEN v_role = 'ADMIN' THEN true
        -- SUPERVISEUR: VISIONNER, TRAVAILLER, AFFECTER, EXPORTER
        WHEN v_role = 'SUPERVISEUR' AND v_perm IN ('VISIONNER', 'TRAVAILLER', 'AFFECTER', 'EXPORTER') THEN true
        -- COLLABORATEUR: VISIONNER, TRAVAILLER
        WHEN v_role = 'COLLABORATEUR' AND v_perm IN ('VISIONNER', 'TRAVAILLER') THEN true
        -- CONTROLEUR: VISIONNER, TRAVAILLER
        WHEN v_role = 'CONTROLEUR' AND v_perm IN ('VISIONNER', 'TRAVAILLER') THEN true
        -- SECRETAIRE: VISIONNER, AFFECTER
        WHEN v_role = 'SECRETAIRE' AND v_perm IN ('VISIONNER', 'AFFECTER') THEN true
        -- STAGIAIRE: VISIONNER
        WHEN v_role = 'STAGIAIRE' AND v_perm = 'VISIONNER' THEN true
        ELSE false
      END;

      INSERT INTO public.cabinet_roles (cabinet_id, role, permission, granted)
      VALUES (p_cabinet_id, v_role, v_perm, v_granted)
      ON CONFLICT (cabinet_id, role, permission) DO UPDATE SET granted = EXCLUDED.granted;
    END LOOP;
  END LOOP;
END;
$$;

-- =========================
-- 9. FK profiles.cabinet_id -> cabinets(id)
-- =========================

-- Add cabinet_id to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cabinet_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cabinet_id uuid;
  END IF;
END $$;

-- Add FK constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_cabinet_id_fkey'
      AND table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cabinet_id_fkey
      FOREIGN KEY (cabinet_id) REFERENCES public.cabinets(id);
  END IF;
END $$;

-- =========================
-- 10. FUNCTION create_cabinet_for_user()
-- =========================

CREATE OR REPLACE FUNCTION public.create_cabinet_for_user(
  p_user_id uuid,
  p_nom text DEFAULT 'Mon cabinet'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cabinet_id uuid;
BEGIN
  -- Check if user already has a cabinet
  SELECT cabinet_id INTO v_cabinet_id
  FROM public.cabinet_membres
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;

  IF v_cabinet_id IS NOT NULL THEN
    RETURN v_cabinet_id;
  END IF;

  -- Create cabinet
  INSERT INTO public.cabinets (nom, is_principal)
  VALUES (p_nom, true)
  RETURNING id INTO v_cabinet_id;

  -- Add user as ADMIN
  INSERT INTO public.cabinet_membres (cabinet_id, user_id, role)
  VALUES (v_cabinet_id, p_user_id, 'ADMIN');

  -- Create default reglages
  INSERT INTO public.cabinet_reglages (cabinet_id)
  VALUES (v_cabinet_id);

  -- Seed default role permissions
  PERFORM public.seed_cabinet_roles(v_cabinet_id);

  -- Update profiles.cabinet_id
  UPDATE public.profiles
  SET cabinet_id = v_cabinet_id
  WHERE id = p_user_id;

  RETURN v_cabinet_id;
END;
$$;

-- =========================
-- Trigger updated_at on cabinets
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_cabinets_updated_at'
  ) THEN
    CREATE TRIGGER set_cabinets_updated_at
      BEFORE UPDATE ON public.cabinets
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_cabinet_membres_user_id ON public.cabinet_membres(user_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_membres_cabinet_id ON public.cabinet_membres(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_roles_cabinet_id ON public.cabinet_roles(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_connecteurs_cabinet_id ON public.cabinet_connecteurs(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_api_keys_cabinet_id ON public.cabinet_api_keys(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_cabinets_parent ON public.cabinets(parent_cabinet_id);
