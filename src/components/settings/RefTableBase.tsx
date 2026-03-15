import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ---------- types ---------- */

export type ColumnDef<T> = {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
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
};

const PAGE_SIZE = 20;

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

/* ---------- component ---------- */

export default function RefTableBase<T extends { id: string }>({
  title, description, service, columns, fields, defaultValues,
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await service.getAll();
    setItems(data);
    setLoading(false);
  }, [service]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => service.search(items, filter), [items, filter, service]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [filter]);

  function openCreate() {
    setEditItem(null);
    setForm({ ...defaultValues } as Record<string, unknown>);
    setDialogOpen(true);
  }

  function openEdit(item: T) {
    setEditItem(item);
    setForm({ ...(item as Record<string, unknown>) });
    setDialogOpen(true);
  }

  async function handleSave() {
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
    const ok = await service.delete(id);
    if (ok) {
      toast.success("Element supprime");
      setDeleteConfirm(null);
      await load();
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  function updateForm(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-6 space-y-3">
        <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        <div className="h-64 w-full bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="glass-card border border-white/10 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer par mot cle"
          className="pl-9 bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th key={col.key} className="text-left py-2.5 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
              <th className="w-20 py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-8 text-slate-500">
                  {filter ? "Aucun resultat pour ce filtre" : "Aucun element"}
                </td>
              </tr>
            ) : (
              paged.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => openEdit(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="py-2.5 px-3 text-slate-200">
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            {filtered.length} element{filtered.length > 1 ? "s" : ""} — Page {page + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg">
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
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder={field.placeholder || "Selectionner"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "number" ? (
                  <Input
                    type="number"
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, Number(e.target.value))}
                    placeholder={field.placeholder}
                    className="bg-white/5 border-white/10"
                  />
                ) : field.type === "textarea" ? (
                  <textarea
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                ) : (
                  <Input
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => updateForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="bg-white/5 border-white/10"
                  />
                )}
              </div>
            ))}
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
    </div>
  );
}
