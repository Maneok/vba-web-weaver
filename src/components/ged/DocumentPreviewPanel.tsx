import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { GEDDocument } from "./types";

interface DocumentPreviewPanelProps {
  doc: GEDDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (doc: GEDDocument) => void;
  onReplace?: (doc: GEDDocument) => void;
  onDelete?: (doc: GEDDocument) => void;
  children?: React.ReactNode;
}

function isImage(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
}

function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function isHtml(name: string): boolean {
  return /\.html?$/i.test(name);
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${bytes} o`;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function getFileType(name: string): string {
  if (isPdf(name)) return "PDF";
  if (isImage(name)) return "Image";
  if (isHtml(name)) return "HTML";
  const ext = name.split(".").pop()?.toUpperCase();
  return ext || "Fichier";
}

export default function DocumentPreviewPanel({
  doc,
  isOpen,
  onClose,
  onDownload,
  onDelete,
  children,
}: DocumentPreviewPanelProps) {
  // FIX #9: Track load errors per doc ID to allow retry
  const [loadError, setLoadError] = useState(false);

  // Reset error state when doc changes
  useEffect(() => {
    setLoadError(false);
  }, [doc?.id, doc?.url]);

  if (!doc) return null;

  const canPreview = isPdf(doc.name) || isImage(doc.name) || isHtml(doc.name);
  const hasUrl = !!doc.url;
  const isLoading = !doc.url && isOpen; // URL still being fetched

  const validationLabel =
    doc.validation_status === "validated" ? "Validé" :
    doc.validation_status === "rejected" ? "Rejeté" : "En attente";
  const validationCls =
    doc.validation_status === "validated" ? "bg-emerald-500/15 text-emerald-500" :
    doc.validation_status === "rejected" ? "bg-red-500/15 text-red-500" :
    "bg-muted text-muted-foreground";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{doc.name}</SheetTitle>
          <SheetDescription>
            {doc.category} — {getFileType(doc.name)}
          </SheetDescription>
        </SheetHeader>

        {/* Metadata — compact */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-b border-border pb-3 mt-3">
          <span>{formatSize(doc.size)}</span>
          <span>{formatDate(doc.created_at)}</span>
          {doc.expiration && <span>Exp. {formatDate(doc.expiration)}</span>}
          <Badge className={`text-[10px] ${validationCls}`}>{validationLabel}</Badge>
        </div>

        {/* Preview area */}
        <div className="flex-1 min-h-0 my-4 rounded-lg border border-border bg-muted/30 overflow-hidden flex flex-col">
          {isLoading ? (
            /* Loading state while URL is being fetched */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement de l'apercu...</p>
            </div>
          ) : hasUrl && canPreview && !loadError ? (
            /* Previewable document */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0">
                {(isPdf(doc.name) || isHtml(doc.name)) && (
                  <iframe
                    key={doc.url}
                    src={doc.url}
                    title={doc.name}
                    className="w-full h-full min-h-[400px]"
                    onError={() => setLoadError(true)}
                  />
                )}
                {isImage(doc.name) && (
                  <img
                    key={doc.url}
                    src={doc.url}
                    alt={doc.name}
                    className="w-full h-full object-contain p-4"
                    onError={() => setLoadError(true)}
                  />
                )}
              </div>
              <div className="flex justify-center py-2 border-t border-border/50 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(doc.url, "_blank")}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ouvrir dans un nouvel onglet
                </Button>
              </div>
            </div>
          ) : (
            /* Fallback — no preview available */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-[200px]">
              <p className="text-sm text-center px-4">
                {loadError
                  ? "Erreur de chargement — le document n'a pas pu etre affiche"
                  : !hasUrl
                    ? "URL du document indisponible"
                    : "Apercu non disponible pour ce format"}
              </p>
              {hasUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(doc.url, "_blank")} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir dans le navigateur
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onDownload?.(doc)} className="gap-2">
                <Download className="h-4 w-4" />
                Telecharger
              </Button>
              {loadError && (
                <Button variant="ghost" size="sm" onClick={() => setLoadError(false)} className="text-xs">
                  Reessayer
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Extra content (validation, tags, notes) */}
        {children}

        {/* Actions */}
        <SheetFooter className="mt-4 flex-row gap-2">
          <Button className="flex-1" onClick={() => onDownload?.(doc)}>
            <Download className="h-4 w-4 mr-2" />
            Telecharger
          </Button>
          <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => onDelete?.(doc)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
