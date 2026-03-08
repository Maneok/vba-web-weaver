import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Search, Eye, ArrowUpDown, ChevronDown, ChevronUp, UserPlus, MoreHorizontal, Edit3, FileDown, Archive, Download, Clock, Trash2 } from "lucide-react";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { toast } from "sonner";
import type { Client } from "@/lib/types";

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
  const { clients, updateClient, deleteClient, isLoading } = useAppState();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterVigilance, setFilterVigilance] = useState<string>("all");
  const [filterPilotage, setFilterPilotage] = useState<string>("all");
  const [filterEtat, setFilterEtat] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("raisonSociale");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // FIX 2: Scan localStorage for drafts
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  useEffect(() => {
    const found: DraftInfo[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("draft_nc_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "");
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
      const main = JSON.parse(localStorage.getItem("draft_nouveau_client") || "");
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

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  const filtered = useMemo(() => {
    const result = clients.filter(c => {
      const matchSearch = !search ||
        c.raisonSociale.toLowerCase().includes(search.toLowerCase()) ||
        c.ref.toLowerCase().includes(search.toLowerCase()) ||
        c.siren.includes(search) ||
        c.dirigeant.toLowerCase().includes(search.toLowerCase()) ||
        c.comptable.toLowerCase().includes(search.toLowerCase());
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
  }, [clients, search, filterVigilance, filterPilotage, filterEtat, sortKey, sortDir]);

  const handleExportCSV = () => {
    const headers = ["Ref", "Raison Sociale", "SIREN", "Forme", "Mission", "Comptable", "Score", "Vigilance", "Pilotage", "KYC%", "Butoir"];
    // CORRECTION 6: Exclude non-diffusible clients from CSV export
    const exportable = filtered.filter(c => !c.nonDiffusible);
    const excluded = filtered.length - exportable.length;
    const rows = exportable.map(c => {
      let kyc = 0;
      if (c.siren) kyc += 25;
      if (c.mail) kyc += 25;
      if (c.iban) kyc += 25;
      if (c.adresse) kyc += 25;
      return [c.ref, c.raisonSociale, c.siren, c.forme, c.mission, c.comptable, c.scoreGlobal, c.nivVigilance, c.etatPilotage, `${kyc}%`, c.dateButoir];
    });
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_lcb.csv";
    a.click();
    URL.revokeObjectURL(url);
    if (excluded > 0) {
      toast.warning(`Export CSV genere — ${excluded} client(s) non-diffusible(s) exclus (art. R.123-320 C.com)`);
    } else {
      toast.success("Export CSV genere");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Chargement des clients...</p>
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-white/[0.06]" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/nouveau-client")}>
            <UserPlus className="w-4 h-4" /> Nouveau client
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up-delay-1">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher par nom, SIREN, reference, comptable..."
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
        <Select value={filterEtat} onValueChange={setFilterEtat}>
          <SelectTrigger className="w-[150px] bg-white/[0.03] border-white/[0.06]">
            <SelectValue placeholder="Etat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="ACTIF">Actif</SelectItem>
            <SelectItem value="PROSPECT">Prospect</SelectItem>
            <SelectItem value="ARCHIVE">Archive</SelectItem>
          </SelectContent>
        </Select>
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
                      localStorage.removeItem(draft.key);
                      if (draft.key !== "draft_nouveau_client") localStorage.removeItem("draft_nouveau_client");
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
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">KYC</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center cursor-pointer" onClick={() => handleSort("dateButoir")}>
                  <div className="flex items-center gap-1.5 justify-center">Butoir <SortIcon column="dateButoir" /></div>
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(client => (
                <TableRow
                  key={client.ref}
                  className="cursor-pointer border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  onClick={() => navigate(`/client/${client.ref}`)}
                >
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
                      let s = 0;
                      if (client.siren) s += 25;
                      if (client.mail) s += 25;
                      if (client.iban) s += 25;
                      if (client.adresse) s += 25;
                      const color = s >= 75 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
                      return <span className={`text-xs font-mono font-semibold ${color}`}>{s}%</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-center text-slate-400 font-mono">{client.dateButoir}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 h-8 w-8 p-0">
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateFicheAcceptation(client); toast.success("PDF genere"); }}>
                          <FileDown className="w-3.5 h-3.5 mr-2" /> Generer PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateClient(client.ref, { etat: "ARCHIVE" }); toast.success("Client archive"); }}>
                          <Archive className="w-3.5 h-3.5 mr-2" /> Archiver
                        </DropdownMenuItem>
                        {profile?.role === "ADMIN" && (
                          <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-500/10" onClick={(e) => { e.stopPropagation(); if (confirm("Supprimer definitivement ce client ?")) { deleteClient(client.ref); toast.success("Client supprime"); } }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-slate-500">
                    Aucun client ne correspond aux filtres
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
