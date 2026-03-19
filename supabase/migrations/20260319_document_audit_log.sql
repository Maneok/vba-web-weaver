-- Document audit log for GED traceability
CREATE TABLE IF NOT EXISTS document_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  cabinet_id uuid NOT NULL REFERENCES cabinets(id),
  siren text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (action IN (
    'upload', 'download', 'preview', 'validate', 'reject',
    'delete', 'rename', 'replace', 'category_change', 'tag_change'
  )),
  actor_id uuid REFERENCES auth.users(id),
  actor_name text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_doc_audit_document ON document_audit_log(document_id);
CREATE INDEX idx_doc_audit_siren ON document_audit_log(siren);
CREATE INDEX idx_doc_audit_cabinet ON document_audit_log(cabinet_id);
CREATE INDEX idx_doc_audit_created ON document_audit_log(created_at DESC);

ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_audit_select_cabinet" ON document_audit_log
  FOR SELECT USING (cabinet_id = get_user_cabinet_id());

CREATE POLICY "doc_audit_insert_cabinet" ON document_audit_log
  FOR INSERT WITH CHECK (cabinet_id = get_user_cabinet_id());
