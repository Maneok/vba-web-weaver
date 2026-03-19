import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Trash2 } from "lucide-react";
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

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${bytes} o`;
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
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
  if (!doc) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{doc.name}</SheetTitle>
          <SheetDescription>
            v{doc.version} — {doc.category}
          </SheetDescription>
        </SheetHeader>

        {/* Preview area */}
        <div className="flex-1 min-h-0 my-4 rounded-lg border border-border bg-muted/30 overflow-hidden">
          {isPdf(doc.name) ? (
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
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
              <p className="text-sm">Aperçu non disponible pour ce format</p>
              <Button variant="outline" size="sm" onClick={() => onDownload?.(doc)}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger pour consulter
              </Button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm border-t border-border pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Catégorie</span>
            <span>{doc.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taille</span>
            <span>{formatSize(doc.size)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Uploadé le</span>
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
          {doc.uploaded_by && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploadé par</span>
              <span>{doc.uploaded_by}</span>
            </div>
          )}
        </div>

        {/* Extra content (validation, tags, notes) */}
        {children}

        {/* Actions */}
        <SheetFooter className="mt-4 flex-row gap-2">
          <Button className="flex-1" onClick={() => onDownload?.(doc)}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
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
