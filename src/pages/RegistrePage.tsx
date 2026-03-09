import { useState, useMemo, useCallback } from "react";
import { useAppState } from "@/lib/AppContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { AlerteRegistre } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookOpen, Plus, AlertTriangle, Download, FileWarning, X, ChevronLeft, ChevronRight, ArrowUpDown, FileX2 } from "lucide-react";
import { toast } from "sonner";
import { ALERT_CATEGORIES as CATEGORIES, DEFAULT_ASSOCIES, DEFAULT_SUPERVISEURS } from "@/lib/constants";

const PAGE_SIZE = 20;
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateFR(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function sanitizeCSVValue(val: string | undefined): string {
  const v = (val || "").replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, "");
  if (/^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}

function getCategoryBadgeClasses(categorie: string): string {
  const upper = categorie.toUpperCase();
  if (upper.includes("TRACFIN")) return "bg-red-600/20 text-red-400 border border-red-500/20";
  if (upper.includes("PPE")) return "bg-red-500/15 text-red-400 border border-red-500/15";
  if (upper.includes("PAYS")) return "bg-red-500/15 text-red-400 border border-red-500/15";
  if (upper.includes("ATYPIQUE") || upper.includes("OPERATION")) return "bg-orange-500/15 text-orange-400 border border-orange-500/15";
  if (upper.includes("ANOMALIE")) return "bg-amber-500/15 text-amber-400 border border-amber-500/15";
  return "bg-blue-500/15 text-blue-400 border border-blue-500/15";
}

function getStatutBadgeClasses(statut: string): string {
  if (statut === "CLÔTURÉ") return "bg-emerald-500/15 text-emerald-400";
  return "bg-amber-500/15 text-amber-400";
}

function exportCSV(data: AlerteRegistre[], filename: string) {
  const headers = ["Date", "Client", "Categorie", "Qualification", "Details", "Action prise", "Responsable", "Statut", "Date butoir", "Type decision", "Validateur"];
  const rows = data.map(a => [
    a.date, a.clientConcerne, a.categorie, a.qualification, a.details,
    a.actionPrise, a.responsable, a.statut, a.dateButoir, a.typeDecision, a.validateur,
  ]);
  const csv = [headers.join(";"), ...rows.map(r => r.map(v => `"${sanitizeCSVValue(v)}"`).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RegistrePage() {
  const { alertes, addAlerte, clients } = useAppState();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterCategorie, setFilterCategorie] = useState<string>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedAlerte, setSelectedAlerte] = useState<AlerteRegistre | null>(null);
  const [newAlerte, setNewAlerte] = useState({
    client: "", categorie: CATEGORIES[0], details: "", responsable: "", dateEcheance: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<"date" | "clientConcerne" | "categorie" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const debouncedSearch = useDebounce(search, 250);

  const hasActiveFilters = filterStatut !== "all" || filterCategorie !== "all" || dateStart !== "" || dateEnd !== "" || search !== "";

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setFilterStatut("all");
    setFilterCategorie("all");
    setDateStart("");
    setDateEnd("");
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((key: "date" | "clientConcerne" | "categorie") => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  // --- KPI counts ---
  const totalAlertes = alertes.length;
  const enCours = alertes.filter(a => a.statut === "EN COURS").length;
  const tracfinCount = alertes.filter(a => (a.typeDecision || "").toLowerCase().includes("tracfin")).length;

  // --- Unique categories for filter ---
  const uniqueCategories = useMemo(() => {
    const cats = new Set(alertes.map(a => a.categorie));
    return Array.from(cats).sort();
  }, [alertes]);

  // --- Filtered data ---
  const filtered = useMemo(() => {
    const result = alertes.filter(a => {
      const matchSearch = !debouncedSearch ||
        (a.clientConcerne || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (a.categorie || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (a.details || "").toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatut = filterStatut === "all" || a.statut === filterStatut;
      const matchCategorie = filterCategorie === "all" || a.categorie === filterCategorie;
      const matchDateStart = !dateStart || a.date >= dateStart;
      const matchDateEnd = !dateEnd || a.date <= dateEnd;
      return matchSearch && matchStatut && matchCategorie && matchDateStart && matchDateEnd;
    });
    if (sortKey) {
      result.sort((a, b) => {
        const va = (a[sortKey] || "").toLowerCase();
        const vb = (b[sortKey] || "").toLowerCase();
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [alertes, debouncedSearch, filterStatut, filterCategorie, dateStart, dateEnd, sortKey, sortDir]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddAlerte = () => {
    const errors: Record<string, string> = {};
    if (!newAlerte.client) errors.client = "Veuillez selectionner un client";
    if (!newAlerte.details.trim()) errors.details = "Veuillez saisir les details de l'alerte";
    if (!newAlerte.responsable) errors.responsable = "Veuillez selectionner un responsable";
    if (!newAlerte.dateEcheance) errors.dateEcheance = "Veuillez saisir une date d'echeance";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setFormErrors({});
    addAlerte({
      date: new Date().toISOString().split("T")[0],
      clientConcerne: newAlerte.client,
      categorie: newAlerte.categorie,
      details: newAlerte.details,
      actionPrise: "EN INVESTIGATION",
      responsable: newAlerte.responsable,
      qualification: "",
      statut: "EN COURS",
      dateButoir: newAlerte.dateEcheance,
      typeDecision: "",
      validateur: "",
    });
    setShowDialog(false);
    setNewAlerte({ client: "", categorie: CATEGORIES[0], details: "", responsable: "", dateEcheance: "" });
    toast.success("Alerte ajoutee au registre");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Registre LCB-FT</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registre des alertes, investigations et decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
            onClick={() => {
              exportCSV(filtered, `registre-lcb-ft-${new Date().toISOString().split("T")[0]}.csv`);
              toast.success(`${filtered.length} alertes exportees en CSV`);
            }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4" /> Nouvelle alerte
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <div className="glass-card p-4 flex items-center gap-4 transition-transform duration-200 hover:scale-[1.03] cursor-default">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{totalAlertes}</p>
            <p className="text-[11px] text-slate-500">Total alertes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4 transition-transform duration-200 hover:scale-[1.03] cursor-default">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{enCours}</p>
            <p className="text-[11px] text-slate-500">En cours</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4 transition-transform duration-200 hover:scale-[1.03] cursor-default">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <FileWarning className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{tracfinCount}</p>
            <p className="text-[11px] text-slate-500">Declarations TRACFIN</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher dans le registre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
            aria-label="Rechercher dans le registre"
          />
        </div>
        <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[150px] bg-white/[0.03] border-white/[0.06]" aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="EN COURS">En cours</SelectItem>
            <SelectItem value="CLÔTURÉ">Cloture</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategorie} onValueChange={(v) => { setFilterCategorie(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white/[0.03] border-white/[0.06]" aria-label="Filtrer par categorie">
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes categories</SelectItem>
            {uniqueCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateStart}
          onChange={e => { setDateStart(e.target.value); setCurrentPage(1); }}
          className="w-full sm:w-[150px] bg-white/[0.03] border-white/[0.06] text-slate-300"
          placeholder="Date debut"
          aria-label="Date de debut du filtre"
        />
        <Input
          type="date"
          value={dateEnd}
          onChange={e => { setDateEnd(e.target.value); setCurrentPage(1); }}
          className="w-full sm:w-[150px] bg-white/[0.03] border-white/[0.06] text-slate-300"
          placeholder="Date fin"
          aria-label="Date de fin du filtre"
        />
        {hasActiveFilters && (
          <Button
            variant="outline"
            className="gap-1.5 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
            onClick={clearAllFilters}
            aria-label="Effacer tous les filtres"
          >
            <X className="w-4 h-4" /> Effacer filtres
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "180ms" }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("date")} aria-label="Trier par date">
                  <span className="inline-flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("clientConcerne")} aria-label="Trier par client">
                  <span className="inline-flex items-center gap-1">Client <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("categorie")} aria-label="Trier par categorie">
                  <span className="inline-flex items-center gap-1">Categorie <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Qualification</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Details</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Action prise</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Responsable</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Statut</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Date butoir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((a, i) => {
                const globalIndex = (safePage - 1) * PAGE_SIZE + i;
                const alerteId = (a as AlerteRegistre & { id?: string }).id || `ALR-${String(globalIndex + 1).padStart(4, "0")}`;
                const isOverdue = a.dateButoir && a.dateButoir < getToday() && a.statut !== "CLÔTURÉ";
                return (
                  <TableRow
                    key={alerteId}
                    className={`border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer ${isOverdue ? "bg-red-500/[0.06]" : ""}`}
                    onClick={() => setSelectedAlerte(a)}
                    aria-label={`Alerte ${alerteId} - ${a.clientConcerne}`}
                  >
                    <TableCell className="text-xs text-slate-400 font-mono whitespace-nowrap">{formatDateFR(a.date)}</TableCell>
                    <TableCell className="font-medium text-sm text-slate-200 whitespace-nowrap">{a.clientConcerne}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${getCategoryBadgeClasses(a.categorie)}`}>
                        {a.categorie}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{a.qualification}</TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{a.details?.length > 100 ? a.details.slice(0, 100) + "..." : a.details}</TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-[180px] truncate">{a.actionPrise}</TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">{a.responsable}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${getStatutBadgeClasses(a.statut)}`}>
                        {a.statut}
                      </span>
                    </TableCell>
                    <TableCell className={`text-xs font-mono whitespace-nowrap ${isOverdue ? "text-red-400 font-semibold" : "text-slate-400"}`}>{formatDateFR(a.dateButoir)}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <FileX2 className="w-12 h-12 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">Aucune alerte trouvee</p>
                      <p className="text-xs text-slate-600">Modifiez vos filtres ou creez une nouvelle alerte</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filtered.length} alerte{filtered.length > 1 ? "s" : ""} affichee{filtered.length > 1 ? "s" : ""}
              {filtered.length !== alertes.length && ` sur ${alertes.length}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Page precedente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedAlerte} onOpenChange={(open) => { if (!open) setSelectedAlerte(null); }}>
        <SheetContent className="bg-[hsl(217,33%,12%)] border-white/[0.06] w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle className="text-white text-lg">Detail de l'alerte</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
              onClick={() => setSelectedAlerte(null)}
              aria-label="Fermer le panneau de detail"
            >
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          {selectedAlerte && (
            <div className="mt-6 space-y-5">
              <DetailRow label="Date" value={formatDateFR(selectedAlerte.date)} mono />
              <DetailRow label="Client concerne" value={selectedAlerte.clientConcerne} />
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Categorie</p>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${getCategoryBadgeClasses(selectedAlerte.categorie)}`}>
                  {selectedAlerte.categorie}
                </span>
              </div>
              <DetailRow label="Qualification" value={selectedAlerte.qualification || "—"} />
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Details</p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedAlerte.details || "—"}</p>
              </div>
              <DetailRow label="Action prise" value={selectedAlerte.actionPrise || "—"} />
              <DetailRow label="Responsable" value={selectedAlerte.responsable || "—"} />
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Statut</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${getStatutBadgeClasses(selectedAlerte.statut)}`}>
                  {selectedAlerte.statut}
                </span>
              </div>
              <DetailRow label="Date butoir" value={formatDateFR(selectedAlerte.dateButoir)} mono />
              <DetailRow label="Type de decision" value={selectedAlerte.typeDecision || "—"} />
              <DetailRow label="Validateur" value={selectedAlerte.validateur || "—"} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New alert dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06]">
          <DialogHeader>
            <DialogTitle className="text-white">Nouvelle alerte LCB-FT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Client concerne</Label>
              <Select value={newAlerte.client} onValueChange={v => setNewAlerte(p => ({ ...p, client: v }))}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue placeholder="Selectionnez un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.ref} value={c.raisonSociale}>{c.raisonSociale} ({c.ref})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Categorie</Label>
              <Select value={newAlerte.categorie} onValueChange={v => setNewAlerte(p => ({ ...p, categorie: v }))}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Details</Label>
              <Textarea value={newAlerte.details} onChange={e => setNewAlerte(p => ({ ...p, details: e.target.value }))} className="bg-white/[0.03] border-white/[0.06]" placeholder="Description de l'alerte..." />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Responsable</Label>
              <Select value={newAlerte.responsable} onValueChange={v => setNewAlerte(p => ({ ...p, responsable: v }))}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                <SelectContent>
                  {[...DEFAULT_ASSOCIES, ...DEFAULT_SUPERVISEURS].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Date echeance</Label>
              <Input type="date" value={newAlerte.dateEcheance} onChange={e => setNewAlerte(p => ({ ...p, dateEcheance: e.target.value }))} className="bg-white/[0.03] border-white/[0.06]" />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleAddAlerte} disabled={!newAlerte.client || !newAlerte.details}>
              Enregistrer l'alerte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
