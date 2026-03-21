-- Add extrait_kbis to documents category CHECK constraint
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
    'cni', 'cni_dirigeant', 'kbis', 'extrait_kbis', 'rib', 'statuts',
    'justificatif_domicile', 'attestation', 'attestation_vigilance',
    'liste_beneficiaires_effectifs', 'declaration_source_fonds',
    'justificatif_patrimoine', 'contrat', 'facture',
    'pv_assemblee', 'bilan', 'autre'
  ));
