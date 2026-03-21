-- ============================================================================
-- Migration: Wire cabinet_reglages — complete wiring
-- Date: 2026-03-21
-- Parts: 1) new columns, 2) helper functions, 3) RLS policies,
--        4) business functions, 5) performance indexes
-- ============================================================================

-- ============================================================================
-- PART 1: Add new columns to cabinet_reglages
-- ============================================================================

ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS notif_revue_echue BOOLEAN DEFAULT true;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS notif_doc_expire BOOLEAN DEFAULT true;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS notif_alerte_ouverte BOOLEAN DEFAULT true;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS frequence_maj_externe TEXT DEFAULT 'quotidien';
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS email_responsable_alertes TEXT;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS seuil_score_alerte INTEGER DEFAULT 60;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS delai_rappel_signature_jours INTEGER DEFAULT 7;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS auto_archive_lettres_jours INTEGER DEFAULT 365;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS purge_brouillons_jours INTEGER DEFAULT 90;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS forcer_2fa BOOLEAN DEFAULT false;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS mode_strict_lcb BOOLEAN DEFAULT false;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS autoriser_acces_stagiaire_docs BOOLEAN DEFAULT false;
ALTER TABLE public.cabinet_reglages ADD COLUMN IF NOT EXISTS limite_taille_upload_mo INTEGER DEFAULT 10;

-- CHECK constraint on frequence_maj_externe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'cabinet_reglages_frequence_maj_externe_check'
  ) THEN
    ALTER TABLE public.cabinet_reglages
      ADD CONSTRAINT cabinet_reglages_frequence_maj_externe_check
      CHECK (frequence_maj_externe IN ('quotidien','hebdomadaire','mensuel','jamais'));
  END IF;
END $$;

-- Trigger: auto-update updated_at on cabinet_reglages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_cabinet_reglages_updated_at'
  ) THEN
    CREATE TRIGGER set_cabinet_reglages_updated_at
      BEFORE UPDATE ON public.cabinet_reglages
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- PART 2: Helper functions
-- ============================================================================

-- get_cabinet_reglage(p_key) → BOOLEAN
CREATE OR REPLACE FUNCTION public.get_cabinet_reglage(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_key
    WHEN 'restreindre_visibilite_affectations' THEN restreindre_visibilite_affectations
    WHEN 'restreindre_visibilite_cabinet' THEN restreindre_visibilite_cabinet
    WHEN 'restreindre_validation_responsables' THEN restreindre_validation_responsables
    WHEN 'limiter_exports_auteur' THEN limiter_exports_auteur
    WHEN 'limiter_notifications_affectes' THEN limiter_notifications_affectes
    WHEN 'bloquer_demandes_validation_incompletes' THEN bloquer_demandes_validation_incompletes
    WHEN 'bloquer_validations_incompletes' THEN bloquer_validations_incompletes
    WHEN 'generation_auto_maintiens' THEN generation_auto_maintiens
    WHEN 'documents_expires_manquants' THEN documents_expires_manquants
    WHEN 'mises_a_jour_externes' THEN mises_a_jour_externes
    WHEN 'notif_revue_echue' THEN notif_revue_echue
    WHEN 'notif_doc_expire' THEN notif_doc_expire
    WHEN 'notif_alerte_ouverte' THEN notif_alerte_ouverte
    WHEN 'forcer_2fa' THEN forcer_2fa
    WHEN 'mode_strict_lcb' THEN mode_strict_lcb
    WHEN 'autoriser_acces_stagiaire_docs' THEN autoriser_acces_stagiaire_docs
    ELSE false
  END
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id()
  LIMIT 1;
$$;

-- get_cabinet_reglage_int(p_key) → INTEGER
CREATE OR REPLACE FUNCTION public.get_cabinet_reglage_int(p_key TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_key
    WHEN 'delai_suspension_jours' THEN delai_suspension_jours
    WHEN 'seuil_score_alerte' THEN seuil_score_alerte
    WHEN 'delai_rappel_signature_jours' THEN delai_rappel_signature_jours
    WHEN 'auto_archive_lettres_jours' THEN auto_archive_lettres_jours
    WHEN 'purge_brouillons_jours' THEN purge_brouillons_jours
    WHEN 'limite_taille_upload_mo' THEN limite_taille_upload_mo
    ELSE 0
  END
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id()
  LIMIT 1;
$$;

-- get_all_cabinet_reglages() → JSON
CREATE OR REPLACE FUNCTION public.get_all_cabinet_reglages()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(r)
  FROM public.cabinet_reglages r
  WHERE r.cabinet_id = public.get_user_cabinet_id()
  LIMIT 1;
$$;

-- is_user_assigned_to_client(p_client_id) → BOOLEAN
CREATE OR REPLACE FUNCTION public.is_user_assigned_to_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = p_client_id
      AND (assigned_to = auth.uid() OR affecte_a = auth.uid())
  );
$$;

-- can_see_client(p_client_id) → BOOLEAN
CREATE OR REPLACE FUNCTION public.can_see_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_restricted BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO v_role
  FROM public.cabinet_membres
  WHERE user_id = auth.uid() AND is_active = true
    AND cabinet_id = public.get_user_cabinet_id()
  LIMIT 1;

  -- Admin and superviseur always see all clients
  IF v_role IN ('ADMIN', 'SUPERVISEUR') THEN
    RETURN true;
  END IF;

  -- Check if visibility restriction is enabled
  SELECT restreindre_visibilite_affectations INTO v_restricted
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id();

  -- If not restricted, everyone can see
  IF NOT COALESCE(v_restricted, false) THEN
    RETURN true;
  END IF;

  -- Otherwise, check assignment
  RETURN public.is_user_assigned_to_client(p_client_id);
END;
$$;

-- ============================================================================
-- PART 3: RLS Policies
-- ============================================================================

-- --- clients_select ---
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (
    cabinet_id = public.get_user_cabinet_id()
    AND (
      -- Admin/superviseur bypass restriction
      EXISTS (
        SELECT 1 FROM public.cabinet_membres
        WHERE user_id = auth.uid()
          AND cabinet_id = public.get_user_cabinet_id()
          AND is_active = true
          AND role IN ('ADMIN', 'SUPERVISEUR')
      )
      -- Or restriction is off
      OR NOT COALESCE(
        (SELECT restreindre_visibilite_affectations FROM public.cabinet_reglages WHERE cabinet_id = public.get_user_cabinet_id()),
        false
      )
      -- Or user is assigned
      OR assigned_to = auth.uid()
      OR affecte_a = auth.uid()
    )
  );

-- --- documents_cabinet (SELECT) ---
DROP POLICY IF EXISTS "documents_cabinet" ON public.documents;
CREATE POLICY "documents_cabinet" ON public.documents
  FOR SELECT USING (
    cabinet_id = public.get_user_cabinet_id()
    AND (
      -- Admin/superviseur bypass
      EXISTS (
        SELECT 1 FROM public.cabinet_membres
        WHERE user_id = auth.uid()
          AND cabinet_id = public.get_user_cabinet_id()
          AND is_active = true
          AND role IN ('ADMIN', 'SUPERVISEUR')
      )
      -- Or restriction is off
      OR NOT COALESCE(
        (SELECT restreindre_visibilite_affectations FROM public.cabinet_reglages WHERE cabinet_id = public.get_user_cabinet_id()),
        false
      )
      -- Or user is assigned to the linked client
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.ref = documents.client_ref
          AND c.cabinet_id = public.get_user_cabinet_id()
          AND (c.assigned_to = auth.uid() OR c.affecte_a = auth.uid())
      )
    )
  );

-- --- documents_manage (INSERT/UPDATE/DELETE) ---
DROP POLICY IF EXISTS "documents_manage" ON public.documents;
CREATE POLICY "documents_manage" ON public.documents
  FOR ALL USING (
    cabinet_id = public.get_user_cabinet_id()
    AND (
      -- Admin/superviseur can manage all
      EXISTS (
        SELECT 1 FROM public.cabinet_membres
        WHERE user_id = auth.uid()
          AND cabinet_id = public.get_user_cabinet_id()
          AND is_active = true
          AND role IN ('ADMIN', 'SUPERVISEUR')
      )
      -- Or own documents
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    cabinet_id = public.get_user_cabinet_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.cabinet_membres
        WHERE user_id = auth.uid()
          AND cabinet_id = public.get_user_cabinet_id()
          AND is_active = true
          AND role IN ('ADMIN', 'SUPERVISEUR')
      )
      OR user_id = auth.uid()
    )
  );

-- --- notif_select (notifications) ---
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT USING (
    cabinet_id = public.get_user_cabinet_id()
    AND (
      -- If limiter_notifications_affectes is off, show all
      NOT COALESCE(
        (SELECT limiter_notifications_affectes FROM public.cabinet_reglages WHERE cabinet_id = public.get_user_cabinet_id()),
        false
      )
      -- Or the notification is for the current user (user_id column if it exists) or is global
      OR user_id = auth.uid()
      OR user_id IS NULL
    )
  );

-- ============================================================================
-- PART 4: Business functions
-- ============================================================================

-- request_client_validation(p_client_id) → JSON
CREATE OR REPLACE FUNCTION public.request_client_validation(p_client_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_bloquer BOOLEAN;
BEGIN
  -- Fetch client
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND cabinet_id = public.get_user_cabinet_id();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  -- Check bloquer_demandes_validation_incompletes
  SELECT bloquer_demandes_validation_incompletes INTO v_bloquer
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id();

  IF COALESCE(v_bloquer, false) THEN
    -- Validate required fields
    IF v_client.raison_sociale IS NULL OR v_client.raison_sociale = '' THEN
      RETURN json_build_object('success', false, 'error', 'Raison sociale manquante');
    END IF;
    IF v_client.siren IS NULL OR v_client.siren = '' THEN
      RETURN json_build_object('success', false, 'error', 'SIREN manquant');
    END IF;
    IF v_client.forme IS NULL OR v_client.forme = '' THEN
      RETURN json_build_object('success', false, 'error', 'Forme juridique manquante');
    END IF;
    IF v_client.dirigeant IS NULL OR v_client.dirigeant = '' THEN
      RETURN json_build_object('success', false, 'error', 'Dirigeant manquant');
    END IF;
    IF v_client.adresse IS NULL OR v_client.adresse = '' THEN
      RETURN json_build_object('success', false, 'error', 'Adresse manquante');
    END IF;
    IF v_client.score_global IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Score global non calculé');
    END IF;
  END IF;

  -- Update workflow status
  UPDATE public.clients
  SET workflow_status = 'DEMANDE_VALIDATION',
      demande_validation_par = auth.uid(),
      demande_validation_date = now()
  WHERE id = p_client_id;

  -- Audit trail
  INSERT INTO public.audit_trail (cabinet_id, user_id, action, table_name, record_id, new_data)
  VALUES (
    public.get_user_cabinet_id(),
    auth.uid(),
    'DEMANDE_VALIDATION',
    'clients',
    p_client_id,
    json_build_object('client_id', p_client_id, 'raison_sociale', v_client.raison_sociale)::jsonb
  );

  RETURN json_build_object('success', true, 'status', 'DEMANDE_VALIDATION');
END;
$$;

-- validate_client(p_client_id, p_decision, p_motif) → JSON
CREATE OR REPLACE FUNCTION public.validate_client(p_client_id UUID, p_decision TEXT, p_motif TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_restrict_validation BOOLEAN;
  v_bloquer_incomplete BOOLEAN;
  v_doc_count INT;
  v_new_status TEXT;
BEGIN
  -- Check decision value
  IF p_decision NOT IN ('VALIDE', 'REFUSE') THEN
    RETURN json_build_object('success', false, 'error', 'Décision invalide (VALIDE ou REFUSE)');
  END IF;

  -- Get user role
  SELECT role INTO v_role
  FROM public.cabinet_membres
  WHERE user_id = auth.uid() AND is_active = true
    AND cabinet_id = public.get_user_cabinet_id()
  LIMIT 1;

  -- Check restreindre_validation_responsables
  SELECT restreindre_validation_responsables, bloquer_validations_incompletes
  INTO v_restrict_validation, v_bloquer_incomplete
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id();

  IF COALESCE(v_restrict_validation, false) AND v_role <> 'ADMIN' THEN
    RETURN json_build_object('success', false, 'error', 'Seul un administrateur peut valider les clients');
  END IF;

  -- Check bloquer_validations_incompletes: minimum 2 documents KYC
  IF COALESCE(v_bloquer_incomplete, false) AND p_decision = 'VALIDE' THEN
    SELECT COUNT(*) INTO v_doc_count
    FROM public.documents_kyc
    WHERE client_ref = (SELECT ref FROM public.clients WHERE id = p_client_id)
      AND cabinet_id = public.get_user_cabinet_id();

    IF v_doc_count < 2 THEN
      RETURN json_build_object('success', false, 'error', 'Minimum 2 documents KYC requis pour valider');
    END IF;
  END IF;

  -- Determine new status
  v_new_status := p_decision;

  -- Update client
  UPDATE public.clients
  SET workflow_status = v_new_status,
      valideur = auth.uid(),
      date_validation = now(),
      motif_refus = CASE WHEN p_decision = 'REFUSE' THEN p_motif ELSE NULL END
  WHERE id = p_client_id AND cabinet_id = public.get_user_cabinet_id();

  -- Audit trail
  INSERT INTO public.audit_trail (cabinet_id, user_id, action, table_name, record_id, new_data)
  VALUES (
    public.get_user_cabinet_id(),
    auth.uid(),
    'VALIDATION_CLIENT',
    'clients',
    p_client_id,
    json_build_object('decision', p_decision, 'motif', p_motif)::jsonb
  );

  RETURN json_build_object('success', true, 'status', v_new_status);
END;
$$;

-- can_export_document(p_doc_id) → BOOLEAN
CREATE OR REPLACE FUNCTION public.can_export_document(p_doc_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_exports BOOLEAN;
  v_doc_user_id UUID;
BEGIN
  SELECT limiter_exports_auteur INTO v_limit_exports
  FROM public.cabinet_reglages
  WHERE cabinet_id = public.get_user_cabinet_id();

  -- If not limited, everyone can export
  IF NOT COALESCE(v_limit_exports, false) THEN
    RETURN true;
  END IF;

  -- Otherwise only the document author can export
  SELECT user_id INTO v_doc_user_id
  FROM public.documents
  WHERE id = p_doc_id AND cabinet_id = public.get_user_cabinet_id();

  RETURN v_doc_user_id = auth.uid();
END;
$$;

-- generate_notifications(p_cabinet_id) → INTEGER
CREATE OR REPLACE FUNCTION public.generate_notifications(p_cabinet_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reglages RECORD;
  _count INT := 0;
  _rows INT;
BEGIN
  SELECT * INTO v_reglages
  FROM public.cabinet_reglages
  WHERE cabinet_id = p_cabinet_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 1. Revues échues
  IF COALESCE(v_reglages.notif_revue_echue, true) THEN
    INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
    SELECT
      p_cabinet_id,
      'REVUE_ECHUE',
      'Revue périodique échue — ' || c.raison_sociale,
      'La revue périodique du client ' || c.raison_sociale || ' est dépassée.',
      'haute'
    FROM public.clients c
    WHERE c.cabinet_id = p_cabinet_id
      AND c.prochaine_revue IS NOT NULL
      AND c.prochaine_revue < CURRENT_DATE
      AND c.workflow_status NOT IN ('ARCHIVE', 'REFUSE')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.cabinet_id = p_cabinet_id
          AND n.type = 'REVUE_ECHUE'
          AND n.message LIKE '%' || c.raison_sociale || '%'
          AND n.created_at > now() - interval '7 days'
      );
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END IF;

  -- 2. Documents expirés / manquants
  IF COALESCE(v_reglages.documents_expires_manquants, true) THEN
    INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
    SELECT
      p_cabinet_id,
      'DOC_EXPIRE',
      'Document expiré — ' || d.name,
      'Le document "' || d.name || '" (client ' || COALESCE(d.client_ref, 'N/A') || ') a expiré.',
      'moyenne'
    FROM public.documents d
    WHERE d.cabinet_id = p_cabinet_id
      AND d.expiration_date IS NOT NULL
      AND d.expiration_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.cabinet_id = p_cabinet_id
          AND n.type = 'DOC_EXPIRE'
          AND n.message LIKE '%' || d.name || '%'
          AND n.created_at > now() - interval '7 days'
      );
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END IF;

  -- 3. Alertes ouvertes sur clients à score élevé
  IF COALESCE(v_reglages.notif_alerte_ouverte, true) THEN
    INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
    SELECT
      p_cabinet_id,
      'ALERTE_SCORE',
      'Score élevé — ' || c.raison_sociale,
      'Le client ' || c.raison_sociale || ' a un score de ' || c.score_global || ' (seuil: ' || COALESCE(v_reglages.seuil_score_alerte, 60) || ').',
      'haute'
    FROM public.clients c
    WHERE c.cabinet_id = p_cabinet_id
      AND c.score_global IS NOT NULL
      AND c.score_global >= COALESCE(v_reglages.seuil_score_alerte, 60)
      AND c.workflow_status NOT IN ('ARCHIVE', 'REFUSE')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.cabinet_id = p_cabinet_id
          AND n.type = 'ALERTE_SCORE'
          AND n.message LIKE '%' || c.raison_sociale || '%'
          AND n.created_at > now() - interval '7 days'
      );
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END IF;

  RETURN _count;
END;
$$;

-- auto_generate_maintiens() → INTEGER
CREATE OR REPLACE FUNCTION public.auto_generate_maintiens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cab RECORD;
  _count INT := 0;
  _rows INT;
BEGIN
  FOR v_cab IN
    SELECT cr.cabinet_id
    FROM public.cabinet_reglages cr
    WHERE cr.generation_auto_maintiens = true
  LOOP
    INSERT INTO public.maintiens_mission (client_id, cabinet_id, date_cloture)
    SELECT c.id, v_cab.cabinet_id, CURRENT_DATE
    FROM public.clients c
    WHERE c.cabinet_id = v_cab.cabinet_id
      AND c.workflow_status = 'VALIDE'
      AND c.date_prochain_maintien IS NOT NULL
      AND c.date_prochain_maintien <= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.maintiens_mission m
        WHERE m.client_id = c.id
          AND m.date_cloture = CURRENT_DATE
      );
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END LOOP;

  RETURN _count;
END;
$$;

-- auto_archive_lettres() → INTEGER
CREATE OR REPLACE FUNCTION public.auto_archive_lettres()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cab RECORD;
  _count INT := 0;
  _rows INT;
BEGIN
  FOR v_cab IN
    SELECT cr.cabinet_id, cr.auto_archive_lettres_jours
    FROM public.cabinet_reglages cr
    WHERE cr.auto_archive_lettres_jours IS NOT NULL AND cr.auto_archive_lettres_jours > 0
  LOOP
    UPDATE public.lettres_mission
    SET status = 'archive', statut = 'archive'
    WHERE user_id IN (
        SELECT cm.user_id FROM public.cabinet_membres cm WHERE cm.cabinet_id = v_cab.cabinet_id
      )
      AND status NOT IN ('archive')
      AND updated_at < now() - (v_cab.auto_archive_lettres_jours || ' days')::interval;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END LOOP;

  RETURN _count;
END;
$$;

-- auto_purge_brouillons() → INTEGER
CREATE OR REPLACE FUNCTION public.auto_purge_brouillons()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cab RECORD;
  _count INT := 0;
  _rows INT;
BEGIN
  FOR v_cab IN
    SELECT cr.cabinet_id, cr.purge_brouillons_jours
    FROM public.cabinet_reglages cr
    WHERE cr.purge_brouillons_jours IS NOT NULL AND cr.purge_brouillons_jours > 0
  LOOP
    DELETE FROM public.lettres_mission
    WHERE user_id IN (
        SELECT cm.user_id FROM public.cabinet_membres cm WHERE cm.cabinet_id = v_cab.cabinet_id
      )
      AND status = 'brouillon'
      AND updated_at < now() - (v_cab.purge_brouillons_jours || ' days')::interval;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _count := _count + _rows;
  END LOOP;

  RETURN _count;
END;
$$;

-- daily_full_maintenance() → JSON (overrides existing)
CREATE OR REPLACE FUNCTION public.daily_full_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub_result JSON;
  _backup_result JSON;
  _retention_result JSON;
  _notif_count INT := 0;
  _maintiens_count INT;
  _archive_count INT;
  _purge_count INT;
  v_cab RECORD;
BEGIN
  -- 1. Subscriptions
  _sub_result := public.daily_subscription_maintenance();

  -- 2. Backup quotidien
  _backup_result := public.create_daily_snapshot();

  -- 3. Rétention des données
  _retention_result := public.apply_data_retention();

  -- 4. Notifications per cabinet
  FOR v_cab IN SELECT id FROM public.cabinets LOOP
    _notif_count := _notif_count + public.generate_notifications(v_cab.id);
  END LOOP;

  -- 5. Auto-generate maintiens
  _maintiens_count := public.auto_generate_maintiens();

  -- 6. Auto-archive lettres
  _archive_count := public.auto_archive_lettres();

  -- 7. Auto-purge brouillons
  _purge_count := public.auto_purge_brouillons();

  RETURN json_build_object(
    'subscriptions', _sub_result,
    'backup', _backup_result,
    'retention', _retention_result,
    'notifications_generated', _notif_count,
    'maintiens_generated', _maintiens_count,
    'lettres_archived', _archive_count,
    'brouillons_purged', _purge_count,
    'executed_at', now()
  );
END;
$$;

-- ============================================================================
-- PART 5: Performance indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON public.clients(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_affecte_a ON public.clients(affecte_a) WHERE affecte_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cabinet_assigned ON public.clients(cabinet_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_documents_cabinet_client ON public.documents(cabinet_id, client_ref);
CREATE INDEX IF NOT EXISTS idx_documents_expiration ON public.documents(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_cabinet_type ON public.notifications(cabinet_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_reglages_cabinet ON public.cabinet_reglages(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_lettres_mission_cabinet_status ON public.lettres_mission(user_id, status);
CREATE INDEX IF NOT EXISTS idx_maintiens_cabinet ON public.maintiens_mission(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_clients_workflow ON public.clients(cabinet_id, workflow_status);
CREATE INDEX IF NOT EXISTS idx_clients_score ON public.clients(cabinet_id, score_global DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_cabinet_statut ON public.alertes_registre(cabinet_id, statut, created_at);
