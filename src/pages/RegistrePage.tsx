import { useState } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";

const CATEGORIES = [
  "ADMIN : KYC Incomplet",
  "INTERNE : Erreur Procédure",
  "FLUX : Incohérence / Atypique",
  "SOUPCON : Tracfin potentiel",
  "EXTERNE : Gel des avoirs / Sanctions",
];
const ACTIONS = ["SOUPCON CARACTERISE", "DOUTE LEVE", "EN INVESTIGATION"];

export default function RegistrePage() {
  const { alertes, addAlerte, updateAlerte, clients } = useAppState();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [newAlerte, setNewAlerte] = useState({
    client: "", categorie: CATEGORIES[0], details: "",
    action: ACTIONS[0], responsable: "", dateEcheance: "",
  });

  const filtered = alertes.filter(a => {
    const matchSearch = !search || a.clientConcerne.toLowerCase().includes(search.toLowerCase()) || a.categorie.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === "all" || a.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const enCours = alertes.filter(a => a.statut === "EN COURS").length;

  const handleCreate = () => {
    addAlerte({
      date: new Date().toISOString().split("T")[0],
      clientConcerne: newAlerte.client,
      categorie: newAlerte.categorie,
      details: newAlerte.details,
      actionPrise: newAlerte.action,
      responsable: newAlerte.responsable,
      qualification: "",
      statut: "EN COURS",
      dateButoir: newAlerte.dateEcheance,
      typeDecision: "",
      validateur: "",
    });
    setShowNew(false);
    setNewAlerte({ client: "", categorie: CATEGORIES[0], details: "", action: ACTIONS[0], responsable: "", dateEcheance: "" });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registre LCB-FT</h1>
          <p className="text-sm text-muted-foreground mt-1">{alertes.length} alertes — {enCours} en cours</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="w-4 h-4" /> Nouvelle Alerte</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="EN COURS">En cours</SelectItem>
            <SelectItem value="CLÔTURÉ">Clôturé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-mono">{a.date}</TableCell>
                <TableCell className="font-medium text-sm">{a.clientConcerne}</TableCell>
                <TableCell className="text-xs">{a.categorie}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{a.details || "—"}</TableCell>
                <TableCell className="text-xs">{a.actionPrise}</TableCell>
                <TableCell className="text-xs">{a.responsable}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${a.statut === "CLÔTURÉ" ? "bg-risk-low/10 text-risk-low" : "bg-risk-medium/10 text-risk-medium"}`}>{a.statut}</span>
                </TableCell>
                <TableCell className="text-xs">{a.dateButoir}</TableCell>
                <TableCell>
                  {a.statut !== "CLÔTURÉ" && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateAlerte(i, { statut: "CLÔTURÉ" })}>Clôturer</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle Alerte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client concerné</Label>
              <Select value={newAlerte.client} onValueChange={v => setNewAlerte(p => ({ ...p, client: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.ref} value={`${c.raisonSociale} (${c.forme})`}>{c.ref} — {c.raisonSociale}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={newAlerte.categorie} onValueChange={v => setNewAlerte(p => ({ ...p, categorie: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Détails</Label><Input value={newAlerte.details} onChange={e => setNewAlerte(p => ({ ...p, details: e.target.value }))} /></div>
            <div>
              <Label>Action prise</Label>
              <Select value={newAlerte.action} onValueChange={v => setNewAlerte(p => ({ ...p, action: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsable</Label><Input value={newAlerte.responsable} onChange={e => setNewAlerte(p => ({ ...p, responsable: e.target.value }))} /></div>
              <div><Label>Date échéance</Label><Input type="date" value={newAlerte.dateEcheance} onChange={e => setNewAlerte(p => ({ ...p, dateEcheance: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!newAlerte.client}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
