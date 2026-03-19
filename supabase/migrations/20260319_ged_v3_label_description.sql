-- GED V3: Label + Description columns (#109, #110)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS description text;

-- Indexes for search in notes/tags (#139)
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_documents_notes ON public.documents USING gin (to_tsvector('french', coalesce(notes, '')));
CREATE INDEX IF NOT EXISTS idx_documents_label ON public.documents USING gin (to_tsvector('french', coalesce(label, '')));
