-- Fix vigilance thresholds: SIMPLIFIEE ≤ 25 (was ≤ 30), STANDARD 26-60 (was 31-60), RENFORCEE > 60
-- Aligns SQL with the JS constants in src/lib/constants.ts

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
  FOR v_client IN
    SELECT * FROM clients
    WHERE cabinet_id = p_cabinet_id
      AND etat != 'ARCHIVE'
  LOOP
    -- 1. score_activite
    SELECT COALESCE(ra.score, 25) INTO v_score_activite
    FROM ref_activites ra
    WHERE ra.cabinet_id = p_cabinet_id
      AND ra.code = v_client.ape
    LIMIT 1;
    IF v_score_activite IS NULL THEN v_score_activite := 25; END IF;

    -- 2. score_mission
    SELECT COALESCE(rm.score, 25) INTO v_score_mission
    FROM ref_missions rm
    WHERE rm.cabinet_id = p_cabinet_id
      AND (rm.code = v_client.mission OR UPPER(rm.libelle) = UPPER(v_client.mission))
    LIMIT 1;
    IF v_score_mission IS NULL THEN v_score_mission := 25; END IF;

    -- 3. score_structure
    SELECT COALESCE(rt.score, 20) INTO v_score_structure
    FROM ref_types_juridiques rt
    WHERE rt.cabinet_id = p_cabinet_id
      AND (UPPER(rt.libelle) = UPPER(v_client.forme) OR UPPER(rt.code) = UPPER(v_client.forme))
    LIMIT 1;
    IF v_score_structure IS NULL THEN v_score_structure := 20; END IF;

    -- 4. score_pays
    IF v_client.pays_risque = 'OUI' THEN
      v_score_pays := 100;
    ELSE
      v_score_pays := 0;
    END IF;

    -- 5. score_maturite
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
            v_score_maturite := 80;
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

    IF v_client.date_creation IS NOT NULL AND v_client.date_creation != '' THEN
      BEGIN
        v_age_months := EXTRACT(YEAR FROM AGE(NOW(), v_client.date_creation::timestamp)) * 12
                       + EXTRACT(MONTH FROM AGE(NOW(), v_client.date_creation::timestamp));
        IF v_age_months < 6 THEN v_malus := v_malus + 20;
        ELSIF v_age_months < 24 THEN v_malus := v_malus + 10;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    -- 7. score_global + niv_vigilance
    IF v_client.ppe = 'OUI' OR v_client.atypique = 'OUI' THEN
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

      -- FIX: Aligned thresholds — SIMPLIFIEE ≤ 25, STANDARD 26-60, RENFORCEE > 60
      IF v_score_global <= 25 THEN v_niv_vigilance := 'SIMPLIFIEE';
      ELSIF v_score_global <= 60 THEN v_niv_vigilance := 'STANDARD';
      ELSE v_niv_vigilance := 'RENFORCEE';
      END IF;
    END IF;

    -- 8. date_butoir
    CASE v_niv_vigilance
      WHEN 'SIMPLIFIEE' THEN v_date_butoir := (NOW() + INTERVAL '3 years')::date;
      WHEN 'STANDARD'   THEN v_date_butoir := (NOW() + INTERVAL '1 year')::date;
      WHEN 'RENFORCEE'  THEN v_date_butoir := (NOW() + INTERVAL '6 months')::date;
      ELSE v_date_butoir := (NOW() + INTERVAL '1 year')::date;
    END CASE;

    -- 9. UPDATE
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
