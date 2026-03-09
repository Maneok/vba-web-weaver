import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Copy, RefreshCw, Search, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";

export interface LettreMissionRecord {
  id: string;
  numero: string;
  clientName: string;
  date: string;
  missions: string[];
  statut: "Brouillon" | "Genere" | "Envoye" | "Signe";
}

const STORAGE_KEY = "lcb-lettre-mission-history";

function loadHistory(): LettreMissionRecord[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [
    { id: "lm-1", numero: "LM-2026-001", clientName: "SCI Horizon", date: "2026-01-15", missions: ["Tenue comptable", "Social"], statut: "Signe" },
    { id: "lm-2", numero: "LM-2026-002", clientName: "SARL Tech Solutions", date: "2026-02-03", missions: ["Revision", "Juridique"], statut: "Envoye" },
    { id: "lm-3", numero: "LM-2026-003", clientName: "SAS GreenBio", date: "2026-02-28", missions: ["Tenue comptable"], statut: "Genere" },
    { id: "lm-4", numero: "LM-2026-004", clientName: "EURL Dupont Services", date: "2026-03-05", missions: ["Tenue comptable", "Social", "Juridique"], statut: "Brouillon" },
    { id: "lm-5", numero: "LM-2026-005", clientName: "SA Constructo", date: "2026-03-07", missions: ["Revision", "Controle fiscal"], statut: "Brouillon" },
  ];
}

const STATUT_STYLES: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  Brouillon: { variant: "secondary", className: "" },
  Genere: { variant: "outline", className: "border-blue-500/30 text-blue-400" },
  Envoye: { variant: "outline", className: "border-amber-500/30 text-amber-400" },
  Signe: { variant: "default", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

export default function LettreMissionHistory() {
  const [records, setRecords] = useState<LettreMissionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [dateFrom, setDateFrom] = useState("");

  useEffect(() => {
    setRecords(loadHistory());
  }, []);

  const filtered = records.filter((r) => {
    const matchSearch =
      !search ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.numero.toLowerCase().includes(search.toLowerCase());
    const matchStatut = statutFilter === "Tous" || r.statut === statutFilter;
    const matchDate = !dateFrom || r.date >= dateFrom;
    return matchSearch && matchStatut && matchDate;
  });

  const handleDuplicate = (record: LettreMissionRecord) => {
    const dup: LettreMissionRecord = {
      ...record,
      id: `lm-${Date.now()}`,
      numero: `LM-${new Date().getFullYear()}-${String(records.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      statut: "Brouillon",
    };
    const updated = [...records, dup];
    setRecords(updated);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Lettre dupliquee en brouillon");
  };

  const handleRegenerate = (record: LettreMissionRecord) => {
    toast.info(`Re-generation de ${record.numero} en cours...`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Historique des lettres de mission</h2>
        <Badge variant="secondary" className="gap-1">
          <FileText className="h-3 w-3" />
          {filtered.length} lettre(s)
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par client ou numero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-card/80 backdrop-blur border-white/10"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[150px] bg-card/80 backdrop-blur border-white/10">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tous">Tous les statuts</SelectItem>
            <SelectItem value="Brouillon">Brouillon</SelectItem>
            <SelectItem value="Genere">Genere</SelectItem>
            <SelectItem value="Envoye">Envoye</SelectItem>
            <SelectItem value="Signe">Signe</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="pl-8 w-[160px] bg-card/80 backdrop-blur border-white/10"
            placeholder="Depuis..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden bg-card/60 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-xs">N° Lettre</TableHead>
              <TableHead className="text-xs">Client</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Missions incluses</TableHead>
              <TableHead className="text-xs">Statut</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((record) => {
              const style = STATUT_STYLES[record.statut];
              return (
                <TableRow key={record.id} className="border-white/[0.04]">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400/60" />
                      <span className="font-mono text-xs">{record.numero}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{record.clientName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(record.date).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {record.missions.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-white/10">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={style.variant} className={style.className}>
                      {record.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir PDF">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Dupliquer"
                        onClick={() => handleDuplicate(record)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Re-generer"
                        onClick={() => handleRegenerate(record)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucune lettre de mission trouvee
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
