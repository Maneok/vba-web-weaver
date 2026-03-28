import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateInfo {
  exists: boolean;
  name?: string;
  size?: number;
  updatedAt?: string;
}

interface CabinetAssetInfo {
  id: string;
  nom: string;
  hasCustomTemplate: boolean;
  hasLogo: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminTemplates() {
  // Default template
  const [defaultTemplate, setDefaultTemplate] = useState<TemplateInfo>({ exists: false });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // Cabinets overview
  const [cabinets, setCabinets] = useState<CabinetAssetInfo[]>([]);

  const [loading, setLoading] = useState(true);

  // ---- Load everything ----
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check default template
      const { data: tplList } = await supabase.storage
        .from("cabinet-assets")
        .list("default", { search: "lm-default" });
      if (tplList && tplList.length > 0) {
        const f = tplList[0];
        setDefaultTemplate({
          exists: true,
          name: f.name,
          size: (f.metadata as any)?.size ?? undefined,
          updatedAt: f.updated_at ?? f.created_at,
        });
      } else {
        setDefaultTemplate({ exists: false });
      }

      // 2. Load cabinets list with asset info
      const { data: allCabinets } = await supabase
        .from("cabinets")
        .select("id, nom")
        .order("nom");
      if (allCabinets) {
        const infos: CabinetAssetInfo[] = [];
        for (const cab of allCabinets) {
          let hasCustomTemplate = false;
          let hasLogo = false;
          try {
            const { data: tpl } = await supabase.storage
              .from("cabinet-assets")
              .list(`${cab.id}/templates`, { search: "lm-default" });
            hasCustomTemplate = !!(tpl && tpl.length > 0);
          } catch { /* non-blocking: cabinet template check */ }
          try {
            const { data: logo } = await supabase.storage
              .from("cabinet-assets")
              .list(`${cab.id}`, { search: "logo" });
            hasLogo = !!(logo && logo.length > 0);
          } catch { /* non-blocking: cabinet logo check */ }
          infos.push({ id: cab.id, nom: cab.nom || cab.id, hasCustomTemplate, hasLogo });
        }
        setCabinets(infos);
      }
    } catch (err) {
      logger.error("AdminTemplates load error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Upload default template ----
  const handleTemplateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".docx")) {
      toast.error("Fichier .docx requis");
      return;
    }
    setUploadingTemplate(true);
    try {
      const { error } = await supabase.storage
        .from("cabinet-assets")
        .upload("default/lm-default.docx", file, {
          upsert: true,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      if (error) throw error;
      toast.success("Template par défaut uploadé avec succès");
      setDefaultTemplate({
        exists: true,
        name: file.name,
        size: file.size,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("Default template upload failed", err);
      toast.error("Erreur upload : " + (err.message || "Erreur inconnue"));
    } finally {
      setUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  }, []);

  // ---- Download default template ----
  const handleTemplateDownload = useCallback(async () => {
    try {
      const { data, error } = await supabase.storage
        .from("cabinet-assets")
        .download("default/lm-default.docx");
      if (error) throw error;
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "template-lm-defaut.docx";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      toast.error("Erreur téléchargement : " + (err.message || "Erreur inconnue"));
    }
  }, []);

  // ---- Helpers ----
  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Default Template */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Template Lettre de Mission par défaut
          </CardTitle>
          <CardDescription>
            Ce template sera utilisé par tous les cabinets qui n'ont pas uploadé leur propre template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {defaultTemplate.exists ? (
              <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Template par défaut actif
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Aucun template
              </Badge>
            )}
          </div>

          {defaultTemplate.exists && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Fichier : <span className="text-foreground font-medium">{defaultTemplate.name}</span></p>
              <p>Taille : <span className="text-foreground">{formatSize(defaultTemplate.size)}</span></p>
              <p>Mis à jour : <span className="text-foreground">{formatDate(defaultTemplate.updatedAt)}</span></p>
            </div>
          )}

          <div className="flex items-center gap-3">
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
              {uploadingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {defaultTemplate.exists ? "Remplacer le template" : "Uploader un template"}
            </Button>

            {defaultTemplate.exists && (
              <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger le template actuel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 — Templates par cabinet */}
      <Card className="border-gray-200 dark:border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Templates par cabinet
            </CardTitle>
            <CardDescription>
              Vue de supervision des assets par cabinet.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {cabinets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun cabinet trouvé.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2.5 font-medium">Cabinet</th>
                    <th className="text-center px-4 py-2.5 font-medium">Template LM</th>
                    <th className="text-center px-4 py-2.5 font-medium">Logo</th>
                  </tr>
                </thead>
                <tbody>
                  {cabinets.map((cab) => (
                    <tr key={cab.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{cab.nom}</td>
                      <td className="px-4 py-2.5 text-center">
                        {cab.hasCustomTemplate ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Template custom
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            Utilise le défaut
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {cab.hasLogo ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Logo uploadé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pas de logo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
