-- ==========================================================
-- FONCTION RPC : Recalcule les scores de TOUS les clients d'un cabinet
-- Appelée quand les paramètres de scoring changent
-- ==========================================================

CREATE OR REPLACE FUNCTION recalculate_cabinet_scores(p_cabinet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_score_activite numeric;
  v_score_pays numeric;
  v_score_mission numeric;
  v_score_maturite numeric;
  v_score_structure numeric;
  v_malus numeric;
  v_score_global numeric;
  v_niv_vigilance text;
  v_anciennete_years numeric;
  v_max_criterion numeric;
  v_avg numeric;
  v_updated_count integer := 0;
  v_date_butoir date;
  v_age_months integer;
BEGIN
  -- Boucle sur tous les clients actifs du cabinet
  FOR v_client IN
    SELECT * FROM clients
    WHERE cabinet_id = p_cabinet_id
      AND etat != 'ARCHIVE'
  LOOP
    -- 1. score_activite : depuis ref_activites par code APE
    SELECT COALESCE(ra.score, 25) INTO v_score_activite
    FROM ref_activites ra
    WHERE ra.cabinet_id = p_cabinet_id
      AND ra.code = v_client.ape
    LIMIT 1;
    IF v_score_activite IS NULL THEN v_score_activite := 25; END IF;

    -- 2. score_mission : depuis ref_missions par type mission
    SELECT COALESCE(rm.score, 25) INTO v_score_mission
    FROM ref_missions rm
    WHERE rm.cabinet_id = p_cabinet_id
      AND (rm.code = v_client.mission OR UPPER(rm.libelle) = UPPER(v_client.mission))
    LIMIT 1;
    IF v_score_mission IS NULL THEN v_score_mission := 25; END IF;

    -- 3. score_structure : depuis ref_types_juridiques par forme juridique
    SELECT COALESCE(rt.score, 20) INTO v_score_structure
    FROM ref_types_juridiques rt
    WHERE rt.cabinet_id = p_cabinet_id
      AND (UPPER(rt.libelle) = UPPER(v_client.forme) OR UPPER(rt.code) = UPPER(v_client.forme))
    LIMIT 1;
    IF v_score_structure IS NULL THEN v_score_structure := 20; END IF;

    -- 4. score_pays : 100 si pays_risque = OUI, 0 sinon
    IF v_client.pays_risque = 'OUI' THEN
      v_score_pays := 100;
    ELSE
      v_score_pays := 0;
    END IF;

    -- 5. score_maturite : calculé depuis date_creation (text)
    IF v_client.date_creation IS NULL OR v_client.date_creation = '' THEN
      v_score_maturite := 65;
    ELSE
      BEGIN
        v_anciennete_years := EXTRACT(EPOCH FROM (NOW() - v_client.date_creation::timestamp)) / (365.25 * 24 * 3600);
        IF v_anciennete_years < 1 THEN
          v_score_maturite := 65;
        ELSIF v_anciennete_years < 3 THEN
          IF v_client.date_reprise IS NOT NULL
             AND v_client.date_reprise != ''
             AND v_client.date_reprise != v_client.date_creation THEN
            v_score_maturite := 50;
          ELSE
            v_score_maturite := 30;
          END IF;
        ELSE
          -- > 3 ans
          IF (v_client.effectif IS NOT NULL
              AND v_client.effectif != ''
              AND v_client.effectif != '0'
              AND v_client.effectif !~ '^0\s'
              AND UPPER(v_client.effectif) NOT LIKE '%AUCUN%'
              AND UPPER(v_client.effectif) NOT LIKE '%NEANT%')
             OR UPPER(COALESCE(v_client.forme, '')) LIKE '%SCI%'
             OR UPPER(COALESCE(v_client.forme, '')) LIKE '%HOLDING%' THEN
            v_score_maturite := 0;
          ELSIF v_client.date_reprise IS NULL
                OR v_client.date_reprise = ''
                OR v_client.date_reprise = v_client.date_creation THEN
            v_score_maturite := 10;
          ELSE
            v_score_maturite := 80; -- Dormant shell risk
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_score_maturite := 65;
      END;
    END IF;

    -- 6. malus
    v_malus := 0;
    IF v_client.cash = 'OUI' THEN v_malus := v_malus + 40; END IF;
    IF v_client.pression = 'OUI' THEN v_malus := v_malus + 40; END IF;
    IF v_client.distanciel = 'OUI' THEN v_malus := v_malus + 30; END IF;

    -- Récence malus (entreprise jeune)
    IF v_client.date_creation IS NOT NULL AND v_client.date_creation != '' THEN
      BEGIN
        v_age_months := EXTRACT(YEAR FROM AGE(NOW(), v_client.date_creation::timestamp)) * 12
                       + EXTRACT(MONTH FROM AGE(NOW(), v_client.date_creation::timestamp));
        IF v_age_months < 6 THEN v_malus := v_malus + 20;
        ELSIF v_age_months < 24 THEN v_malus := v_malus + 10;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore invalid dates
      END;
    END IF;

    -- 7. score_global + niv_vigilance
    IF v_client.ppe = 'OUI' OR v_client.atypique = 'OUI' THEN
      -- PPE ou atypique → score forcé à 100, vigilance renforcée
      v_score_global := 100;
      v_niv_vigilance := 'RENFORCEE';
      IF v_client.ppe = 'OUI' THEN v_malus := v_malus + 100; END IF;
      IF v_client.atypique = 'OUI' THEN v_malus := v_malus + 100; END IF;
    ELSE
      v_max_criterion := GREATEST(v_score_activite, v_score_pays, v_score_mission, v_score_maturite, v_score_structure);
      v_avg := (v_score_activite + v_score_pays + v_score_mission + v_score_maturite + v_score_structure) / 5.0;

      IF v_max_criterion >= 60 THEN
        v_score_global := LEAST(ROUND(v_max_criterion + v_malus), 100);
      ELSE
        v_score_global := LEAST(ROUND(v_avg + v_malus), 100);
      END IF;

      IF v_score_global <= 30 THEN v_niv_vigilance := 'SIMPLIFIEE';
      ELSIF v_score_global <= 60 THEN v_niv_vigilance := 'STANDARD';
      ELSE v_niv_vigilance := 'RENFORCEE';
      END IF;
    END IF;

    -- 8. date_butoir selon vigilance
    CASE v_niv_vigilance
      WHEN 'SIMPLIFIEE' THEN v_date_butoir := (NOW() + INTERVAL '3 years')::date;
      WHEN 'STANDARD'   THEN v_date_butoir := (NOW() + INTERVAL '1 year')::date;
      WHEN 'RENFORCEE'  THEN v_date_butoir := (NOW() + INTERVAL '6 months')::date;
      ELSE v_date_butoir := (NOW() + INTERVAL '1 year')::date;
    END CASE;

    -- 9. UPDATE le client
    UPDATE clients SET
      score_activite = v_score_activite,
      score_pays = v_score_pays,
      score_mission = v_score_mission,
      score_maturite = v_score_maturite,
      score_structure = v_score_structure,
      malus = v_malus,
      score_global = v_score_global,
      niv_vigilance = v_niv_vigilance,
      date_butoir = v_date_butoir::text,
      etat_pilotage = CASE
        WHEN v_date_butoir < NOW()::date THEN 'RETARD'
        WHEN v_date_butoir < (NOW() + INTERVAL '60 days')::date THEN 'BIENTOT'
        ELSE 'A JOUR'
      END,
      updated_at = NOW()
    WHERE id = v_client.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Audit trail
  INSERT INTO audit_trail (cabinet_id, action, table_name, new_data)
  VALUES (
    p_cabinet_id,
    'RECALCULATE_ALL_SCORES',
    'clients',
    jsonb_build_object('updated_count', v_updated_count, 'timestamp', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'timestamp', NOW()
  );
END;
$$;

-- ==========================================================
-- TRIGGER : Recalcul automatique quand les tables ref_* changent
-- ==========================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cabinet_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cabinet_id := OLD.cabinet_id;
  ELSE
    v_cabinet_id := NEW.cabinet_id;
  END IF;

  IF v_cabinet_id IS NOT NULL THEN
    PERFORM recalculate_cabinet_scores(v_cabinet_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attacher le trigger aux 4 tables de référence
DROP TRIGGER IF EXISTS trg_recalc_ref_activites ON ref_activites;
CREATE TRIGGER trg_recalc_ref_activites
  AFTER UPDATE OF score, niveau_risque ON ref_activites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_scores();

DROP TRIGGER IF EXISTS trg_recalc_ref_missions ON ref_missions;
CREATE TRIGGER trg_recalc_ref_missions
  AFTER UPDATE OF score, niveau_risque ON ref_missions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_scores();

DROP TRIGGER IF EXISTS trg_recalc_ref_types_juridiques ON ref_types_juridiques;
CREATE TRIGGER trg_recalc_ref_types_juridiques
  AFTER UPDATE OF score, niveau_risque ON ref_types_juridiques
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_scores();

DROP TRIGGER IF EXISTS trg_recalc_ref_pays ON ref_pays;
CREATE TRIGGER trg_recalc_ref_pays
  AFTER UPDATE OF score, niveau_risque, est_gafi_noir, est_gafi_gris, est_offshore ON ref_pays
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_scores();

-- Grant execute to authenticated users (RPC call from front)
GRANT EXECUTE ON FUNCTION recalculate_cabinet_scores(uuid) TO authenticated;
