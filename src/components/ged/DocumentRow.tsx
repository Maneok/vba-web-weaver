import { FileText, Image, File, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays } from "date-fns";
import type { GEDDocument } from "./types";

interface DocumentRowProps {
  doc: GEDDocument;
  onPreview: (doc: GEDDocument) => void;
  onDownload: (doc: GEDDocument) => void;
  onDelete: (doc: GEDDocument) => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FileText;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return Image;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${bytes} o`;
}

function getExpirationBadge(expiration: string | null) {
  if (!expiration) {
    return { text: "N/A", className: "bg-muted text-muted-foreground" };
  }

  const days = differenceInDays(new Date(expiration), new Date());

  if (days < 0) {
    return { text: "Expiré", className: "bg-red-500/15 text-red-500 animate-pulse-risk" };
  }
  if (days < 30) {
    return { text: `Expire dans ${days}j`, className: "bg-red-500/15 text-red-500" };
  }
  if (days <= 90) {
    return { text: `Expire dans ${days}j`, className: "bg-amber-500/15 text-amber-500" };
  }
  return { text: "Valide", className: "bg-emerald-500/15 text-emerald-500" };
}

export default function DocumentRow({ doc, onPreview, onDownload, onDelete }: DocumentRowProps) {
  const Icon = getFileIcon(doc.name);
  const expBadge = getExpirationBadge(doc.expiration);

  return (
    <tr className="group border-b border-border/50 hover:bg-accent/30 transition-colors">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm truncate max-w-[200px]" title={doc.name}>
            {doc.name}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <span className="bg-primary/10 text-primary rounded-full text-xs px-2 py-0.5">
          {doc.category}
        </span>
      </td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{formatSize(doc.size)}</td>
      <td className="py-2.5 px-3">
        <span className="border border-border rounded text-xs px-1.5 py-0.5 text-muted-foreground">
          v{doc.version}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={`rounded-full text-xs px-2 py-0.5 font-medium ${expBadge.className}`}>
          {expBadge.text}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(doc)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aperçu</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDownload(doc)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Télécharger</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(doc)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}
