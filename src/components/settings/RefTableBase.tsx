import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Copy, RotateCcw, X,
  FileSearch, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";

/* ---------- types ---------- */

export type ColumnDef<T> = {
  key: string;
  label: string;
  width?: string;
  render?: (item: T, highlight?: string) => React.ReactNode;
  sortable?: boolean;
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
};

const PAGE_SIZES = [10, 20, 50, 100];

/* ---------- risk badge helper ---------- */

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

/* ---------- highlight helper ---------- */

function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !highlight.trim()) return <>{text}</>;
  const q = highlight.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* ---------- CSV helpers ---------- */

function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
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

/* ---------- is new (< 24h) ---------- */

function isNew(createdAt: unknown): boolean {
  if (typeof createdAt !== "string") return false;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

/* ---------- component ---------- */

export default function RefTableBase<T extends { id: string }>({
  title, description, service, columns, fields, defaultValues,
  storageKey, extraFilters, extraStats, hasScore = true, searchAllFields,
}: Props<T>) {
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

  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Filters
  const [riskFilter, setRiskFilter] = useState("all");
  const [piloteFilter, setPiloteFilter] = useState("all");
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>({});

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk risk change dialog
  const [bulkRiskOpen, setBulkRiskOpen] = useState(false);
  const [bulkRiskScore, setBulkRiskScore] = useState(50);

  // Keyboard focus
  const [focusIdx, setFocusIdx] = useState(-1);
  const tableRef = useRef<HTMLTableElement>(null);

  // Undo delete
  const undoRef = useRef<{ id: string; item: T; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Restore filters from sessionStorage
  const sKey = storageKey || title.replace(/\s+/g, "_").toLowerCase();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`ref_filters_${sKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.riskFilter) setRiskFilter(parsed.riskFilter);
        if (parsed.piloteFilter) setPiloteFilter(parsed.piloteFilter);
        if (parsed.extraFilterValues) setExtraFilterValues(parsed.extraFilterValues);
        if (parsed.pageSize) setPageSize(parsed.pageSize);
      }
    } catch { /* ignore */ }
  }, [sKey]);

  // Persist filters to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(`ref_filters_${sKey}`, JSON.stringify({
        riskFilter, piloteFilter, extraFilterValues, pageSize,
      }));
    } catch { /* ignore */ }
  }, [riskFilter, piloteFilter, extraFilterValues, pageSize, sKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await service.getAll();
    setItems(data);
    setLoading(false);
  }, [service]);

  useEffect(() => { load(); }, [load]);

  // Full-text search on all specified fields
  const searched = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase().trim();
    const searchFields = searchAllFields || ["code", "libelle"];
    return items.filter((item) => {
      const rec = item as Record<string, unknown>;
      return searchFields.some((key) => {
        const val = rec[key];
        return typeof val === "string" && val.toLowerCase().includes(q);
      });
    });
  }, [items, debouncedSearch, searchAllFields]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = searched;

    // Risk filter
    if (hasScore && riskFilter !== "all") {
      result = result.filter((item) => {
        const score = (item as Record<string, unknown>).score as number;
        if (riskFilter === "faible") return score <= 25;
        if (riskFilter === "moyen") return score > 25 && score <= 60;
        if (riskFilter === "eleve") return score > 60;
        return true;
      });
    }

    // Pilote filter
    if (piloteFilter !== "all") {
      result = result.filter((item) => {
        const val = (item as Record<string, unknown>).is_default as boolean;
        return piloteFilter === "oui" ? val : !val;
      });
    }

    // Extra filters
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

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);

  // Reset page on filter/search change
  useEffect(() => { setPage(0); }, [debouncedSearch, riskFilter, piloteFilter, extraFilterValues, pageSize]);

  // Stats
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

  const computedExtraStats = useMemo(() => {
    if (!extraStats) return null;
    return extraStats(items);
  }, [items, extraStats]);

  // Selection helpers
  const allPageSelected = paged.length > 0 && paged.every((item) => selected.has(item.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
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
  }

  // Sort handler
  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function renderSortIcon(key: string) {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  }

  // Form helpers
  function openCreate() {
    setEditItem(null);
    setForm({ ...defaultValues } as Record<string, unknown>);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(item: T) {
    setEditItem(item);
    setForm({ ...(item as Record<string, unknown>) });
    setFormErrors({});
    setDialogOpen(true);
  }

  function openDuplicate(item: T) {
    setEditItem(null);
    const rec = { ...(item as Record<string, unknown>) };
    delete rec.id;
    delete rec.created_at;
    delete rec.updated_at;
    if (typeof rec.code === "string") rec.code = rec.code + "_COPY";
    setForm(rec);
    setFormErrors({});
    setDialogOpen(true);
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = form[field.key];
        if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
          errors[field.key] = `${field.label} est requis`;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        const result = await service.update(editItem.id, form);
        if (result) {
          toast.success("Element mis a jour");
          await load();
        } else {
          toast.error("Erreur lors de la mise a jour");
        }
      } else {
        const result = await service.create(form as Partial<T>);
        if (result) {
          toast.success("Element cree");
          await load();
        } else {
          toast.error("Erreur lors de la creation");
        }
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // Find the item for undo
    const item = items.find((i) => i.id === id);
    const ok = await service.delete(id);
    if (ok) {
      setDeleteConfirm(null);
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      await load();

      // Undo toast
      if (item) {
        if (undoRef.current) clearTimeout(undoRef.current.timer);
        const toastId = toast.success("Element supprime", {
          action: {
            label: "Annuler",
            onClick: async () => {
              const rec = { ...(item as Record<string, unknown>) };
              delete rec.id;
              delete rec.created_at;
              delete rec.updated_at;
              const restored = await service.create(rec as Partial<T>);
              if (restored) {
                toast.success("Suppression annulee");
                await load();
              }
            },
          },
          duration: 5000,
        });
        const timer = setTimeout(() => { undoRef.current = null; }, 5000);
        undoRef.current = { id, item, timer };
      }
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let successCount = 0;
    for (const id of ids) {
      const ok = await service.delete(id);
      if (ok) successCount++;
    }
    setSelected(new Set());
    await load();
    toast.success(`${successCount} element(s) supprime(s)`);
  }

  // Bulk risk change
  async function handleBulkRiskChange() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let successCount = 0;
    for (const id of ids) {
      const ok = await service.update(id, { score: bulkRiskScore });
      if (ok) successCount++;
    }
    setBulkRiskOpen(false);
    setSelected(new Set());
    await load();
    toast.success(`Risque mis a jour pour ${successCount} element(s)`);
  }

  // Reset to defaults
  async function handleResetDefaults() {
    // Re-create from service (which does lazyInit with defaults)
    toast.info("Reinitialisation en cours...");
    await load();
    toast.success("Referentiel actualise");
  }

  // Export CSV
  function handleExportCSV() {
    const headers = columns.map((c) => c.label);
    const rows = items.map((item) => {
      const rec = item as Record<string, unknown>;
      return columns.map((col) => escapeCSV(rec[col.key]));
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sKey}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} element(s) exporte(s)`);
  }

  // Import CSV
  function handleImportCSV() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error("Le fichier CSV est vide ou invalide");
        return;
      }
      const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

      // Map headers to column keys
      const colKeyMap: Record<string, string> = {};
      for (const col of columns) {
        const idx = headers.indexOf(col.label.toLowerCase());
        if (idx !== -1) colKeyMap[col.label.toLowerCase()] = col.key;
      }

      let created = 0;
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          const key = colKeyMap[h];
          if (key && vals[idx] !== undefined) {
            const val = vals[idx].trim();
            // Try to parse as number for score/ponderation
            if (key === "score" || key === "ponderation") {
              row[key] = Number(val) || 0;
            } else if (key === "is_default") {
              row[key] = val.toLowerCase() === "oui" || val.toLowerCase() === "true";
            } else {
              row[key] = val;
            }
          }
        });
        if (row.code || row.libelle) {
          const result = await service.create(row as Partial<T>);
          if (result) created++;
        }
      }
      await load();
      toast.success(`${created} element(s) importe(s)`);
    };
    input.click();
  }

  function updateForm(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function resetFilters() {
    setSearchInput("");
    setRiskFilter("all");
    setPiloteFilter("all");
    setExtraFilterValues({});
  }

  const hasActiveFilters = debouncedSearch || riskFilter !== "all" || piloteFilter !== "all" ||
    Object.values(extraFilterValues).some((v) => v && v !== "all");

  // Keyboard navigation
  function handleTableKeyDown(e: React.KeyboardEvent) {
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
    }
  }

  // Risk distribution bar
  function RiskBar() {
    if (!stats || stats.total === 0) return null;
    const pFaible = (stats.faible / stats.total) * 100;
    const pMoyen = (stats.moyen / stats.total) * 100;
    const pEleve = (stats.eleve / stats.total) * 100;
    return (
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/5">
        {pFaible > 0 && <div className="bg-emerald-500/60 transition-all duration-500" style={{ width: `${pFaible}%` }} />}
        {pMoyen > 0 && <div className="bg-amber-500/60 transition-all duration-500" style={{ width: `${pMoyen}%` }} />}
        {pEleve > 0 && <div className="bg-red-500/60 transition-all duration-500" style={{ width: `${pEleve}%` }} />}
      </div>
    );
  }

  /* ---------- loading skeleton ---------- */
  if (loading) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-3">
        <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        <div className="flex gap-2 mt-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-7 w-20 bg-white/5 rounded animate-pulse" />)}
        </div>
        <div className="h-2 w-full bg-white/5 rounded animate-pulse" />
        <div className="space-y-1 mt-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-10 w-full bg-white/5 rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs border-white/10 hover:bg-white/5" aria-label="Exporter en CSV">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportCSV} className="gap-1.5 text-xs border-white/10 hover:bg-white/5" aria-label="Importer un CSV">
            <Upload className="w-3.5 h-3.5" /> Importer
          </Button>
          <Button onClick={openCreate} size="sm" className="gap-2" aria-label="Ajouter un element">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher (code, libelle, description...)"
            className="pl-9 bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/40"
            aria-label="Rechercher dans le referentiel"
          />
        </div>

        {/* Risk filter */}
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

        {/* Pilote filter */}
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

        {/* Extra filters */}
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

        {/* Reset filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-xs text-slate-400 hover:text-slate-200" aria-label="Reinitialiser les filtres">
            <X className="w-3.5 h-3.5" /> Reinitialiser
          </Button>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <span className="text-sm text-blue-300">{selected.size} selectionne(s)</span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              if (confirm(`Supprimer ${selected.size} element(s) ?`)) handleBulkDelete();
            }}
            aria-label="Supprimer la selection"
          >
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
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="w-full text-sm"
          role="grid"
          aria-label={title}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
        >
          <thead>
            <tr className="border-b border-white/10">
              <th className="w-10 py-2.5 px-2">
                <Checkbox
                  checked={allPageSelected && paged.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout selectionner"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-2.5 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider select-none"
                  style={{ width: col.width || "auto" }}
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
                    <p className="text-slate-500">
                      {hasActiveFilters ? "Aucun resultat pour ces filtres" : "Aucun element dans ce referentiel"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-xs">
                        <X className="w-3.5 h-3.5" /> Reinitialiser les filtres
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
                      "border-b border-white/5 cursor-pointer transition-all duration-200",
                      idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                      isSelected ? "bg-blue-500/10 hover:bg-blue-500/15" : "hover:bg-white/[0.07]",
                      isFocused ? "ring-1 ring-blue-500/50 ring-inset" : "",
                      "animate-fadeIn",
                    ].join(" ")}
                    style={{ animationDelay: `${idx * 20}ms` }}
                    onClick={() => openEdit(item)}
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
                      <td key={col.key} className="py-2.5 px-3 text-slate-200" style={{ width: col.width || "auto" }}>
                        <div className="flex items-center gap-2">
                          {col.render
                            ? col.render(item, debouncedSearch)
                            : <HighlightText text={String(rec[col.key] ?? "")} highlight={debouncedSearch} />
                          }
                          {col.key === "libelle" && itemIsNew && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0 gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Nouveau
                            </Badge>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                          onClick={() => openEdit(item)}
                          aria-label="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400"
                          onClick={() => openDuplicate(item)}
                          aria-label="Dupliquer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                          onClick={() => setDeleteConfirm(item.id)}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: counter + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">
            {sorted.length} element{sorted.length > 1 ? "s" : ""} affiche{sorted.length > 1 ? "s" : ""} sur {items.length} total
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Lignes:</span>
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Page {page + 1}/{totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(0)} className="h-7 w-7 p-0" aria-label="Premiere page">
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 p-0" aria-label="Page precedente">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 p-0" aria-label="Page suivante">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-7 w-7 p-0" aria-label="Derniere page">
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reset to defaults button */}
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={handleResetDefaults} className="gap-1.5 text-xs text-slate-400 hover:text-slate-200" aria-label="Reinitialiser aux valeurs par defaut">
          <RotateCcw className="w-3.5 h-3.5" /> Reinitialiser aux valeurs par defaut
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editItem ? "Modifier l'element" : "Ajouter un element"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-slate-300">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                {field.type === "select" && field.options ? (
                  <Select
                    value={String(form[field.key] ?? "")}
                    onValueChange={(v) => updateForm(field.key, v)}
                  >
                    <SelectTrigger className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={field.placeholder || "Selectionner"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "slider" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[Number(form[field.key] ?? 0)]}
                        onValueChange={([v]) => updateForm(field.key, v)}
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono text-slate-300 w-10 text-right">{Number(form[field.key] ?? 0)}</span>
                    </div>
                    <RiskBadge score={Number(form[field.key] ?? 0)} />
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!form[field.key]}
                      onCheckedChange={(v) => updateForm(field.key, !!v)}
                    />
                    <span className="text-sm text-slate-300">{field.placeholder || "Actif"}</span>
                  </div>
                ) : field.type === "multi-checkbox" && field.options ? (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((opt) => {
                      const currentVal = String(form[field.key] ?? "");
                      const parts = currentVal.split(",").map((s) => s.trim()).filter(Boolean);
                      const checked = parts.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              let next: string[];
                              if (v) {
                                next = [...parts, opt.value];
                              } else {
                                next = parts.filter((p) => p !== opt.value);
                              }
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
                    className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500" : ""}`}
                  />
                ) : field.type === "textarea" ? (
                  <textarea
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className={`w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${formErrors[field.key] ? "border-red-500" : ""}`}
                  />
                ) : (
                  <Input
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={`bg-white/5 border-white/10 ${formErrors[field.key] ? "border-red-500" : ""}`}
                  />
                )}
                {formErrors[field.key] && <p className="text-xs text-red-400">{formErrors[field.key]}</p>}
              </div>
            ))}

            {/* Score preview badge */}
            {hasScore && form.score !== undefined && (
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">Cette action est irreversible. Voulez-vous continuer ?</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Risk Change Dialog */}
      <Dialog open={bulkRiskOpen} onOpenChange={setBulkRiskOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Modifier le risque ({selected.size} elements)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Slider
                value={[bulkRiskScore]}
                onValueChange={([v]) => setBulkRiskScore(v)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-mono text-slate-300 w-10 text-right">{bulkRiskScore}</span>
            </div>
            <RiskBadge score={bulkRiskScore} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkRiskOpen(false)}>Annuler</Button>
            <Button onClick={handleBulkRiskChange}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fade-in animation style */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out both;
        }
      `}</style>
    </div>
  );
}
