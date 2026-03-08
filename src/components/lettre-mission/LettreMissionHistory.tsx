import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Copy, Send, Search, FileText } from "lucide-react";

export interface LettreMissionRecord {
  id: string;
  numero: string;
  clientName: string;
  date: string;
  templateName: string;
  statut: "Brouillon" | "Envoyee" | "Signee";
}

const STORAGE_KEY = "lcb-lettre-mission-history";

function loadHistory(): LettreMissionRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [
    { id: "lm-1", numero: "LM-2026-001", clientName: "SCI Horizon", date: "2026-01-15", templateName: "Mission Immobilier", statut: "Signee" },
    { id: "lm-2", numero: "LM-2026-002", clientName: "SARL Tech Solutions", date: "2026-02-03", templateName: "Standard Cabinet", statut: "Envoyee" },
    { id: "lm-3", numero: "LM-2026-003", clientName: "SAS GreenBio", date: "2026-02-28", templateName: "Standard Cabinet", statut: "Brouillon" },
    { id: "lm-4", numero: "LM-2026-004", clientName: "EURL Dupont Services", date: "2026-03-05", templateName: "Mission Social", statut: "Brouillon" },
  ];
}

const STATUT_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  Brouillon: "secondary",
  Envoyee: "outline",
  Signee: "default",
};

export default function LettreMissionHistory() {
  const [records, setRecords] = useState<LettreMissionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");

  useEffect(() => {
    setRecords(loadHistory());
  }, []);

  const filtered = records.filter((r) => {
    const matchSearch =
      !search ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.numero.toLowerCase().includes(search.toLowerCase());
    const matchStatut = statutFilter === "Tous" || r.statut === statutFilter;
    return matchSearch && matchStatut;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Historique des lettres de mission</h2>
        <Badge variant="secondary">{filtered.length} lettre(s)</Badge>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par client ou numero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tous">Tous les statuts</SelectItem>
            <SelectItem value="Brouillon">Brouillon</SelectItem>
            <SelectItem value="Envoyee">Envoyee</SelectItem>
            <SelectItem value="Signee">Signee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Lettre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {record.numero}
                  </div>
                </TableCell>
                <TableCell>{record.clientName}</TableCell>
                <TableCell>{new Date(record.date).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{record.templateName}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUT_COLORS[record.statut]}>{record.statut}</Badge>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Renvoyer">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
