import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { downloadCSV } from "@/lib/csvUtils";
import { useDebounce } from "@/hooks/useDebounce";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Search, Eye, ArrowUpDown, ChevronDown, ChevronUp, UserPlus, MoreHorizontal, Edit3, FileDown, Archive, Download, Clock, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight, X, DatabaseZap, RefreshCw } from "lucide-react";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { toast } from "sonner";
import type { Client } from "@/lib/types";

const PAGE_SIZE = 25;

/** Calculate KYC completion percentage based on key fields */
function computeKycPercent(client: Client): number {
  let s = 0;
  if (client.siren) s += 25;
  if (client.mail) s += 25;
  if (client.iban) s += 25;
  if (client.adresse) s += 25;
  return s;
}

interface DraftInfo {
  siren: string;
  raisonSociale: string;
  step: number;
  savedAt: number;
  key: string;
}

type SortKey = "raisonSociale" | "scoreGlobal" | "nivVigilance" | "etatPilotage" | "dateButoir" | "comptable";
type SortDir = "asc" | "desc";

export default function BddPage() {
  const { clients, updateClient, deleteClient, isLoading, refreshClients } = useAppState();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 7. Persist search/filter state to URL search params
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filterVigilance, setFilterVigilance] = useState<string>(searchParams.get("vigilance") || "all");
  const [filterPilotage, setFilterPilotage] = useState<string>(searchParams.get("pilotage") || "all");
  const [filterEtat, setFilterEtat] = useState<string>(searchParams.get("etat") || "all");
  const [sortKey, setSortKey] = useState<SortKey>("raisonSociale");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; ref: string; name: string } | { type: "bulk"; refs: string[] } | null>(null);
  const debouncedSearch = useDebounce(search, 250);

  useDocumentTitle("Base Clients");

  // 7. Sync filter state to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (filterVigilance !== "all") params.vigilance = filterVigilance;
    if (filterPilotage !== "all") params.pilotage = filterPilotage;
    if (filterEtat !== "all") params.etat = filterEtat;
    setSearchParams(params, { replace: true });
  }, [search, filterVigilance, filterPilotage, filterEtat, setSearchParams]);

  // 5. Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (filterVigilance !== "all") count++;
    if (filterPilotage !== "all") count++;
    if (filterEtat !== "all") count++;
    return count;
  }, [debouncedSearch, filterVigilance, filterPilotage, filterEtat]);

  // 2. Clear all filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterVigilance("all");
    setFilterPilotage("all");
    setFilterEtat("all");
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // 10. Keyboard shortcut: press 'n' to navigate to /nouveau-client
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        navigate("/nouveau-client");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // FIX 2: Scan localStorage for drafts
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  useEffect(() => {
    const found: DraftInfo[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("draft_nc_")) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || "");
          if (data.form?.siren) {
            found.push({
              siren: data.form.siren,
              raisonSociale: data.form.raisonSociale || "",
              step: data.step || 0,
              savedAt: data.savedAt || 0,
              key,
            });
          }
        } catch {}
      }
    }
    // Also check the main draft
    try {
      const main = JSON.parse(sessionStorage.getItem("draft_nouveau_client") || "");
      if (main.form?.siren && !found.some(d => d.siren.replace(/\s/g, "") === main.form.siren.replace(/\s/g, ""))) {
        found.push({
          siren: main.form.siren,
          raisonSociale: main.form.raisonSociale || "",
          step: main.step || 0,
          savedAt: main.savedAt || 0,
          key: "draft_nouveau_client",
        });
      }
    } catch {}
    found.sort((a, b) => b.savedAt - a.savedAt);
    setDrafts(found);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // OPT: Aria-sort helper for WCAG 2.1 compliance
  const ariaSort = (col: SortKey) => sortKey === col ? (sortDir === "asc" ? "ascending" as const : "descending" as const) : undefined;

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  // Reset to page 0 and clear selectAllPages when filters change
  useEffect(() => { setPage(0); setSelectAllPages(false); }, [debouncedSearch, filterVigilance, filterPilotage, filterEtat]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const result = clients.filter(c => {
      const matchSearch = !q ||
        (c.raisonSociale || "").toLowerCase().includes(q) ||
        (c.ref || "").toLowerCase().includes(q) ||
        (c.siren || "").includes(debouncedSearch) ||
        (c.dirigeant || "").toLowerCase().includes(q) ||
        (c.comptable || "").toLowerCase().includes(q);
      const matchVig = filterVigilance === "all" || c.nivVigilance === filterVigilance;
      const matchPil = filterPilotage === "all" || c.etatPilotage === filterPilotage;
      const matchEtat = filterEtat === "all" ||
        (filterEtat === "ACTIF" && c.etat === "VALIDE") ||
        (filterEtat === "PROSPECT" && c.etat === "PROSPECT") ||
        (filterEtat === "ARCHIVE" && c.etat === "ARCHIVE");
      return matchSearch && matchVig && matchPil && matchEtat;
    });

    result.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [clients, debouncedSearch, filterVigilance, filterPilotage, filterEtat, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    const headers = ["Ref", "Raison Sociale", "SIREN", "Forme", "Mission", "Comptable", "Score", "Vigilance", "Pilotage", "KYC%", "Butoir"];
    const exportable = filtered.filter(c => !c.nonDiffusible);
    const excluded = filtered.length - exportable.length;
    const rows = exportable.map(c => [
      String(c.ref), c.raisonSociale, c.siren, c.forme, c.mission, c.comptable,
      String(c.scoreGlobal), c.nivVigilance, c.etatPilotage, `${computeKycPercent(c)}%`, c.dateButoir,
    ]);
    downloadCSV(headers, rows, "clients_lcb.csv");
    if (excluded > 0) {
      toast.warning(`Export CSV genere — ${excluded} client(s) non-diffusible(s) exclus (art. R.123-320 C.com)`);
    } else {
      toast.success("Export CSV genere");
    }
  };

  // 6. Loading skeleton instead of spinner
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 bg-white/[0.06]" />
            <Skeleton className="h-4 w-36 bg-white/[0.04]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 bg-white/[0.06]" />
            <Skeleton className="h-9 w-36 bg-white/[0.06]" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-10 flex-1 min-w-[220px] bg-white/[0.04]" />
          <Skeleton className="h-10 w-[180px] bg-white/[0.04]" />
          <Skeleton className="h-10 w-[170px] bg-white/[0.04]" />
          <Skeleton className="h-10 w-[150px] bg-white/[0.04]" />
        </div>
        <div className="glass-card overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 bg-white/[0.04]" />
                <Skeleton className="h-4 w-16 bg-white/[0.04]" />
                <Skeleton className="h-4 w-40 bg-white/[0.06]" />
                <Skeleton className="h-4 w-16 bg-white/[0.04]" />
                <Skeleton className="h-4 w-24 bg-white/[0.04]" />
                <Skeleton className="h-4 w-16 bg-white/[0.04]" />
                <Skeleton className="h-4 w-12 bg-white/[0.04]" />
                <Skeleton className="h-5 w-20 rounded-full bg-white/[0.04]" />
                <Skeleton className="h-5 w-16 rounded-full bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Base de Donnees Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} dossiers · {filtered.length} affiches</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={() => refreshClients()} title="Rafraichir la liste">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/nouveau-client")}>
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau client</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center animate-fade-in-up-delay-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un client"
            className="pl-9 pr-24 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20"
          />
          {debouncedSearch && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full" aria-live="polite" aria-atomic="true">
              {filtered.length} resultat{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Select value={filterVigilance} onValueChange={setFilterVigilance}>
          <SelectTrigger className="w-full sm:w-[160px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Vigilance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes vigilances</SelectItem>
            <SelectItem value="SIMPLIFIEE">Simplifiee</SelectItem>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="RENFORCEE">Renforcee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPilotage} onValueChange={setFilterPilotage}>
          <SelectTrigger className="w-full sm:w-[150px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Pilotage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous etats</SelectItem>
            <SelectItem value="A JOUR">A jour</SelectItem>
            <SelectItem value="RETARD">Retard</SelectItem>
            <SelectItem value="BIENTÔT">Bientot</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEtat} onValueChange={setFilterEtat}>
          <SelectTrigger className="w-full sm:w-[130px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Etat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="ACTIF">Actif</SelectItem>
            <SelectItem value="PROSPECT">Prospect</SelectItem>
            <SelectItem value="ARCHIVE">Archive</SelectItem>
          </SelectContent>
        </Select>
        {/* 5. Active filter count badge */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-xs">
            {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}
          </Badge>
        )}
        {/* 2. Clear filters button */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <X className="w-3 h-3" /> Effacer filtres
          </Button>
        )}
      </div>

      {/* FIX 2: Brouillons section */}
      {drafts.length > 0 && (
        <div className="glass-card p-4 animate-fade-in-up-delay-1">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-300">Brouillons ({drafts.length})</h3>
          </div>
          <div className="space-y-2">
            {drafts.map(draft => (
              <div key={draft.key} className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-sm text-slate-200 font-medium">{draft.raisonSociale || "Sans nom"}</span>
                    <span className="text-xs text-slate-500 ml-2 font-mono">{draft.siren}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Etape {draft.step + 1}/6 · {draft.savedAt ? (() => {
                      const diff = Date.now() - draft.savedAt;
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "a l'instant";
                      if (mins < 60) return `il y a ${mins} min`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `il y a ${hours}h`;
                      return `il y a ${Math.floor(hours / 24)}j`;
                    })() : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1 text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate("/nouveau-client")}
                  >
                    Reprendre
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                    onClick={() => {
                      sessionStorage.removeItem(draft.key);
                      // Also remove main draft if it matches this SIREN
                      const mainDraft = sessionStorage.getItem("draft_nouveau_client");
                      if (mainDraft) {
                        try {
                          const md = JSON.parse(mainDraft);
                          if (md.form?.siren?.replace(/\s/g, "") === draft.siren.replace(/\s/g, "")) {
                            sessionStorage.removeItem("draft_nouveau_client");
                          }
                        } catch { /* JSON parse error — ignore stale draft */ }
                      }
                      setDrafts(prev => prev.filter(d => d.key !== draft.key));
                      toast.success("Brouillon supprime");
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedRefs.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-fade-in-up">
          <span className="text-sm text-blue-200 font-medium">{selectedRefs.size} selectionne{selectedRefs.size > 1 ? "s" : ""}</span>
          {/* 12. Select all across pages */}
          {!selectAllPages && filtered.length > paginated.length && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-blue-300 hover:text-blue-200"
              onClick={() => {
                const next = new Set(selectedRefs);
                filtered.forEach(c => next.add(c.ref));
                setSelectedRefs(next);
                setSelectAllPages(true);
              }}
            >
              Selectionner les {filtered.length} resultats
            </Button>
          )}
          {selectAllPages && (
            <span className="text-xs text-blue-400">Tous les {filtered.length} resultats selectionnes</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            onClick={() => {
              // 15. Confirmation toast with undo for archive action
              try {
                const validRefs = [...selectedRefs].filter(ref => clients.some(c => c.ref === ref));
                if (validRefs.length === 0) return;
                const refsToArchive = new Set(validRefs);
                const previousStates = new Map<string, string>();
                refsToArchive.forEach(ref => {
                  const client = clients.find(c => c.ref === ref);
                  if (client) previousStates.set(ref, client.etat);
                });
                refsToArchive.forEach(ref => updateClient(ref, { etat: "ARCHIVE" }));
                setSelectedRefs(new Set());
                setSelectAllPages(false);
                toast.success(`${refsToArchive.size} client(s) archive(s)`, {
                  action: {
                    label: "Annuler",
                    onClick: () => {
                      previousStates.forEach((etat, ref) => updateClient(ref, { etat: etat as Client["etat"] }));
                      toast.info("Archivage annule");
                    },
                  },
                });
              } catch (err) {
                toast.error("Erreur lors de l'archivage des clients");
              }
            }}
          >
            <Archive className="w-3 h-3" /> Archiver
          </Button>
          {profile?.role === "ADMIN" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10"
              onClick={() => {
                const validRefs = [...selectedRefs].filter(ref => clients.some(c => c.ref === ref));
                if (validRefs.length === 0) return;
                setDeleteTarget({ type: "bulk", refs: validRefs });
              }}
            >
              <Trash2 className="w-3 h-3" /> Supprimer
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => { setSelectedRefs(new Set()); setSelectAllPages(false); }}>
            Deselectionner
          </Button>
        </div>
      )}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2 animate-fade-in-up-delay-2">
        {filtered.length === 0 ? (
          <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
            <DatabaseZap className="w-10 h-10 text-slate-600" />
            <p className="text-sm text-slate-400 font-medium">Aucun client ne correspond aux filtres</p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1 text-xs border-white/[0.08]">
                <X className="w-3 h-3" /> Effacer les filtres
              </Button>
            )}
          </div>
        ) : (
          paginated.map((client) => (
            <div
              key={client.ref}
              className="glass-card p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
              onClick={() => navigate(`/client/${client.ref}`)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-slate-500">{client.ref}</span>
                  <VigilanceBadge level={client.nivVigilance} />
                </div>
                <p className="font-medium text-sm text-slate-200 truncate">{client.raisonSociale}</p>
                <p className="text-xs text-slate-500 mt-0.5">{client.forme} · {client.mission}</p>
                <div className="flex items-center gap-3 mt-2">
                  <PilotageBadge status={client.etatPilotage} />
                  <span className="text-xs text-slate-500 font-mono">{client.dateButoir}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <ScoreGauge score={client.scoreGlobal} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0" aria-label="Actions">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/client/${client.ref}`); }}>
                      <Eye className="w-3.5 h-3.5 mr-2" /> Voir detail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); try { generateFicheAcceptation(client); toast.success("PDF genere"); } catch { toast.error("Erreur PDF"); } }}>
                      <FileDown className="w-3.5 h-3.5 mr-2" /> Generer PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-2">
            <p className="text-xs text-slate-500">{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs text-slate-400 px-2">{page + 1} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0"><ChevronRightIcon className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Table (desktop) */}
      <div className="hidden sm:block glass-card overflow-hidden animate-fade-in-up-delay-2">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
          <Table>
            {/* 14. Sticky table header */}
            <TableHeader className="sticky top-0 z-10 bg-[#0f1117] backdrop-blur-sm">
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-white/5"
                    checked={paginated.length > 0 && paginated.every(c => selectedRefs.has(c.ref))}
                    onChange={(e) => {
                      const next = new Set(selectedRefs);
                      paginated.forEach(c => e.target.checked ? next.add(c.ref) : next.delete(c.ref));
                      setSelectedRefs(next);
                    }}
                    aria-label="Selectionner tous les clients de la page"
                  />
                </TableHead>
                <TableHead className="w-[90px] text-slate-500 text-[11px] uppercase tracking-wider">Ref</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer" onClick={() => handleSort("raisonSociale")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("raisonSociale"); } }} role="columnheader" tabIndex={0} aria-label="Trier par Raison Sociale" aria-sort={ariaSort("raisonSociale")}>
                  <div className="flex items-center gap-1.5">Raison Sociale <SortIcon column="raisonSociale" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Forme</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer" onClick={() => handleSort("comptable")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("comptable"); } }} role="columnheader" tabIndex={0} aria-label="Trier par Comptable" aria-sort={ariaSort("comptable")}>
                  <div className="flex items-center gap-1.5">Comptable <SortIcon column="comptable" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Mission</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer text-center" onClick={() => handleSort("scoreGlobal")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("scoreGlobal"); } }} role="columnheader" tabIndex={0} aria-label="Trier par Score" aria-sort={ariaSort("scoreGlobal")}>
                  <div className="flex items-center gap-1.5 justify-center">Score <SortIcon column="scoreGlobal" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Vigilance</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Pilotage</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">KYC</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center cursor-pointer" onClick={() => handleSort("dateButoir")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("dateButoir"); } }} role="columnheader" tabIndex={0} aria-label="Trier par Butoir" aria-sort={ariaSort("dateButoir")}>
                  <div className="flex items-center gap-1.5 justify-center">Butoir <SortIcon column="dateButoir" /></div>
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((client, idx) => (
                <TableRow
                  key={client.ref}
                  className={`cursor-pointer border-white/[0.04] transition-colors hover:bg-white/[0.03] hover:border-l-2 hover:border-l-blue-500 ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                  onClick={() => navigate(`/client/${client.ref}`)}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-white/20 bg-white/5"
                      checked={selectedRefs.has(client.ref)}
                      onChange={(e) => {
                        const next = new Set(selectedRefs);
                        e.target.checked ? next.add(client.ref) : next.delete(client.ref);
                        setSelectedRefs(next);
                        if (selectAllPages && !e.target.checked) setSelectAllPages(false);
                      }}
                      aria-label={`Selectionner ${client.raisonSociale}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-slate-500">{client.ref}</TableCell>
                  <TableCell className="font-medium text-sm text-slate-200">{client.raisonSociale}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.forme}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.comptable}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.mission}</TableCell>
                  <TableCell><ScoreGauge score={client.scoreGlobal} /></TableCell>
                  <TableCell className="text-center"><VigilanceBadge level={client.nivVigilance} /></TableCell>
                  <TableCell className="text-center"><PilotageBadge status={client.etatPilotage} /></TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const s = computeKycPercent(client);
                      const color = s >= 75 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
                      return <span className={`text-xs font-mono font-semibold ${color}`}>{s}%</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-center text-slate-400 font-mono">{client.dateButoir}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 h-8 w-8 p-0" aria-label="Actions">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/client/${client.ref}`); }}>
                          <Eye className="w-3.5 h-3.5 mr-2" /> Voir detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/client/${client.ref}`); }}>
                          <Edit3 className="w-3.5 h-3.5 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); try { generateFicheAcceptation(client); toast.success("PDF genere"); } catch (err) { toast.error("Erreur lors de la generation du PDF"); } }}>
                          <FileDown className="w-3.5 h-3.5 mr-2" /> Generer PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          const prevEtat = client.etat;
                          updateClient(client.ref, { etat: "ARCHIVE" });
                          toast.success("Client archive", {
                            action: {
                              label: "Annuler",
                              onClick: () => {
                                updateClient(client.ref, { etat: prevEtat });
                                toast.info("Archivage annule");
                              },
                            },
                          });
                        }}>
                          <Archive className="w-3.5 h-3.5 mr-2" /> Archiver
                        </DropdownMenuItem>
                        {profile?.role === "ADMIN" && (
                          <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-500/10" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "single", ref: client.ref, name: client.raisonSociale || client.ref }); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {/* 3. Better empty state */}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <DatabaseZap className="w-10 h-10 text-slate-600" />
                      <p className="text-sm text-slate-400 font-medium">Aucun client ne correspond aux filtres</p>
                      <p className="text-xs text-slate-600">Essayez de modifier vos criteres de recherche ou d'effacer les filtres</p>
                      {activeFilterCount > 0 && (
                        <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 gap-1 text-xs border-white/[0.08]">
                          <X className="w-3 h-3" /> Effacer les filtres
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </p>
            {/* 13. Pagination with first/last page buttons */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8 p-0" title="Premiere page" aria-label="Premiere page">
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0" title="Page precedente" aria-label="Page precedente">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-blue-600" : ""}`}
                  >
                    {p + 1}
                  </Button>
                );
              })}
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0" title="Page suivante" aria-label="Page suivante">
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-8 w-8 p-0" title="Derniere page" aria-label="Derniere page">
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Confirmer la suppression</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "single"
                ? `Etes-vous sur de vouloir supprimer definitivement "${deleteTarget.name}" ? Cette action est irreversible.`
                : `Etes-vous sur de vouloir supprimer definitivement ${deleteTarget?.refs.length} client(s) ? Cette action est irreversible.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => {
              if (!deleteTarget) return;
              try {
                if (deleteTarget.type === "single") {
                  deleteClient(deleteTarget.ref);
                  toast.success("Client supprime");
                } else {
                  deleteTarget.refs.forEach(ref => deleteClient(ref));
                  setSelectedRefs(new Set());
                  setSelectAllPages(false);
                  toast.success(`${deleteTarget.refs.length} clients supprimes`);
                }
              } catch {
                toast.error("Erreur lors de la suppression");
              }
              setDeleteTarget(null);
            }}>
              <Trash2 className="w-4 h-4 mr-2" /> Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
