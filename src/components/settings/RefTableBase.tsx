import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Copy, RotateCcw, X,
  FileSearch, Sparkles, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebounce } from "@/hooks/useDebounce";

/* ========== GLOBAL STYLE (injected once) ========== */

let _styleInjected = false;
function injectGlobalStyle() {
  if (_styleInjected || typeof document === "undefined") return;
  _styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes refFadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    .ref-fade-in { animation: refFadeIn .25s ease-out both; }
  `;
  document.head.appendChild(style);
}

/* ========== TYPES ========== */

export type ColumnDef<T> = {
  key: string;
  label: string;
  width?: string;
  minWidth?: string;
  render?: (item: T, highlight?: string) => React.ReactNode;
  sortable?: boolean;
  exportFn?: (item: T) => string;
};

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "slider" | "checkbox" | "multi-checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
};

export type FilterDef = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  filterFn: (item: Record<string, unknown>, value: string) => boolean;
};

export type ExtraStatDef = {
  label: string;
  count: number;
  color: string;
};

type RefService<T> = {
  getAll(): Promise<T[]>;
  create(item: Partial<T>): Promise<T | null>;
  update(id: string, updates: Record<string, unknown>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  search(items: T[], query: string): T[];
};

type Props<T extends { id: string }> = {
  title: string;
  description: string;
  service: RefService<T>;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  defaultValues: Partial<T>;
  storageKey?: string;
  extraFilters?: FilterDef[];
  extraStats?: (items: T[]) => ExtraStatDef[];
  hasScore?: boolean;
  searchAllFields?: string[];
  /** Transform item before populating the edit form (e.g. reconstruct computed fields) */
  transformForEdit?: (item: Record<string, unknown>) => Record<string, unknown>;
};

const PAGE_SIZES = [10, 20, 50, 100];

/* ========== RISK / PILOTE BADGES ========== */

export function RiskBadge({ score }: { score: number }) {
  if (score <= 25) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">Faible</Badge>;
  if (score <= 60) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">Moyen</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">Eleve</Badge>;
}

export function PiloteBadge({ value }: { value: boolean }) {
  return value
    ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Oui</Badge>
    : <Badge variant="outline" className="text-slate-500 border-white/10">Non</Badge>;
}

/* ========== HIGHLIGHT (all occurrences) ========== */

function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !highlight.trim() || !text) return <>{text}</>;
  const q = highlight.trim();
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

/* ========== CSV HELPERS ========== */

function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

/* ========== HELPERS ========== */

function isNew(createdAt: unknown): boolean {
  if (typeof createdAt !== "string") return false;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ========== COMPONENT ========== */

export default function RefTableBase<T extends { id: string }>({
  title, description, service, columns, fields, defaultValues,
  storageKey, extraFilters, extraStats, hasScore = true, searchAllFields,
  transformForEdit,
}: Props<T>) {
  // 1. Inject global animation style once
  useEffect(() => { injectGlobalStyle(); }, []);

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 2. Sorting (stable sort)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 3. Filters
  const [riskFilter, setRiskFilter] = useState("all");
  const [piloteFilter, setPiloteFilter] = useState("all");
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>({});

  // 4. Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 5. Bulk operations
  const [bulkRiskOpen, setBulkRiskOpen] = useState(false);
  const [bulkRiskScore, setBulkRiskScore] = useState(50);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // 6. Import state
  const [importing, setImporting] = useState(false);

  // 7. Keyboard focus
  const [focusIdx, setFocusIdx] = useState(-1);
  const tableRef = useRef<HTMLTableElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // 8. Undo
  const undoRef = useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);

  // 9. Storage key
  const sKey = storageKey || title.replace(/\s+/g, "_").toLowerCase();

  // 10. Restore filters from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`ref_filters_${sKey}`);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.riskFilter) setRiskFilter(p.riskFilter);
        if (p.piloteFilter) setPiloteFilter(p.piloteFilter);
        if (p.extraFilterValues) setExtraFilterValues(p.extraFilterValues);
        if (p.pageSize) setPageSize(p.pageSize);
      }
    } catch { /* ignore */ }
  }, [sKey]);

  // 11. Persist filters
  useEffect(() => {
    try {
      sessionStorage.setItem(`ref_filters_${sKey}`, JSON.stringify({ riskFilter, piloteFilter, extraFilterValues, pageSize }));
    } catch { /* ignore */ }
  }, [riskFilter, piloteFilter, extraFilterValues, pageSize, sKey]);

  // 12. Cleanup undo timer on unmount
  useEffect(() => {
    return () => { if (undoRef.current) clearTimeout(undoRef.current.timer); };
  }, []);

  // 13. Load data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await service.getAll();
      setItems(data);
      // 14. Clean selection – remove stale IDs
      setSelected((prev) => {
        const validIds = new Set(data.map((d) => d.id));
        const cleaned = new Set<string>();
        for (const id of prev) { if (validIds.has(id)) cleaned.add(id); }
        return cleaned.size === prev.size ? prev : cleaned;
      });
    } catch {
      toast.error("Erreur lors du chargement des donnees");
    }
    setLoading(false);
  }, [service]);

  useEffect(() => { load(); }, [load]);

  // 15. Full-text search on all fields
  const searched = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase().trim();
    const sf = searchAllFields || ["code", "libelle"];
    return items.filter((item) => {
      const rec = item as Record<string, unknown>;
      return sf.some((key) => {
        const val = rec[key];
        return typeof val === "string" && val.toLowerCase().includes(q);
      });
    });
  }, [items, debouncedSearch, searchAllFields]);

  // 16. Apply filters
  const filtered = useMemo(() => {
    let result = searched;
    if (hasScore && riskFilter !== "all") {
      result = result.filter((item) => {
        const score = (item as Record<string, unknown>).score as number;
        if (riskFilter === "faible") return score <= 25;
        if (riskFilter === "moyen") return score > 25 && score <= 60;
        if (riskFilter === "eleve") return score > 60;
        return true;
      });
    }
    if (piloteFilter !== "all") {
      result = result.filter((item) => {
        const val = (item as Record<string, unknown>).is_default as boolean;
        return piloteFilter === "oui" ? val : !val;
      });
    }
    if (extraFilters) {
      for (const ef of extraFilters) {
        const val = extraFilterValues[ef.key];
        if (val && val !== "all") {
          result = result.filter((item) => ef.filterFn(item as Record<string, unknown>, val));
        }
      }
    }
    return result;
  }, [searched, riskFilter, piloteFilter, extraFilterValues, extraFilters, hasScore]);

  // 17. Stable sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const indexed = filtered.map((item, i) => ({ item, i }));
    indexed.sort((a, b) => {
      const av = (a.item as Record<string, unknown>)[sortKey];
      const bv = (b.item as Record<string, unknown>)[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") { cmp = av - bv; }
      else if (typeof av === "boolean" && typeof bv === "boolean") { cmp = (av === bv ? 0 : av ? -1 : 1); }
      else { cmp = String(av ?? "").toLowerCase().localeCompare(String(bv ?? "").toLowerCase()); }
      if (cmp === 0) return a.i - b.i; // stable
      return sortDir === "asc" ? cmp : -cmp;
    });
    return indexed.map((x) => x.item);
  }, [filtered, sortKey, sortDir]);

  // 18. Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(() => sorted.slice(safePage * pageSize, (safePage + 1) * pageSize), [sorted, safePage, pageSize]);

  // 19. Reset page on filter/search change
  useEffect(() => { setPage(0); }, [debouncedSearch, riskFilter, piloteFilter, extraFilterValues, pageSize]);

  // 20. Reset focusIdx on page/filter change
  useEffect(() => { setFocusIdx(-1); }, [safePage, debouncedSearch, riskFilter, piloteFilter, sortKey, sortDir]);

  // 21. Stats on ALL items
  const stats = useMemo(() => {
    if (!hasScore) return null;
    let faible = 0, moyen = 0, eleve = 0;
    for (const item of items) {
      const score = (item as Record<string, unknown>).score as number;
      if (score <= 25) faible++;
      else if (score <= 60) moyen++;
      else eleve++;
    }
    return { faible, moyen, eleve, total: items.length };
  }, [items, hasScore]);

  // 22. Extra stats
  const computedExtraStats = useMemo(() => extraStats ? extraStats(items) : null, [items, extraStats]);

  // 23. Selection helpers + indeterminate
  const somePageSelected = paged.some((item) => selected.has(item.id));
  const allPageSelected = paged.length > 0 && paged.every((item) => selected.has(item.id));

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of paged) next.delete(item.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of paged) next.add(item.id);
        return next;
      });
    }
  }, [allPageSelected, paged]);

  // 24. Sort handler
  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir("asc");
      return key;
    });
  }, []);

  function renderSortIcon(key: string) {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  }

  // 25. Form open helpers
  const openCreate = useCallback(() => {
    setEditItem(null);
    setForm({ ...defaultValues } as Record<string, unknown>);
    setFormErrors({});
    setDialogOpen(true);
  }, [defaultValues]);

  const openEdit = useCallback((item: T) => {
    setEditItem(item);
    let formData = { ...(item as Record<string, unknown>) };
    if (transformForEdit) formData = transformForEdit(formData);
    setForm(formData);
    setFormErrors({});
    setDialogOpen(true);
  }, [transformForEdit]);

  const openDuplicate = useCallback((item: T) => {
    setEditItem(null);
    let rec = { ...(item as Record<string, unknown>) };
    if (transformForEdit) rec = transformForEdit(rec);
    delete rec.id;
    delete rec.created_at;
    delete rec.updated_at;
    if (typeof rec.code === "string") rec.code = rec.code + "_COPY";
    setForm(rec);
    setFormErrors({});
    setDialogOpen(true);
  }, [transformForEdit]);

  // 26. Form validation with duplicate code check
  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = form[field.key];
        if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
          errors[field.key] = `${field.label} est requis`;
        }
      }
      if (field.maxLength && typeof form[field.key] === "string") {
        if ((form[field.key] as string).length > field.maxLength) {
          errors[field.key] = `Maximum ${field.maxLength} caracteres`;
        }
      }
    }
    // 27. Duplicate code check
    if (form.code && typeof form.code === "string") {
      const code = (form.code as string).trim().toUpperCase();
      const existing = items.find((i) => {
        const ic = (i as Record<string, unknown>).code;
        return typeof ic === "string" && ic.toUpperCase() === code && i.id !== editItem?.id;
      });
      if (existing) errors.code = `Le code "${code}" existe deja`;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // 28. Save
  async function handleSave() {
    if (!validateForm()) {
      toast.error("Veuillez corriger les erreurs");
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        const result = await service.update(editItem.id, form);
        if (result) { toast.success("Element mis a jour"); await load(); }
        else { toast.error("Erreur lors de la mise a jour"); }
      } else {
        const result = await service.create(form as Partial<T>);
        if (result) { toast.success("Element cree"); await load(); }
        else { toast.error("Erreur lors de la creation"); }
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  // 29. Delete with undo
  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    setDeleting(true);
    const ok = await service.delete(id);
    setDeleting(false);
    if (ok) {
      setDeleteConfirm(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      await load();
      if (item) {
        if (undoRef.current) clearTimeout(undoRef.current.timer);
        toast.success("Element supprime", {
          action: {
            label: "Annuler",
            onClick: async () => {
              const rec = { ...(item as Record<string, unknown>) };
              delete rec.id; delete rec.created_at; delete rec.updated_at;
              const restored = await service.create(rec as Partial<T>);
              if (restored) { toast.success("Suppression annulee"); await load(); }
            },
          },
          duration: 5000,
        });
        const timer = setTimeout(() => { undoRef.current = null; }, 5000);
        undoRef.current = { timer };
      }
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  // 30. Bulk delete (with proper Dialog)
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selected);
    let ok = 0, fail = 0;
    for (const id of ids) {
      const r = await service.delete(id);
      if (r) ok++; else fail++;
    }
    setSelected(new Set());
    setBulkDeleteOpen(false);
    setBulkProcessing(false);
    await load();
    if (fail > 0) toast.warning(`${ok} supprime(s), ${fail} erreur(s)`);
    else toast.success(`${ok} element(s) supprime(s)`);
  }

  // 31. Bulk risk change
  async function handleBulkRiskChange() {
    if (selected.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      const r = await service.update(id, { score: bulkRiskScore });
      if (r) ok++;
    }
    setBulkRiskOpen(false);
    setBulkProcessing(false);
    setSelected(new Set());
    await load();
    toast.success(`Risque mis a jour pour ${ok} element(s)`);
  }

  // 32. Reset to defaults
  async function handleResetDefaults() {
    toast.info("Reinitialisation en cours...");
    await load();
    toast.success("Referentiel actualise");
  }

  // 33. Export CSV (uses exportFn when available)
  const handleExportCSV = useCallback(() => {
    const exportItems = selected.size > 0
      ? items.filter((i) => selected.has(i.id))
      : items;
    const headers = columns.map((c) => c.label);
    const rows = exportItems.map((item) => {
      const rec = item as Record<string, unknown>;
      return columns.map((col) =>
        escapeCSV(col.exportFn ? col.exportFn(item) : rec[col.key])
      );
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sKey}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    const label = selected.size > 0 ? `${exportItems.length} selectionne(s)` : `${exportItems.length} element(s)`;
    toast.success(`${label} exporte(s)`);
  }, [items, selected, columns, sKey]);

  // 34. Import CSV with progress
  const handleImportCSV = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        // 35. Handle \r\n line endings
        const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) { toast.error("CSV vide ou invalide"); setImporting(false); return; }
        const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
        const colKeyMap: Record<string, string> = {};
        for (const col of columns) {
          const idx = headers.indexOf(col.label.toLowerCase());
          if (idx !== -1) colKeyMap[col.label.toLowerCase()] = col.key;
        }
        // 36. Also map field keys directly
        for (const field of fields) {
          const idx = headers.indexOf(field.key.toLowerCase());
          if (idx !== -1 && !Object.values(colKeyMap).includes(field.key)) {
            colKeyMap[field.key.toLowerCase()] = field.key;
          }
        }
        let created = 0, skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i]);
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            const key = colKeyMap[h];
            if (key && vals[idx] !== undefined) {
              const val = vals[idx].trim();
              if (key === "score" || key === "ponderation") row[key] = Number(val) || 0;
              else if (key === "is_default") row[key] = val.toLowerCase() === "oui" || val.toLowerCase() === "true";
              else row[key] = val;
            }
          });
          if (row.code || row.libelle) {
            const result = await service.create(row as Partial<T>);
            if (result) created++; else skipped++;
          }
        }
        await load();
        if (skipped > 0) toast.warning(`${created} importe(s), ${skipped} erreur(s)`);
        else toast.success(`${created} element(s) importe(s)`);
      } catch {
        toast.error("Erreur lors de l'import");
      }
      setImporting(false);
    };
    input.click();
  }, [service, columns, fields, load]);

  // 37. Update form
  const updateForm = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev }; delete n[key]; return n;
    });
  }, []);

  // 38. Reset filters
  const resetFilters = useCallback(() => {
    setSearchInput("");
    setRiskFilter("all");
    setPiloteFilter("all");
    setExtraFilterValues({});
  }, []);

  const hasActiveFilters = debouncedSearch || riskFilter !== "all" || piloteFilter !== "all" ||
    Object.values(extraFilterValues).some((v) => v && v !== "all");

  // 39. Keyboard navigation (Escape clears selection, Delete opens bulk delete)
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((prev) => Math.min(prev + 1, paged.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && focusIdx >= 0 && focusIdx < paged.length) {
      e.preventDefault();
      openEdit(paged[focusIdx]);
    } else if (e.key === " " && focusIdx >= 0 && focusIdx < paged.length) {
      e.preventDefault();
      toggleSelect(paged[focusIdx].id);
    } else if (e.key === "Escape") {
      if (selected.size > 0) { setSelected(new Set()); e.preventDefault(); }
    } else if (e.key === "Delete" && selected.size > 0) {
      e.preventDefault();
      setBulkDeleteOpen(true);
    }
  }, [paged, focusIdx, openEdit, toggleSelect, selected.size]);

  // 40. Auto-focus first field in dialog
  useEffect(() => {
    if (dialogOpen) {
      setTimeout(() => firstFieldRef.current?.focus(), 100);
    }
  }, [dialogOpen]);

  // 41. Risk distribution bar
  function RiskBar() {
    if (!stats || stats.total === 0) return null;
    const pF = (stats.faible / stats.total) * 100;
    const pM = (stats.moyen / stats.total) * 100;
    const pE = (stats.eleve / stats.total) * 100;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5 cursor-help">
              {pF > 0 && <div className="bg-emerald-500/60 transition-all duration-500" style={{ width: `${pF}%` }} />}
              {pM > 0 && <div className="bg-amber-500/60 transition-all duration-500" style={{ width: `${pM}%` }} />}
              {pE > 0 && <div className="bg-red-500/60 transition-all duration-500" style={{ width: `${pE}%` }} />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {stats.faible} faible ({Math.round(pF)}%) · {stats.moyen} moyen ({Math.round(pM)}%) · {stats.eleve} eleve ({Math.round(pE)}%)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  /* ========== LOADING SKELETON ========== */
  if (loading) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-4" aria-busy="true" aria-label="Chargement en cours">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
            <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
            <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-7 w-20 bg-white/5 rounded animate-pulse" />)}
        </div>
        <div className="h-2 w-full bg-white/5 rounded animate-pulse" />
        <div className="h-10 w-full bg-white/5 rounded animate-pulse" />
        <div className="space-y-0.5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-11 w-full bg-white/5 rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
        <div className="flex justify-between">
          <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
          <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className="h-7 w-7 bg-white/5 rounded animate-pulse" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {description}
            <span className="ml-2 text-slate-500">({items.length} element{items.length > 1 ? "s" : ""})</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <ActionTooltip label={selected.size > 0 ? `Exporter ${selected.size} selectionne(s)` : "Exporter tout en CSV"}>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs border-white/10 hover:bg-white/5" aria-label="Exporter en CSV">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </ActionTooltip>
          <ActionTooltip label="Importer un fichier CSV">
            <Button variant="outline" size="sm" onClick={handleImportCSV} disabled={importing} className="gap-1.5 text-xs border-white/10 hover:bg-white/5" aria-label="Importer un CSV">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importer
            </Button>
          </ActionTooltip>
          <Button onClick={openCreate} size="sm" className="gap-2" aria-label="Ajouter un element">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>
      </div>

      {/* ===== STATS ===== */}
      {stats && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{stats.faible} Faible</Badge>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{stats.moyen} Moyen</Badge>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{stats.eleve} Eleve</Badge>
            {computedExtraStats?.map((s) => (
              <Badge key={s.label} className={s.color}>{s.count} {s.label}</Badge>
            ))}
          </div>
          <RiskBar />
        </div>
      )}
      {computedExtraStats && !stats && (
        <div className="flex items-center gap-2 flex-wrap">
          {computedExtraStats.map((s) => (
            <Badge key={s.label} className={s.color}>{s.count} {s.label}</Badge>
          ))}
        </div>
      )}

      {/* ===== FILTERS ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher (code, libelle, description...)"
            className="pl-9 pr-8 bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/40"
            aria-label="Rechercher dans le referentiel"
          />
          {/* 42. Clear search button */}
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {hasScore && (
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-sm" aria-label="Filtrer par risque">
              <SelectValue placeholder="Risque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous risques</SelectItem>
              <SelectItem value="faible">Faible</SelectItem>
              <SelectItem value="moyen">Moyen</SelectItem>
              <SelectItem value="eleve">Eleve</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={piloteFilter} onValueChange={setPiloteFilter}>
          <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-sm" aria-label="Filtrer par pilotes">
            <SelectValue placeholder="Pilotes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous pilotes</SelectItem>
            <SelectItem value="oui">Oui</SelectItem>
            <SelectItem value="non">Non</SelectItem>
          </SelectContent>
        </Select>
        {extraFilters?.map((ef) => (
          <Select
            key={ef.key}
            value={extraFilterValues[ef.key] || "all"}
            onValueChange={(v) => setExtraFilterValues((prev) => ({ ...prev, [ef.key]: v }))}
          >
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-sm" aria-label={`Filtrer par ${ef.label}`}>
              <SelectValue placeholder={ef.label} />
            </SelectTrigger>
            <SelectContent>
              {ef.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-xs text-slate-400 hover:text-slate-200" aria-label="Reinitialiser les filtres">
            <X className="w-3.5 h-3.5" /> Reinitialiser
          </Button>
        )}
      </div>

      {/* ===== FILTERED COUNT ===== */}
      {hasActiveFilters && (
        <p className="text-xs text-slate-500">
          {sorted.length} resultat{sorted.length > 1 ? "s" : ""} sur {items.length} element{items.length > 1 ? "s" : ""}
        </p>
      )}

      {/* ===== BULK ACTIONS ===== */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-300 font-medium">{selected.size} selectionne{selected.size > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={() => setBulkDeleteOpen(true)} aria-label="Supprimer la selection">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </Button>
            {hasScore && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-white/10" onClick={() => setBulkRiskOpen(true)} aria-label="Modifier le risque en masse">
                Modifier le risque
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs text-slate-400" onClick={() => setSelected(new Set())} aria-label="Deselectionner tout">
              Deselectionner
            </Button>
          </div>
        </div>
      )}

      {/* ===== TABLE ===== */}
      <div className="overflow-x-auto rounded-lg">
        <table
          ref={tableRef}
          className="w-full text-sm"
          role="grid"
          aria-label={title}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
        >
          {/* 43. Sticky header */}
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
            <tr className="border-b border-white/10">
              <th className="w-10 py-2.5 px-2">
                <Checkbox
                  checked={allPageSelected && paged.length > 0}
                  // 44. Indeterminate state
                  {...(somePageSelected && !allPageSelected ? { "data-state": "indeterminate" } : {})}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout selectionner"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-2.5 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider select-none group"
                  style={{ width: col.width || "auto", minWidth: col.minWidth || (col.width || "auto") }}
                >
                  {col.sortable !== false ? (
                    <button
                      className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                      onClick={() => handleSort(col.key)}
                      aria-label={`Trier par ${col.label}`}
                    >
                      {col.label}
                      {renderSortIcon(col.key)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th className="w-28 py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <FileSearch className="w-10 h-10 text-slate-600" />
                    <p className="text-slate-500 text-sm">
                      {hasActiveFilters ? "Aucun resultat pour ces filtres" : "Aucun element dans ce referentiel"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-xs">
                        <X className="w-3.5 h-3.5" /> Reinitialiser les filtres
                      </Button>
                    )}
                    {!hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={openCreate} className="gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" /> Ajouter un element
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((item, idx) => {
                const rec = item as Record<string, unknown>;
                const isSelected = selected.has(item.id);
                const isFocused = focusIdx === idx;
                const itemIsNew = isNew(rec.created_at);
                return (
                  <tr
                    key={item.id}
                    className={[
                      "border-b border-white/5 cursor-pointer transition-colors duration-150",
                      idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]",
                      isSelected ? "!bg-blue-500/10 hover:!bg-blue-500/15" : "hover:bg-white/[0.06]",
                      isFocused ? "ring-1 ring-inset ring-blue-500/50" : "",
                      "ref-fade-in",
                    ].join(" ")}
                    style={{ animationDelay: `${idx * 15}ms` }}
                    onClick={() => openEdit(item)}
                    onDoubleClick={() => openEdit(item)}
                    role="row"
                    aria-selected={isSelected}
                    tabIndex={-1}
                  >
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        aria-label={`Selectionner ${rec.libelle || rec.code || ""}`}
                      />
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="py-2.5 px-3 text-slate-200"
                        style={{ width: col.width || "auto", minWidth: col.minWidth || "auto" }}
                      >
                        {/* 45. Truncate long text with tooltip */}
                        <div className="flex items-center gap-2 max-w-full">
                          <span className="truncate">
                            {col.render
                              ? col.render(item, debouncedSearch)
                              : <HighlightText text={String(rec[col.key] ?? "")} highlight={debouncedSearch} />}
                          </span>
                          {col.key === "libelle" && itemIsNew && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0 gap-1 flex-shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> Nouveau
                            </Badge>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <ActionTooltip label="Modifier">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={() => openEdit(item)} aria-label="Modifier">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="Dupliquer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400" onClick={() => openDuplicate(item)} aria-label="Dupliquer">
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="Supprimer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400" onClick={() => setDeleteConfirm(item.id)} aria-label="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </ActionTooltip>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">
            {sorted.length} element{sorted.length > 1 ? "s" : ""} affiche{sorted.length > 1 ? "s" : ""} sur {items.length} total
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Lignes :</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[70px] h-7 bg-white/5 border-white/10 text-xs" aria-label="Nombre de lignes par page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* 46. Better pagination with page numbers */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">Page {safePage + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={safePage === 0} onClick={() => setPage(0)} className="h-7 w-7 p-0" aria-label="Premiere page">
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 p-0" aria-label="Page precedente">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {/* 47. Page number buttons */}
          {totalPages <= 7 ? (
            Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                variant={i === safePage ? "default" : "ghost"}
                size="sm"
                onClick={() => setPage(i)}
                className={`h-7 w-7 p-0 text-xs ${i === safePage ? "" : "text-slate-400"}`}
                aria-label={`Page ${i + 1}`}
                aria-current={i === safePage ? "page" : undefined}
              >
                {i + 1}
              </Button>
            ))
          ) : (
            <>
              {[0, 1].map((i) => (
                <Button key={i} variant={i === safePage ? "default" : "ghost"} size="sm" onClick={() => setPage(i)} className={`h-7 w-7 p-0 text-xs ${i === safePage ? "" : "text-slate-400"}`}>{i + 1}</Button>
              ))}
              {safePage > 3 && <span className="text-xs text-slate-600 px-1">...</span>}
              {safePage > 2 && safePage < totalPages - 3 && (
                <Button variant="default" size="sm" className="h-7 w-7 p-0 text-xs">{safePage + 1}</Button>
              )}
              {safePage < totalPages - 4 && <span className="text-xs text-slate-600 px-1">...</span>}
              {[totalPages - 2, totalPages - 1].filter(i => i > 1).map((i) => (
                <Button key={i} variant={i === safePage ? "default" : "ghost"} size="sm" onClick={() => setPage(i)} className={`h-7 w-7 p-0 text-xs ${i === safePage ? "" : "text-slate-400"}`}>{i + 1}</Button>
              ))}
            </>
          )}
          <Button variant="ghost" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 p-0" aria-label="Page suivante">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-7 w-7 p-0" aria-label="Derniere page">
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 48. Reset to defaults */}
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={handleResetDefaults} className="gap-1.5 text-xs text-slate-400 hover:text-slate-200" aria-label="Reinitialiser aux valeurs par defaut">
          <RotateCcw className="w-3.5 h-3.5" /> Reinitialiser aux valeurs par defaut
        </Button>
      </div>

      {/* ===== CREATE / EDIT DIALOG ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editItem ? "Modifier l'element" : "Ajouter un element"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              {editItem ? "Modifiez les champs ci-dessous puis validez." : "Remplissez les champs ci-dessous pour creer un nouvel element."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {fields.map((field, fieldIdx) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-slate-300 text-sm">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                {field.type === "select" && field.options ? (
                  <Select value={String(form[field.key] ?? "")} onValueChange={(v) => updateForm(field.key, v)}>
                    <SelectTrigger className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500 ring-1 ring-red-500/30" : ""}`}>
                      <SelectValue placeholder={field.placeholder || "Selectionner"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "slider" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[Number(form[field.key] ?? 0)]}
                        onValueChange={([v]) => updateForm(field.key, v)}
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono text-slate-300 w-10 text-right tabular-nums">{Number(form[field.key] ?? 0)}</span>
                    </div>
                    {/* 49. Preview risk badge next to slider */}
                    <RiskBadge score={Number(form[field.key] ?? 0)} />
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!form[field.key]} onCheckedChange={(v) => updateForm(field.key, !!v)} />
                    <span className="text-sm text-slate-300">{field.placeholder || "Actif"}</span>
                  </div>
                ) : field.type === "multi-checkbox" && field.options ? (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {field.options.map((opt) => {
                      const currentVal = String(form[field.key] ?? "");
                      const parts = currentVal.split(",").map((s) => s.trim()).filter(Boolean);
                      const checked = parts.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v ? [...parts, opt.value] : parts.filter((p) => p !== opt.value);
                              updateForm(field.key, next.join(", "));
                            }}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                ) : field.type === "number" ? (
                  <Input
                    type="number"
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, Number(e.target.value))}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500 ring-1 ring-red-500/30" : ""}`}
                  />
                ) : field.type === "textarea" ? (
                  <div className="space-y-1">
                    <textarea
                      value={String(form[field.key] ?? "")}
                      onChange={(e) => updateForm(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      maxLength={field.maxLength}
                      className={`w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y ${formErrors[field.key] ? "border-red-500 ring-1 ring-red-500/30" : ""}`}
                    />
                    {/* 50. Character count */}
                    {field.maxLength && (
                      <p className="text-[10px] text-slate-600 text-right">
                        {String(form[field.key] ?? "").length} / {field.maxLength}
                      </p>
                    )}
                  </div>
                ) : (
                  <Input
                    ref={fieldIdx === 0 ? firstFieldRef : undefined}
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500 ring-1 ring-red-500/30" : ""}`}
                  />
                )}
                {formErrors[field.key] && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {formErrors[field.key]}
                  </p>
                )}
              </div>
            ))}

            {/* Score preview (when score is not a slider field but exists in form) */}
            {hasScore && form.score !== undefined && !fields.some((f) => f.key === "score" && f.type === "slider") && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400">Apercu risque :</span>
                <RiskBadge score={Number(form.score ?? 0)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editItem ? "Mettre a jour" : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Confirmer la suppression</DialogTitle>
            <DialogDescription className="text-slate-400">
              Cette action est irreversible. Vous pourrez annuler pendant 5 secondes apres la suppression.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK DELETE DIALOG ===== */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Supprimer {selected.size} element{selected.size > 1 ? "s" : ""} ?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)} disabled={bulkProcessing}>Annuler</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkProcessing} className="gap-2">
              {bulkProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              Supprimer {selected.size} element{selected.size > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK RISK CHANGE DIALOG ===== */}
      <Dialog open={bulkRiskOpen} onOpenChange={setBulkRiskOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Modifier le risque ({selected.size} elements)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Slider value={[bulkRiskScore]} onValueChange={([v]) => setBulkRiskScore(v)} min={0} max={100} step={1} className="flex-1" />
              <span className="text-sm font-mono text-slate-300 w-10 text-right tabular-nums">{bulkRiskScore}</span>
            </div>
            <RiskBadge score={bulkRiskScore} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkRiskOpen(false)} disabled={bulkProcessing}>Annuler</Button>
            <Button onClick={handleBulkRiskChange} disabled={bulkProcessing} className="gap-2">
              {bulkProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
