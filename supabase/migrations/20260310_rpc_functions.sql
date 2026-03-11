-- Migration: version existing RPC functions used by frontend and edge functions
-- Date: 2026-03-10
-- Functions: check_user_access, get_cabinet_usage, add_extra_seat, daily_full_maintenance
-- Plus their dependencies: is_subscription_active, can_add_seat, can_add_client,
--   daily_subscription_maintenance, create_daily_snapshot, apply_data_retention

-- ============================================================================
-- 1. Helper functions (dependencies, must be created first)
-- ============================================================================

-- 1a. is_subscription_active — used by check_user_access & get_cabinet_usage
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_cabinet_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _sub RECORD;
BEGIN
  SELECT * INTO _sub FROM public.cabinet_subscriptions WHERE cabinet_id = p_cabinet_id;
  IF NOT FOUND THEN RETURN TRUE; END IF;
  IF _sub.status = 'trialing' THEN RETURN COALESCE(_sub.trial_end > now(), FALSE); END IF;
  IF _sub.status = 'active' THEN RETURN TRUE; END IF;
  IF _sub.status = 'past_due' THEN RETURN _sub.updated_at + interval '7 days' > now(); END IF;
  -- Canceled mais période payée non terminée
  IF _sub.status = 'canceled' AND _sub.subscription_end IS NOT NULL THEN
    RETURN _sub.subscription_end > now();
  END IF;
  RETURN FALSE;
END;
$function$;

-- 1b. can_add_seat — used by get_cabinet_usage
CREATE OR REPLACE FUNCTION public.can_add_seat(p_cabinet_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _max_seats INT; _current INT; _pending_inv INT; _extra INT; _status TEXT;
BEGIN
  SELECT max_seats, extra_seats, status INTO _max_seats, _extra, _status
  FROM public.cabinet_subscriptions WHERE cabinet_id = p_cabinet_id;

  IF _max_seats IS NULL THEN _max_seats := 1; END IF;
  IF _extra IS NULL THEN _extra := 0; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('trialing', 'active') THEN RETURN FALSE; END IF;

  SELECT count(*) INTO _current FROM public.profiles WHERE cabinet_id = p_cabinet_id AND is_active = true;
  SELECT count(*) INTO _pending_inv FROM public.invitations WHERE cabinet_id = p_cabinet_id AND status = 'pending';

  RETURN (_current + _pending_inv) < (_max_seats + _extra);
END;
$function$;

-- 1c. can_add_client — used by get_cabinet_usage
CREATE OR REPLACE FUNCTION public.can_add_client(p_cabinet_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _max INT; _grace INT; _current INT; _grace_until TIMESTAMPTZ; _status TEXT;
BEGIN
  SELECT max_clients, COALESCE(grace_extra_clients, 0), grace_extra_clients_until, status
  INTO _max, _grace, _grace_until, _status
  FROM public.cabinet_subscriptions WHERE cabinet_id = p_cabinet_id;

  IF _max IS NULL THEN _max := 50; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('trialing', 'active') THEN RETURN FALSE; END IF;
  IF _grace_until IS NOT NULL AND _grace_until < now() THEN _grace := 0; END IF;

  SELECT count(*) INTO _current FROM public.clients WHERE cabinet_id = p_cabinet_id;
  RETURN _current < (_max + _grace);
END;
$function$;

-- 1d. daily_subscription_maintenance — used by daily_full_maintenance
CREATE OR REPLACE FUNCTION public.daily_subscription_maintenance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _trials_suspended INT := 0;
  _pastdue_suspended INT := 0;
  _invitations_expired INT := 0;
  _sessions_cleaned INT := 0;
  _graces_expired INT := 0;
  _discounts_expired INT := 0;
BEGIN
  -- 1. Suspendre les trials expirés
  WITH suspended AS (
    UPDATE public.cabinet_subscriptions SET status = 'suspended'
    WHERE status = 'trialing' AND trial_end < now()
    RETURNING cabinet_id
  )
  SELECT count(*) INTO _trials_suspended FROM suspended;

  -- Désactiver les non-admins des cabinets fraîchement suspendus
  UPDATE public.profiles SET is_active = false
  WHERE cabinet_id IN (SELECT cabinet_id FROM public.cabinet_subscriptions WHERE status = 'suspended' AND updated_at >= now() - interval '2 minutes')
    AND role != 'ADMIN';

  -- Notifications trials
  INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
  SELECT cabinet_id, 'TRIAL_EXPIRE', 'Période d''essai terminée',
    'Votre essai de 14 jours est terminé. Choisissez un plan pour continuer. Données conservées 90 jours.',
    'URGENTE'
  FROM public.cabinet_subscriptions
  WHERE status = 'suspended' AND updated_at >= now() - interval '2 minutes'
    AND cabinet_id NOT IN (SELECT cabinet_id FROM public.notifications WHERE type = 'TRIAL_EXPIRE' AND created_at > now() - interval '1 day');

  -- 2. Suspendre les past_due hors délai de grâce
  WITH grace_expired AS (
    UPDATE public.cabinet_subscriptions SET status = 'suspended'
    WHERE status = 'past_due'
      AND ((billing_cycle = 'annual' AND updated_at < now() - interval '30 days')
        OR (billing_cycle != 'annual' AND updated_at < now() - interval '7 days'))
    RETURNING cabinet_id
  )
  SELECT count(*) INTO _pastdue_suspended FROM grace_expired;

  -- 3. Expirer les invitations
  UPDATE public.invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS _invitations_expired = ROW_COUNT;

  -- 4. Nettoyer les sessions > 24h
  DELETE FROM public.active_sessions WHERE last_activity < now() - interval '24 hours';
  GET DIAGNOSTICS _sessions_cleaned = ROW_COUNT;

  -- 5. Expirer les grâces de clients supplémentaires
  UPDATE public.cabinet_subscriptions SET grace_extra_clients = 0, grace_extra_clients_until = NULL
  WHERE grace_extra_clients > 0 AND grace_extra_clients_until < now();
  GET DIAGNOSTICS _graces_expired = ROW_COUNT;

  -- 6. Expirer les coupons
  UPDATE public.cabinet_subscriptions SET coupon_code = NULL, discount_percent = 0, discount_until = NULL
  WHERE discount_percent > 0 AND discount_until < now();
  GET DIAGNOSTICS _discounts_expired = ROW_COUNT;

  -- 7. Rappels J-3 trial
  INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
  SELECT cabinet_id, 'TRIAL_RAPPEL', 'Plus que 3 jours d''essai',
    'Votre période d''essai se termine bientôt. Passez à un plan payant pour ne pas perdre l''accès.',
    'NORMAL'
  FROM public.cabinet_subscriptions
  WHERE status = 'trialing' AND trial_end BETWEEN now() + interval '2 days' AND now() + interval '4 days'
    AND cabinet_id NOT IN (SELECT cabinet_id FROM public.notifications WHERE type = 'TRIAL_RAPPEL' AND created_at > now() - interval '3 days');

  -- 8. Rappels J-1 trial
  INSERT INTO public.notifications (cabinet_id, type, titre, message, priority)
  SELECT cabinet_id, 'TRIAL_DERNIER_JOUR', 'Dernier jour d''essai !',
    'Votre essai gratuit se termine demain. Souscrivez maintenant !',
    'URGENTE'
  FROM public.cabinet_subscriptions
  WHERE status = 'trialing' AND trial_end BETWEEN now() AND now() + interval '1 day'
    AND cabinet_id NOT IN (SELECT cabinet_id FROM public.notifications WHERE type = 'TRIAL_DERNIER_JOUR' AND created_at > now() - interval '1 day');

  RETURN json_build_object(
    'trials_suspended', _trials_suspended,
    'pastdue_suspended', _pastdue_suspended,
    'invitations_expired', _invitations_expired,
    'sessions_cleaned', _sessions_cleaned,
    'graces_expired', _graces_expired,
    'discounts_expired', _discounts_expired,
    'run_at', now()
  );
END;
$function$;

-- 1e. create_daily_snapshot — used by daily_full_maintenance
CREATE OR REPLACE FUNCTION public.create_daily_snapshot()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _cab RECORD;
  _total_rows INT := 0;
  _tables_done TEXT[] := '{}';
  _backup_id UUID;
BEGIN
  -- Logger le début
  INSERT INTO public.backup_history (backup_type, status)
  VALUES ('tables_only', 'started')
  RETURNING id INTO _backup_id;

  -- Pour chaque cabinet actif
  FOR _cab IN SELECT id FROM public.cabinets LOOP
    -- Clients (critique)
    INSERT INTO public._data_snapshots (snapshot_date, table_name, cabinet_id, row_count, data)
    SELECT CURRENT_DATE, 'clients', _cab.id, count(*),
      COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
    FROM public.clients c WHERE c.cabinet_id = _cab.id
    ON CONFLICT (snapshot_date, table_name, cabinet_id) DO UPDATE SET
      row_count = EXCLUDED.row_count, data = EXCLUDED.data, created_at = now();

    -- Alertes registre
    INSERT INTO public._data_snapshots (snapshot_date, table_name, cabinet_id, row_count, data)
    SELECT CURRENT_DATE, 'alertes_registre', _cab.id, count(*),
      COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb)
    FROM public.alertes_registre a WHERE a.cabinet_id = _cab.id
    ON CONFLICT (snapshot_date, table_name, cabinet_id) DO UPDATE SET
      row_count = EXCLUDED.row_count, data = EXCLUDED.data, created_at = now();

    -- Profiles
    INSERT INTO public._data_snapshots (snapshot_date, table_name, cabinet_id, row_count, data)
    SELECT CURRENT_DATE, 'profiles', _cab.id, count(*),
      COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
    FROM public.profiles p WHERE p.cabinet_id = _cab.id
    ON CONFLICT (snapshot_date, table_name, cabinet_id) DO UPDATE SET
      row_count = EXCLUDED.row_count, data = EXCLUDED.data, created_at = now();

    -- Contrôles qualité
    INSERT INTO public._data_snapshots (snapshot_date, table_name, cabinet_id, row_count, data)
    SELECT CURRENT_DATE, 'controles_qualite', _cab.id, count(*),
      COALESCE(jsonb_agg(row_to_json(cq)), '[]'::jsonb)
    FROM public.controles_qualite cq WHERE cq.cabinet_id = _cab.id
    ON CONFLICT (snapshot_date, table_name, cabinet_id) DO UPDATE SET
      row_count = EXCLUDED.row_count, data = EXCLUDED.data, created_at = now();

    -- Abonnements
    INSERT INTO public._data_snapshots (snapshot_date, table_name, cabinet_id, row_count, data)
    SELECT CURRENT_DATE, 'cabinet_subscriptions', _cab.id, count(*),
      COALESCE(jsonb_agg(row_to_json(cs)), '[]'::jsonb)
    FROM public.cabinet_subscriptions cs WHERE cs.cabinet_id = _cab.id
    ON CONFLICT (snapshot_date, table_name, cabinet_id) DO UPDATE SET
      row_count = EXCLUDED.row_count, data = EXCLUDED.data, created_at = now();
  END LOOP;

  -- Compter le total
  SELECT count(*) INTO _total_rows FROM public._data_snapshots WHERE snapshot_date = CURRENT_DATE;

  -- Marquer le backup comme terminé
  UPDATE public.backup_history SET
    status = 'completed',
    tables_backed_up = ARRAY['clients', 'alertes_registre', 'profiles', 'controles_qualite', 'cabinet_subscriptions'],
    total_rows = _total_rows,
    completed_at = now()
  WHERE id = _backup_id;

  -- Nettoyer les snapshots > 30 jours (garder 30 jours de backups)
  DELETE FROM public._data_snapshots WHERE snapshot_date < CURRENT_DATE - 30;

  RETURN json_build_object(
    'success', true,
    'backup_id', _backup_id,
    'snapshots_created', _total_rows,
    'date', CURRENT_DATE
  );
END;
$function$;

-- 1f. apply_data_retention — used by daily_full_maintenance
CREATE OR REPLACE FUNCTION public.apply_data_retention()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _old_snapshots_deleted INT;
  _old_sessions_deleted INT;
  _old_notifications_deleted INT;
BEGIN
  -- Snapshots > 30 jours
  DELETE FROM public._data_snapshots WHERE snapshot_date < CURRENT_DATE - 30;
  GET DIAGNOSTICS _old_snapshots_deleted = ROW_COUNT;

  -- Sessions > 7 jours
  DELETE FROM public.active_sessions WHERE last_activity < now() - interval '7 days';
  GET DIAGNOSTICS _old_sessions_deleted = ROW_COUNT;

  -- Notifications lues > 90 jours
  DELETE FROM public.notifications WHERE lue = true AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS _old_notifications_deleted = ROW_COUNT;

  -- NE PAS supprimer l'audit_trail (conservation 5 ans LCB-FT)
  -- NE PAS supprimer les déclarations de soupçon (conservation 5 ans)

  RETURN json_build_object(
    'old_snapshots_deleted', _old_snapshots_deleted,
    'old_sessions_deleted', _old_sessions_deleted,
    'old_notifications_deleted', _old_notifications_deleted,
    'audit_trail_policy', '5 ans — non supprimé',
    'run_at', now()
  );
END;
$function$;

-- ============================================================================
-- 2. Main RPC functions (called from frontend / edge functions)
-- ============================================================================

-- 2a. check_user_access — called in src/components/SubscriptionBanner.tsx
CREATE OR REPLACE FUNCTION public.check_user_access(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _profile RECORD;
  _sub_active BOOLEAN;
  _sub_status TEXT;
  _days_remaining INT;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN json_build_object('allowed', false, 'reason', 'PROFILE_NOT_FOUND'); END IF;
  IF NOT _profile.is_active THEN RETURN json_build_object('allowed', false, 'reason', 'USER_DEACTIVATED'); END IF;

  SELECT public.is_subscription_active(_profile.cabinet_id) INTO _sub_active;
  SELECT status INTO _sub_status FROM public.cabinet_subscriptions WHERE cabinet_id = _profile.cabinet_id;

  IF NOT _sub_active THEN
    IF _profile.role = 'ADMIN' THEN
      RETURN json_build_object('allowed', true, 'readonly', true, 'reason', 'SUSPENDED_ADMIN_READONLY',
        'message', 'Votre abonnement est suspendu. Accès en lecture seule. Réactivez votre plan.');
    ELSE
      RETURN json_build_object('allowed', false, 'reason', 'CABINET_SUSPENDED',
        'message', 'L''abonnement de votre cabinet est suspendu. Contactez votre administrateur.');
    END IF;
  END IF;

  -- Calculer les jours restants
  SELECT CASE
    WHEN cs.status = 'trialing' THEN GREATEST(0, EXTRACT(DAY FROM cs.trial_end - now())::int)
    ELSE NULL
  END INTO _days_remaining
  FROM public.cabinet_subscriptions cs WHERE cs.cabinet_id = _profile.cabinet_id;

  RETURN json_build_object(
    'allowed', true,
    'readonly', false,
    'role', _profile.role,
    'cabinet_id', _profile.cabinet_id,
    'sub_status', COALESCE(_sub_status, 'none'),
    'days_remaining', _days_remaining
  );
END;
$function$;

-- 2b. get_cabinet_usage — called in src/components/settings/SubscriptionSettings.tsx
CREATE OR REPLACE FUNCTION public.get_cabinet_usage(p_cabinet_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _result JSON;
BEGIN
  SELECT json_build_object(
    'plan', COALESCE(s.plan, 'trial'),
    'status', COALESCE(s.status, 'trialing'),
    'max_seats', COALESCE(s.max_seats, 1) + COALESCE(s.extra_seats, 0),
    'base_seats', COALESCE(s.max_seats, 1),
    'extra_seats', COALESCE(s.extra_seats, 0),
    'max_clients', COALESCE(s.max_clients, 50),
    'max_storage_mb', COALESCE(s.max_storage_mb, 5120),
    'current_seats', (SELECT count(*) FROM public.profiles WHERE cabinet_id = p_cabinet_id AND is_active = true),
    'pending_invitations', (SELECT count(*) FROM public.invitations WHERE cabinet_id = p_cabinet_id AND status = 'pending'),
    'current_clients', (SELECT count(*) FROM public.clients WHERE cabinet_id = p_cabinet_id),
    'current_storage_mb', 0,
    'trial_end', s.trial_end,
    'subscription_end', s.subscription_end,
    'billing_cycle', COALESCE(s.billing_cycle, 'monthly'),
    'monthly_price_cents', s.monthly_price_cents,
    'extra_seat_price_cents', s.extra_seat_price_cents,
    'webhook_url', s.webhook_url,
    'days_remaining', CASE
      WHEN s.status = 'trialing' THEN GREATEST(0, EXTRACT(DAY FROM s.trial_end - now())::int)
      WHEN s.status = 'canceled' AND s.subscription_end IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM s.subscription_end - now())::int)
      ELSE NULL
    END,
    'is_active', public.is_subscription_active(p_cabinet_id),
    'can_add_seat', public.can_add_seat(p_cabinet_id),
    'can_add_client', public.can_add_client(p_cabinet_id)
  ) INTO _result
  FROM public.cabinet_subscriptions s
  WHERE s.cabinet_id = p_cabinet_id;

  IF _result IS NULL THEN
    _result := json_build_object(
      'plan', 'trial', 'status', 'trialing', 'max_seats', 1, 'base_seats', 1, 'extra_seats', 0,
      'max_clients', 50, 'max_storage_mb', 5120,
      'current_seats', (SELECT count(*) FROM public.profiles WHERE cabinet_id = p_cabinet_id AND is_active = true),
      'pending_invitations', 0, 'current_clients', (SELECT count(*) FROM public.clients WHERE cabinet_id = p_cabinet_id),
      'current_storage_mb', 0, 'trial_end', now() + interval '14 days',
      'subscription_end', NULL, 'billing_cycle', 'monthly', 'monthly_price_cents', 2900,
      'extra_seat_price_cents', 1500, 'webhook_url', NULL, 'days_remaining', 14,
      'is_active', true, 'can_add_seat', true, 'can_add_client', true
    );
  END IF;

  RETURN _result;
END;
$function$;

-- 2c. add_extra_seat — called in src/components/settings/SubscriptionSettings.tsx
CREATE OR REPLACE FUNCTION public.add_extra_seat(p_cabinet_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _current_extra INT; _price INT;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'ADMIN' THEN
    RETURN json_build_object('success', false, 'error', 'Réservé aux administrateurs');
  END IF;

  SELECT extra_seats, extra_seat_price_cents INTO _current_extra, _price
  FROM public.cabinet_subscriptions WHERE cabinet_id = p_cabinet_id;

  UPDATE public.cabinet_subscriptions SET extra_seats = COALESCE(_current_extra, 0) + 1
  WHERE cabinet_id = p_cabinet_id;

  INSERT INTO public.audit_trail (cabinet_id, user_id, user_email, action, new_data)
  VALUES (p_cabinet_id, auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
    'AJOUT_SIEGE_SUPPLEMENTAIRE',
    jsonb_build_object('total_extra', COALESCE(_current_extra, 0) + 1, 'price_cents', _price));

  RETURN json_build_object('success', true, 'extra_seats', COALESCE(_current_extra, 0) + 1,
    'monthly_extra_cost_cents', (COALESCE(_current_extra, 0) + 1) * COALESCE(_price, 1500));
END;
$function$;

-- 2d. daily_full_maintenance — called in supabase/functions/daily-maintenance/index.ts
CREATE OR REPLACE FUNCTION public.daily_full_maintenance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _sub_result JSON;
  _backup_result JSON;
  _retention_result JSON;
BEGIN
  -- 1. Maintenance abonnements
  _sub_result := public.daily_subscription_maintenance();

  -- 2. Backup quotidien
  _backup_result := public.create_daily_snapshot();

  -- 3. Rétention des données
  _retention_result := public.apply_data_retention();

  RETURN json_build_object(
    'subscriptions', _sub_result,
    'backup', _backup_result,
    'retention', _retention_result,
    'run_at', now()
  );
END;
$function$;
