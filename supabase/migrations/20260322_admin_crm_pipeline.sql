-- Pipeline prospects CRM
CREATE TABLE IF NOT EXISTS public.admin_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES cabinets(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  company_name TEXT,
  siren TEXT,
  source TEXT CHECK (source IN ('site_web', 'demo', 'bouche_a_oreille', 'salon', 'partenaire', 'linkedin', 'autre')),
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualifie', 'demo_planifiee', 'demo_faite', 'proposition', 'negociation', 'gagne', 'perdu')),
  plan_vise TEXT CHECK (plan_vise IN ('solo', 'cabinet', 'enterprise')),
  montant_estime_cents INT DEFAULT 0,
  notes TEXT,
  next_action TEXT,
  next_action_date DATE,
  lost_reason TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_prospects_policy ON public.admin_prospects FOR ALL USING (public.is_super_admin());

-- Activites CRM
CREATE TABLE IF NOT EXISTS public.admin_crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES admin_prospects(id) ON DELETE CASCADE,
  cabinet_id UUID REFERENCES cabinets(id),
  type TEXT NOT NULL CHECK (type IN ('appel', 'email', 'demo', 'reunion', 'relance', 'note')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_crm_policy ON public.admin_crm_activities FOR ALL USING (public.is_super_admin());
