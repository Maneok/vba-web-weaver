-- ==========================================================
-- CRON automatique : daily-maintenance + nightly score recalc
-- Double ceinture : pg_cron (SQL) + Vercel cron (HTTP backup)
-- ==========================================================

-- 1. Activer pg_cron et pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Accorder à postgres le droit d'utiliser cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ==========================================================
-- JOB 1 : daily_full_maintenance() — tous les jours à 5h00 UTC
-- Appelle directement la RPC SQL (snapshots, backups, etc.)
-- Le cache gel-avoirs est géré par le job HTTP ci-dessous
-- ==========================================================

SELECT cron.unschedule('daily-maintenance-job')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-job');

SELECT cron.schedule(
  'daily-maintenance-job',
  '0 5 * * *',
  $$SELECT daily_full_maintenance();$$
);

-- ==========================================================
-- JOB 2 : Recalcul nightly des scores — tous les jours à 5h30 UTC
-- Rattrape les cas où un trigger aurait raté ou un import CSV sans recalcul
-- ==========================================================

SELECT cron.unschedule('nightly-score-recalc')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-score-recalc');

SELECT cron.schedule(
  'nightly-score-recalc',
  '30 5 * * *',
  $$
  DO $do$
  DECLARE
    v_cab RECORD;
  BEGIN
    FOR v_cab IN SELECT id FROM public.cabinets WHERE id != '00000000-0000-0000-0000-000000000000' LOOP
      PERFORM public.recalculate_cabinet_scores(v_cab.id);
    END LOOP;
  END;
  $do$;
  $$
);

-- ==========================================================
-- JOB 3 : Appel HTTP vers Edge Function daily-maintenance — 5h15 UTC
-- Nécessaire pour le pré-chargement du cache gel-avoirs (11 Mo)
-- qui ne peut se faire qu'en Edge Function (fetch HTTP externe)
-- Utilise pg_net pour l'appel HTTP asynchrone
-- ==========================================================

SELECT cron.unschedule('daily-maintenance-http')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-http');

SELECT cron.schedule(
  'daily-maintenance-http',
  '15 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://szjcmepjuxlvnkqbxqqr.supabase.co/functions/v1/daily-maintenance',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6amNtZXBqdXhsdm5rcWJ4cXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjE3OTIsImV4cCI6MjA4ODM5Nzc5Mn0.Y1pAtDUdUTxm0ixzHN0NU4AprBMivvR8lZTnmKJvahk"}'::jsonb,
    body := '{"source": "pg_cron", "scheduled": true}'::jsonb
  );
  $$
);

-- Vérification : SELECT * FROM cron.job;
