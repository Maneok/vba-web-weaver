import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Search, Plus, Eye, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import NewClientDialog from "@/components/NewClientDialog";
import type { Client } from "@/lib/types";

type SortKey = "raisonSociale" | "scoreGlobal" | "nivVigilance" | "etatPilotage" | "dateButoir" | "comptable";
type SortDir = "asc" | "desc";

export default function BddPage() {
  const { clients } = useAppState();
  const [search, setSearch] = useState("");
  const [filterVigilance, setFilterVigilance] = useState<string>("all");
  const [filterPilotage, setFilterPilotage] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("raisonSociale");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  const filtered = useMemo(() => {
    let result = clients.filter(c => {
      const matchSearch = !search ||
        c.raisonSociale.toLowerCase().includes(search.toLowerCase()) ||
        c.ref.toLowerCase().includes(search.toLowerCase()) ||
        c.siren.includes(search) ||
        c.dirigeant.toLowerCase().includes(search.toLowerCase());
      const matchVig = filterVigilance === "all" || c.nivVigilance === filterVigilance;
      const matchPil = filterPilotage === "all" || c.etatPilotage === filterPilotage;
      return matchSearch && matchVig && matchPil;
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
  }, [clients, search, filterVigilance, filterPilotage, sortKey, sortDir]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Base de Donnees Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} dossiers &middot; {filtered.length} affiches</p>
        </div>
        <Button onClick={() => setShowNewClient(true)} className="gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Nouveau Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up-delay-1">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par nom, SIREN, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20"
          />
        </div>
        <Select value={filterVigilance} onValueChange={setFilterVigilance}>
          <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.06]">
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
          <SelectTrigger className="w-[170px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Pilotage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous etats</SelectItem>
            <SelectItem value="A JOUR">A jour</SelectItem>
            <SelectItem value="RETARD">Retard</SelectItem>
            <SelectItem value="BIENTÔT">Bientot</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-[90px] text-slate-500 text-[11px] uppercase tracking-wider">Ref</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer" onClick={() => handleSort("raisonSociale")}>
                  <div className="flex items-center gap-1.5">Raison Sociale <SortIcon column="raisonSociale" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Forme</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer" onClick={() => handleSort("comptable")}>
                  <div className="flex items-center gap-1.5">Comptable <SortIcon column="comptable" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Mission</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider cursor-pointer text-center" onClick={() => handleSort("scoreGlobal")}>
                  <div className="flex items-center gap-1.5 justify-center">Score <SortIcon column="scoreGlobal" /></div>
                </TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Vigilance</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Pilotage</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center cursor-pointer" onClick={() => handleSort("dateButoir")}>
                  <div className="flex items-center gap-1.5 justify-center">Butoir <SortIcon column="dateButoir" /></div>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(client => (
                <TableRow
                  key={client.ref}
                  className="cursor-pointer border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  onClick={() => setSelectedClient(client)}
                >
                  <TableCell className="font-mono text-[11px] text-slate-500">{client.ref}</TableCell>
                  <TableCell className="font-medium text-sm text-slate-200">{client.raisonSociale}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.forme}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.comptable}</TableCell>
                  <TableCell className="text-xs text-slate-400">{client.mission}</TableCell>
                  <TableCell><ScoreGauge score={client.scoreGlobal} /></TableCell>
                  <TableCell className="text-center"><VigilanceBadge level={client.nivVigilance} /></TableCell>
                  <TableCell className="text-center"><PilotageBadge status={client.etatPilotage} /></TableCell>
                  <TableCell className="text-xs text-center text-slate-400 font-mono">{client.dateButoir}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10" onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                    Aucun client ne correspond aux filtres
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedClient && (
        <ClientDetailDialog client={selectedClient} open onClose={() => setSelectedClient(null)} />
      )}

      {showNewClient && (
        <NewClientDialog open onClose={() => setShowNewClient(false)} />
      )}
    </div>
  );
}
