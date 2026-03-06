import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VigilanceBadge } from "@/components/RiskBadges";

export default function ControlePage() {
  const { clients } = useAppState();

  // Weighted random audit: higher risk clients have more chance of being picked
  const auditable = (() => {
    if (clients.length <= 5) return [...clients];
    // Seeded shuffle based on current month for reproducibility within a month
    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth();
    const seededRandom = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };
    const weighted = clients.map((c, i) => ({
      client: c,
      weight: c.scoreGlobal * 2 + seededRandom(i) * 30,
    }));
    return weighted
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(w => w.client);
  })();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔍 Contrôle Qualité Mensuel</h1>
        <p className="text-sm text-muted-foreground mt-1">Tirage aléatoire de dossiers pour contrôle — {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Dossiers tirés au sort ce mois</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {auditable.map(c => (
              <div key={c.ref} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
                  <div>
                    <p className="font-medium text-sm">{c.raisonSociale}</p>
                    <p className="text-xs text-muted-foreground">{c.forme} · {c.siren}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Score</p>
                    <p className="font-mono font-bold">{c.scoreGlobal}</p>
                  </div>
                  <VigilanceBadge level={c.nivVigilance} />
                  <div className="flex gap-1">
                    {c.ppe === "OUI" && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">PPE</span>}
                    {c.paysRisque === "OUI" && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Pays</span>}
                    {c.atypique === "OUI" && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Atypique</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Points de contrôle</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <span className="font-bold text-primary">1</span>
              <span>IDENTITÉ & BÉNÉFICIAIRES EFFECTIFS — Vérifier CNI, KBIS, RBE à jour</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <span className="font-bold text-primary">2</span>
              <span>SCORING & RISQUE — Vérifier cohérence du score, malus, niveau de vigilance</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <span className="font-bold text-primary">3</span>
              <span>DOCUMENTS & CONTRAT — Lettre de mission signée, mandat SEPA, pièces</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
