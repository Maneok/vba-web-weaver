import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import type { AlerteRegistre } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookOpen, Plus, AlertTriangle, Download, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { ALERT_CATEGORIES as CATEGORIES, DEFAULT_ASSOCIES, DEFAULT_SUPERVISEURS } from "@/lib/constants";

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
  const csv = [headers.join(";"), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(";"))].join("\n");
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
    return alertes.filter(a => {
      const matchSearch = !search ||
        a.clientConcerne.toLowerCase().includes(search.toLowerCase()) ||
        a.categorie.toLowerCase().includes(search.toLowerCase()) ||
        a.details.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === "all" || a.statut === filterStatut;
      const matchCategorie = filterCategorie === "all" || a.categorie === filterCategorie;
      const matchDateStart = !dateStart || a.date >= dateStart;
      const matchDateEnd = !dateEnd || a.date <= dateEnd;
      return matchSearch && matchStatut && matchCategorie && matchDateStart && matchDateEnd;
    });
  }, [alertes, search, filterStatut, filterCategorie, dateStart, dateEnd]);

  const handleAddAlerte = () => {
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
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{totalAlertes}</p>
            <p className="text-[11px] text-slate-500">Total alertes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{enCours}</p>
            <p className="text-[11px] text-slate-500">En cours</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
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
      <div className="flex gap-3 flex-wrap animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher dans le registre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[150px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="EN COURS">En cours</SelectItem>
            <SelectItem value="CLÔTURÉ">Cloture</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategorie} onValueChange={setFilterCategorie}>
          <SelectTrigger className="w-[200px] bg-white/[0.03] border-white/[0.06]">
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
          onChange={e => setDateStart(e.target.value)}
          className="w-[150px] bg-white/[0.03] border-white/[0.06] text-slate-300"
          placeholder="Date debut"
        />
        <Input
          type="date"
          value={dateEnd}
          onChange={e => setDateEnd(e.target.value)}
          className="w-[150px] bg-white/[0.03] border-white/[0.06] text-slate-300"
          placeholder="Date fin"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "180ms" }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Client</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Categorie</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Qualification</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Details</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Action prise</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Responsable</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Statut</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Date butoir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a, i) => (
                <TableRow
                  key={i}
                  className="border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setSelectedAlerte(a)}
                >
                  <TableCell className="text-xs text-slate-400 font-mono whitespace-nowrap">{a.date}</TableCell>
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
                  <TableCell className="text-xs text-slate-400 font-mono whitespace-nowrap">{a.dateButoir}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    Aucune alerte ne correspond aux filtres
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.06] text-xs text-slate-500">
            {filtered.length} alerte{filtered.length > 1 ? "s" : ""} affichee{filtered.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedAlerte} onOpenChange={(open) => { if (!open) setSelectedAlerte(null); }}>
        <SheetContent className="bg-[hsl(217,33%,12%)] border-white/[0.06] w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white text-lg">Detail de l'alerte</SheetTitle>
          </SheetHeader>
          {selectedAlerte && (
            <div className="mt-6 space-y-5">
              <DetailRow label="Date" value={selectedAlerte.date} mono />
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
              <DetailRow label="Date butoir" value={selectedAlerte.dateButoir || "—"} mono />
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
