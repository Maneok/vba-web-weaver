import { FileText, Image, File, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { differenceInDays, differenceInHours } from "date-fns";
import { GED_CATEGORIES } from "@/lib/gedUtils";
import DocumentStatusBadge from "./DocumentStatusBadge";
import { EditableText, EditableSelect, EditableDate } from "./EditableCell";
import type { GEDDocument } from "./types";

// ── Props ───────────────────────────────────────────────────────────

export interface DocumentRowProps {
  doc: GEDDocument;
  onPreview: (doc: GEDDocument) => void;
  onDownload: (doc: GEDDocument) => void;
  onDelete: (doc: GEDDocument) => void;
  /** Generic field updater — replaces individual onRename/onCategoryChange/etc. */
  onUpdateField?: (docId: string, field: string, value: unknown) => void;
  /** Selection */
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

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
  if (days < 0) return { text: "Expiré", className: "bg-red-500/15 text-red-500 animate-pulse-risk" };
  if (days < 30) return { text: `Expire dans ${days}j`, className: "bg-red-500/15 text-red-500" };
  if (days <= 90) return { text: `Expire dans ${days}j`, className: "bg-amber-500/15 text-amber-500" };
  return { text: "Valide", className: "bg-emerald-500/15 text-emerald-500" };
}

function isNew(createdAt: string): boolean {
  return differenceInHours(new Date(), new Date(createdAt)) < 24;
}

// ── Component ───────────────────────────────────────────────────────

export default function DocumentRow({
  doc,
  onPreview,
  onDownload,
  onDelete,
  onUpdateField,
  isSelected,
  onToggleSelect,
}: DocumentRowProps) {
  const Icon = getFileIcon(doc.name);
  const expBadge = getExpirationBadge(doc.expiration);
  const docIsNew = isNew(doc.created_at);
  const editable = !!onUpdateField;

  const displayName = doc.label || doc.name;
  const description = doc.description;
  const validationStatus = doc.validation_status || "pending";

  return (
    <tr className="group border-b border-border/50 hover:bg-accent/30 transition-colors">
      {/* Checkbox */}
      {onToggleSelect && (
        <td className="py-2.5 px-3">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </td>
      )}

      {/* Name + label + description */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {editable ? (
                <EditableText
                  value={doc.name}
                  onSave={(v) => onUpdateField(doc.id, "name", v)}
                  placeholder="Nom du document"
                />
              ) : (
                <span className="text-sm truncate max-w-[200px]" title={displayName}>
                  {displayName}
                </span>
              )}
              {docIsNew && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-blue-500 text-[9px] text-white font-bold leading-none">
                  NEW
                </span>
              )}
              {/* Label edit icon */}
              {editable && (
                <EditableText
                  value={doc.label || ""}
                  onSave={(v) => onUpdateField(doc.id, "label", v || null)}
                  placeholder="Libellé personnalisé"
                  iconTrigger
                />
              )}
            </div>
            {description && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{description}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-2.5 px-3">
        <EditableSelect
          value={doc.category}
          options={GED_CATEGORIES}
          onSave={(v) => onUpdateField?.(doc.id, "category", v)}
          readOnly={!editable}
        />
      </td>

      {/* Size */}
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{formatSize(doc.size)}</td>

      {/* Version */}
      <td className="py-2.5 px-3">
        <span className="border border-border rounded text-xs px-1.5 py-0.5 text-muted-foreground">
          v{doc.version}
        </span>
      </td>

      {/* Expiration */}
      <td className="py-2.5 px-3">
        <EditableDate
          value={doc.expiration}
          onSave={(v) => onUpdateField?.(doc.id, "expiration", v)}
          readOnly={!editable}
          badgeProps={expBadge}
          renderBadge={({ text, className }) => (
            <span className={`rounded-full text-xs px-2 py-0.5 font-medium ${className}`}>
              {text}
            </span>
          )}
        />
      </td>

      {/* Validation status */}
      <td className="py-2.5 px-3">
        <DocumentStatusBadge status={validationStatus as "pending" | "validated" | "rejected"} />
      </td>

      {/* Actions */}
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
