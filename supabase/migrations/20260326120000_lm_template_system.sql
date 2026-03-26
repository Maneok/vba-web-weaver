-- Colonnes cabinet pour le système LM
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS outil_transmission_defaut TEXT DEFAULT 'Idépôt';
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS taux_ec TEXT DEFAULT '200 € HT';
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS taux_collaborateur TEXT DEFAULT '100 € HT';
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS id_sepa TEXT;
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS assureur_rc TEXT DEFAULT 'MMA IARD';
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS numero_contrat_rc TEXT;
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS adresse_assureur TEXT;
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS ville_tribunal TEXT DEFAULT 'MARSEILLE';
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS date_cgv TEXT DEFAULT '6 Janvier 2025';

-- Colonnes client pour pré-remplissage LM
ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_fiscal TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_cloture_exercice TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assujetti_tva BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cac BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS volume_comptable TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS outil_transmission TEXT;

-- Bucket Storage pour les assets cabinet
INSERT INTO storage.buckets (id, name, public)
VALUES ('cabinet-assets', 'cabinet-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Policy : les membres du cabinet peuvent lire/écrire
CREATE POLICY "Cabinet members can manage assets"
ON storage.objects FOR ALL USING (
  bucket_id = 'cabinet-assets' AND
  (storage.foldername(name))[1] = (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);
