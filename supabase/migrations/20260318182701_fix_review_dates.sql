-- ==========================================================
-- Recalculer date_butoir pour TOUS les clients existants
-- Nouveau délai : SIMPLIFIEE +2ans, STANDARD +1an, RENFORCEE +6mois
-- Base = max(date_derniere_revue, date_creation_ligne)
-- ==========================================================

UPDATE clients SET
  date_butoir = CASE
    WHEN niv_vigilance = 'SIMPLIFIEE' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '2 years'
    )::date::text
    WHEN niv_vigilance = 'STANDARD' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '1 year'
    )::date::text
    WHEN niv_vigilance = 'RENFORCEE' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '6 months'
    )::date::text
    ELSE date_butoir
  END,
  etat_pilotage = CASE
    WHEN date_butoir::date < CURRENT_DATE THEN 'RETARD'
    WHEN date_butoir::date < (CURRENT_DATE + INTERVAL '60 days') THEN 'BIENTOT'
    ELSE 'A JOUR'
  END,
  date_prochain_maintien = CASE
    WHEN niv_vigilance = 'SIMPLIFIEE' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '2 years'
    )::date
    WHEN niv_vigilance = 'STANDARD' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '1 year'
    )::date
    WHEN niv_vigilance = 'RENFORCEE' THEN (
      GREATEST(
        COALESCE(date_derniere_revue::date, date_creation_ligne::date, CURRENT_DATE),
        COALESCE(date_creation_ligne::date, CURRENT_DATE)
      ) + INTERVAL '6 months'
    )::date
    ELSE date_prochain_maintien
  END,
  updated_at = NOW()
WHERE statut = 'ACTIF';

-- Fonction utilitaire : intervalle de revue selon vigilance
CREATE OR REPLACE FUNCTION get_review_interval(p_vigilance text)
RETURNS interval
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_vigilance
    WHEN 'SIMPLIFIEE' THEN INTERVAL '2 years'
    WHEN 'STANDARD' THEN INTERVAL '1 year'
    WHEN 'RENFORCEE' THEN INTERVAL '6 months'
    ELSE INTERVAL '1 year'
  END;
END;
$$;

-- Fonction utilitaire : un client est-il éligible pour une revue ?
CREATE OR REPLACE FUNCTION is_review_due(
  p_vigilance text,
  p_derniere_revue text,
  p_date_creation text
)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_base_date date;
  v_due_date date;
BEGIN
  v_base_date := GREATEST(
    COALESCE(NULLIF(p_derniere_revue, '')::date, '2020-01-01'::date),
    COALESCE(NULLIF(p_date_creation, '')::date, '2020-01-01'::date)
  );
  v_due_date := v_base_date + get_review_interval(p_vigilance);
  RETURN v_due_date <= CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_review_interval(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_review_due(text, text, text) TO authenticated;
