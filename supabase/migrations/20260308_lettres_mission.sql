-- Table for persisting Lettre de Mission editor state
CREATE TABLE IF NOT EXISTS public.lettres_mission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_ref text NOT NULL,
  numero text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'brouillon',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_ref, user_id)
);

-- RLS
ALTER TABLE public.lettres_mission ENABLE ROW LEVEL SECURITY;

-- Users can only access their own lettres
CREATE POLICY "Users manage own lettres_mission"
  ON public.lettres_mission
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_lettres_mission
  BEFORE UPDATE ON public.lettres_mission
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
