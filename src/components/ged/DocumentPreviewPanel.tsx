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
  // Auto-load preview when doc changes (no extra click needed)
  const [showPreview, setShowPreview] = useState(true);

  // Reset to auto-show when doc changes
  useEffect(() => {
    setShowPreview(true);
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

        {/* Metadata — compact */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-b border-border pb-3 mt-3">
          <span>{formatSize(doc.size)}</span>
          <span>{getFileType(doc.name)}</span>
          <span>{formatDate(doc.created_at)}</span>
          {doc.expiration && <span>Exp. {formatDate(doc.expiration)}</span>}
          <Badge className={`text-[10px] ${validationCls}`}>{validationLabel}</Badge>
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

        {/* Actions — 2 boutons */}
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
