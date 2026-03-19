-- T10: Label + Description columns (already applied via MCP on 2026-03-19)
-- Kept here for migration history completeness.

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS description text;

-- Indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_documents_label ON public.documents USING gin (to_tsvector('french', coalesce(label, '')));
