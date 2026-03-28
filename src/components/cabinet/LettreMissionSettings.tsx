import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Upload, Image, FileText, Trash2, Check } from "lucide-react";
import TarifsGrille from "./TarifsGrille";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LmCabinetFields {
  outil_transmission_defaut: string;
  taux_ec: string;
  taux_collaborateur: string;
  id_sepa: string;
  assureur_rc: string;
  numero_contrat_rc: string;
  adresse_assureur: string;
  ville_tribunal: string;
  date_cgv: string;
}

const DEFAULTS: LmCabinetFields = {
  outil_transmission_defaut: "Idépôt",
  taux_ec: "200 € HT",
  taux_collaborateur: "100 € HT",
  id_sepa: "",
  assureur_rc: "MMA IARD",
  numero_contrat_rc: "",
  adresse_assureur: "",
  ville_tribunal: "MARSEILLE",
  date_cgv: "6 Janvier 2025",
};

const OUTILS_TRANSMISSION = ["Idépôt", "Inqom", "Pennylane", "Dext", "Email", "Autre"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LettreMissionSettings() {
  const { cabinetId } = useAuth();
  const [fields, setFields] = useState<LmCabinetFields>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Template state
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // ---- Load ----
  useEffect(() => {
    if (!cabinetId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("cabinets")
          .select("outil_transmission_defaut, taux_ec, taux_collaborateur, id_sepa, assureur_rc, numero_contrat_rc, adresse_assureur, ville_tribunal, date_cgv")
          .eq("id", cabinetId)
          .single();
        if (error) throw error;
        if (data) {
          setFields({
            outil_transmission_defaut: data.outil_transmission_defaut ?? DEFAULTS.outil_transmission_defaut,
            taux_ec: data.taux_ec ?? DEFAULTS.taux_ec,
            taux_collaborateur: data.taux_collaborateur ?? DEFAULTS.taux_collaborateur,
            id_sepa: data.id_sepa ?? "",
            assureur_rc: data.assureur_rc ?? DEFAULTS.assureur_rc,
            numero_contrat_rc: data.numero_contrat_rc ?? "",
            adresse_assureur: data.adresse_assureur ?? "",
            ville_tribunal: data.ville_tribunal ?? DEFAULTS.ville_tribunal,
            date_cgv: data.date_cgv ?? DEFAULTS.date_cgv,
          });
        }

        // Check logo existence
        const { data: logoList } = await supabase.storage
          .from("cabinet-assets")
          .list(`${cabinetId}`, { search: "logo" });
        if (logoList && logoList.length > 0) {
          const { data: urlData } = supabase.storage
            .from("cabinet-assets")
            .getPublicUrl(`${cabinetId}/${logoList[0].name}`);
          // Use signed URL for private bucket
          const { data: signedData } = await supabase.storage
            .from("cabinet-assets")
            .createSignedUrl(`${cabinetId}/${logoList[0].name}`, 3600);
          if (signedData?.signedUrl) setLogoUrl(signedData.signedUrl);
        }

        // Check template existence
        const { data: tplList } = await supabase.storage
          .from("cabinet-assets")
          .list(`${cabinetId}/templates`);
        if (tplList && tplList.length > 0) {
          setTemplateName(tplList[0].name);
        }
      } catch (err) {
        logger.error("Failed to load LM settings", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [cabinetId]);

  // ---- Save fields ----
  const handleSave = useCallback(async () => {
    if (!cabinetId) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("cabinets")
        .update(fields as any)
        .eq("id", cabinetId);
      if (error) throw error;
      setSaved(true);
      toast.success("Paramètres Lettre de Mission enregistrés");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      logger.error("Failed to save LM settings", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [cabinetId, fields]);

  // ---- Upload logo ----
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cabinetId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le logo ne doit pas dépasser 2 Mo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Fichier image requis (PNG, JPG)");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${cabinetId}/logo.${ext}`;
      const { error } = await supabase.storage
        .from("cabinet-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signedData } = await supabase.storage
        .from("cabinet-assets")
        .createSignedUrl(path, 3600);
      if (signedData?.signedUrl) setLogoUrl(signedData.signedUrl);
      toast.success("Logo uploadé avec succès");
    } catch (err: any) {
      logger.error("Logo upload failed", err);
      toast.error("Erreur lors de l'upload du logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }, [cabinetId]);

  // ---- Upload template ----
  const handleTemplateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cabinetId) return;
    if (!file.name.endsWith(".docx")) {
      toast.error("Fichier .docx requis");
      return;
    }
    setUploadingTemplate(true);
    try {
      const path = `${cabinetId}/templates/lm-default.docx`;
      const { error } = await supabase.storage
        .from("cabinet-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setTemplateName(file.name);
      toast.success("Template uploadé avec succès");
    } catch (err: any) {
      logger.error("Template upload failed", err);
      toast.error("Erreur lors de l'upload du template");
    } finally {
      setUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  }, [cabinetId]);

  // ---- Delete logo ----
  const handleDeleteLogo = useCallback(async () => {
    if (!cabinetId) return;
    try {
      const { data: files } = await supabase.storage
        .from("cabinet-assets")
        .list(`${cabinetId}`, { search: "logo" });
      if (files && files.length > 0) {
        await supabase.storage
          .from("cabinet-assets")
          .remove(files.map(f => `${cabinetId}/${f.name}`));
      }
      setLogoUrl(null);
      toast.success("Logo supprimé");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  }, [cabinetId]);

  // ---- Field change ----
  const updateField = (key: keyof LmCabinetFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo & Template uploads */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="w-4 h-4" />
            Logo et Template
          </CardTitle>
          <CardDescription>Logo du cabinet et template DOCX personnalisé pour les lettres de mission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="space-y-3">
            <Label className="font-medium">Logo du cabinet</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative group">
                  <img
                    src={logoUrl}
                    alt="Logo cabinet"
                    className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-1"
                  />
                  <button
                    onClick={handleDeleteLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400">
                  <Image className="w-8 h-8" />
                </div>
              )}
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  {logoUrl ? "Remplacer" : "Uploader"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, max 2 Mo</p>
              </div>
            </div>
          </div>

          {/* Template DOCX */}
          <div className="space-y-3">
            <Label className="font-medium">Template DOCX personnalisé</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-blue-500" />
                {templateName ? (
                  <span className="text-slate-700 dark:text-slate-300">{templateName}</span>
                ) : (
                  <span className="text-muted-foreground italic">Template par défaut utilisé</span>
                )}
              </div>
              <div>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleTemplateUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => templateInputRef.current?.click()}
                  disabled={uploadingTemplate}
                >
                  {uploadingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  {templateName ? "Remplacer" : "Uploader"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grille tarifaire */}
      <TarifsGrille cabinetId={cabinetId} />

      {/* Editable fields */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Paramètres Lettre de Mission
          </CardTitle>
          <CardDescription>Valeurs par défaut utilisées lors de la génération des lettres de mission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Outil de transmission */}
          <div className="space-y-1.5">
            <Label htmlFor="outil_transmission">Outil de transmission par défaut</Label>
            <Select
              value={fields.outil_transmission_defaut}
              onValueChange={v => updateField("outil_transmission_defaut", v)}
            >
              <SelectTrigger id="outil_transmission" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTILS_TRANSMISSION.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Taux horaires */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="taux_ec">Taux horaire expert-comptable</Label>
              <Input
                id="taux_ec"
                value={fields.taux_ec}
                onChange={e => updateField("taux_ec", e.target.value)}
                placeholder="200 € HT"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taux_collab">Taux horaire collaborateur</Label>
              <Input
                id="taux_collab"
                value={fields.taux_collaborateur}
                onChange={e => updateField("taux_collaborateur", e.target.value)}
                placeholder="100 € HT"
              />
            </div>
          </div>

          {/* SEPA */}
          <div className="space-y-1.5">
            <Label htmlFor="id_sepa">Identifiant créancier SEPA</Label>
            <Input
              id="id_sepa"
              value={fields.id_sepa}
              onChange={e => updateField("id_sepa", e.target.value)}
              placeholder="FR00ZZZ..."
              className="max-w-sm"
            />
          </div>

          {/* Assureur RC Pro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="assureur_rc">Assureur RC Pro</Label>
              <Input
                id="assureur_rc"
                value={fields.assureur_rc}
                onChange={e => updateField("assureur_rc", e.target.value)}
                placeholder="MMA IARD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numero_contrat_rc">N° contrat RC Pro</Label>
              <Input
                id="numero_contrat_rc"
                value={fields.numero_contrat_rc}
                onChange={e => updateField("numero_contrat_rc", e.target.value)}
                placeholder="Numéro de contrat"
              />
            </div>
          </div>

          {/* Adresse assureur */}
          <div className="space-y-1.5">
            <Label htmlFor="adresse_assureur">Adresse de l'assureur</Label>
            <Input
              id="adresse_assureur"
              value={fields.adresse_assureur}
              onChange={e => updateField("adresse_assureur", e.target.value)}
              placeholder="Adresse complète de l'assureur"
            />
          </div>

          {/* Tribunal + CGV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ville_tribunal">Ville du tribunal compétent</Label>
              <Input
                id="ville_tribunal"
                value={fields.ville_tribunal}
                onChange={e => updateField("ville_tribunal", e.target.value)}
                placeholder="MARSEILLE"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_cgv">Date des CGV en vigueur</Label>
              <Input
                id="date_cgv"
                value={fields.date_cgv}
                onChange={e => updateField("date_cgv", e.target.value)}
                placeholder="6 Janvier 2025"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saved ? "Enregistré" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
