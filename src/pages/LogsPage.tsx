import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LogsPage() {
  const { logs } = useAppState();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">🔒 Journal des Actions</h1>
        <p className="text-sm text-muted-foreground mt-1">Historique automatique de toutes les actions effectuées</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Horodatage</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-mono">{log.horodatage}</TableCell>
                <TableCell className="text-xs">{log.utilisateur}</TableCell>
                <TableCell className="text-xs font-mono">{log.refClient}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    log.typeAction === "CRÉATION" ? "bg-risk-low/10 text-risk-low" :
                    log.typeAction.includes("ERREUR") ? "bg-risk-high/10 text-risk-high" :
                    "bg-primary/10 text-primary"
                  }`}>{log.typeAction}</span>
                </TableCell>
                <TableCell className="text-xs max-w-[300px] truncate">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
