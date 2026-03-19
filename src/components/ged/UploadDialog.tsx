import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Upload } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  classifyDocument,
  getDefaultExpiration,
  getExpirationLabel,
  checkDuplicate,
  generateNormalizedName,
  formatFileSize,
  GED_CATEGORIES,
} from "@/lib/gedUtils";
import type { GEDDocument } from "./types";

export interface UploadConfig {
  file: File;
  category: string;
  expiration: Date | null;
  normalizedName: string;
  replaceExisting?: string;
}

interface UploadDialogProps {
  files: File[];
  siren: string;
  clientName: string;
  existingDocs: GEDDocument[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (uploads: UploadConfig[]) => Promise<void>;
}

type DuplicateAction = "replace" | "keep" | "skip";

interface FileConfig {
  file: File;
  category: string;
  confidence: "high" | "medium" | "low";
  expiration: string; // ISO date string or ""
  useNormalizedName: boolean;
  duplicateAction: DuplicateAction;
  duplicateDocId?: string;
  duplicateDocName?: string;
  duplicateDocDate?: string;
  duplicateDocVersion?: number;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot) : "";
}

export default function UploadDialog({
  files,
  siren,
  clientName,
  existingDocs,
  isOpen,
  onClose,
  onConfirm,
}: UploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [configs, setConfigs] = useState<FileConfig[]>(() =>
    files.map((file) => {
      const classification = classifyDocument(file.name);
      const expDate = getDefaultExpiration(classification.category);
      const dup = checkDuplicate(file.name, file.size, existingDocs);

      return {
        file,
        category: classification.category,
        confidence: classification.confidence,
        expiration: expDate ? expDate.toISOString().split("T")[0] : "",
        useNormalizedName: true,
        duplicateAction: dup.isDuplicate ? "replace" : "keep",
        duplicateDocId: dup.existingDoc?.id,
        duplicateDocName: dup.existingDoc?.name,
        duplicateDocDate: dup.existingDoc?.created_at,
        duplicateDocVersion: dup.existingDoc?.version,
      };
    }),
  );

  const updateConfig = useCallback((index: number, patch: Partial<FileConfig>) => {
    setConfigs((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }, []);

  const handleCategoryChange = useCallback(
    (index: number, category: string) => {
      const expDate = getDefaultExpiration(category);
      updateConfig(index, {
        category,
        confidence: "high",
        expiration: expDate ? expDate.toISOString().split("T")[0] : "",
      });
    },
    [updateConfig],
  );

  const activeConfigs = useMemo(
    () => configs.filter((c) => c.duplicateAction !== "skip"),
    [configs],
  );

  const handleConfirm = async () => {
    setUploading(true);
    setProgress(0);

    const uploads: UploadConfig[] = activeConfigs.map((c) => {
      const ext = getExtension(c.file.name);
      const version = c.duplicateAction === "replace" && c.duplicateDocVersion
        ? c.duplicateDocVersion + 1
        : 1;

      return {
        file: c.file,
        category: c.category,
        expiration: c.expiration ? new Date(c.expiration) : null,
        normalizedName: c.useNormalizedName
          ? generateNormalizedName(siren, c.category, version, ext)
          : c.file.name,
        replaceExisting: c.duplicateAction === "replace" ? c.duplicateDocId : undefined,
      };
    });

    try {
      // Simulate per-file progress
      const step = 100 / uploads.length;
      for (let i = 0; i < uploads.length; i++) {
        setProgress(Math.round(step * (i + 0.5)));
      }
      await onConfirm(uploads);
      setProgress(100);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !uploading && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Importer {files.length} document{files.length > 1 ? "s" : ""} pour {clientName}
          </DialogTitle>
          <DialogDescription>
            Vérifiez la classification et les métadonnées avant l'import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {configs.map((config, index) => (
            <div
              key={`${config.file.name}-${index}`}
              className={`rounded-lg border border-border p-4 space-y-3 ${
                config.duplicateAction === "skip" ? "opacity-40" : ""
              }`}
            >
              {/* File header */}
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{config.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(config.file.size)}
                  </p>
                </div>
                {config.confidence === "high" ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Auto-détecté
                  </span>
                ) : config.confidence === "low" ? (
                  <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    À vérifier
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Probable
                  </span>
                )}
              </div>

              {/* Category select */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Catégorie</label>
                  <Select
                    value={config.category}
                    onValueChange={(val) => handleCategoryChange(index, val)}
                    disabled={config.duplicateAction === "skip"}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GED_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expiration */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Expiration</label>
                  {getDefaultExpiration(config.category) !== null ? (
                    <>
                      <input
                        type="date"
                        value={config.expiration}
                        onChange={(e) => updateConfig(index, { expiration: e.target.value })}
                        disabled={config.duplicateAction === "skip"}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Expire dans {getExpirationLabel(config.category)}
                      </p>
                    </>
                  ) : (
                    <div className="flex h-9 items-center">
                      <span className="text-xs text-muted-foreground italic">
                        Pas d'expiration
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Normalized name */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`norm-${index}`}
                  checked={config.useNormalizedName}
                  onChange={(e) => updateConfig(index, { useNormalizedName: e.target.checked })}
                  disabled={config.duplicateAction === "skip"}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                <label htmlFor={`norm-${index}`} className="text-xs text-muted-foreground">
                  Renommer selon la norme
                </label>
                {config.useNormalizedName && (
                  <span className="text-xs text-primary font-mono truncate">
                    {generateNormalizedName(
                      siren,
                      config.category,
                      config.duplicateAction === "replace" && config.duplicateDocVersion
                        ? config.duplicateDocVersion + 1
                        : 1,
                      getExtension(config.file.name),
                    )}
                  </span>
                )}
              </div>

              {/* Duplicate warning */}
              {config.duplicateDocId && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
                  <p className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Un document similaire existe déjà ({config.duplicateDocName}, uploadé le{" "}
                    {config.duplicateDocDate
                      ? format(new Date(config.duplicateDocDate), "d MMM yyyy", { locale: fr })
                      : "—"}
                    )
                  </p>
                  <div className="flex gap-3">
                    {(["replace", "keep", "skip"] as const).map((action) => (
                      <label
                        key={action}
                        className="flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`dup-${index}`}
                          checked={config.duplicateAction === action}
                          onChange={() => updateConfig(index, { duplicateAction: action })}
                          className="h-3 w-3"
                        />
                        {action === "replace"
                          ? `Remplacer (v${(config.duplicateDocVersion || 1) + 1})`
                          : action === "keep"
                            ? "Garder les deux"
                            : "Annuler ce fichier"}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Import en cours... {progress}%
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={uploading || activeConfigs.length === 0}>
            <Upload className="h-4 w-4 mr-2" />
            Importer {activeConfigs.length} document{activeConfigs.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
