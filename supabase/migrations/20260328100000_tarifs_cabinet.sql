-- Add default pricing grid to cabinets
ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS tarifs_defaut JSONB DEFAULT '{
  "taux_ec": 200,
  "taux_collaborateur": 100,
  "prix_bulletin": 32,
  "prix_fin_contrat": 30,
  "prix_coffre_fort": 5,
  "prix_contrat_simple": 100,
  "prix_entree_salarie": 30,
  "prix_attestation_maladie": 30,
  "prix_bordereaux": 25,
  "prix_sylae": 15,
  "honoraires_juridique_defaut": 300,
  "forfait_constitution_defaut": 500
}'::jsonb;
