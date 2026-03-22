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
import { Download, RefreshCw, Trash2, Eye, ExternalLink } from "lucide-react";
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
  return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
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
  onReplace,
  onDelete,
  children,
}: DocumentPreviewPanelProps) {
  // P1: Lazy preview — don't load iframe/image until user clicks "Ouvrir"
  const [showPreview, setShowPreview] = useState(false);

  // Reset preview state when doc changes
  useEffect(() => {
    setShowPreview(false);
  }, [doc?.id]);

  if (!doc) return null;

  const canPreview = isPdf(doc.name) || isImage(doc.name) || isHtml(doc.name);
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
            v{doc.version} — {doc.category}
          </SheetDescription>
        </SheetHeader>

        {/* Metadata — shown INSTANTLY */}
        <div className="space-y-2 text-sm border-b border-border pb-4 mt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categorie</span>
            <span>{doc.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline" className="text-xs">{getFileType(doc.name)}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taille</span>
            <span>{formatSize(doc.size)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Uploade le</span>
            <span>{formatDate(doc.created_at)}</span>
          </div>
          {doc.expiration && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiration</span>
              <span>{formatDate(doc.expiration)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>v{doc.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Statut</span>
            <Badge className={`text-xs ${validationCls}`}>{validationLabel}</Badge>
          </div>
          {doc.uploaded_by && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploade par</span>
              <span>{doc.uploaded_by}</span>
            </div>
          )}
        </div>

        {/* Preview area — lazy loaded */}
        <div className="flex-1 min-h-0 my-4 rounded-lg border border-border bg-muted/30 overflow-hidden">
          {showPreview ? (
            // Loaded preview
            isPdf(doc.name) || isHtml(doc.name) ? (
              <iframe
                src={doc.url}
                title={doc.name}
                className="w-full h-full min-h-[400px]"
              />
            ) : isImage(doc.name) ? (
              <img
                src={doc.url}
                alt={doc.name}
                className="w-full h-full object-contain p-4"
              />
            ) : null
          ) : (
            // Placeholder — instant load
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
              {canPreview ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Previsualiser
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => doc.url && window.open(doc.url, "_blank")}
                    className="gap-2 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir dans un nouvel onglet
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm">Apercu non disponible pour ce format</p>
                  <Button variant="outline" size="sm" onClick={() => onDownload?.(doc)}>
                    <Download className="h-4 w-4 mr-2" />
                    Telecharger pour consulter
                  </Button>
                </>
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
          <Button variant="outline" className="flex-1" onClick={() => onReplace?.(doc)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Remplacer
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => onDelete?.(doc)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
