-- Super admin peut tout faire dans cabinet-assets
CREATE POLICY "Super admin full access to cabinet-assets"
ON storage.objects FOR ALL USING (
  bucket_id = 'cabinet-assets' AND
  public.is_super_admin()
);

-- Tous les utilisateurs authentifiés peuvent lire le dossier default/
-- (pour que l'Edge Function puisse télécharger le template par défaut)
CREATE POLICY "All authenticated users can read default templates"
ON storage.objects FOR SELECT USING (
  bucket_id = 'cabinet-assets' AND
  (storage.foldername(name))[1] = 'default'
  AND auth.role() = 'authenticated'
);
