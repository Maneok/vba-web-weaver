-- Add cabinet_id to documents table for multi-tenant isolation
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cabinet_id uuid REFERENCES public.cabinets(id);

-- Backfill existing documents with user's cabinet_id
UPDATE public.documents d SET cabinet_id = p.cabinet_id
FROM public.profiles p WHERE d.user_id = p.id AND d.cabinet_id IS NULL;

-- Add RLS policy for documents scoped by cabinet
DROP POLICY IF EXISTS "documents_cabinet" ON public.documents;
CREATE POLICY "documents_cabinet" ON public.documents
  FOR ALL USING (cabinet_id = get_user_cabinet_id());

-- Same for document_versions
ALTER TABLE public.document_versions ADD COLUMN IF NOT EXISTS cabinet_id uuid REFERENCES public.cabinets(id);
UPDATE public.document_versions dv SET cabinet_id = d.cabinet_id
FROM public.documents d WHERE dv.document_id = d.id AND dv.cabinet_id IS NULL;
