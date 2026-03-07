import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen } from "lucide-react";

export default function RegistrePage() {
  const { alertes } = useAppState();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const filtered = useMemo(() => {
    return alertes.filter(a => {
      const matchSearch = !search ||
        a.clientConcerne.toLowerCase().includes(search.toLowerCase()) ||
        a.categorie.toLowerCase().includes(search.toLowerCase()) ||
        a.details.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === "all" || a.statut === filterStatut;
      return matchSearch && matchStatut;
    });
  }, [alertes, search, filterStatut]);

  const enCours = alertes.filter(a => a.statut === "EN COURS").length;
  const clotures = alertes.filter(a => a.statut === "CLÔTURÉ").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-bold text-white">Registre LCB-FT</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registre des alertes, investigations et decisions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up-delay-1">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{alertes.length}</p>
            <p className="text-[11px] text-slate-500">Total alertes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse-risk" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">{enCours}</p>
            <p className="text-[11px] text-slate-500">En cours</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{clotures}</p>
            <p className="text-[11px] text-slate-500">Clotures</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up-delay-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher dans le registre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="EN COURS">En cours</SelectItem>
            <SelectItem value="CLÔTURÉ">Cloture</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Client</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Categorie</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Action</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Responsable</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Statut</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Butoir</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Decision</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Validateur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a, i) => (
                <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-xs text-slate-400 font-mono">{a.date}</TableCell>
                  <TableCell className="font-medium text-sm text-slate-200">{a.clientConcerne}</TableCell>
                  <TableCell>
                    <span className="text-[11px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      {a.categorie}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{a.actionPrise}</TableCell>
                  <TableCell className="text-xs text-slate-400">{a.responsable}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                      a.statut === "CLÔTURÉ"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>{a.statut}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{a.dateButoir}</TableCell>
                  <TableCell className="text-xs text-slate-400">{a.typeDecision}</TableCell>
                  <TableCell className="text-xs text-slate-400">{a.validateur}</TableCell>
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
      </div>
    </div>
  );
}
