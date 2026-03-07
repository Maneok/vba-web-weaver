import { useState, useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, CheckCircle2, AlertCircle, Key, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function GouvernancePage() {
  const { collaborateurs } = useAppState();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const formesOk = collaborateurs.filter(c => c.statutFormation.includes("A JOUR")).length;
  const formesKo = collaborateurs.filter(c => c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")).length;

  const filtered = useMemo(() => {
    if (!search) return collaborateurs;
    return collaborateurs.filter(c =>
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.fonction.toLowerCase().includes(search.toLowerCase())
    );
  }, [collaborateurs, search]);

  const handleRelance = (collab: typeof collaborateurs[0]) => {
    if (!collab.email) {
      toast.error(`Email manquant pour ${collab.nom}`);
      return;
    }
    const subject = encodeURIComponent(`Relance formation LCB-FT — ${collab.nom} — Formation expiree depuis ${collab.derniereFormation || "N/A"}`);
    const body = encodeURIComponent(
      `Bonjour ${collab.nom},\n\nVotre formation LCB-FT est expiree (derniere formation : ${collab.derniereFormation || "aucune"}).\n\nConformement aux obligations reglementaires (art. L.561-36 CMF), nous vous invitons a regulariser votre situation dans les meilleurs delais.\n\nCordialement,\nLe Referent LCB-FT`
    );
    window.open(`mailto:${collab.email}?subject=${subject}&body=${body}`, "_self");
    toast.success(`Email de relance ouvert pour ${collab.nom}`);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-xl font-bold text-white">Gouvernance LCB-FT</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi de l'equipe et des formations obligatoires</p>
        </div>
        <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="w-4 h-4" /> Ajouter collaborateur
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up-delay-1">
        <div className="glass-card p-5 kpi-glow-blue">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{collaborateurs.length}</p>
          <p className="text-[12px] text-slate-500 mt-1">Collaborateurs</p>
        </div>
        <div className="glass-card p-5 kpi-glow-green">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formesOk}</p>
          <p className="text-[12px] text-slate-500 mt-1">Formations a jour</p>
        </div>
        <div className="glass-card p-5 kpi-glow-red">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-400">{formesKo}</p>
          <p className="text-[12px] text-slate-500 mt-1">A former / relancer</p>
        </div>
      </div>

      {/* Search */}
      <div className="animate-fade-in-up-delay-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Rechercher un collaborateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-fade-in-up-delay-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Collaborateur</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Fonction</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Ref. LCB</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Suppleant</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Niveau</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Signature Manuel</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Derniere Formation</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider">Statut</TableHead>
                <TableHead className="text-slate-500 text-[11px] uppercase tracking-wider text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => (
                <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center text-[11px] font-bold text-blue-400">
                        {c.nom.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium text-sm text-slate-200">{c.nom}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{c.fonction}</TableCell>
                  <TableCell className="text-center">
                    {c.referentLcb && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        <Key className="w-3 h-3" /> REF
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{c.suppleant}</TableCell>
                  <TableCell className="text-xs text-slate-400">{c.niveauCompetence}</TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{c.dateSignatureManuel}</TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{c.derniereFormation || "---"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                      c.statutFormation.includes("A JOUR")
                        ? "bg-emerald-500/15 text-emerald-400"
                        : c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {c.statutFormation}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {(c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400"
                        onClick={() => handleRelance(c)}
                      >
                        <Mail className="w-3 h-3" /> Relancer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add collaborator dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[hsl(217,33%,14%)] border-white/[0.06]">
          <DialogHeader>
            <DialogTitle className="text-white">Ajouter un collaborateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-slate-400">Nom</Label><Input className="bg-white/[0.03] border-white/[0.06]" placeholder="NOM Prenom" /></div>
            <div>
              <Label className="text-xs text-slate-400">Fonction</Label>
              <Select defaultValue="COLLABORATEUR">
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSOCIE SIGNATAIRE">Associe signataire</SelectItem>
                  <SelectItem value="SUPERVISEUR">Superviseur</SelectItem>
                  <SelectItem value="COLLABORATEUR">Collaborateur</SelectItem>
                  <SelectItem value="STAGIAIRE">Stagiaire</SelectItem>
                  <SelectItem value="ALTERNANT">Alternant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-slate-400">Email</Label><Input className="bg-white/[0.03] border-white/[0.06]" placeholder="email@cabinet.fr" /></div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => { setShowAddDialog(false); toast.success("Collaborateur ajoute"); }}>
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
