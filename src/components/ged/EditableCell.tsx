import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

// ── EditableText ────────────────────────────────────────────────────

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Show a pencil icon on hover instead of double-click */
  iconTrigger?: boolean;
  /** Max width for the truncated text */
  maxWidth?: string;
}

export function EditableText({
  value,
  onSave,
  placeholder = "Modifier…",
  className = "",
  iconTrigger = false,
  maxWidth = "200px",
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const confirm = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirm();
          if (e.key === "Escape") cancel();
        }}
        onBlur={confirm}
        className={`h-6 text-sm px-1.5 py-0 ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className={`text-sm truncate cursor-default ${className}`}
        style={{ maxWidth }}
        title={`${value || placeholder}\nDouble-clic pour modifier`}
        onDoubleClick={() => {
          if (!iconTrigger) {
            setDraft(value);
            setEditing(true);
          }
        }}
      >
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
      {iconTrigger && (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          title={placeholder}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── EditableSelect ──────────────────────────────────────────────────

interface EditableSelectProps {
  value: string;
  options: readonly { value: string; label: string }[];
  onSave: (value: string) => void;
  readOnly?: boolean;
}

export function EditableSelect({ value, options, onSave, readOnly }: EditableSelectProps) {
  if (readOnly) {
    const label = options.find(o => o.value === value)?.label || value;
    return (
      <span className="bg-primary/10 text-primary rounded-full text-xs px-2 py-0.5">
        {label}
      </span>
    );
  }

  return (
    <Select value={value} onValueChange={onSave}>
      <SelectTrigger className="h-auto border-0 bg-primary/10 text-primary rounded-full text-xs px-2 py-0.5 w-auto gap-1 hover:bg-primary/20 transition-colors">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── EditableDate ────────────────────────────────────────────────────

interface EditableDateProps {
  value: string | null;
  onSave: (value: string | null) => void;
  readOnly?: boolean;
  /** Render function for the trigger badge */
  renderBadge: (props: { text: string; className: string }) => React.ReactNode;
  badgeProps: { text: string; className: string };
}

export function EditableDate({ value, onSave, readOnly, renderBadge, badgeProps }: EditableDateProps) {
  if (readOnly) {
    return <>{renderBadge(badgeProps)}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`rounded-full text-xs px-2 py-0.5 font-medium cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${badgeProps.className}`}>
          {badgeProps.text}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Date d'expiration</p>
          <Input
            type="date"
            defaultValue={value?.split("T")[0] || ""}
            onChange={(e) => onSave(e.target.value || null)}
            className="h-8 text-xs"
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive w-full"
              onClick={() => onSave(null)}
            >
              Supprimer l'expiration
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
