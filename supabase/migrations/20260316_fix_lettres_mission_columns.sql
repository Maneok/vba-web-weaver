-- Add missing raison_sociale column
ALTER TABLE lettres_mission ADD COLUMN IF NOT EXISTS raison_sociale text;

-- Add statut column (alias for status, used by frontend)
ALTER TABLE lettres_mission ADD COLUMN IF NOT EXISTS statut text DEFAULT 'brouillon';

-- Sync existing data: copy status → statut where statut is null
UPDATE lettres_mission SET statut = COALESCE(status, 'brouillon') WHERE statut IS NULL;

-- Add modele_id reference for model integration
ALTER TABLE lettres_mission ADD COLUMN IF NOT EXISTS modele_id uuid REFERENCES lm_modeles(id) ON DELETE SET NULL;

-- Add updated_at trigger if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_lettres_mission_updated_at'
  ) THEN
    CREATE TRIGGER update_lettres_mission_updated_at
      BEFORE UPDATE ON lettres_mission
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
