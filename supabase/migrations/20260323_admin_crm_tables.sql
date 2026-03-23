-- ══════════════════════════════════════════
-- CRM TABLES ENHANCEMENTS + FONCTIONS + VIEWS
-- Extends existing admin_prospects and admin_crm_activities
-- ══════════════════════════════════════════

-- Add missing columns to admin_prospects
ALTER TABLE public.admin_prospects ADD COLUMN IF NOT EXISTS converted_cabinet_id UUID REFERENCES public.cabinets(id) ON DELETE SET NULL;
ALTER TABLE public.admin_prospects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add 'croec' to source check (drop + re-add since we can't ALTER CHECK directly)
ALTER TABLE public.admin_prospects DROP CONSTRAINT IF EXISTS admin_prospects_source_check;
ALTER TABLE public.admin_prospects ADD CONSTRAINT admin_prospects_source_check
  CHECK (source IN ('site_web','demo','bouche_a_oreille','salon','partenaire','linkedin','croec','autre'));

-- Add 'conversion' and 'onboarding' to activity types
ALTER TABLE public.admin_crm_activities DROP CONSTRAINT IF EXISTS admin_crm_activities_type_check;
ALTER TABLE public.admin_crm_activities ADD CONSTRAINT admin_crm_activities_type_check
  CHECK (type IN ('appel','email','demo','reunion','relance','note','conversion','onboarding'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON public.admin_prospects(stage);
CREATE INDEX IF NOT EXISTS idx_prospects_next_action ON public.admin_prospects(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_prospect ON public.admin_crm_activities(prospect_id, created_at DESC);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_prospect_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospect_updated ON public.admin_prospects;
CREATE TRIGGER trg_prospect_updated BEFORE UPDATE ON public.admin_prospects
  FOR EACH ROW EXECUTE FUNCTION update_prospect_timestamp();

-- Fonction stats pipeline
CREATE OR REPLACE FUNCTION public.admin_get_pipeline_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result JSON;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  SELECT json_build_object(
    'total_prospects', (SELECT count(*) FROM admin_prospects WHERE stage NOT IN ('gagne','perdu')),
    'total_value_cents', (SELECT coalesce(sum(montant_estime_cents),0) FROM admin_prospects WHERE stage NOT IN ('gagne','perdu')),
    'won_count', (SELECT count(*) FROM admin_prospects WHERE stage = 'gagne'),
    'lost_count', (SELECT count(*) FROM admin_prospects WHERE stage = 'perdu'),
    'conversion_rate', (SELECT CASE WHEN count(*) > 0 THEN round(100.0 * count(*) FILTER (WHERE stage = 'gagne') / count(*), 1) ELSE 0 END FROM admin_prospects WHERE stage IN ('gagne','perdu')),
    'avg_cycle_days', (SELECT coalesce(avg(EXTRACT(DAY FROM updated_at - created_at))::int, 0) FROM admin_prospects WHERE stage = 'gagne'),
    'overdue_actions', (SELECT count(*) FROM admin_prospects WHERE next_action_date < CURRENT_DATE AND stage NOT IN ('gagne','perdu')),
    'stages', (SELECT json_object_agg(stage, cnt) FROM (SELECT stage, count(*) as cnt FROM admin_prospects GROUP BY stage) s),
    'sources', (SELECT json_object_agg(source, cnt) FROM (SELECT source, count(*) as cnt FROM admin_prospects GROUP BY source) s),
    'monthly_conversions', (SELECT coalesce(json_agg(row_to_json(m)), '[]'::json) FROM (
      SELECT date_trunc('month', updated_at)::date as month, count(*) as conversions
      FROM admin_prospects WHERE stage = 'gagne' AND updated_at > now() - interval '12 months'
      GROUP BY 1 ORDER BY 1
    ) m)
  ) INTO result;
  RETURN result;
END;
$$;

-- Fonction convertir prospect en cabinet
CREATE OR REPLACE FUNCTION public.admin_convert_prospect(p_prospect_id UUID, p_plan TEXT DEFAULT 'solo')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prospect RECORD;
  v_cabinet_id UUID;
  v_result JSON;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  SELECT * INTO v_prospect FROM admin_prospects WHERE id = p_prospect_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prospect introuvable'; END IF;
  IF v_prospect.stage = 'gagne' THEN RAISE EXCEPTION 'Prospect deja converti'; END IF;

  v_result := public.admin_create_cabinet(
    coalesce(v_prospect.company_name, v_prospect.contact_name),
    coalesce(v_prospect.siren, ''),
    coalesce(v_prospect.plan_vise, p_plan)
  );
  v_cabinet_id := (v_result->>'cabinet_id')::UUID;

  UPDATE admin_prospects SET stage = 'gagne', converted_cabinet_id = v_cabinet_id, updated_at = now() WHERE id = p_prospect_id;
  INSERT INTO admin_crm_activities (prospect_id, cabinet_id, type, content, created_by)
  VALUES (p_prospect_id, v_cabinet_id, 'conversion', 'Prospect converti en cabinet - plan: ' || p_plan, auth.uid());

  RETURN json_build_object('success', true, 'cabinet_id', v_cabinet_id, 'prospect_id', p_prospect_id);
END;
$$;

-- Vue onboarding cabinets recents (90 derniers jours)
CREATE OR REPLACE VIEW public.v_admin_onboarding AS
SELECT
  c.id as cabinet_id,
  c.nom as cabinet_nom,
  c.created_at,
  cs.plan,
  cs.status as sub_status,
  (SELECT count(*) FROM public.profiles p WHERE p.cabinet_id = c.id) as total_users,
  (SELECT count(*) FROM public.clients cl WHERE cl.cabinet_id = c.id) as total_clients,
  (SELECT count(*) FROM public.lettres_mission lm WHERE lm.cabinet_id = c.id) as total_lm,
  (SELECT count(*) FROM public.documents d WHERE d.cabinet_id = c.id) as total_docs,
  (SELECT max(lh.created_at) FROM public.login_history lh JOIN public.profiles p2 ON p2.id = lh.user_id WHERE p2.cabinet_id = c.id) as last_login,
  ap.id as prospect_id,
  ap.contact_name,
  ap.contact_email,
  ap.source
FROM public.cabinets c
LEFT JOIN public.cabinet_subscriptions cs ON cs.cabinet_id = c.id
LEFT JOIN public.admin_prospects ap ON ap.converted_cabinet_id = c.id
WHERE c.created_at > now() - interval '90 days'
ORDER BY c.created_at DESC;
