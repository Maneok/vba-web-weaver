-- Link documents to clients (bidirectional GED ↔ Client)

-- 1. Add client_id for direct FK link documents → clients
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Add siren for fast lookup without join
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS siren text;

-- 3. Backfill client_id and siren from existing client_ref
UPDATE public.documents d
SET
  client_id = c.id,
  siren = c.siren
FROM public.clients c
WHERE d.client_ref = c.ref
  AND d.client_id IS NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_siren ON public.documents(siren);

-- 5. Expand CHECK constraint on category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'documents' AND constraint_name = 'documents_category_check'
  ) THEN
    ALTER TABLE public.documents DROP CONSTRAINT documents_category_check;
  END IF;
END $$;

ALTER TABLE public.documents ADD CONSTRAINT documents_category_check
  CHECK (category IN (
    'cni', 'cni_dirigeant', 'kbis', 'rib', 'statuts',
    'justificatif_domicile', 'attestation', 'attestation_vigilance',
    'liste_beneficiaires_effectifs', 'declaration_source_fonds',
    'justificatif_patrimoine', 'contrat', 'facture',
    'pv_assemblee', 'bilan', 'autre'
  ));

-- 6. Storage policies: allow access by cabinet_id in addition to user_id
DO $$
BEGIN
  -- Drop old user-based storage policies
  DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Cabinet members upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Cabinet members view documents" ON storage.objects;
  DROP POLICY IF EXISTS "Cabinet members delete documents" ON storage.objects;

  CREATE POLICY "Cabinet members upload documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[1] IN (
          SELECT cabinet_id::text FROM public.profiles WHERE id = auth.uid()
        )
      )
    );

  CREATE POLICY "Cabinet members view documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[1] IN (
          SELECT cabinet_id::text FROM public.profiles WHERE id = auth.uid()
        )
      )
    );

  CREATE POLICY "Cabinet members delete documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[1] IN (
          SELECT cabinet_id::text FROM public.profiles WHERE id = auth.uid()
        )
      )
    );
END $$;
