import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ScrollText } from "lucide-react";

export default function LogsPage() {
  const { logs } = useAppState();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  const actionTypes = useMemo(() => {
    return [...new Set(logs.map(l => l.typeAction))];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = !search ||
        log.refClient.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.utilisateur.toLowerCase().includes(search.toLowerCase());
      const matchAction = filterAction === "all" || log.typeAction === filterAction;
      return matchSearch && matchAction;
    });
  }, [logs, search, filterAction]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-bold text-white">Journal des Actions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historique automatique de toutes les actions effectuees</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 animate-fade-in-up-delay-1">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{logs.length}</p>
            <p className="text-[11px] text-slate-500">Total entrees</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up-delay-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par reference, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Type d'action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes actions</SelectItem>
            {actionTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Horodatage</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Utilisateur</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Reference</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Action</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log, i) => (
                <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-xs font-mono text-slate-400">{log.horodatage}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[9px] font-bold text-blue-400">
                        {(log.utilisateur || "??").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-300">{log.utilisateur}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">{log.refClient}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                      log.typeAction === "CRÉATION"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : log.typeAction.includes("ERREUR")
                        ? "bg-red-500/15 text-red-400"
                        : "bg-blue-500/15 text-blue-400"
                    }`}>{log.typeAction}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 max-w-[350px] truncate">{log.details}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                    Aucune entree ne correspond aux filtres
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
