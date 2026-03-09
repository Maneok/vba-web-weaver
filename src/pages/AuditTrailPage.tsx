import { useState, useEffect, useMemo, useCallback } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Shield, Loader2, Download, ChevronLeft, ChevronRight,
  Filter, X, ArrowUpDown, Eye, Calendar, User, Activity,
} from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  id: number;
  user_email: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CONNEXION: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DECONNEXION: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  CREATION: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MODIFICATION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SUPPRESSION: "bg-red-500/10 text-red-400 border-red-500/20",
  INVITATION_UTILISATEUR: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  CHANGEMENT_ROLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const PAGE_SIZE = 50;

function formatDateTimeFR(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return dateStr; }
}

function exportAuditCSV(entries: AuditRow[]) {
  const headers = ["ID", "Date/Heure", "Utilisateur", "Action", "Table", "ID Enregistrement", "Donnees"];
  const rows = entries.map(e => [
    String(e.id),
    formatDateTimeFR(e.created_at),
    e.user_email || "",
    e.action,
    e.table_name || "",
    e.record_id || "",
    e.new_data ? JSON.stringify(e.new_data).slice(0, 500) : "",
  ]);
  const csv = [headers.join(";"), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, "")}"`).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-trail-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderDiffView(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData && !newData) return <span className="text-slate-600">Aucune donnee</span>;

  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  const changes: { key: string; old: string; new_: string; changed: boolean }[] = [];

  for (const key of allKeys) {
    const oldVal = oldData?.[key] !== undefined ? String(oldData[key]) : "";
    const newVal = newData?.[key] !== undefined ? String(newData[key]) : "";
    if (oldVal !== newVal) {
      changes.push({ key, old: oldVal, new_: newVal, changed: true });
    } else {
      changes.push({ key, old: oldVal, new_: newVal, changed: false });
    }
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {changes.map(c => (
        <div key={c.key} className={`text-xs font-mono px-2 py-1 rounded ${c.changed ? "bg-amber-500/5" : ""}`}>
          <span className="text-slate-500">{c.key}: </span>
          {c.changed ? (
            <>
              <span className="text-red-400 line-through">{c.old || "(vide)"}</span>
              <span className="text-slate-600 mx-1">&rarr;</span>
              <span className="text-emerald-400">{c.new_ || "(vide)"}</span>
            </>
          ) : (
            <span className="text-slate-400">{c.new_}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditRow | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("audit_trail")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (!mounted) return;
        if (error) {
          logger.error("[AuditTrail] load error:", error);
          toast.error("Erreur lors du chargement du journal d'audit");
        } else if (data) {
          setEntries(data as AuditRow[]);
        }
      } catch (err) {
        if (mounted) {
          logger.error("[AuditTrail] exception:", err);
          toast.error("Erreur lors du chargement du journal d'audit");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Unique values for filters
  const uniqueActions = useMemo(() => Array.from(new Set(entries.map(e => e.action))).sort(), [entries]);
  const uniqueUsers = useMemo(() => Array.from(new Set(entries.map(e => e.user_email).filter(Boolean))).sort(), [entries]);

  // Stats
  const stats = useMemo(() => {
    const now = Date.now();
    const last24h = entries.filter(e => { const t = new Date(e.created_at).getTime(); return !isNaN(t) && (now - t) < 86400000; }).length;
    const last7d = entries.filter(e => { const t = new Date(e.created_at).getTime(); return !isNaN(t) && (now - t) < 7 * 86400000; }).length;
    const modifications = entries.filter(e => e.action === "MODIFICATION").length;
    const connexions = entries.filter(e => e.action === "CONNEXION").length;
    return { total: entries.length, last24h, last7d, modifications, connexions };
  }, [entries]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = entries.filter(e => {
      const matchSearch = !search ||
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        e.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        e.table_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.record_id?.toLowerCase().includes(search.toLowerCase());
      const matchAction = filterAction === "all" || e.action === filterAction;
      const matchUser = filterUser === "all" || e.user_email === filterUser;
      const dateStr = e.created_at.split("T")[0];
      const matchDateStart = !dateStart || dateStr >= dateStart;
      const matchDateEnd = !dateEnd || dateStr <= dateEnd;
      return matchSearch && matchAction && matchUser && matchDateStart && matchDateEnd;
    });

    if (sortDir === "asc") result = [...result].reverse();

    return result;
  }, [entries, search, filterAction, filterUser, dateStart, dateEnd, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = search || filterAction !== "all" || filterUser !== "all" || dateStart || dateEnd;

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterAction("all");
    setFilterUser("all");
    setDateStart("");
    setDateEnd("");
    setCurrentPage(1);
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Piste d'Audit
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Journal inalterable de toutes les actions — conforme aux exigences reglementaires
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-2.5 flex items-center gap-2 text-xs text-red-400 font-medium">
              <Shield className="w-3.5 h-3.5" />
              Tamper-proof : aucune modification possible
            </CardContent>
          </Card>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/[0.06] text-slate-400"
            onClick={() => {
              exportAuditCSV(filtered);
              toast.success(`${filtered.length} entrees exportees en CSV`);
            }}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up">
        {[
          { label: "Total entrees", value: stats.total, color: "text-blue-400", icon: Activity },
          { label: "Dernières 24h", value: stats.last24h, color: "text-emerald-400", icon: Calendar },
          { label: "7 derniers jours", value: stats.last7d, color: "text-purple-400", icon: Calendar },
          { label: "Modifications", value: stats.modifications, color: "text-amber-400", icon: Activity },
          { label: "Connexions", value: stats.connexions, color: "text-slate-400", icon: User },
        ].map(s => (
          <div key={s.label} className="glass-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 animate-fade-in-up">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par action, email, table..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[170px] bg-white/[0.03] border-white/[0.06] text-slate-300">
            <SelectValue placeholder="Type d'action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={v => { setFilterUser(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[200px] bg-white/[0.03] border-white/[0.06] text-slate-300">
            <SelectValue placeholder="Utilisateur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous utilisateurs</SelectItem>
            {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setCurrentPage(1); }} className="w-[140px] bg-white/[0.03] border-white/[0.06] text-slate-300" />
        <Input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setCurrentPage(1); }} className="w-[140px] bg-white/[0.03] border-white/[0.06] text-slate-300" />
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400" onClick={clearFilters}>
            <X className="w-3 h-3 mr-1" /> Effacer
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider w-[50px]">#</TableHead>
                  <TableHead
                    className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                  >
                    <span className="flex items-center gap-1">
                      Date/Heure
                      <ArrowUpDown className={`w-3 h-3 ${sortDir ? "text-blue-400" : "text-slate-600"}`} />
                    </span>
                  </TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Utilisateur</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Action</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Table</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">ID</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Details</TableHead>
                  <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((entry) => (
                  <TableRow key={entry.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-xs font-mono text-slate-600">{entry.id}</TableCell>
                    <TableCell className="text-xs font-mono text-slate-400 whitespace-nowrap">
                      {formatDateTimeFR(entry.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">{entry.user_email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ACTION_COLORS[entry.action] || "bg-slate-500/10 text-slate-400 border-slate-500/20"}
                      >
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">{entry.table_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">{entry.record_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[250px]">
                      <span className="block truncate text-slate-500">
                        {entry.new_data ? JSON.stringify(entry.new_data).slice(0, 80) : "—"}
                        {entry.new_data && JSON.stringify(entry.new_data).length > 80 ? "..." : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-400"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-12">
                      {hasFilters ? (
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="w-6 h-6 text-slate-600" />
                          <p className="text-sm">Aucune entree ne correspond aux filtres</p>
                          <Button variant="ghost" size="sm" className="text-xs text-blue-400" onClick={clearFilters}>
                            Effacer les filtres
                          </Button>
                        </div>
                      ) : (
                        "Aucune entree dans le journal d'audit"
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {filtered.length} entree{filtered.length > 1 ? "s" : ""}
                {filtered.length !== entries.length && ` sur ${entries.length}`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-white/[0.08] text-slate-300"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-400">{safePage} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-white/[0.08] text-slate-300"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/[0.08] text-slate-100 max-h-[90vh] overflow-y-auto">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-100">
                  <Eye className="w-5 h-5 text-blue-400" />
                  Detail de l'entree #{selectedEntry.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Date / Heure</p>
                    <p className="text-sm text-slate-300 font-mono">{formatDateTimeFR(selectedEntry.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Utilisateur</p>
                    <p className="text-sm text-slate-300">{selectedEntry.user_email}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Action</p>
                    <Badge className={ACTION_COLORS[selectedEntry.action] || "bg-slate-500/10 text-slate-400"}>
                      {selectedEntry.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Table</p>
                    <p className="text-sm text-slate-300 font-mono">{selectedEntry.table_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">ID Enregistrement</p>
                    <p className="text-sm text-slate-300 font-mono">{selectedEntry.record_id || "—"}</p>
                  </div>
                  {selectedEntry.user_agent && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">User Agent</p>
                      <p className="text-xs text-slate-500 truncate">{selectedEntry.user_agent}</p>
                    </div>
                  )}
                </div>

                {/* Diff view for modifications */}
                {selectedEntry.action === "MODIFICATION" && (selectedEntry.old_data || selectedEntry.new_data) && (
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Modifications</p>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      {renderDiffView(selectedEntry.old_data, selectedEntry.new_data)}
                    </div>
                  </div>
                )}

                {/* Raw data for non-modifications */}
                {selectedEntry.action !== "MODIFICATION" && selectedEntry.new_data && (
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Donnees</p>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 max-h-[300px] overflow-y-auto">
                      <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedEntry.new_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
