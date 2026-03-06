import { useAppState } from "@/lib/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shield, AlertTriangle, Users, TrendingUp } from "lucide-react";

const COLORS_VIG = { SIMPLIFIEE: "#22c55e", STANDARD: "#eab308", RENFORCEE: "#ef4444" };
const COLORS_PIL = { "A JOUR": "#22c55e", "RETARD": "#ef4444", "BIENTÔT": "#f97316" };

export default function DashboardPage() {
  const { clients, collaborateurs, alertes } = useAppState();

  const totalClients = clients.length;
  const safeTotal = totalClients || 1;
  const vigCounts = clients.reduce((acc, c) => {
    acc[c.nivVigilance] = (acc[c.nivVigilance] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pilCounts = clients.reduce((acc, c) => {
    acc[c.etatPilotage] = (acc[c.etatPilotage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const vigData = Object.entries(vigCounts).map(([name, value]) => ({ name, value }));
  const pilData = Object.entries(pilCounts).map(([name, value]) => ({ name, value }));

  // Score moyen par critère
  const avgScores = [
    { name: "Activité", score: Math.round(clients.reduce((s, c) => s + c.scoreActivite, 0) / safeTotal) },
    { name: "Pays", score: Math.round(clients.reduce((s, c) => s + c.scorePays, 0) / safeTotal) },
    { name: "Mission", score: Math.round(clients.reduce((s, c) => s + c.scoreMission, 0) / safeTotal) },
    { name: "Maturité", score: Math.round(clients.reduce((s, c) => s + c.scoreMaturite, 0) / safeTotal) },
    { name: "Structure", score: Math.round(clients.reduce((s, c) => s + c.scoreStructure, 0) / safeTotal) },
  ];

  const scoreGlobalMoyen = Math.round(clients.reduce((s, c) => s + c.scoreGlobal, 0) / safeTotal);

  // Comptable distribution
  const comptableData = Object.entries(
    clients.reduce((acc, c) => {
      acc[c.comptable] = (acc[c.comptable] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const retardCount = pilCounts["RETARD"] || 0;
  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS").length;
  const formationKo = collaborateurs.filter(c => c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 Tableau de Bord LCB-FT</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d'ensemble du dispositif de vigilance du cabinet</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clients actifs</p>
                <p className="text-3xl font-bold mt-1">{totalClients}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score cabinet moyen</p>
                <p className="text-3xl font-bold mt-1">{scoreGlobalMoyen}<span className="text-base font-normal text-muted-foreground">/100</span></p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-risk-medium/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-risk-medium" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dossiers en retard</p>
                <p className="text-3xl font-bold mt-1 text-destructive">{retardCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes en cours</p>
                <p className="text-3xl font-bold mt-1">{alertesEnCours}</p>
                {formationKo > 0 && (
                  <p className="text-xs text-destructive mt-1">🔴 {formationKo} formation(s) à revoir</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-risk-high/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-risk-high" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vigilance Pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Répartition par Vigilance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={vigData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {vigData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS_VIG[entry.name as keyof typeof COLORS_VIG] || "#888"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pilotage Pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">État de Pilotage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pilData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {pilData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS_PIL[entry.name as keyof typeof COLORS_PIL] || "#888"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score par critère */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Score Moyen par Critère</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avgScores} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="score" fill="hsl(220, 60%, 30%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Répartition comptables */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Répartition par Comptable</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comptableData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Clients" fill="hsl(210, 60%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
