import { useState } from "react";
import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VigilanceBadge, PilotageBadge, ScoreGauge } from "@/components/RiskBadges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Eye } from "lucide-react";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import NewClientDialog from "@/components/NewClientDialog";
import KycBadge from "@/components/KycBadge";
import type { Client } from "@/lib/types";

export default function BddPage() {
  const { clients } = useAppState();
  const [search, setSearch] = useState("");
  const [filterVigilance, setFilterVigilance] = useState<string>("all");
  const [filterPilotage, setFilterPilotage] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  const filtered = clients.filter(c => {
    const matchSearch = !search || 
      c.raisonSociale.toLowerCase().includes(search.toLowerCase()) ||
      c.ref.toLowerCase().includes(search.toLowerCase()) ||
      c.siren.includes(search) ||
      c.dirigeant.toLowerCase().includes(search.toLowerCase());
    const matchVig = filterVigilance === "all" || c.nivVigilance === filterVigilance;
    const matchPil = filterPilotage === "all" || c.etatPilotage === filterPilotage;
    return matchSearch && matchVig && matchPil;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📁 Base de Données Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} dossiers · {filtered.length} affichés</p>
        </div>
        <Button onClick={() => setShowNewClient(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouveau Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, SIREN, référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterVigilance} onValueChange={setFilterVigilance}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vigilance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes vigilances</SelectItem>
            <SelectItem value="SIMPLIFIEE">✅ Simplifiée</SelectItem>
            <SelectItem value="STANDARD">🟡 Standard</SelectItem>
            <SelectItem value="RENFORCEE">🔴 Renforcée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPilotage} onValueChange={setFilterPilotage}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Pilotage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous états</SelectItem>
            <SelectItem value="A JOUR">✅ A jour</SelectItem>
            <SelectItem value="RETARD">🔴 Retard</SelectItem>
            <SelectItem value="BIENTÔT">🟠 Bientôt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Réf</TableHead>
              <TableHead>Raison Sociale</TableHead>
              <TableHead>Forme</TableHead>
              <TableHead>Comptable</TableHead>
              <TableHead>Mission</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Vigilance</TableHead>
              <TableHead className="text-center">Pilotage</TableHead>
              <TableHead className="text-center">KYC</TableHead>
              <TableHead className="text-center">Butoir</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(client => (
              <TableRow key={client.ref} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedClient(client)}>
                <TableCell className="font-mono text-xs">{client.ref}</TableCell>
                <TableCell className="font-medium">{client.raisonSociale}</TableCell>
                <TableCell className="text-xs">{client.forme}</TableCell>
                <TableCell className="text-xs">{client.comptable}</TableCell>
                <TableCell className="text-xs">{client.mission}</TableCell>
                <TableCell><ScoreGauge score={client.scoreGlobal} /></TableCell>
                <TableCell className="text-center"><VigilanceBadge level={client.nivVigilance} /></TableCell>
                <TableCell className="text-center"><PilotageBadge status={client.etatPilotage} /></TableCell>
                <TableCell className="text-center"><KycBadge completeness={client.kycCompleteness ?? 0} size="sm" /></TableCell>
                <TableCell className="text-xs text-center">{client.dateButoir}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
