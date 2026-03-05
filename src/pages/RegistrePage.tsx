import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RegistrePage() {
  const { alertes } = useAppState();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">📒 Registre LCB-FT</h1>
        <p className="text-sm text-muted-foreground mt-1">Registre des alertes, investigations et décisions</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date Butoir</TableHead>
              <TableHead>Décision</TableHead>
              <TableHead>Validateur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alertes.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{a.date}</TableCell>
                <TableCell className="font-medium text-sm">{a.clientConcerne}</TableCell>
                <TableCell className="text-xs">{a.categorie}</TableCell>
                <TableCell className="text-xs">{a.actionPrise}</TableCell>
                <TableCell className="text-xs">{a.responsable}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    a.statut === "CLÔTURÉ" ? "bg-risk-low/10 text-risk-low" :
                    "bg-risk-medium/10 text-risk-medium"
                  }`}>{a.statut}</span>
                </TableCell>
                <TableCell className="text-xs">{a.dateButoir}</TableCell>
                <TableCell className="text-xs">{a.typeDecision}</TableCell>
                <TableCell className="text-xs">{a.validateur}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
