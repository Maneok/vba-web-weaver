import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Image, File, Eye, Download, Trash2, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { differenceInDays, differenceInHours } from "date-fns";
import { GED_CATEGORIES } from "@/lib/gedUtils";
import DocumentStatusBadge from "./DocumentStatusBadge";
import type { GEDDocument } from "./types";

interface DocumentRowProps {
  doc: GEDDocument;
  onPreview: (doc: GEDDocument) => void;
  onDownload: (doc: GEDDocument) => void;
  onDelete: (doc: GEDDocument) => void;
  onRename?: (docId: string, newName: string) => void;
  onCategoryChange?: (docId: string, newCategory: string) => void;
  onExpirationChange?: (docId: string, newDate: string | null) => void;
  onLabelChange?: (docId: string, newLabel: string) => void;
  prefixCell?: React.ReactNode;
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

/* #127 — Is document new (< 24h) */
function isNew(createdAt: string): boolean {
  return differenceInHours(new Date(), new Date(createdAt)) < 24;
}

export default function DocumentRow({
  doc,
  onPreview,
  onDownload,
  onDelete,
  onRename,
  onCategoryChange,
  onExpirationChange,
  onLabelChange,
  prefixCell,
}: DocumentRowProps) {
  const Icon = getFileIcon(doc.name);
  const expBadge = getExpirationBadge(doc.expiration);
  const docIsNew = isNew(doc.created_at);

  /* #101 — Inline rename state */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(doc.name);
  const inputRef = useRef<HTMLInputElement>(null);

  /* #109 — Inline label editing */
  const [editingLabel, setEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState((doc as any).label || "");
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingLabel && labelRef.current) {
      labelRef.current.focus();
      labelRef.current.select();
    }
  }, [editingLabel]);

  const confirmRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== doc.name && onRename) {
      onRename(doc.id, trimmed);
    }
    setEditing(false);
  }, [editName, doc.id, doc.name, onRename]);

  const confirmLabel = useCallback(() => {
    const trimmed = editLabel.trim();
    if (onLabelChange) {
      onLabelChange(doc.id, trimmed);
    }
    setEditingLabel(false);
  }, [editLabel, doc.id, onLabelChange]);

  const validationStatus = (doc as any).validation_status || "pending";
  const displayName = (doc as any).label || doc.name;
  const description = (doc as any).description;

  return (
    <tr className="group border-b border-border/50 hover:bg-accent/30 transition-colors">
      {prefixCell && <td className="py-2.5 px-3">{prefixCell}</td>}

      {/* #101 — Name cell with double-click rename + #109 label */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") { setEditing(false); setEditName(doc.name); }
                  }}
                  onBlur={confirmRename}
                  className="h-6 text-sm px-1.5 py-0"
                />
              </div>
            ) : editingLabel ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={labelRef}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmLabel();
                    if (e.key === "Escape") { setEditingLabel(false); setEditLabel((doc as any).label || ""); }
                  }}
                  onBlur={confirmLabel}
                  className="h-6 text-sm px-1.5 py-0"
                  placeholder="Libellé personnalisé..."
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className="text-sm truncate max-w-[200px] cursor-default"
                  title={`${displayName}\nDouble-clic pour renommer`}
                  onDoubleClick={() => { if (onRename) { setEditName(doc.name); setEditing(true); } }}
                >
                  {displayName}
                </span>
                {/* #127 — NEW badge */}
                {docIsNew && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-blue-500 text-[9px] text-white font-bold leading-none">
                    NEW
                  </span>
                )}
                {/* #109 — Edit label button */}
                {onLabelChange && (
                  <button
                    onClick={() => { setEditLabel((doc as any).label || ""); setEditingLabel(true); }}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                    title="Modifier le libellé"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {/* #110 — Description line */}
            {description && !editing && !editingLabel && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{description}</p>
            )}
          </div>
        </div>
      </td>

      {/* #102 — Category cell with inline edit */}
      <td className="py-2.5 px-3">
        {onCategoryChange ? (
          <Select
            value={doc.category}
            onValueChange={(val) => onCategoryChange(doc.id, val)}
          >
            <SelectTrigger className="h-auto border-0 bg-primary/10 text-primary rounded-full text-xs px-2 py-0.5 w-auto gap-1 hover:bg-primary/20 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GED_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} className="text-xs">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="bg-primary/10 text-primary rounded-full text-xs px-2 py-0.5">
            {doc.category}
          </span>
        )}
      </td>

      <td className="py-2.5 px-3 text-sm text-muted-foreground">{formatSize(doc.size)}</td>

      <td className="py-2.5 px-3">
        <span className="border border-border rounded text-xs px-1.5 py-0.5 text-muted-foreground">
          v{doc.version}
        </span>
      </td>

      {/* #103 — Expiration cell with inline date edit */}
      <td className="py-2.5 px-3">
        {onExpirationChange ? (
          <Popover>
            <PopoverTrigger asChild>
              <button className={`rounded-full text-xs px-2 py-0.5 font-medium cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${expBadge.className}`}>
                {expBadge.text}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Date d'expiration</p>
                <Input
                  type="date"
                  defaultValue={doc.expiration?.split("T")[0] || ""}
                  onChange={(e) => onExpirationChange(doc.id, e.target.value || null)}
                  className="h-8 text-xs"
                />
                {doc.expiration && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive w-full"
                    onClick={() => onExpirationChange(doc.id, null)}
                  >
                    Supprimer l'expiration
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className={`rounded-full text-xs px-2 py-0.5 font-medium ${expBadge.className}`}>
            {expBadge.text}
          </span>
        )}
      </td>

      {/* #124 — Validation status column */}
      <td className="py-2.5 px-3">
        <DocumentStatusBadge status={validationStatus as "pending" | "validated" | "rejected"} />
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
