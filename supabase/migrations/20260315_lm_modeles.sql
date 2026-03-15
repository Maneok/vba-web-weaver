-- Helper: update_updated_at_column (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════
-- Table des modèles de lettre de mission par cabinet
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lm_modeles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT 'Modèle standard',
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  cgv_content text,
  repartition_taches jsonb DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'grimy' CHECK (source IN ('grimy', 'import_docx', 'duplicate')),
  original_filename text,
  import_mapping jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_lm_modeles_cabinet ON lm_modeles(cabinet_id);
CREATE INDEX idx_lm_modeles_default ON lm_modeles(cabinet_id, is_default) WHERE is_default = true;

ALTER TABLE lm_modeles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cabinet models" ON lm_modeles
  FOR SELECT USING (cabinet_id = get_user_cabinet_id());

CREATE POLICY "Admins can insert models" ON lm_modeles
  FOR INSERT WITH CHECK (
    cabinet_id = get_user_cabinet_id()
    AND get_user_role() IN ('ADMIN', 'SUPERVISEUR')
  );

CREATE POLICY "Admins can update models" ON lm_modeles
  FOR UPDATE USING (
    cabinet_id = get_user_cabinet_id()
    AND get_user_role() IN ('ADMIN', 'SUPERVISEUR')
  );

CREATE POLICY "Admins can delete models" ON lm_modeles
  FOR DELETE USING (
    cabinet_id = get_user_cabinet_id()
    AND get_user_role() = 'ADMIN'
  );

CREATE TRIGGER update_lm_modeles_updated_at
  BEFORE UPDATE ON lm_modeles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION ensure_single_default_lm_modele()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE lm_modeles SET is_default = false
    WHERE cabinet_id = NEW.cabinet_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_default_lm_modele
  BEFORE INSERT OR UPDATE ON lm_modeles
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_lm_modele();

-- ══════════════════════════════════════════════
-- Table des instances de LM générées
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lm_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  modele_id uuid REFERENCES lm_modeles(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  numero text NOT NULL,
  sections_snapshot jsonb NOT NULL,
  cgv_snapshot text,
  variables_resolved jsonb,
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyee', 'signee', 'archivee')),
  pdf_storage_path text,
  docx_storage_path text,
  signed_at timestamptz,
  signed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_lm_instances_cabinet ON lm_instances(cabinet_id);
CREATE INDEX idx_lm_instances_client ON lm_instances(client_id);
CREATE INDEX idx_lm_instances_numero ON lm_instances(cabinet_id, numero);

ALTER TABLE lm_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cabinet instances" ON lm_instances
  FOR SELECT USING (cabinet_id = get_user_cabinet_id());

CREATE POLICY "Users can insert own cabinet instances" ON lm_instances
  FOR INSERT WITH CHECK (cabinet_id = get_user_cabinet_id());

CREATE POLICY "Users can update own cabinet instances" ON lm_instances
  FOR UPDATE USING (cabinet_id = get_user_cabinet_id());

CREATE POLICY "Admins can delete instances" ON lm_instances
  FOR DELETE USING (
    cabinet_id = get_user_cabinet_id()
    AND get_user_role() IN ('ADMIN', 'SUPERVISEUR')
  );

CREATE TRIGGER update_lm_instances_updated_at
  BEFORE UPDATE ON lm_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
