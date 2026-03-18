-- ============================================================
-- BUG 2 — Corriger le prénom "Alexande" → "Alexandre" dans profiles
-- ============================================================
UPDATE profiles
SET full_name = 'Alexandre Dahan'
WHERE email = 'futuryservices@gmail.com' AND full_name = 'Alexande Dahan';

-- ============================================================
-- BUG 10 — Peupler search_vector + trigger auto
-- ============================================================

-- Trigger pour auto-peupler search_vector à chaque INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_client_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('french',
    COALESCE(NEW.raison_sociale, '') || ' ' ||
    COALESCE(NEW.siren, '') || ' ' ||
    COALESCE(NEW.dirigeant, '') || ' ' ||
    COALESCE(NEW.ville, '') || ' ' ||
    COALESCE(NEW.ape, '') || ' ' ||
    COALESCE(NEW.domaine, '') || ' ' ||
    COALESCE(NEW.forme, '') || ' ' ||
    COALESCE(NEW.ref, '') || ' ' ||
    COALESCE(NEW.adresse, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_search_vector ON clients;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE OF raison_sociale, siren, dirigeant, ville, ape, domaine, forme, ref, adresse
  ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_client_search_vector();

-- Peupler les search_vector existants
UPDATE clients SET search_vector = to_tsvector('french',
  COALESCE(raison_sociale, '') || ' ' ||
  COALESCE(siren, '') || ' ' ||
  COALESCE(dirigeant, '') || ' ' ||
  COALESCE(ville, '') || ' ' ||
  COALESCE(ape, '') || ' ' ||
  COALESCE(domaine, '') || ' ' ||
  COALESCE(forme, '') || ' ' ||
  COALESCE(ref, '') || ' ' ||
  COALESCE(adresse, '')
);

-- Index GIN pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_clients_search_vector ON clients USING GIN(search_vector);

-- ============================================================
-- BUG 11 — Index sur clients.siren
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_siren ON clients(siren);
CREATE INDEX IF NOT EXISTS idx_clients_cabinet_id ON clients(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_clients_cabinet_statut ON clients(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_clients_cabinet_vigilance ON clients(cabinet_id, niv_vigilance);

-- ============================================================
-- BUG 12 — Index sur audit_trail et client_history
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_trail_cabinet_date ON audit_trail(cabinet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_client_history_ref ON client_history(client_ref);
CREATE INDEX IF NOT EXISTS idx_client_history_cabinet ON client_history(cabinet_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_cabinet ON login_history(cabinet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_cabinet ON notifications(cabinet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_kyc_client ON documents_kyc(client_ref, cabinet_id);

-- ============================================================
-- BUG 13 — CHECK constraint sur client_history.event_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'client_history_event_type_check'
  ) THEN
    ALTER TABLE client_history ADD CONSTRAINT client_history_event_type_check
      CHECK (event_type IN (
        'CREATION', 'MODIFICATION', 'REVUE_MAINTIEN', 'CHANGEMENT_VIGILANCE',
        'CHANGEMENT_SCORE', 'UPLOAD_DOCUMENT', 'SCREENING', 'ARCHIVE',
        'REACTIVATION', 'REFUS', 'VALIDATION', 'AFFECTATION'
      ));
  END IF;
END $$;

-- ============================================================
-- BUG 14 — Colonnes date typées via immutable function
-- ============================================================
CREATE OR REPLACE FUNCTION parse_iso_date(val text)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN val ~ '^\d{4}-\d{2}-\d{2}' THEN val::date
    ELSE NULL
  END;
$$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_butoir_parsed date
  GENERATED ALWAYS AS (parse_iso_date(date_butoir)) STORED;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_creation_parsed date
  GENERATED ALWAYS AS (parse_iso_date(date_creation)) STORED;

-- Index sur les colonnes computed
CREATE INDEX IF NOT EXISTS idx_clients_butoir_parsed ON clients(date_butoir_parsed);

-- ============================================================
-- BUG 15 — Ajouter un commentaire de dépréciation explicite
-- ============================================================
COMMENT ON TABLE lm_templates IS 'DEPRECATED — remplacée par lm_modeles. Ne pas utiliser.';
COMMENT ON TABLE lm_instances IS 'DEPRECATED — remplacée par lettres_mission. Ne pas utiliser.';
COMMENT ON TABLE maintiens_mission IS 'DEPRECATED — remplacée par revue_maintien. Ne pas utiliser.';

-- ============================================================
-- BUG 16 — Vérifier les backups en échec
-- ============================================================
-- Pas de migration nécessaire, juste une requête de vérification :
-- SELECT status, COUNT(*) FROM backup_history GROUP BY status;

-- ============================================================
-- Contrainte unique pour brouillons (nécessaire pour BUG 25)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_brouillons_siren_cabinet'
  ) THEN
    CREATE UNIQUE INDEX idx_brouillons_siren_cabinet ON brouillons(siren, cabinet_id)
      WHERE siren IS NOT NULL AND cabinet_id IS NOT NULL;
  END IF;
END $$;
