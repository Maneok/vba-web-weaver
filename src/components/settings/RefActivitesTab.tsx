import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { activitesService, type RefActivite, type NiveauRisque } from "@/lib/referentielsService";

const RISK_BADGE: Record<NiveauRisque, string> = {
  "Faible": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Moyen": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Élevé": "bg-red-500/15 text-red-400 border-red-500/30",
};

const PAGE_SIZE = 20;

const EMPTY: Omit<RefActivite, "id"> = {
  code: "",
  libelle: "",
  description: "",
  niveau_risque: "Faible",
  parametres_pilotes: false,
};

export default function RefActivitesTab() {
  const [items, setItems] = useState<RefActivite[]>(() => activitesService.getAll());
  const [filter, setFilter] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partial<RefActivite> & Omit<RefActivite, "id">>({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filter) return items;
    const lower = filter.toLowerCase();
    return items.filter(
      (m) =>
        m.code.toLowerCase().includes(lower) ||
        m.libelle.toLowerCase().includes(lower) ||
        m.description.toLowerCase().includes(lower)
    );
  }, [items, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const reload = useCallback(() => setItems(activitesService.getAll()), []);

  function openCreate() {
    setEditId(null);
    setEditItem({ ...EMPTY });
    setDialogOpen(true);
  }

  function openEdit(item: RefActivite) {
    setEditId(item.id);
    setEditItem({ ...item });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!editItem.libelle.trim()) {
      toast.error("Le libelle est requis");
      return;
    }
    if (editId) {
      activitesService.update(editId, editItem);
      toast.success("Activite mise a jour");
    } else {
      activitesService.create(editItem as Omit<RefActivite, "id">);
      toast.success("Activite ajoutee");
    }
    reload();
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    activitesService.delete(id);
    toast.success("Activite supprimee");
    reload();
  }

  function applyFilter() {
    setFilter(filterInput);
    setPage(0);
  }

  return (
    <div className="glass-card border border-white/10 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Referentiel Activites</h2>
          <p className="text-sm text-slate-400 mt-1">Gestion des codes APE/NAF et niveaux de risque associes.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Filtrer par mot cle"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            className="pl-9"
          />
        </div>
        <Button variant="secondary" onClick={applyFilter}>Filtrer</Button>
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">Code</TableHead>
              <TableHead className="text-slate-400">Libelle</TableHead>
              <TableHead className="text-slate-400">Description</TableHead>
              <TableHead className="text-slate-400">Niveau de risque</TableHead>
              <TableHead className="text-slate-400">Param. pilotes</TableHead>
              <TableHead className="text-slate-400 w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">Aucune activite trouvee</TableCell>
              </TableRow>
            )}
            {pageItems.map((item) => (
              <TableRow key={item.id} className="border-white/10 cursor-pointer hover:bg-white/5" onClick={() => openEdit(item)}>
                <TableCell className="text-slate-300 font-mono">{item.code}</TableCell>
                <TableCell className="text-slate-200 font-medium">{item.libelle}</TableCell>
                <TableCell className="text-slate-400 max-w-[200px] truncate">{item.description}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={RISK_BADGE[item.niveau_risque]}>{item.niveau_risque}</Badge>
                </TableCell>
                <TableCell className="text-slate-300">{item.parametres_pilotes ? "Oui" : "Non"}</TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-200" onClick={() => openEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>Supprimer l'activite "{item.libelle}" ? Cette action est irreversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{filtered.length} resultat{filtered.length > 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Precedent</Button>
            <span className="flex items-center px-2">Page {page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier l'activite" : "Ajouter une activite"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={editItem.code} onChange={(e) => setEditItem((p) => ({ ...p, code: e.target.value }))} placeholder="68.10Z" />
              </div>
              <div className="space-y-2">
                <Label>Libelle <span className="text-red-400">*</span></Label>
                <Input value={editItem.libelle} onChange={(e) => setEditItem((p) => ({ ...p, libelle: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editItem.description} onChange={(e) => setEditItem((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Niveau de risque</Label>
              <Select value={editItem.niveau_risque} onValueChange={(v) => setEditItem((p) => ({ ...p, niveau_risque: v as NiveauRisque }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faible">Faible</SelectItem>
                  <SelectItem value="Moyen">Moyen</SelectItem>
                  <SelectItem value="Élevé">Élevé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editItem.parametres_pilotes} onCheckedChange={(v) => setEditItem((p) => ({ ...p, parametres_pilotes: v }))} />
              <Label>Parametres pilotes</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>{editId ? "Mettre a jour" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
