import { useState } from "react";
import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Trash2 } from "lucide-react";

export default function AdminPage() {
  const { params, setParams } = useAppState();
  const [apeScores, setApeScores] = useState(params.apeScores);
  const [paysRisque, setPaysRisque] = useState(params.paysRisque);
  const [missionScores, setMissionScores] = useState(params.missionScores);
  const [seuils, setSeuils] = useState(params.seuils);
  const [malusConfig, setMalusConfig] = useState(params.malus);
  const [saved, setSaved] = useState(false);

  const saveAll = () => {
    setParams({
      ...params,
      apeScores,
      paysRisque,
      missionScores,
      seuils,
      malus: malusConfig,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administration & Paramétrage</h1>
          <p className="text-sm text-muted-foreground mt-1">Tables de référence éditables (PARAM)</p>
        </div>
        <Button onClick={saveAll} className="gap-2">
          <Save className="w-4 h-4" />
          {saved ? "Sauvegardé !" : "Sauvegarder tout"}
        </Button>
      </div>

      <Tabs defaultValue="ape">
        <TabsList className="grid grid-cols-5 w-full max-w-xl">
          <TabsTrigger value="ape">Codes APE</TabsTrigger>
          <TabsTrigger value="pays">Pays risque</TabsTrigger>
          <TabsTrigger value="missions">Missions</TabsTrigger>
          <TabsTrigger value="seuils">Seuils</TabsTrigger>
          <TabsTrigger value="malus">Malus</TabsTrigger>
        </TabsList>

        {/* APE SCORES */}
        <TabsContent value="ape">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Codes APE / NAF — Scores d'activité</CardTitle>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setApeScores([...apeScores, { code: "", score: 25, description: "" }])}>
                <Plus className="w-3 h-3" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Code APE</TableHead>
                      <TableHead className="w-[80px]">Score</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apeScores.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={item.code} onChange={e => { const arr = [...apeScores]; arr[i] = { ...arr[i], code: e.target.value }; setApeScores(arr); }} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.score} onChange={e => { const arr = [...apeScores]; arr[i] = { ...arr[i], score: +e.target.value }; setApeScores(arr); }} className="h-8 text-xs w-16" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.description} onChange={e => { const arr = [...apeScores]; arr[i] = { ...arr[i], description: e.target.value }; setApeScores(arr); }} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setApeScores(apeScores.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYS RISQUE */}
        <TabsContent value="pays">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Pays à risque (GAFI)</CardTitle>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setPaysRisque([...paysRisque, { pays: "", score: 75, categorie: "GRISE" }])}>
                <Plus className="w-3 h-3" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pays</TableHead>
                      <TableHead className="w-[80px]">Score</TableHead>
                      <TableHead className="w-[120px]">Catégorie</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paysRisque.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={item.pays} onChange={e => { const arr = [...paysRisque]; arr[i] = { ...arr[i], pays: e.target.value }; setPaysRisque(arr); }} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.score} onChange={e => { const arr = [...paysRisque]; arr[i] = { ...arr[i], score: +e.target.value }; setPaysRisque(arr); }} className="h-8 text-xs w-16" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.categorie} onChange={e => { const arr = [...paysRisque]; arr[i] = { ...arr[i], categorie: e.target.value }; setPaysRisque(arr); }} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setPaysRisque(paysRisque.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MISSIONS */}
        <TabsContent value="missions">
          <Card>
            <CardHeader><CardTitle className="text-sm">Types de mission — Scores</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mission</TableHead>
                    <TableHead className="w-[80px]">Score</TableHead>
                    <TableHead>Justification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missionScores.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{item.mission}</TableCell>
                      <TableCell>
                        <Input type="number" value={item.score} onChange={e => { const arr = [...missionScores]; arr[i] = { ...arr[i], score: +e.target.value }; setMissionScores(arr); }} className="h-8 text-xs w-16" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.description} onChange={e => { const arr = [...missionScores]; arr[i] = { ...arr[i], description: e.target.value }; setMissionScores(arr); }} className="h-8 text-xs" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEUILS */}
        <TabsContent value="seuils">
          <Card>
            <CardHeader><CardTitle className="text-sm">Seuils de vigilance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SEUIL BAS (Simplifiée &le;)</label>
                  <Input type="number" value={seuils.SEUIL_BAS} onChange={e => setSeuils({ ...seuils, SEUIL_BAS: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SEUIL HAUT (Standard &le;)</label>
                  <Input type="number" value={seuils.SEUIL_HAUT} onChange={e => setSeuils({ ...seuils, SEUIL_HAUT: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SEUIL CRITIQUE (Force Renforcée)</label>
                  <Input type="number" value={seuils.SEUIL_CRITIQUE} onChange={e => setSeuils({ ...seuils, SEUIL_CRITIQUE: +e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Un client avec un score &le; {seuils.SEUIL_BAS} sera en vigilance Simplifiée, entre {seuils.SEUIL_BAS + 1} et {seuils.SEUIL_HAUT} en Standard, au-delà en Renforcée.
                Si un seul axe dépasse {seuils.SEUIL_CRITIQUE}, le dossier passe automatiquement en Renforcée.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MALUS */}
        <TabsContent value="malus">
          <Card>
            <CardHeader><CardTitle className="text-sm">Malus contextuels</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CTX_DISTANCIEL (Relation à distance)</label>
                  <Input type="number" value={malusConfig.CTX_DISTANCIEL} onChange={e => setMalusConfig({ ...malusConfig, CTX_DISTANCIEL: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CTX_CASH (Espèces significatives)</label>
                  <Input type="number" value={malusConfig.CTX_CASH} onChange={e => setMalusConfig({ ...malusConfig, CTX_CASH: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CTX_PRESSION (Pression comportementale)</label>
                  <Input type="number" value={malusConfig.CTX_PRESSION} onChange={e => setMalusConfig({ ...malusConfig, CTX_PRESSION: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">MALUS_ATYPIQUE (Forçage client atypique)</label>
                  <Input type="number" value={malusConfig.MALUS_ATYPIQUE} onChange={e => setMalusConfig({ ...malusConfig, MALUS_ATYPIQUE: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SCORE_PPE (Forçage PPE)</label>
                  <Input type="number" value={malusConfig.SCORE_PPE} onChange={e => setMalusConfig({ ...malusConfig, SCORE_PPE: +e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
