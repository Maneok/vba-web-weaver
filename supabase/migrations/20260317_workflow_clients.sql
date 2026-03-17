-- ============================================================================
-- Migration: Workflow clients (Prospect → Validation → Maintien)
-- ============================================================================

-- Workflow status on clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'PROSPECT'
  CHECK (workflow_status IN ('PROSPECT', 'A_TRAITER', 'EN_COURS', 'DEMANDE_VALIDATION', 'VALIDE', 'REFUSE', 'MAINTIEN', 'ARCHIVE'));

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS affecte_a uuid REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valideur uuid REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date_validation timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date_prochain_maintien date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS motif_refus text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS demande_validation_par uuid REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS demande_validation_date timestamptz;

-- Maintiens de mission
CREATE TABLE IF NOT EXISTS public.maintiens_mission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  cabinet_id uuid,
  date_cloture date NOT NULL,
  date_generation timestamptz DEFAULT now(),
  statut text DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE', 'VALIDE', 'REFUSE')),
  valideur uuid REFERENCES auth.users(id),
  date_validation timestamptz,
  commentaire text,
  questionnaire_reponses jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS on maintiens_mission
ALTER TABLE public.maintiens_mission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintiens_select" ON public.maintiens_mission
  FOR SELECT USING (
    cabinet_id IN (SELECT unnest(public.get_user_cabinet_ids()))
  );

CREATE POLICY "maintiens_insert" ON public.maintiens_mission
  FOR INSERT WITH CHECK (
    cabinet_id IN (SELECT unnest(public.get_user_cabinet_ids()))
  );

CREATE POLICY "maintiens_update" ON public.maintiens_mission
  FOR UPDATE USING (
    cabinet_id IN (SELECT unnest(public.get_user_cabinet_ids()))
  );

CREATE POLICY "maintiens_delete" ON public.maintiens_mission
  FOR DELETE USING (
    cabinet_id IN (SELECT unnest(public.get_user_cabinet_ids()))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_workflow_status ON public.clients(workflow_status);
CREATE INDEX IF NOT EXISTS idx_clients_affecte_a ON public.clients(affecte_a);
CREATE INDEX IF NOT EXISTS idx_maintiens_client_id ON public.maintiens_mission(client_id);
CREATE INDEX IF NOT EXISTS idx_maintiens_cabinet_id ON public.maintiens_mission(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_maintiens_statut ON public.maintiens_mission(statut);
