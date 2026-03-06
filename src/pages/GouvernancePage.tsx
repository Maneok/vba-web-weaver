import { useAppState } from "@/lib/AppContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GouvernancePage() {
  const { collaborateurs } = useAppState();

  const formesOk = collaborateurs.filter(c => c.statutFormation.includes("A JOUR")).length;
  const formesKo = collaborateurs.filter(c => c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">👥 Gouvernance LCB-FT</h1>
        <p className="text-sm text-muted-foreground mt-1">Suivi de l'équipe et des formations obligatoires</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{collaborateurs.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Collaborateurs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-risk-low">{formesOk}</p>
            <p className="text-sm text-muted-foreground mt-1">Formations à jour</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-risk-high">{formesKo}</p>
            <p className="text-sm text-muted-foreground mt-1">À former / relancer</p>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Collaborateur</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead className="text-center">Réf. LCB</TableHead>
              <TableHead>Suppléant</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Signature Manuel</TableHead>
              <TableHead>Dernière Formation</TableHead>
              <TableHead>Statut Formation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collaborateurs.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{c.nom}</TableCell>
                <TableCell className="text-xs">{c.fonction}</TableCell>
                <TableCell className="text-center">{c.referentLcb ? "🔑 OUI" : ""}</TableCell>
                <TableCell className="text-xs">{c.suppleant}</TableCell>
                <TableCell className="text-xs">{c.niveauCompetence}</TableCell>
                <TableCell className="text-xs">{c.dateSignatureManuel}</TableCell>
                <TableCell className="text-xs">{c.derniereFormation || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    c.statutFormation.includes("A JOUR") ? "bg-risk-low/10 text-risk-low" :
                    c.statutFormation.includes("FORMER") ? "bg-risk-high/10 text-risk-high" :
                    "bg-risk-medium/10 text-risk-medium"
                  }`}>
                    {c.statutFormation}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
