import { useMemo } from "react";
import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, AlertTriangle, Shield, TrendingUp } from "lucide-react";

export default function CartographieRisques() {
  const { clients } = useAppState();

  const stats = useMemo(() => {
    const total = clients.length;
    const simplifiee = clients.filter(c => c.nivVigilance === "SIMPLIFIEE").length;
    const standard = clients.filter(c => c.nivVigilance === "STANDARD").length;
    const renforcee = clients.filter(c => c.nivVigilance === "RENFORCEE").length;
    const avgScore = total > 0 ? Math.round(clients.reduce((s, c) => s + (c.scoreGlobal || 0), 0) / total) : 0;

    // Top risques
    const topRisques = [...clients]
      .sort((a, b) => (b.scoreGlobal || 0) - (a.scoreGlobal || 0))
      .slice(0, 5);

    // PPE count
    const ppeCount = clients.filter(c => c.ppe === "OUI").length;
    const paysRisqueCount = clients.filter(c => c.paysRisque === "OUI").length;

    return { total, simplifiee, standard, renforcee, avgScore, topRisques, ppeCount, paysRisqueCount };
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.simplifiee}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Vigilance simplifiee</p>
            {stats.total > 0 && <p className="text-[10px] text-slate-300 dark:text-slate-600">{Math.round(stats.simplifiee / stats.total * 100)}%</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.standard}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Vigilance standard</p>
            {stats.total > 0 && <p className="text-[10px] text-slate-300 dark:text-slate-600">{Math.round(stats.standard / stats.total * 100)}%</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.renforcee}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Vigilance renforcee</p>
            {stats.total > 0 && <p className="text-[10px] text-slate-300 dark:text-slate-600">{Math.round(stats.renforcee / stats.total * 100)}%</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.avgScore}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Score moyen</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">/120</p>
          </CardContent>
        </Card>
      </div>

      {/* Facteurs de risque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.ppeCount}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Personnes Politiquement Exposees</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.paysRisqueCount}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Pays a risque</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 risques */}
      <Card className="border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-400" />
            Top 5 — Clients a plus haut risque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topRisques.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Aucun client enregistre</p>
          ) : (
            <div className="rounded-md border border-gray-200 dark:border-white/[0.06] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Vigilance</TableHead>
                    <TableHead>PPE</TableHead>
                    <TableHead>Pays risque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topRisques.map(c => (
                    <TableRow key={c.ref}>
                      <TableCell className="font-medium">{c.raisonSociale}</TableCell>
                      <TableCell className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">{c.ref}</TableCell>
                      <TableCell>
                        <span className={`font-bold ${
                          c.scoreGlobal >= 61 ? "text-red-400" :
                          c.scoreGlobal >= 26 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {c.scoreGlobal}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${
                          c.nivVigilance === "RENFORCEE" ? "bg-red-500/15 text-red-400" :
                          c.nivVigilance === "STANDARD" ? "bg-amber-500/15 text-amber-400" :
                          "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {c.nivVigilance}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.ppe === "OUI" ? (
                          <Badge className="bg-purple-500/15 text-purple-400 text-xs">OUI</Badge>
                        ) : <span className="text-xs text-slate-300 dark:text-slate-600">NON</span>}
                      </TableCell>
                      <TableCell>
                        {c.paysRisque === "OUI" ? (
                          <Badge className="bg-orange-500/15 text-orange-400 text-xs">OUI</Badge>
                        ) : <span className="text-xs text-slate-300 dark:text-slate-600">NON</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
